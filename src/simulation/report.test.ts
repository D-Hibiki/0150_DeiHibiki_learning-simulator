import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { runExperiment } from "./experiment";
import { buildReportArtifact, reportCsv } from "./report";

describe("report artifact", () => {
  it("preserves reproducibility metadata and explicit limitations", () => {
    const result = runExperiment(DEFAULT_CONFIG);
    const artifact = buildReportArtifact(result, {
      appVersion: "test",
      generatedAt: "2026-08-16T00:00:00.000Z",
    });
    expect(artifact.provenance).toMatchObject({
      appVersion: "test",
      modelVersion: "1.0.0",
      prng: "xoroshiro128plus",
      streamDerivation: "jump-2^64",
      percentileMethod: "R-type-7",
    });
    expect(artifact.scope.dataKind).toBe("synthetic");
    expect(artifact.scope.limitations.join(" ")).toMatch(/do not establish causal/);
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
  });

  it("exports a BOM-prefixed tidy trial CSV and summary CSV", () => {
    const result = runExperiment({ ...DEFAULT_CONFIG, trialCount: 10, learnerCount: 10 });
    const files = reportCsv(buildReportArtifact(result, { generatedAt: "2026-08-16T00:00:00.000Z" }));
    expect(files.summaryCsv.startsWith("\ufeff")).toBe(true);
    expect(files.trialsCsv.startsWith("\ufeff")).toBe(true);
    expect(files.trialsCsv.trim().split("\n")).toHaveLength(1 + 30);
    expect(files.trialsCsv).toContain("trial_stream_id");
    expect(files.summaryCsv).toContain("paired_difference");
  });
});
