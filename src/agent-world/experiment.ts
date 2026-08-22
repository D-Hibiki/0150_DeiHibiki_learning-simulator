import { createClusteredNetwork, runAgentWorld } from "./engine";
import {
  AGENT_WORLD_VERSION,
  type AgentWorldConfig,
  type AgentWorldExperimentResult,
  type CitizenDecisionProvider,
  type NetworkProvider,
  type WorldVariant,
  cloneAgentWorldConfig,
  validateAgentWorldConfig,
} from "./protocol";

export type RunAgentWorldExperimentOptions = {
  policyFactory?: (variant: Exclude<WorldVariant, "rule-baseline">) => CitizenDecisionProvider;
  networkProvider?: NetworkProvider;
  variants?: readonly WorldVariant[];
  onProgress?: (progress: { variant: WorldVariant; tick: number; totalTicks: number; citizenId: number }) => void;
};

const VARIANTS = ["full", "no-interaction", "no-memory", "rule-baseline"] as const;

export async function runAgentWorldExperiment(
  suppliedConfig: AgentWorldConfig,
  options: RunAgentWorldExperimentOptions = {},
): Promise<AgentWorldExperimentResult> {
  validateAgentWorldConfig(suppliedConfig);
  const config = cloneAgentWorldConfig(suppliedConfig);
  const sharedNetwork = (options.networkProvider ?? { create: createClusteredNetwork }).create(config);
  const pairedNetworkProvider: NetworkProvider = { create: () => sharedNetwork };
  const variants = options.variants ?? VARIANTS;
  const entries: Array<readonly [WorldVariant, Awaited<ReturnType<typeof runAgentWorld>>]> = [];
  for (const variant of variants) {
    const policy = variant === "rule-baseline" ? undefined : options.policyFactory?.(variant);
    const result = await runAgentWorld(config, {
      variant,
      policy,
      networkProvider: pairedNetworkProvider,
      onProgress: (progress) => options.onProgress?.({ variant, ...progress }),
    });
    entries.push([variant, result] as const);
  }

  const missing = VARIANTS.filter((variant) => !entries.some(([current]) => current === variant));
  for (const variant of missing) {
    const result = await runAgentWorld(config, { variant, networkProvider: pairedNetworkProvider });
    entries.push([variant, result] as const);
  }

  return {
    worldVersion: AGENT_WORLD_VERSION,
    configSnapshot: cloneAgentWorldConfig(config),
    byVariant: Object.fromEntries(entries) as AgentWorldExperimentResult["byVariant"],
  };
}
