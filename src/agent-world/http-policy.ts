import {
  deriveInferenceSeed,
  type CitizenAction,
  type CitizenDecisionProvider,
  type CitizenObservation,
} from "./protocol";

export type AgentRuntimeStatus = {
  available: boolean;
  version: string | null;
  model: string;
  modelDigest: string | null;
  modelInstalled: boolean;
  installedModels: string[];
  localOnly: true;
  message: string;
  promptVersion: string;
  actionSchemaVersion: string;
  generation: {
    temperature: number;
    numContext: number;
    numPredict: number;
  };
};

export type HttpPolicyOptions = {
  endpoint?: string;
  signal?: AbortSignal;
  onDecision?: (observation: CitizenObservation) => void;
  worldSeed: number;
  modelDigest: string;
};

export async function fetchAgentRuntimeStatus(signal?: AbortSignal): Promise<AgentRuntimeStatus> {
  const response = await fetch("/api/agent-world/status", { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Agent runtime status failed: ${response.status}`);
  return response.json() as Promise<AgentRuntimeStatus>;
}

export function createHttpCitizenDecisionProvider(options: HttpPolicyOptions): CitizenDecisionProvider {
  const endpoint = options.endpoint ?? "/api/agent-world/decide";
  return {
    async decide(observation): Promise<CitizenAction> {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: options.signal,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            observation,
            inferenceSeed: deriveInferenceSeed(options.worldSeed, observation.citizen.id, observation.tick),
            modelDigest: options.modelDigest,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Citizen decision failed (${response.status}): ${body.slice(0, 240)}`);
        }
        const payload = await response.json() as { action?: CitizenAction };
        if (!payload.action) throw new Error("Citizen decision response did not include an action.");
        options.onDecision?.(observation);
        return payload.action;
      } catch (error) {
        throw error instanceof Error ? error : new Error("Unknown citizen decision error");
      }
    },
  };
}
