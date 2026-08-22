import type { WorldVariant } from "./protocol";

export type AgentWorldCondition = WorldVariant;

export type RunTerminalStatus =
  | "completed"
  | "failed"
  | "cancelled"
  | "timed-out"
  | "invalid";

export type SeedStream = {
  value: number;
  streamId: string;
};

/**
 * Each source of stochasticity has its own named stream. Paired conditions must
 * reuse the same manifest; the condition itself must not be encoded in a seed.
 */
export type AgentWorldSeedManifest = {
  initialization: SeedStream;
  network: SeedStream;
  schedule: SeedStream;
  inference: SeedStream;
};

export type AgentWorldRunRecord = {
  runId: string;
  replicateId: string;
  condition: AgentWorldCondition;
  terminalStatus: RunTerminalStatus;
  seeds: AgentWorldSeedManifest;
  shockTick: number;
  /** One 0..1 population-level continuity share for every completed tick. */
  continuityShareByTick: readonly number[];
  failureReason?: string;
};

/**
 * No defaults are supplied intentionally. A study must freeze every numerical
 * threshold in its preregistered protocol before confirmatory runs are opened.
 */
export type CascadeThresholds = {
  baselineWindowTicks: number;
  baselineMaxContinuityShare: number;
  cascadeMinContinuityShare: number;
  onsetWindowTicks: number;
  sustainTicks: number;
  minimumCompletedRunsPerCondition: number;
  minimumComparablePairs: number;
  minimumFullCascadeIncidence: number;
  minimumPrimaryRiskDifference: number;
  minimumSecondaryRiskDifference: number;
};

export type CascadeEvaluation = {
  detected: boolean;
  baselineMaximum: number;
  onsetTick: number | null;
  peakPostShockShare: number;
};

export type RunExclusionReason =
  | Exclude<RunTerminalStatus, "completed">
  | "invalid-seed-manifest"
  | "invalid-series";

export type EvaluatedRun = {
  run: AgentWorldRunRecord;
  cascade: CascadeEvaluation;
};

export type ConditionSummary = {
  condition: AgentWorldCondition;
  totalRuns: number;
  completedRuns: number;
  cascadeRuns: number;
  cascadeIncidence: number | null;
  excludedRuns: number;
  exclusions: Partial<Record<RunExclusionReason, number>>;
  evaluatedRuns: readonly EvaluatedRun[];
};

export type PairedConditionComparison = {
  fullCondition: "full";
  controlCondition: Exclude<AgentWorldCondition, "full">;
  comparablePairs: number;
  bothCascade: number;
  fullOnlyCascade: number;
  controlOnlyCascade: number;
  neitherCascade: number;
  /** Mean of full cascade indicator minus control cascade indicator. */
  pairedRiskDifference: number | null;
  seedMismatchPairs: number;
  unmatchedFullRuns: number;
  unmatchedControlRuns: number;
};

export type RobustnessCheck = {
  id: string;
  passed: boolean;
};

export type EmergenceStatus =
  | "observed_pattern"
  | "candidate_emergence"
  | "robust_candidate";

export type EmergenceAssessment = {
  unit: "simulation-run";
  primaryPattern: "interaction-induced-continuity-cascade";
  status: EmergenceStatus | null;
  primaryEvaluable: boolean;
  reasons: readonly string[];
  thresholds: CascadeThresholds;
  conditions: Record<AgentWorldCondition, ConditionSummary>;
  comparisons: {
    primary: PairedConditionComparison;
    noMemory: PairedConditionComparison;
    rule: PairedConditionComparison;
  };
  robustnessChecks: readonly RobustnessCheck[];
};

const CONDITIONS: readonly AgentWorldCondition[] = [
  "full",
  "no-interaction",
  "no-memory",
  "rule-baseline",
];
const SEED_STREAM_KEYS = ["initialization", "network", "schedule", "inference"] as const;

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isUnsigned32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function validateCascadeThresholds(thresholds: CascadeThresholds): void {
  for (const [name, value] of [
    ["baselineWindowTicks", thresholds.baselineWindowTicks],
    ["onsetWindowTicks", thresholds.onsetWindowTicks],
    ["sustainTicks", thresholds.sustainTicks],
    ["minimumCompletedRunsPerCondition", thresholds.minimumCompletedRunsPerCondition],
    ["minimumComparablePairs", thresholds.minimumComparablePairs],
  ] as const) {
    if (!isPositiveInteger(value)) throw new RangeError(`${name} must be a positive integer`);
  }

  for (const [name, value] of [
    ["baselineMaxContinuityShare", thresholds.baselineMaxContinuityShare],
    ["cascadeMinContinuityShare", thresholds.cascadeMinContinuityShare],
    ["minimumFullCascadeIncidence", thresholds.minimumFullCascadeIncidence],
    ["minimumPrimaryRiskDifference", thresholds.minimumPrimaryRiskDifference],
    ["minimumSecondaryRiskDifference", thresholds.minimumSecondaryRiskDifference],
  ] as const) {
    if (!isProbability(value)) throw new RangeError(`${name} must be from 0 to 1`);
  }

  if (thresholds.baselineMaxContinuityShare >= thresholds.cascadeMinContinuityShare) {
    throw new RangeError("baselineMaxContinuityShare must be below cascadeMinContinuityShare");
  }
}

function validateSeedManifest(seeds: AgentWorldSeedManifest): boolean {
  if (typeof seeds !== "object" || seeds === null || Array.isArray(seeds)) return false;
  const record = seeds as unknown as Record<string, SeedStream | undefined>;
  const keys = Object.keys(record).sort();
  if (keys.length !== SEED_STREAM_KEYS.length
    || !SEED_STREAM_KEYS.every((key) => keys.includes(key))) return false;
  const streams = SEED_STREAM_KEYS.map((key) => record[key]);
  if (!streams.every((stream): stream is SeedStream => stream !== undefined)) return false;
  return streams.every((stream) => isUnsigned32(stream.value) && stream.streamId.trim().length > 0)
    && new Set(streams.map((stream) => stream.streamId)).size === SEED_STREAM_KEYS.length;
}

function sameSeedManifest(left: AgentWorldSeedManifest, right: AgentWorldSeedManifest): boolean {
  if (!validateSeedManifest(left) || !validateSeedManifest(right)) return false;
  return SEED_STREAM_KEYS.every((key) =>
    left[key].value === right[key].value && left[key].streamId === right[key].streamId);
}

export function evaluateContinuityCascade(
  run: Pick<AgentWorldRunRecord, "shockTick" | "continuityShareByTick">,
  thresholds: CascadeThresholds,
): CascadeEvaluation {
  validateCascadeThresholds(thresholds);
  const series = run.continuityShareByTick;
  if (!Number.isInteger(run.shockTick) || run.shockTick <= 0 || run.shockTick >= series.length) {
    throw new RangeError("shockTick must identify a tick after a baseline and before the series ends");
  }
  if (series.some((value) => !isProbability(value))) {
    throw new RangeError("continuityShareByTick must contain only finite values from 0 to 1");
  }
  if (run.shockTick < thresholds.baselineWindowTicks) {
    throw new RangeError("series does not contain the preregistered baseline window");
  }

  const baseline = series.slice(run.shockTick - thresholds.baselineWindowTicks, run.shockTick);
  const baselineMaximum = Math.max(...baseline);
  const postShock = series.slice(run.shockTick);
  const peakPostShockShare = Math.max(...postShock);

  if (baselineMaximum > thresholds.baselineMaxContinuityShare) {
    return { detected: false, baselineMaximum, onsetTick: null, peakPostShockShare };
  }

  const latestOnsetTick = Math.min(
    series.length - thresholds.sustainTicks,
    run.shockTick + thresholds.onsetWindowTicks - 1,
  );
  for (let onset = run.shockTick; onset <= latestOnsetTick; onset += 1) {
    const sustained = series
      .slice(onset, onset + thresholds.sustainTicks)
      .every((value) => value >= thresholds.cascadeMinContinuityShare);
    if (sustained) {
      return { detected: true, baselineMaximum, onsetTick: onset, peakPostShockShare };
    }
  }

  return { detected: false, baselineMaximum, onsetTick: null, peakPostShockShare };
}

function incrementExclusion(
  exclusions: Partial<Record<RunExclusionReason, number>>,
  reason: RunExclusionReason,
): void {
  exclusions[reason] = (exclusions[reason] ?? 0) + 1;
}

export function summarizeCondition(
  runs: readonly AgentWorldRunRecord[],
  condition: AgentWorldCondition,
  thresholds: CascadeThresholds,
): ConditionSummary {
  validateCascadeThresholds(thresholds);
  const selected = runs.filter((run) => run.condition === condition);
  const evaluatedRuns: EvaluatedRun[] = [];
  const exclusions: Partial<Record<RunExclusionReason, number>> = {};

  for (const run of selected) {
    if (run.terminalStatus !== "completed") {
      incrementExclusion(exclusions, run.terminalStatus);
      continue;
    }
    if (!validateSeedManifest(run.seeds)) {
      incrementExclusion(exclusions, "invalid-seed-manifest");
      continue;
    }
    try {
      evaluatedRuns.push({ run, cascade: evaluateContinuityCascade(run, thresholds) });
    } catch {
      incrementExclusion(exclusions, "invalid-series");
    }
  }

  const cascadeRuns = evaluatedRuns.filter(({ cascade }) => cascade.detected).length;
  const excludedRuns = selected.length - evaluatedRuns.length;
  return {
    condition,
    totalRuns: selected.length,
    completedRuns: evaluatedRuns.length,
    cascadeRuns,
    cascadeIncidence: evaluatedRuns.length > 0 ? cascadeRuns / evaluatedRuns.length : null,
    excludedRuns,
    exclusions,
    evaluatedRuns,
  };
}

export function comparePairedConditions(
  full: ConditionSummary,
  control: ConditionSummary,
): PairedConditionComparison {
  if (full.condition !== "full" || control.condition === "full") {
    throw new RangeError("comparison must be Full versus one control condition");
  }
  const fullByReplicate = new Map(full.evaluatedRuns.map((item) => [item.run.replicateId, item]));
  const controlByReplicate = new Map(control.evaluatedRuns.map((item) => [item.run.replicateId, item]));
  let bothCascade = 0;
  let fullOnlyCascade = 0;
  let controlOnlyCascade = 0;
  let neitherCascade = 0;
  let seedMismatchPairs = 0;

  for (const [replicateId, fullRun] of fullByReplicate) {
    const controlRun = controlByReplicate.get(replicateId);
    if (!controlRun) continue;
    if (!sameSeedManifest(fullRun.run.seeds, controlRun.run.seeds)) {
      seedMismatchPairs += 1;
      continue;
    }
    if (fullRun.cascade.detected && controlRun.cascade.detected) bothCascade += 1;
    else if (fullRun.cascade.detected) fullOnlyCascade += 1;
    else if (controlRun.cascade.detected) controlOnlyCascade += 1;
    else neitherCascade += 1;
  }

  const comparablePairs = bothCascade + fullOnlyCascade + controlOnlyCascade + neitherCascade;
  const matchedReplicateIds = new Set(
    [...fullByReplicate.keys()].filter((id) => controlByReplicate.has(id)),
  );
  return {
    fullCondition: "full",
    controlCondition: control.condition,
    comparablePairs,
    bothCascade,
    fullOnlyCascade,
    controlOnlyCascade,
    neitherCascade,
    pairedRiskDifference: comparablePairs > 0
      ? (fullOnlyCascade - controlOnlyCascade) / comparablePairs
      : null,
    seedMismatchPairs,
    unmatchedFullRuns: fullByReplicate.size - matchedReplicateIds.size,
    unmatchedControlRuns: controlByReplicate.size - matchedReplicateIds.size,
  };
}

function assertNoDuplicateConditionReplicates(runs: readonly AgentWorldRunRecord[]): void {
  const seen = new Set<string>();
  for (const run of runs) {
    const key = `${run.condition}\u0000${run.replicateId}`;
    if (seen.has(key)) {
      throw new Error(`duplicate terminal record for ${run.condition}/${run.replicateId}`);
    }
    seen.add(key);
  }
}

function passesComparison(
  comparison: PairedConditionComparison,
  minimumPairs: number,
  minimumDifference: number,
): boolean {
  return comparison.comparablePairs >= minimumPairs
    && comparison.pairedRiskDifference !== null
    && comparison.pairedRiskDifference >= minimumDifference;
}

export function assessEmergence(
  runs: readonly AgentWorldRunRecord[],
  thresholds: CascadeThresholds,
  robustnessChecks: readonly RobustnessCheck[] = [],
): EmergenceAssessment {
  validateCascadeThresholds(thresholds);
  assertNoDuplicateConditionReplicates(runs);
  const conditions = Object.fromEntries(
    CONDITIONS.map((condition) => [condition, summarizeCondition(runs, condition, thresholds)]),
  ) as Record<AgentWorldCondition, ConditionSummary>;
  const primary = comparePairedConditions(conditions.full, conditions["no-interaction"]);
  const noMemory = comparePairedConditions(conditions.full, conditions["no-memory"]);
  const rule = comparePairedConditions(conditions.full, conditions["rule-baseline"]);
  const reasons: string[] = [];
  let status: EmergenceStatus | null = null;

  const enoughFullRuns = conditions.full.completedRuns >= thresholds.minimumCompletedRunsPerCondition;
  const observed = enoughFullRuns
    && conditions.full.cascadeIncidence !== null
    && conditions.full.cascadeIncidence >= thresholds.minimumFullCascadeIncidence;
  if (observed) status = "observed_pattern";
  else reasons.push("Full did not meet the preregistered observed-pattern threshold.");

  const enoughPrimaryConditionRuns =
    conditions["no-interaction"].completedRuns >= thresholds.minimumCompletedRunsPerCondition;
  const primaryEvaluable = enoughFullRuns
    && enoughPrimaryConditionRuns
    && primary.comparablePairs >= thresholds.minimumComparablePairs;
  const primaryPassed = observed && passesComparison(
    primary,
    thresholds.minimumComparablePairs,
    thresholds.minimumPrimaryRiskDifference,
  );
  if (primaryPassed) status = "candidate_emergence";
  else if (observed) reasons.push("Full versus No-interaction did not meet the preregistered primary contrast.");

  const secondaryPassed = passesComparison(
    noMemory,
    thresholds.minimumComparablePairs,
    thresholds.minimumSecondaryRiskDifference,
  ) && passesComparison(
    rule,
    thresholds.minimumComparablePairs,
    thresholds.minimumSecondaryRiskDifference,
  );
  const robustnessPassed = robustnessChecks.length > 0 && robustnessChecks.every((check) => check.passed);
  if (primaryPassed && secondaryPassed && robustnessPassed) status = "robust_candidate";
  else if (primaryPassed) {
    if (!secondaryPassed) reasons.push("No-memory and Rule secondary controls did not both meet their thresholds.");
    if (!robustnessPassed) reasons.push("All preregistered robustness checks have not passed.");
  }

  return {
    unit: "simulation-run",
    primaryPattern: "interaction-induced-continuity-cascade",
    status,
    primaryEvaluable,
    reasons,
    thresholds: { ...thresholds },
    conditions,
    comparisons: { primary, noMemory, rule },
    robustnessChecks: [...robustnessChecks],
  };
}
