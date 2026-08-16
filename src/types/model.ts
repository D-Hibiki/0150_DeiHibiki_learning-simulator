export type LearnerType = "paper" | "digital" | "hybrid";
export type Infrastructure = "paper" | "digital" | "hybrid";
export type TrialCount = 1 | 10 | 100 | 1000;

export type Composition = Record<LearnerType, number>;

export type Environment = {
  paperAvailability: number;
  digitalAvailability: number;
  paperFreshness: number;
  digitalFreshness: number;
};

export type SimulationConfig = {
  learnerCount: number;
  composition: Composition;
  successThreshold: number;
  environmentId: string;
  environment: Environment;
  baseSeed: number;
  trialCount: TrialCount;
};

export type Learner = {
  id: number;
  type: LearnerType;
  paperAffinity: number;
  digitalAffinity: number;
  learningAbility: number;
};

export type TrialMetrics = {
  learnerCount: number;
  successCount: number;
  attainmentRate: number;
  dropoutCount: number;
  dropoutRate: number;
  bottom20Count: number;
  bottom20Mean: number;
};

export type TrialResult = {
  trialIndex: number;
  trialStreamId: string;
  byInfrastructure: Record<Infrastructure, TrialMetrics>;
};

export type Interval = { lower: number; upper: number };

export type MetricSummary = {
  count: number;
  mean: number;
  sampleStandardDeviation: number | null;
  confidenceInterval95: Interval | null;
  percentileInterval95: Interval | null;
  min: number;
  max: number;
};

export type InfrastructureSummary = {
  attainmentRate: MetricSummary;
  dropoutRate: MetricSummary;
  bottom20Mean: MetricSummary;
};

export type PairedComparisonId =
  | "hybrid-paper"
  | "hybrid-digital"
  | "paper-digital";

export type DirectionCounts = {
  positive: number;
  tied: number;
  negative: number;
};

export type PairedComparisonSummary = {
  left: Infrastructure;
  right: Infrastructure;
  attainmentRate: MetricSummary;
  bottom20Mean: MetricSummary;
  attainmentDirection: DirectionCounts;
  bottom20Direction: DirectionCounts;
};

export type TrendPoint = {
  trialIndex: number;
  paper: number;
  digital: number;
  hybrid: number;
};

export type ExperimentResult = {
  modelVersion: "1.0.0";
  configSnapshot: SimulationConfig;
  trials: TrialResult[];
  summaries: Record<Infrastructure, InfrastructureSummary>;
  pairedDifferences: Record<PairedComparisonId, PairedComparisonSummary>;
  attainmentTrend: TrendPoint[];
};

export type ReportArtifact = {
  schemaVersion: "1.0.0";
  generatedAt: string;
  provenance: {
    appVersion: string;
    modelVersion: "1.0.0";
    prng: "xoroshiro128plus";
    prngVersion: string;
    streamDerivation: "jump-2^64";
    percentileMethod: "R-type-7";
    confidenceIntervalMethod: "student-t-clipped";
  };
  scope: {
    dataKind: "synthetic";
    inferenceTarget: "model-internal";
    limitations: string[];
  };
  result: ExperimentResult;
};

export type ReportCsvFiles = {
  summaryCsv: string;
  trialsCsv: string;
};
