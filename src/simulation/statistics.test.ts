import { describe, expect, it } from "vitest";
import { quantileType7, summarizeMetric } from "./statistics";

describe("quantileType7", () => {
  it("uses the documented R type 7 interpolation", () => {
    expect(quantileType7([0, 1, 2, 3], 0.25)).toBeCloseTo(0.75, 12);
    expect(quantileType7([0, 1, 2, 3], 0.975)).toBeCloseTo(2.925, 12);
  });
});

describe("summarizeMetric", () => {
  it("leaves trial-distribution uncertainty unavailable for one trial", () => {
    expect(summarizeMetric([0.4])).toEqual({
      count: 1,
      mean: 0.4,
      sampleStandardDeviation: null,
      confidenceInterval95: null,
      percentileInterval95: null,
      min: 0.4,
      max: 0.4,
    });
  });

  it("uses sample SD and a Student t interval for ten trials", () => {
    const summary = summarizeMetric([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(summary.mean).toBeCloseTo(0.55, 12);
    expect(summary.sampleStandardDeviation).toBeCloseTo(0.3027650354, 9);
    expect(summary.confidenceInterval95?.lower).toBeCloseTo(0.333414941, 8);
    expect(summary.confidenceInterval95?.upper).toBeCloseTo(0.766585059, 8);
    expect(summary.percentileInterval95?.lower).toBeCloseTo(0.1225, 12);
    expect(summary.percentileInterval95?.upper).toBeCloseTo(0.9775, 12);
  });

  it("clips intervals to the metric's mathematical bounds", () => {
    const summary = summarizeMetric([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(summary.confidenceInterval95?.lower).toBe(0);
    expect(summary.confidenceInterval95?.upper).toBeLessThanOrEqual(1);
  });
});
