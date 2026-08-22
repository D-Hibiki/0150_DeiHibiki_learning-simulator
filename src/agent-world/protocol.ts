export const AGENT_WORLD_VERSION = "0.1.0" as const;
export const AGENT_WORLD_INFERENCE_SEED_STREAM = "inference/v1/world-citizen-tick" as const;

export function deriveInferenceSeedBase(worldSeed: number): number {
  if (!Number.isInteger(worldSeed) || worldSeed < 0 || worldSeed > 0xffff_ffff) {
    throw new RangeError("worldSeed must be an unsigned 32-bit integer");
  }
  return (worldSeed ^ 0xa5a5_a5a5) >>> 0;
}

export function deriveInferenceSeed(worldSeed: number, citizenId: number, tick: number): number {
  if (!Number.isInteger(citizenId) || citizenId < 0 || citizenId > 999) {
    throw new RangeError("citizenId must be an integer from 0 to 999");
  }
  if (!Number.isInteger(tick) || tick < 1 || tick > 1_000) {
    throw new RangeError("tick must be an integer from 1 to 1000");
  }
  return (
    deriveInferenceSeedBase(worldSeed)
    + Math.imul(citizenId + 1, 0x9e37_79b1)
    + Math.imul(tick, 0x85eb_ca6b)
  ) >>> 0;
}

export type WorldVariant = "full" | "no-interaction" | "no-memory" | "rule-baseline";
export type CitizenChannel = "paper" | "digital" | "hybrid" | "pause";

export type WorldEnvironment = {
  paperAvailability: number;
  digitalAvailability: number;
  paperFreshness: number;
  digitalFreshness: number;
};

export type EnvironmentEvent = {
  eventId: string;
  tick: number;
  patch: Partial<WorldEnvironment>;
};

export type AgentWorldConfig = {
  schemaVersion: "agent-world/0.1";
  citizenCount: number;
  tickCount: number;
  worldSeed: number;
  memoryLimit: number;
  opportunityThreshold: number;
  environment: WorldEnvironment;
  environmentEvents: EnvironmentEvent[];
  network: {
    clusterCount: number;
  };
};

export const DEFAULT_AGENT_WORLD_CONFIG: AgentWorldConfig = {
  schemaVersion: "agent-world/0.1",
  citizenCount: 8,
  tickCount: 12,
  worldSeed: 12345,
  memoryLimit: 8,
  opportunityThreshold: 0.5,
  environment: {
    paperAvailability: 1,
    digitalAvailability: 1,
    paperFreshness: 1,
    digitalFreshness: 1,
  },
  environmentEvents: [],
  network: {
    clusterCount: 2,
  },
};

export type CitizenMemory = {
  citizenId: number;
  tick: number;
  channel: CitizenChannel;
  opportunityScore: number;
  accessSucceeded: boolean;
  receivedMessageCount: number;
};

export type CitizenState = {
  id: number;
  paperPreference: number;
  digitalPreference: number;
  adaptability: number;
  socialSusceptibility: number;
  resourceConstraint: number;
  channel: CitizenChannel;
  lastOpportunityScore: number;
  lastAccessSucceeded: boolean;
  continuityTicks: number;
  cumulativeOpportunityScore: number;
  memories: CitizenMemory[];
};

export type CitizenSnapshot = Omit<CitizenState, "memories">;

export type NetworkEdge = {
  source: number;
  target: number;
  weight: number;
};

export type AgentNetwork = {
  citizenIds: number[];
  clusterByCitizen: Record<number, number>;
  edges: NetworkEdge[];
  neighborsByCitizen: Record<number, number[]>;
};

export type NetworkProvider = {
  create: (config: AgentWorldConfig) => AgentNetwork;
};

export type AgentMessage = {
  messageId: string;
  sourceId: number;
  recipientId: number;
  sentTick: number;
  deliverTick: number;
  channelSignal: CitizenChannel;
  strength: number;
};

export type NeighborState = {
  citizenId: number;
  channel: CitizenChannel;
  lastOpportunityScore: number;
  lastAccessSucceeded: boolean;
};

export type CitizenObservation = {
  tick: number;
  citizen: CitizenSnapshot;
  environment: WorldEnvironment;
  neighborStates: NeighborState[];
  receivedMessages: AgentMessage[];
  memories: CitizenMemory[];
};

export type CitizenAction = {
  citizenId: number;
  tick: number;
  channel: CitizenChannel;
  effort: number;
  message: null | {
    recipientId: number;
    channelSignal: CitizenChannel;
    strength: number;
  };
};

export type CitizenDecisionProvider = {
  decide: (observation: CitizenObservation) => CitizenAction | Promise<CitizenAction>;
};

export type ActionLogEntry = {
  tick: number;
  citizenId: number;
  action: CitizenAction;
  opportunityScore: number;
  accessSucceeded: boolean;
};

export type TickMetrics = {
  tick: number;
  environment: WorldEnvironment;
  channelCounts: Record<CitizenChannel, number>;
  opportunityRate: number;
  meanOpportunityScore: number;
  messagesSent: number;
};

export type AgentWorldResult = {
  worldVersion: typeof AGENT_WORLD_VERSION;
  variant: WorldVariant;
  configSnapshot: AgentWorldConfig;
  network: AgentNetwork;
  initialCitizens: CitizenState[];
  finalCitizens: CitizenState[];
  actionLog: ActionLogEntry[];
  tickMetrics: TickMetrics[];
};

export type AgentWorldExperimentResult = {
  worldVersion: typeof AGENT_WORLD_VERSION;
  configSnapshot: AgentWorldConfig;
  byVariant: Record<WorldVariant, AgentWorldResult>;
};

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function cloneAgentWorldConfig(config: AgentWorldConfig): AgentWorldConfig {
  return {
    ...config,
    environment: { ...config.environment },
    environmentEvents: config.environmentEvents.map((event) => ({
      ...event,
      patch: { ...event.patch },
    })),
    network: { ...config.network },
  };
}

export function validateAgentWorldConfig(config: AgentWorldConfig): void {
  if (config.schemaVersion !== "agent-world/0.1") throw new RangeError("unsupported Agent World schemaVersion");
  if (!Number.isInteger(config.citizenCount) || config.citizenCount < 2 || config.citizenCount > 1_000) {
    throw new RangeError("citizenCount must be an integer from 2 to 1000");
  }
  if (!Number.isInteger(config.tickCount) || config.tickCount < 1 || config.tickCount > 1_000) {
    throw new RangeError("tickCount must be an integer from 1 to 1000");
  }
  if (!Number.isInteger(config.worldSeed) || config.worldSeed < 0 || config.worldSeed > 0xffff_ffff) {
    throw new RangeError("worldSeed must be an unsigned 32-bit integer");
  }
  if (!Number.isInteger(config.memoryLimit) || config.memoryLimit < 0 || config.memoryLimit > 1_000) {
    throw new RangeError("memoryLimit must be an integer from 0 to 1000");
  }
  if (!isUnitInterval(config.opportunityThreshold)) {
    throw new RangeError("opportunityThreshold must be from 0 to 1");
  }
  if (Object.values(config.environment).some((value) => !isUnitInterval(value))) {
    throw new RangeError("environment values must be from 0 to 1");
  }
  if (!Number.isInteger(config.network.clusterCount)
    || config.network.clusterCount < 1
    || config.network.clusterCount > config.citizenCount) {
    throw new RangeError("network.clusterCount must be between 1 and citizenCount");
  }
  const eventIds = new Set<string>();
  for (const event of config.environmentEvents) {
    if (event.eventId.length === 0 || eventIds.has(event.eventId)) {
      throw new RangeError("environment event IDs must be non-empty and unique");
    }
    eventIds.add(event.eventId);
    if (!Number.isInteger(event.tick) || event.tick < 1 || event.tick > config.tickCount) {
      throw new RangeError("environment event tick must be within the simulation");
    }
    if (Object.values(event.patch).some((value) => value === undefined || !isUnitInterval(value))) {
      throw new RangeError("environment event values must be from 0 to 1");
    }
  }
}
