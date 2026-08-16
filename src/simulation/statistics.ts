import { mean, sampleStandardDeviation } from "simple-statistics";
import type { MetricSummary } from "../types/model";

const T_CRITICAL_975: Record<number, number> = {
  9: 2.2621571628540993,
  99: 1.9842169515086827,
  999: 1.9623414611334487,
};

export function quantileType7(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0) throw new RangeError("quantile requires at least one value");
  if (probability < 0 || probability > 1) throw new RangeError("probability must be from 0 to 1");
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
}

export function summarizeMetric(
  values: readonly number[],
  bounds: readonly [number, number] = [0, 1],
): MetricSummary {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("metric values must be a non-empty finite array");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const metricMean = mean(values as number[]);
  if (values.length === 1) {
    return {
      count: 1,
      mean: metricMean,
      sampleStandardDeviation: null,
      confidenceInterval95: null,
      percentileInterval95: null,
      min: sorted[0],
      max: sorted[0],
    };
  }
  const standardDeviation = sampleStandardDeviation(values as number[]);
  const critical = T_CRITICAL_975[values.length - 1];
  if (critical === undefined) throw new RangeError("unsupported trial count for confidence interval");
  const margin = critical * standardDeviation / Math.sqrt(values.length);
  return {
    count: values.length,
    mean: metricMean,
    sampleStandardDeviation: standardDeviation,
    confidenceInterval95: {
      lower: Math.max(bounds[0], metricMean - margin),
      upper: Math.min(bounds[1], metricMean + margin),
    },
    percentileInterval95: {
      lower: quantileType7(sorted, 0.025),
      upper: quantileType7(sorted, 0.975),
    },
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
