import type {
  DirectionCounts,
  ExperimentResult,
  Infrastructure,
  InfrastructureSummary,
  PairedComparisonId,
  PairedComparisonSummary,
  SimulationConfig,
  TrialResult,
} from "../types/model";
import { MODEL_VERSION, validateConfig } from "./config";
import { generateCohort } from "./cohort";
import { createBaseGenerator, jumpGenerator } from "./random";
import { summarizeMetric } from "./statistics";
import { runTrial } from "./trial";

const INFRASTRUCTURES: Infrastructure[] = ["paper", "digital", "hybrid"];
const COMPARISONS: Record<PairedComparisonId, readonly [Infrastructure, Infrastructure]> = {
  "hybrid-paper": ["hybrid", "paper"],
  "hybrid-digital": ["hybrid", "digital"],
  "paper-digital": ["paper", "digital"],
};

export type RunExperimentOptions = {
  onProgress?: (progress: { completed: number; total: number }) => void;
};

function cloneConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    composition: { ...config.composition },
    environment: { ...config.environment },
  };
}

function summarizeInfrastructure(trials: TrialResult[], infrastructure: Infrastructure): InfrastructureSummary {
  return {
    attainmentRate: summarizeMetric(trials.map((trial) => trial.byInfrastructure[infrastructure].attainmentRate)),
    dropoutRate: summarizeMetric(trials.map((trial) => trial.byInfrastructure[infrastructure].dropoutRate)),
    bottom20Mean: summarizeMetric(trials.map((trial) => trial.byInfrastructure[infrastructure].bottom20Mean)),
  };
}

function direction(values: readonly number[]): DirectionCounts {
  const epsilon = 1e-12;
  return values.reduce<DirectionCounts>((counts, value) => {
    if (value > epsilon) counts.positive += 1;
    else if (value < -epsilon) counts.negative += 1;
    else counts.tied += 1;
    return counts;
  }, { positive: 0, tied: 0, negative: 0 });
}

function pairedSummary(
  trials: TrialResult[],
  left: Infrastructure,
  right: Infrastructure,
): PairedComparisonSummary {
  const attainment = trials.map((trial) =>
    trial.byInfrastructure[left].attainmentRate - trial.byInfrastructure[right].attainmentRate);
  const bottom20 = trials.map((trial) =>
    trial.byInfrastructure[left].bottom20Mean - trial.byInfrastructure[right].bottom20Mean);
  const bounds: [number, number] = left === "hybrid" ? [0, 1] : [-1, 1];
  return {
    left,
    right,
    attainmentRate: summarizeMetric(attainment, bounds),
    bottom20Mean: summarizeMetric(bottom20, bounds),
    attainmentDirection: direction(attainment),
    bottom20Direction: direction(bottom20),
  };
}

export function runExperiment(
  input: SimulationConfig,
  options: RunExperimentOptions = {},
): ExperimentResult {
  validateConfig(input);
  const config = cloneConfig(input);
  const trials: TrialResult[] = [];
  let stream = createBaseGenerator(config.baseSeed);
  for (let index = 0; index < config.trialCount; index += 1) {
    const trialGenerator = stream.clone();
    const cohort = generateCohort(config.learnerCount, config.composition, trialGenerator);
    trials.push(runTrial(
      cohort,
      config.environment,
      config.successThreshold,
      index + 1,
      `${config.baseSeed}:${index + 1}`,
    ));
    options.onProgress?.({ completed: index + 1, total: config.trialCount });
    if (index + 1 < config.trialCount) stream = jumpGenerator(stream);
  }

  const summaries = Object.fromEntries(
    INFRASTRUCTURES.map((infrastructure) => [infrastructure, summarizeInfrastructure(trials, infrastructure)]),
  ) as ExperimentResult["summaries"];

  const pairedDifferences = Object.fromEntries(
    Object.entries(COMPARISONS).map(([id, [left, right]]) => [id, pairedSummary(trials, left, right)]),
  ) as ExperimentResult["pairedDifferences"];

  const running = { paper: 0, digital: 0, hybrid: 0 };
  const attainmentTrend = trials.map((trial) => {
    for (const infrastructure of INFRASTRUCTURES) {
      running[infrastructure] += trial.byInfrastructure[infrastructure].attainmentRate;
    }
    return {
      trialIndex: trial.trialIndex,
      paper: running.paper / trial.trialIndex,
      digital: running.digital / trial.trialIndex,
      hybrid: running.hybrid / trial.trialIndex,
    };
  });

  return {
    modelVersion: MODEL_VERSION,
    configSnapshot: config,
    trials,
    summaries,
    pairedDifferences,
    attainmentTrend,
  };
}
