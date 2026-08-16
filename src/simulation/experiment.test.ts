import { describe, expect, it } from "vitest";
import type { SimulationConfig } from "../types/model";
import { DEFAULT_CONFIG } from "./config";
import { allocateCohortCounts } from "./cohort";
import { runExperiment } from "./experiment";
import { learnerScores, summarizeScores } from "./trial";

function config(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    ...DEFAULT_CONFIG,
    composition: { ...DEFAULT_CONFIG.composition },
    environment: { ...DEFAULT_CONFIG.environment },
    ...overrides,
  };
}

describe("model v1", () => {
  it("uses largest-remainder allocation with a stable tie break", () => {
    expect(allocateCohortCounts(10, { paper: 33, digital: 33, hybrid: 34 })).toEqual({
      paper: 3,
      digital: 3,
      hybrid: 4,
    });
    expect(allocateCohortCounts(11, { paper: 33, digital: 33, hybrid: 34 })).toEqual({
      paper: 4,
      digital: 3,
      hybrid: 4,
    });
  });

  it("uses max(paper, digital) for hybrid", () => {
    const scores = learnerScores({
      id: 0,
      type: "paper",
      paperAffinity: 0.8,
      digitalAffinity: 0.4,
      learningAbility: 0.75,
    }, DEFAULT_CONFIG.environment);
    expect(scores.paper).toBeCloseTo(0.6);
    expect(scores.digital).toBeCloseTo(0.3);
    expect(scores.hybrid).toBeCloseTo(0.6);
  });

  it("uses ceil for the lower twenty percent", () => {
    const result = summarizeScores([0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.5, 1, 0], 0.5);
    expect(result.bottom20Count).toBe(3);
    expect(result.bottom20Mean).toBeCloseTo(0.1, 12);
  });
});

describe("runExperiment", () => {
  it("is reproducible and does not mutate its input", () => {
    const input = config({ trialCount: 10, learnerCount: 20, baseSeed: 0xffff_ffff });
    const before = structuredClone(input);
    expect(runExperiment(input)).toEqual(runExperiment(input));
    expect(input).toEqual(before);
  });

  it("keeps trial streams prefix-stable when the run count grows", () => {
    const ten = runExperiment(config({ trialCount: 10, learnerCount: 20, baseSeed: 42 }));
    const hundred = runExperiment(config({ trialCount: 100, learnerCount: 20, baseSeed: 42 }));
    expect(hundred.trials.slice(0, 10)).toEqual(ten.trials);
    expect(ten.trials[0].trialStreamId).toBe("42:1");
    expect(ten.trials[9].trialStreamId).toBe("42:10");
  });

  it("reports progress after every completed trial without changing the result", () => {
    const input = config({ trialCount: 10, learnerCount: 20, baseSeed: 42 });
    const updates: Array<{ completed: number; total: number }> = [];
    const withProgress = runExperiment(input, {
      onProgress: (progress) => updates.push(progress),
    });
    expect(updates).toEqual(Array.from({ length: 10 }, (_, index) => ({
      completed: index + 1,
      total: 10,
    })));
    expect(withProgress).toEqual(runExperiment(input));
  });

  it("reports paired differences and cumulative attainment trends", () => {
    const result = runExperiment(config({ trialCount: 10, learnerCount: 30 }));
    const hybridPaper = result.pairedDifferences["hybrid-paper"];
    expect(hybridPaper.attainmentRate.min).toBeGreaterThanOrEqual(0);
    expect(hybridPaper.bottom20Mean.min).toBeGreaterThanOrEqual(-1e-12);
    const final = result.attainmentTrend.at(-1)!;
    expect(final.paper).toBeCloseTo(result.summaries.paper.attainmentRate.mean, 12);
    expect(final.digital).toBeCloseTo(result.summaries.digital.attainmentRate.mean, 12);
    expect(final.hybrid).toBeCloseTo(result.summaries.hybrid.attainmentRate.mean, 12);
    expect(hybridPaper.attainmentDirection.positive + hybridPaper.attainmentDirection.tied + hybridPaper.attainmentDirection.negative).toBe(10);
  });

  it.each([-1, 0x1_0000_0000, 1.5])("rejects invalid seeds: %s", (baseSeed) => {
    expect(() => runExperiment(config({ baseSeed }))).toThrow(/baseSeed/);
  });
});
