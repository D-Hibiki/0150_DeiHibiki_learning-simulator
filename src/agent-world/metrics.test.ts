import { describe, expect, it } from "vitest";
import {
  assessEmergence,
  comparePairedConditions,
  evaluateContinuityCascade,
  summarizeCondition,
  type AgentWorldCondition,
  type AgentWorldRunRecord,
  type AgentWorldSeedManifest,
  type CascadeThresholds,
} from "./metrics";

const THRESHOLDS: CascadeThresholds = {
  baselineWindowTicks: 2,
  baselineMaxContinuityShare: 0.2,
  cascadeMinContinuityShare: 0.6,
  onsetWindowTicks: 3,
  sustainTicks: 2,
  minimumCompletedRunsPerCondition: 2,
  minimumComparablePairs: 2,
  minimumFullCascadeIncidence: 0.5,
  minimumPrimaryRiskDifference: 0.5,
  minimumSecondaryRiskDifference: 0.25,
};

function seeds(replicate: number, inferenceOffset = 0): AgentWorldSeedManifest {
  return {
    initialization: { value: 100 + replicate, streamId: `r${replicate}:initialization` },
    network: { value: 200 + replicate, streamId: `r${replicate}:network` },
    schedule: { value: 300 + replicate, streamId: `r${replicate}:schedule` },
    inference: { value: 400 + replicate + inferenceOffset, streamId: `r${replicate}:inference` },
  };
}

function run(
  condition: AgentWorldCondition,
  replicate: number,
  cascade: boolean,
  overrides: Partial<AgentWorldRunRecord> = {},
): AgentWorldRunRecord {
  return {
    runId: `${condition}-${replicate}`,
    replicateId: `replicate-${replicate}`,
    condition,
    terminalStatus: "completed",
    seeds: seeds(replicate),
    shockTick: 2,
    continuityShareByTick: cascade
      ? [0.1, 0.15, 0.61, 0.72, 0.7]
      : [0.1, 0.15, 0.45, 0.62, 0.4],
    ...overrides,
  };
}

describe("evaluateContinuityCascade", () => {
  it("requires a low preregistered baseline, timely onset, and sustained threshold", () => {
    expect(evaluateContinuityCascade(run("full", 1, true), THRESHOLDS)).toMatchObject({
      detected: true,
      baselineMaximum: 0.15,
      onsetTick: 2,
      peakPostShockShare: 0.72,
    });
    expect(evaluateContinuityCascade(run("full", 1, false), THRESHOLDS).detected).toBe(false);
    expect(evaluateContinuityCascade({
      shockTick: 2,
      continuityShareByTick: [0.1, 0.3, 0.7, 0.8],
    }, THRESHOLDS).detected).toBe(false);
  });

  it("rejects an invalid series instead of treating it as a negative cascade", () => {
    expect(() => evaluateContinuityCascade({
      shockTick: 2,
      continuityShareByTick: [0.1, 0.2, Number.NaN],
    }, THRESHOLDS)).toThrow(/continuityShareByTick/);
  });
});

describe("condition and paired summaries", () => {
  it("excludes failed and invalid runs from both numerator and denominator", () => {
    const summary = summarizeCondition([
      run("full", 1, true),
      run("full", 2, false),
      run("full", 3, true, { terminalStatus: "failed", failureReason: "model error" }),
      run("full", 4, true, { continuityShareByTick: [0.1, 2] }),
    ], "full", THRESHOLDS);

    expect(summary).toMatchObject({
      totalRuns: 4,
      completedRuns: 2,
      cascadeRuns: 1,
      cascadeIncidence: 0.5,
      excludedRuns: 2,
      exclusions: { failed: 1, "invalid-series": 1 },
    });
  });

  it("uses paired simulation runs and refuses seed-mismatched pairs", () => {
    const runs = [
      run("full", 1, true),
      run("full", 2, false),
      run("no-interaction", 1, false),
      run("no-interaction", 2, true, { seeds: seeds(2, 1) }),
    ];
    const full = summarizeCondition(runs, "full", THRESHOLDS);
    const control = summarizeCondition(runs, "no-interaction", THRESHOLDS);
    expect(comparePairedConditions(full, control)).toMatchObject({
      comparablePairs: 1,
      fullOnlyCascade: 1,
      seedMismatchPairs: 1,
      pairedRiskDifference: 1,
    });
  });

  it("rejects seed manifests that omit or add a required stream", () => {
    const partial = seeds(1) as unknown as Record<string, unknown>;
    delete partial.inference;
    const extra = { ...seeds(2), shadow: { value: 999, streamId: "shadow" } };
    const summary = summarizeCondition([
      run("full", 1, true, { seeds: partial as unknown as AgentWorldSeedManifest }),
      run("full", 2, true, { seeds: extra as unknown as AgentWorldSeedManifest }),
    ], "full", THRESHOLDS);

    expect(summary.completedRuns).toBe(0);
    expect(summary.exclusions["invalid-seed-manifest"]).toBe(2);
  });
});

describe("assessEmergence", () => {
  const robustRuns = [1, 2].flatMap((replicate) => [
    run("full", replicate, true),
    run("no-interaction", replicate, false),
    run("no-memory", replicate, replicate === 1),
    run("rule-baseline", replicate, false),
  ]);

  it("advances from observed pattern to candidate only through the primary contrast", () => {
    const assessment = assessEmergence([
      run("full", 1, true),
      run("full", 2, false),
      run("no-interaction", 1, false),
      run("no-interaction", 2, false),
    ], THRESHOLDS);
    expect(assessment.unit).toBe("simulation-run");
    expect(assessment.primaryPattern).toBe("interaction-induced-continuity-cascade");
    expect(assessment.status).toBe("candidate_emergence");
    expect(assessment.comparisons.primary.pairedRiskDifference).toBe(0.5);
  });

  it("keeps an observed pattern below candidate when the primary control matches it", () => {
    const assessment = assessEmergence([
      run("full", 1, true),
      run("full", 2, true),
      run("no-interaction", 1, true),
      run("no-interaction", 2, true),
    ], THRESHOLDS);
    expect(assessment.status).toBe("observed_pattern");
    expect(assessment.comparisons.primary.pairedRiskDifference).toBe(0);
    expect(assessment.reasons).toContain(
      "Full versus No-interaction did not meet the preregistered primary contrast.",
    );
  });

  it("requires secondary controls and all external sensitivity checks for robust status", () => {
    expect(assessEmergence(robustRuns, THRESHOLDS).status).toBe("candidate_emergence");
    const assessment = assessEmergence(robustRuns, THRESHOLDS, [
      { id: "prompt", passed: true },
      { id: "persona-label", passed: true },
      { id: "network", passed: true },
    ]);
    expect(assessment.status).toBe("robust_candidate");
    expect(assessment.comparisons.noMemory.pairedRiskDifference).toBe(0.5);
    expect(assessment.comparisons.rule.pairedRiskDifference).toBe(1);
  });

  it("does not impute a failed paired run as no cascade", () => {
    const assessment = assessEmergence([
      run("full", 1, true),
      run("full", 2, true, { terminalStatus: "timed-out" }),
      run("no-interaction", 1, false),
      run("no-interaction", 2, false),
    ], { ...THRESHOLDS, minimumCompletedRunsPerCondition: 1, minimumComparablePairs: 1 });
    expect(assessment.comparisons.primary.comparablePairs).toBe(1);
    expect(assessment.conditions.full.exclusions["timed-out"]).toBe(1);
  });

  it("rejects duplicate terminal records to prevent selective retry inclusion", () => {
    expect(() => assessEmergence([
      run("full", 1, true),
      run("full", 1, false, { runId: "retry" }),
    ], THRESHOLDS)).toThrow(/duplicate terminal record/);
  });
});
