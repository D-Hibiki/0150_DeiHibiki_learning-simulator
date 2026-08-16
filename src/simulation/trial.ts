import type {
  Environment,
  Infrastructure,
  Learner,
  TrialMetrics,
  TrialResult,
} from "../types/model";

export function learnerScores(learner: Learner, environment: Environment): Record<Infrastructure, number> {
  const paper = learner.paperAffinity * environment.paperAvailability * environment.paperFreshness * learner.learningAbility;
  const digital = learner.digitalAffinity * environment.digitalAvailability * environment.digitalFreshness * learner.learningAbility;
  return { paper, digital, hybrid: Math.max(paper, digital) };
}

export function summarizeScores(scores: readonly number[], threshold: number): TrialMetrics {
  const learnerCount = scores.length;
  const successCount = scores.reduce((count, score) => count + Number(score >= threshold), 0);
  const dropoutCount = learnerCount - successCount;
  const bottom20Count = Math.ceil(learnerCount * 0.2);
  const sorted = [...scores].sort((a, b) => a - b);
  const bottom20Mean = sorted.slice(0, bottom20Count).reduce((sum, score) => sum + score, 0) / bottom20Count;
  return {
    learnerCount,
    successCount,
    attainmentRate: successCount / learnerCount,
    dropoutCount,
    dropoutRate: dropoutCount / learnerCount,
    bottom20Count,
    bottom20Mean,
  };
}

export function runTrial(
  cohort: readonly Learner[],
  environment: Environment,
  threshold: number,
  trialIndex: number,
  trialStreamId: string,
): TrialResult {
  const scores: Record<Infrastructure, number[]> = { paper: [], digital: [], hybrid: [] };
  for (const learner of cohort) {
    const result = learnerScores(learner, environment);
    scores.paper.push(result.paper);
    scores.digital.push(result.digital);
    scores.hybrid.push(result.hybrid);
  }
  return {
    trialIndex,
    trialStreamId,
    byInfrastructure: {
      paper: summarizeScores(scores.paper, threshold),
      digital: summarizeScores(scores.digital, threshold),
      hybrid: summarizeScores(scores.hybrid, threshold),
    },
  };
}
