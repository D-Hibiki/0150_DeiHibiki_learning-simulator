import { describe, expect, it } from "vitest";
import { runAgentWorldExperiment } from "./experiment";
import {
  DEFAULT_AGENT_WORLD_CONFIG,
  type CitizenAction,
  type CitizenDecisionProvider,
  type CitizenObservation,
  type AgentNetwork,
  type WorldVariant,
} from "./protocol";

function decide(observation: CitizenObservation): CitizenAction {
  const receivedSignal = observation.receivedMessages.at(0)?.channelSignal;
  const remembered = observation.memories.at(-1)?.channel;
  return {
    citizenId: observation.citizen.id,
    tick: observation.tick,
    channel: receivedSignal ?? remembered ?? "digital",
    effort: 1,
    message: observation.neighborStates[0] ? {
      recipientId: observation.neighborStates[0].citizenId,
      channelSignal: "paper",
      strength: 1,
    } : null,
  };
}

describe("Agent World experiment", () => {
  it("runs full, no-interaction, no-memory, and rule baseline from paired initial state", async () => {
    const calls = new Map<WorldVariant, number>();
    const result = await runAgentWorldExperiment({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 4,
      tickCount: 3,
    }, {
      policyFactory: (variant): CitizenDecisionProvider => ({
        decide: (observation) => {
          calls.set(variant, (calls.get(variant) ?? 0) + 1);
          return decide(observation);
        },
      }),
    });

    expect(Object.keys(result.byVariant).sort()).toEqual([
      "full",
      "no-interaction",
      "no-memory",
      "rule-baseline",
    ]);
    const variants = Object.values(result.byVariant);
    for (const variant of variants.slice(1)) {
      expect(variant.initialCitizens).toEqual(variants[0].initialCitizens);
      expect(variant.network).toEqual(variants[0].network);
    }
    expect(calls.get("full")).toBe(12);
    expect(calls.get("no-interaction")).toBe(12);
    expect(calls.get("no-memory")).toBe(12);
    expect(calls.has("rule-baseline")).toBe(false);
  });

  it("samples an injected network provider once so every ablation is paired", async () => {
    let networkCalls = 0;
    const result = await runAgentWorldExperiment({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 4,
      tickCount: 1,
    }, {
      networkProvider: {
        create: (): AgentNetwork => {
          networkCalls += 1;
          return {
            citizenIds: [0, 1, 2, 3],
            clusterByCitizen: { 0: 0, 1: 0, 2: 1, 3: 1 },
            edges: [
              { source: 0, target: 1, weight: networkCalls },
              { source: 2, target: 3, weight: networkCalls },
            ],
            neighborsByCitizen: { 0: [1], 1: [0], 2: [3], 3: [2] },
          };
        },
      },
    });

    expect(networkCalls).toBe(1);
    expect(new Set(Object.values(result.byVariant).map((variant) => JSON.stringify(variant.network))).size).toBe(1);
  });

  it("suppresses interaction and memory only in their named ablations", async () => {
    const observations = new Map<WorldVariant, CitizenObservation[]>();
    const result = await runAgentWorldExperiment({
      ...DEFAULT_AGENT_WORLD_CONFIG,
      citizenCount: 4,
      tickCount: 3,
    }, {
      policyFactory: (variant) => ({
        decide: (observation) => {
          const current = observations.get(variant) ?? [];
          current.push(structuredClone(observation));
          observations.set(variant, current);
          return decide(observation);
        },
      }),
    });

    expect(observations.get("full")!.some((item) => item.tick > 1 && item.receivedMessages.length > 0)).toBe(true);
    expect(observations.get("no-interaction")!.every((item) => item.receivedMessages.length === 0 && item.neighborStates.length === 0)).toBe(true);
    expect(observations.get("no-memory")!.every((item) => item.memories.length === 0)).toBe(true);
    expect(result.byVariant["no-memory"].finalCitizens.every((citizen) => citizen.memories.length === 0)).toBe(true);
    expect(result.byVariant.full.finalCitizens.some((citizen) => citizen.memories.length > 0)).toBe(true);
  });
});
