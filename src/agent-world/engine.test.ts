import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_WORLD_CONFIG,
  type AgentNetwork,
  type CitizenAction,
  type CitizenDecisionProvider,
  type CitizenObservation,
  type NetworkProvider,
} from "./protocol";
import {
  createClusteredNetwork,
  replayAgentWorld,
  runAgentWorld,
} from "./engine";
import { graphologyNetworkProvider } from "./graphology-network";

function actionFor(observation: CitizenObservation, patch: Partial<CitizenAction> = {}): CitizenAction {
  return {
    citizenId: observation.citizen.id,
    tick: observation.tick,
    channel: "digital",
    effort: 1,
    message: null,
    ...patch,
  };
}

describe("Agent World protocol defaults", () => {
  it("starts with eight anonymous citizens and twelve ticks", () => {
    expect(DEFAULT_AGENT_WORLD_CONFIG.citizenCount).toBe(8);
    expect(DEFAULT_AGENT_WORLD_CONFIG.tickCount).toBe(12);
  });
});

describe("clustered network", () => {
  it("is seeded, static, symmetric, and has no self edges", () => {
    const first = createClusteredNetwork(DEFAULT_AGENT_WORLD_CONFIG);
    const same = createClusteredNetwork(DEFAULT_AGENT_WORLD_CONFIG);
    const different = createClusteredNetwork({ ...DEFAULT_AGENT_WORLD_CONFIG, worldSeed: 99 });

    expect(first).toEqual(same);
    expect(first).not.toEqual(different);
    expect(first.edges.length).toBeGreaterThan(0);
    for (const edge of first.edges) {
      expect(edge.source).not.toBe(edge.target);
      expect(first.neighborsByCitizen[edge.source]).toContain(edge.target);
      expect(first.neighborsByCitizen[edge.target]).toContain(edge.source);
    }
  });

  it("allows a network provider to be injected", async () => {
    const network: AgentNetwork = {
      citizenIds: [0, 1],
      clusterByCitizen: { 0: 0, 1: 0 },
      edges: [{ source: 0, target: 1, weight: 1 }],
      neighborsByCitizen: { 0: [1], 1: [0] },
    };
    const provider: NetworkProvider = { create: () => network };
    const result = await runAgentWorld({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 2,
      tickCount: 1,
      network: { clusterCount: 1 },
    }, { networkProvider: provider });

    expect(result.network).toEqual(network);
  });
});

describe("tick engine", () => {
  it("delivers messages one tick later", async () => {
    const observations: CitizenObservation[] = [];
    const provider: CitizenDecisionProvider = {
      decide: (observation) => {
        observations.push(structuredClone(observation));
        const recipientId = observation.neighborStates.at(0)?.citizenId;
        return actionFor(observation, {
          message: recipientId === undefined ? null : {
            recipientId,
            channelSignal: "digital",
            strength: 1,
          },
        });
      },
    };

    await runAgentWorld({ ...DEFAULT_AGENT_WORLD_CONFIG, citizenCount: 4, tickCount: 2 }, { policy: provider });

    expect(observations.filter((item) => item.tick === 1).every((item) => item.receivedMessages.length === 0)).toBe(true);
    expect(observations.filter((item) => item.tick === 2).some((item) => item.receivedMessages.length > 0)).toBe(true);
  });

  it("collects every decision before committing any action", async () => {
    const tickOneObservations: CitizenObservation[] = [];
    const provider: CitizenDecisionProvider = {
      decide: (observation) => {
        if (observation.tick === 1) tickOneObservations.push(structuredClone(observation));
        return actionFor(observation, { channel: "digital" });
      },
    };

    const result = await runAgentWorld({ ...DEFAULT_AGENT_WORLD_CONFIG, tickCount: 1 }, { policy: provider });
    const initialChannels = new Map(result.initialCitizens.map((citizen) => [citizen.id, citizen.channel]));

    for (const observation of tickOneObservations) {
      for (const neighbor of observation.neighborStates) {
        expect(neighbor.channel).toBe(initialChannels.get(neighbor.citizenId));
      }
    }
  });

  it("keeps memories isolated and bounded per citizen", async () => {
    const provider: CitizenDecisionProvider = {
      decide: (observation) => {
        const mutable = observation.memories as unknown as Array<unknown>;
        mutable.push({ injected: true });
        return actionFor(observation);
      },
    };
    const result = await runAgentWorld({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      tickCount: 4,
      memoryLimit: 2,
    }, { policy: provider });

    for (const citizen of result.finalCitizens) {
      expect(citizen.memories).toHaveLength(2);
      expect(citizen.memories.every((memory) => memory.citizenId === citizen.id)).toBe(true);
      expect(citizen.memories.map((memory) => memory.tick)).toEqual([3, 4]);
    }
  });

  it("replays a recorded action log without calling the decision provider", async () => {
    const provider: CitizenDecisionProvider = {
      decide: (observation) => actionFor(observation, {
        channel: observation.tick % 2 === 0 ? "paper" : "digital",
      }),
    };
    const config = { ...DEFAULT_AGENT_WORLD_CONFIG, citizenCount: 4, tickCount: 3 };
    const original = await runAgentWorld(config, {
      policy: provider,
      networkProvider: graphologyNetworkProvider,
    });
    const replayed = await replayAgentWorld(original);

    expect(replayed.actionLog).toEqual(original.actionLog);
    expect(replayed.tickMetrics).toEqual(original.tickMetrics);
    expect(replayed.finalCitizens).toEqual(original.finalCitizens);
    expect(replayed.network).toEqual(original.network);
  });

  it("validates ignored messages before suppressing delivery", async () => {
    const invalidProvider: CitizenDecisionProvider = {
      decide: (observation) => actionFor(observation, {
        message: {
          recipientId: 9999,
          channelSignal: "digital",
          strength: 2,
        },
      }),
    };

    await expect(runAgentWorld({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 4,
      tickCount: 1,
    }, { variant: "no-interaction", policy: invalidProvider })).rejects.toThrow(/message/);
  });

  it("rejects unknown action fields at the engine boundary", async () => {
    const invalidProvider: CitizenDecisionProvider = {
      decide: (observation) => ({
        ...actionFor(observation),
        injected: "ignored",
      } as CitizenAction),
    };

    await expect(runAgentWorld({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 4,
      tickCount: 1,
    }, { policy: invalidProvider })).rejects.toThrow(/action schema/);
  });
});
