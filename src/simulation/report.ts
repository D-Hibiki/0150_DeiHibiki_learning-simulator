import { csvFormat } from "d3-dsv";
import { __version as pureRandVersion } from "pure-rand";
import type {
  Infrastructure,
  PairedComparisonId,
  ReportArtifact,
  ReportCsvFiles,
  ExperimentResult,
} from "../types/model";

const INFRASTRUCTURES: Infrastructure[] = ["paper", "digital", "hybrid"];
const COMPARISONS: PairedComparisonId[] = ["hybrid-paper", "hybrid-digital", "paper-digital"];
const BOM = "\ufeff";

export function buildReportArtifact(
  result: ExperimentResult,
  options: { appVersion?: string; generatedAt?: string } = {},
): ReportArtifact {
  return {
    schemaVersion: "1.0.0",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    provenance: {
      appVersion: options.appVersion ?? "unknown",
      modelVersion: result.modelVersion,
      prng: "xoroshiro128plus",
      prngVersion: pureRandVersion,
      streamDerivation: "jump-2^64",
      percentileMethod: "R-type-7",
      confidenceIntervalMethod: "student-t-clipped",
    },
    scope: {
      dataKind: "synthetic",
      inferenceTarget: "model-internal",
      limitations: [
        "This artifact contains synthetic cohorts, not observations from human participants.",
        "Repeated trials quantify model-internal cohort variation and Monte Carlo precision only.",
        "They do not establish causal, population-representative, predictive, or external validity.",
        "Hybrid weakly dominates each single channel by construction because its score is max(paper, digital).",
      ],
    },
    result,
  };
}

function intervalLower(value: { lower: number; upper: number } | null): number | "" {
  return value?.lower ?? "";
}

function intervalUpper(value: { lower: number; upper: number } | null): number | "" {
  return value?.upper ?? "";
}

export function reportCsv(artifact: ReportArtifact): ReportCsvFiles {
  const common = {
    schema_version: artifact.schemaVersion,
    model_version: artifact.provenance.modelVersion,
    base_seed: artifact.result.configSnapshot.baseSeed,
    trial_count: artifact.result.configSnapshot.trialCount,
    learner_count: artifact.result.configSnapshot.learnerCount,
  };
  const summaryRows: Array<Record<string, string | number>> = [];
  for (const infrastructure of INFRASTRUCTURES) {
    const metrics = artifact.result.summaries[infrastructure];
    for (const metric of ["attainmentRate", "dropoutRate", "bottom20Mean"] as const) {
      const summary = metrics[metric];
      summaryRows.push({
        ...common,
        record_type: "infrastructure_summary",
        comparison: "",
        infrastructure,
        metric,
        mean: summary.mean,
        sample_sd: summary.sampleStandardDeviation ?? "",
        ci95_lower: intervalLower(summary.confidenceInterval95),
        ci95_upper: intervalUpper(summary.confidenceInterval95),
        p025: intervalLower(summary.percentileInterval95),
        p975: intervalUpper(summary.percentileInterval95),
        min: summary.min,
        max: summary.max,
      });
    }
  }
  for (const comparison of COMPARISONS) {
    const metrics = artifact.result.pairedDifferences[comparison];
    for (const metric of ["attainmentRate", "bottom20Mean"] as const) {
      const summary = metrics[metric];
      summaryRows.push({
        ...common,
        record_type: "paired_difference",
        comparison,
        infrastructure: "",
        metric,
        mean: summary.mean,
        sample_sd: summary.sampleStandardDeviation ?? "",
        ci95_lower: intervalLower(summary.confidenceInterval95),
        ci95_upper: intervalUpper(summary.confidenceInterval95),
        p025: intervalLower(summary.percentileInterval95),
        p975: intervalUpper(summary.percentileInterval95),
        min: summary.min,
        max: summary.max,
      });
    }
  }

  const trialRows = artifact.result.trials.flatMap((trial) =>
    INFRASTRUCTURES.map((infrastructure) => {
      const metric = trial.byInfrastructure[infrastructure];
      return {
        schema_version: artifact.schemaVersion,
        model_version: artifact.provenance.modelVersion,
        base_seed: artifact.result.configSnapshot.baseSeed,
        trial_index: trial.trialIndex,
        trial_stream_id: trial.trialStreamId,
        infrastructure,
        learner_count: metric.learnerCount,
        success_count: metric.successCount,
        attainment_rate: metric.attainmentRate,
        dropout_count: metric.dropoutCount,
        dropout_rate: metric.dropoutRate,
        bottom20_count: metric.bottom20Count,
        bottom20_mean: metric.bottom20Mean,
      };
    }),
  );

  return {
    summaryCsv: BOM + csvFormat(summaryRows),
    trialsCsv: BOM + csvFormat(trialRows),
  };
}
