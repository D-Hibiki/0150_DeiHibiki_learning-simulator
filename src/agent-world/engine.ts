import { xoroshiro128plus, type RandomGenerator } from "pure-rand";
import {
  AGENT_WORLD_VERSION,
  type ActionLogEntry,
  type AgentMessage,
  type AgentNetwork,
  type AgentWorldConfig,
  type AgentWorldResult,
  type CitizenAction,
  type CitizenChannel,
  type CitizenDecisionProvider,
  type CitizenMemory,
  type CitizenObservation,
  type CitizenSnapshot,
  type CitizenState,
  type NetworkProvider,
  type TickMetrics,
  type WorldEnvironment,
  type WorldVariant,
  cloneAgentWorldConfig,
  validateAgentWorldConfig,
} from "./protocol";

const UINT32_RANGE = 0x1_0000_0000;
const CHANNELS = new Set<CitizenChannel>(["paper", "digital", "hybrid", "pause"]);

export type RunAgentWorldOptions = {
  variant?: WorldVariant;
  policy?: CitizenDecisionProvider;
  networkProvider?: NetworkProvider;
  onProgress?: (progress: { tick: number; totalTicks: number; citizenId: number }) => void;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function nextUnit(generator: RandomGenerator): number {
  return (generator.unsafeNext() >>> 0) / UINT32_RANGE;
}

function cloneCitizen(citizen: CitizenState): CitizenState {
  return {
    ...citizen,
    memories: citizen.memories.map((memory) => ({ ...memory })),
  };
}

function cloneNetwork(network: AgentNetwork): AgentNetwork {
  return {
    citizenIds: [...network.citizenIds],
    clusterByCitizen: { ...network.clusterByCitizen },
    edges: network.edges.map((edge) => ({ ...edge })),
    neighborsByCitizen: Object.fromEntries(
      Object.entries(network.neighborsByCitizen).map(([id, neighbors]) => [id, [...neighbors]]),
    ),
  };
}

function cloneAction(action: CitizenAction): CitizenAction {
  return {
    ...action,
    message: action.message === null ? null : { ...action.message },
  };
}

function cloneMessage(message: AgentMessage): AgentMessage {
  return { ...message };
}

function snapshotCitizen(citizen: CitizenState): CitizenSnapshot {
  const { memories: _memories, ...snapshot } = citizen;
  return { ...snapshot };
}

function addUndirectedEdge(
  edgeKeys: Set<string>,
  edges: AgentNetwork["edges"],
  neighbors: Record<number, number[]>,
  left: number,
  right: number,
  weight: number,
): void {
  if (left === right) return;
  const source = Math.min(left, right);
  const target = Math.max(left, right);
  const key = `${source}:${target}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push({ source, target, weight });
  neighbors[source].push(target);
  neighbors[target].push(source);
}

/**
 * Creates a deterministic clustered graph without coupling the engine to a graph library.
 * A provider can replace this implementation while keeping the same protocol boundary.
 */
export function createClusteredNetwork(config: AgentWorldConfig): AgentNetwork {
  validateAgentWorldConfig(config);
  const generator = xoroshiro128plus(config.worldSeed | 0);
  const shuffledIds = Array.from({ length: config.citizenCount }, (_, id) => id);
  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextUnit(generator) * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
  }

  const clusters = Array.from({ length: config.network.clusterCount }, () => [] as number[]);
  shuffledIds.forEach((citizenId, index) => clusters[index % clusters.length].push(citizenId));
  const clusterByCitizen: Record<number, number> = {};
  clusters.forEach((cluster, clusterId) => {
    for (const citizenId of cluster) clusterByCitizen[citizenId] = clusterId;
  });

  const neighborsByCitizen = Object.fromEntries(
    shuffledIds.map((citizenId) => [citizenId, [] as number[]]),
  ) as Record<number, number[]>;
  const edges: AgentNetwork["edges"] = [];
  const edgeKeys = new Set<string>();

  for (const cluster of clusters) {
    if (cluster.length === 2) {
      addUndirectedEdge(edgeKeys, edges, neighborsByCitizen, cluster[0], cluster[1], 1);
    } else if (cluster.length > 2) {
      for (let index = 0; index < cluster.length; index += 1) {
        addUndirectedEdge(
          edgeKeys,
          edges,
          neighborsByCitizen,
          cluster[index],
          cluster[(index + 1) % cluster.length],
          1,
        );
      }
    }
  }

  for (let index = 1; index < clusters.length; index += 1) {
    addUndirectedEdge(edgeKeys, edges, neighborsByCitizen, clusters[index - 1][0], clusters[index][0], 0.5);
  }

  edges.sort((left, right) => left.source - right.source || left.target - right.target);
  for (const neighbors of Object.values(neighborsByCitizen)) neighbors.sort((left, right) => left - right);

  return {
    citizenIds: Array.from({ length: config.citizenCount }, (_, id) => id),
    clusterByCitizen,
    edges,
    neighborsByCitizen,
  };
}

function validateNetwork(network: AgentNetwork, citizenCount: number): void {
  const expectedIds = Array.from({ length: citizenCount }, (_, id) => id);
  const actualIds = [...network.citizenIds].sort((left, right) => left - right);
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new RangeError("network citizenIds must contain every citizen exactly once");
  }
  for (const citizenId of expectedIds) {
    if (!Number.isInteger(network.clusterByCitizen[citizenId])) {
      throw new RangeError(`network is missing cluster assignment for citizen ${citizenId}`);
    }
    const neighbors = network.neighborsByCitizen[citizenId];
    if (!Array.isArray(neighbors) || new Set(neighbors).size !== neighbors.length) {
      throw new RangeError(`network has invalid neighbors for citizen ${citizenId}`);
    }
    for (const neighborId of neighbors) {
      if (neighborId === citizenId || !expectedIds.includes(neighborId)) {
        throw new RangeError(`network has invalid neighbor ${neighborId} for citizen ${citizenId}`);
      }
      if (!network.neighborsByCitizen[neighborId]?.includes(citizenId)) {
        throw new RangeError("network neighbors must be symmetric");
      }
    }
  }
  for (const edge of network.edges) {
    if (edge.source === edge.target
      || !expectedIds.includes(edge.source)
      || !expectedIds.includes(edge.target)
      || !Number.isFinite(edge.weight)
      || edge.weight < 0) {
      throw new RangeError("network contains an invalid edge");
    }
    if (!network.neighborsByCitizen[edge.source]?.includes(edge.target)
      || !network.neighborsByCitizen[edge.target]?.includes(edge.source)) {
      throw new RangeError("network edges and neighbor index disagree");
    }
  }
}

function initializeCitizens(config: AgentWorldConfig): CitizenState[] {
  const generator = xoroshiro128plus((config.worldSeed ^ 0x6d2b79f5) | 0);
  return Array.from({ length: config.citizenCount }, (_, id) => {
    const paperPreference = nextUnit(generator);
    const digitalPreference = nextUnit(generator);
    return {
      id,
      paperPreference,
      digitalPreference,
      adaptability: nextUnit(generator),
      socialSusceptibility: nextUnit(generator),
      resourceConstraint: nextUnit(generator),
      channel: paperPreference >= digitalPreference ? "paper" : "digital",
      lastOpportunityScore: 0,
      lastAccessSucceeded: false,
      continuityTicks: 0,
      cumulativeOpportunityScore: 0,
      memories: [],
    };
  });
}

function channelQuality(channel: CitizenChannel, environment: WorldEnvironment): number {
  const paper = environment.paperAvailability * environment.paperFreshness;
  const digital = environment.digitalAvailability * environment.digitalFreshness;
  if (channel === "paper") return paper;
  if (channel === "digital") return digital;
  if (channel === "hybrid") return Math.max(paper, digital);
  return 0;
}

export function ruleDecision(observation: CitizenObservation): CitizenAction {
  const citizen = observation.citizen;
  const paperValue = citizen.paperPreference
    * observation.environment.paperAvailability
    * observation.environment.paperFreshness;
  const digitalValue = citizen.digitalPreference
    * observation.environment.digitalAvailability
    * observation.environment.digitalFreshness;
  const socialSignals = observation.receivedMessages.reduce(
    (signals, message) => {
      if (message.channelSignal === "paper") signals.paper += message.strength;
      if (message.channelSignal === "digital") signals.digital += message.strength;
      return signals;
    },
    { paper: 0, digital: 0 },
  );
  const socialWeight = citizen.socialSusceptibility * 0.2;
  const paperScore = paperValue + socialSignals.paper * socialWeight;
  const digitalScore = digitalValue + socialSignals.digital * socialWeight;
  const channel: CitizenChannel = Math.abs(paperScore - digitalScore) <= citizen.adaptability * 0.1
    ? "hybrid"
    : paperScore >= digitalScore ? "paper" : "digital";
  const effort = clamp01(1 - citizen.resourceConstraint * 0.35);
  const recipientId = observation.neighborStates[0]?.citizenId;
  return {
    citizenId: citizen.id,
    tick: observation.tick,
    channel,
    effort,
    message: recipientId === undefined ? null : {
      recipientId,
      channelSignal: channel,
      strength: clamp01(0.5 + citizen.socialSusceptibility * 0.5),
    },
  };
}

function validateAction(
  action: CitizenAction,
  citizenId: number,
  tick: number,
  network: AgentNetwork,
): void {
  if (typeof action !== "object" || action === null || Array.isArray(action)
    || Object.keys(action).sort().join(",") !== "channel,citizenId,effort,message,tick") {
    throw new RangeError("action schema is invalid");
  }
  if (action.citizenId !== citizenId || action.tick !== tick) {
    throw new RangeError(`action identity mismatch for citizen ${citizenId} at tick ${tick}`);
  }
  if (!CHANNELS.has(action.channel)) throw new RangeError("action channel is invalid");
  if (!Number.isFinite(action.effort) || action.effort < 0 || action.effort > 1) {
    throw new RangeError("action effort must be from 0 to 1");
  }
  if (action.message === null) return;
  if (typeof action.message !== "object" || Array.isArray(action.message)
    || Object.keys(action.message).sort().join(",") !== "channelSignal,recipientId,strength") {
    throw new RangeError("message schema is invalid");
  }
  if (!network.neighborsByCitizen[citizenId].includes(action.message.recipientId)) {
    throw new RangeError("messages may only target a network neighbor");
  }
  if (!CHANNELS.has(action.message.channelSignal)
    || !Number.isFinite(action.message.strength)
    || action.message.strength < 0
    || action.message.strength > 1) {
    throw new RangeError("message signal or strength is invalid");
  }
}

function makeTickMetrics(
  tick: number,
  environment: WorldEnvironment,
  citizens: CitizenState[],
  messagesSent: number,
): TickMetrics {
  const channelCounts: TickMetrics["channelCounts"] = { paper: 0, digital: 0, hybrid: 0, pause: 0 };
  let successCount = 0;
  let opportunityScoreSum = 0;
  for (const citizen of citizens) {
    channelCounts[citizen.channel] += 1;
    if (citizen.lastAccessSucceeded) successCount += 1;
    opportunityScoreSum += citizen.lastOpportunityScore;
  }
  return {
    tick,
    environment: { ...environment },
    channelCounts,
    opportunityRate: successCount / citizens.length,
    meanOpportunityScore: opportunityScoreSum / citizens.length,
    messagesSent,
  };
}

export async function runAgentWorld(
  suppliedConfig: AgentWorldConfig,
  options: RunAgentWorldOptions = {},
): Promise<AgentWorldResult> {
  validateAgentWorldConfig(suppliedConfig);
  const config = cloneAgentWorldConfig(suppliedConfig);
  const variant = options.variant ?? "full";
  const network = cloneNetwork((options.networkProvider ?? { create: createClusteredNetwork }).create(config));
  validateNetwork(network, config.citizenCount);

  let citizens = initializeCitizens(config);
  const initialCitizens = citizens.map(cloneCitizen);
  let environment = { ...config.environment };
  let pendingMessages: AgentMessage[] = [];
  const actionLog: ActionLogEntry[] = [];
  const tickMetrics: TickMetrics[] = [];
  const allowInteraction = variant !== "no-interaction";
  const allowMemory = variant !== "no-memory";
  const policy = variant === "rule-baseline" ? undefined : options.policy;

  for (let tick = 1; tick <= config.tickCount; tick += 1) {
    for (const event of config.environmentEvents.filter((candidate) => candidate.tick === tick)) {
      environment = { ...environment, ...event.patch };
    }
    const preCommitCitizens = citizens.map(cloneCitizen);
    const preCommitById = new Map(preCommitCitizens.map((citizen) => [citizen.id, citizen]));
    const deliveredMessages = allowInteraction
      ? pendingMessages.filter((message) => message.deliverTick === tick)
      : [];

    const observations = preCommitCitizens.map((citizen): CitizenObservation => ({
      tick,
      citizen: snapshotCitizen(citizen),
      environment: { ...environment },
      neighborStates: allowInteraction
        ? network.neighborsByCitizen[citizen.id].map((neighborId) => {
          const neighbor = preCommitById.get(neighborId);
          if (!neighbor) throw new Error(`network neighbor ${neighborId} was not initialized`);
          return {
            citizenId: neighbor.id,
            channel: neighbor.channel,
            lastOpportunityScore: neighbor.lastOpportunityScore,
            lastAccessSucceeded: neighbor.lastAccessSucceeded,
          };
        })
        : [],
      receivedMessages: allowInteraction
        ? deliveredMessages.filter((message) => message.recipientId === citizen.id).map(cloneMessage)
        : [],
      memories: allowMemory ? citizen.memories.map((memory) => ({ ...memory })) : [],
    }));

    const decisions: CitizenAction[] = [];
    for (const observation of observations) {
      const action = await (policy?.decide(observation) ?? ruleDecision(observation));
      validateAction(action, observation.citizen.id, tick, network);
      decisions.push(cloneAction(action));
      options.onProgress?.({ tick, totalTicks: config.tickCount, citizenId: observation.citizen.id });
    }

    const nextMessages: AgentMessage[] = [];
    let messagesSent = 0;
    citizens = preCommitCitizens.map((citizen, index) => {
      const action = decisions[index];
      const opportunityScore = clamp01(channelQuality(action.channel, environment) * action.effort);
      const accessSucceeded = opportunityScore >= config.opportunityThreshold;
      const receivedMessageCount = observations[index].receivedMessages.length;
      const memory: CitizenMemory = {
        citizenId: citizen.id,
        tick,
        channel: action.channel,
        opportunityScore,
        accessSucceeded,
        receivedMessageCount,
      };
      const memories = allowMemory && config.memoryLimit > 0
        ? [...citizen.memories, memory].slice(-config.memoryLimit)
        : [];
      if (allowInteraction && action.message !== null) {
        nextMessages.push({
          messageId: `${tick}:${citizen.id}:${action.message.recipientId}`,
          sourceId: citizen.id,
          recipientId: action.message.recipientId,
          sentTick: tick,
          deliverTick: tick + 1,
          channelSignal: action.message.channelSignal,
          strength: action.message.strength,
        });
        messagesSent += 1;
      }
      actionLog.push({
        tick,
        citizenId: citizen.id,
        action: cloneAction(action),
        opportunityScore,
        accessSucceeded,
      });
      return {
        ...citizen,
        channel: action.channel,
        lastOpportunityScore: opportunityScore,
        lastAccessSucceeded: accessSucceeded,
        continuityTicks: accessSucceeded ? citizen.continuityTicks + 1 : 0,
        cumulativeOpportunityScore: citizen.cumulativeOpportunityScore + opportunityScore,
        memories,
      };
    });

    pendingMessages = nextMessages;
    tickMetrics.push(makeTickMetrics(tick, environment, citizens, messagesSent));
  }

  return {
    worldVersion: AGENT_WORLD_VERSION,
    variant,
    configSnapshot: cloneAgentWorldConfig(config),
    network: cloneNetwork(network),
    initialCitizens,
    finalCitizens: citizens.map(cloneCitizen),
    actionLog,
    tickMetrics,
  };
}

function indexReplayLog(config: AgentWorldConfig, actionLog: ActionLogEntry[]): Map<string, ActionLogEntry> {
  const expectedLength = config.citizenCount * config.tickCount;
  if (actionLog.length !== expectedLength) {
    throw new RangeError(`replay log must contain exactly ${expectedLength} actions`);
  }
  const indexed = new Map<string, ActionLogEntry>();
  for (const entry of actionLog) {
    const key = `${entry.tick}:${entry.citizenId}`;
    if (indexed.has(key)) throw new RangeError(`replay log contains duplicate action ${key}`);
    indexed.set(key, entry);
  }
  return indexed;
}

export async function replayAgentWorld(
  recorded: AgentWorldResult,
): Promise<AgentWorldResult> {
  if (recorded.worldVersion !== AGENT_WORLD_VERSION) {
    throw new RangeError("replay worldVersion does not match this engine");
  }
  const config = recorded.configSnapshot;
  const recordedActionLog = recorded.actionLog;
  validateAgentWorldConfig(config);
  validateNetwork(recorded.network, config.citizenCount);
  const indexed = indexReplayLog(config, recordedActionLog);
  const replayed = await runAgentWorld(config, {
    variant: recorded.variant,
    networkProvider: { create: () => cloneNetwork(recorded.network) },
    policy: {
      decide: (observation) => {
        const entry = indexed.get(`${observation.tick}:${observation.citizen.id}`);
        if (!entry) throw new RangeError("replay log is incomplete");
        return cloneAction(entry.action);
      },
    },
  });
  if (replayed.actionLog.some((entry, index) => {
    const recorded = recordedActionLog[index];
    return entry.tick !== recorded.tick
      || entry.citizenId !== recorded.citizenId
      || entry.opportunityScore !== recorded.opportunityScore
      || entry.accessSucceeded !== recorded.accessSucceeded
      || JSON.stringify(entry.action) !== JSON.stringify(recorded.action);
  })) {
    throw new Error("replay verification failed: recorded outcomes do not match the engine");
  }
  if (JSON.stringify(replayed.network) !== JSON.stringify(recorded.network)
    || JSON.stringify(replayed.tickMetrics) !== JSON.stringify(recorded.tickMetrics)
    || JSON.stringify(replayed.finalCitizens) !== JSON.stringify(recorded.finalCitizens)) {
    throw new Error("replay verification failed: recorded world context does not match the engine");
  }
  return replayed;
}
