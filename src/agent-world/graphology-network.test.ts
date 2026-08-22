import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_WORLD_CONFIG } from "./protocol";
import { createGraphologyClusteredNetwork } from "./graphology-network";

describe("createGraphologyClusteredNetwork", () => {
  it("creates a reproducible, symmetric, non-isolated network", () => {
    const first = createGraphologyClusteredNetwork(DEFAULT_AGENT_WORLD_CONFIG);
    const second = createGraphologyClusteredNetwork(DEFAULT_AGENT_WORLD_CONFIG);
    expect(first).toEqual(second);
    expect(first.citizenIds).toHaveLength(8);
    for (const citizenId of first.citizenIds) {
      expect(first.neighborsByCitizen[citizenId].length).toBeGreaterThan(0);
      expect(first.neighborsByCitizen[citizenId]).not.toContain(citizenId);
      for (const neighborId of first.neighborsByCitizen[citizenId]) {
        expect(first.neighborsByCitizen[neighborId]).toContain(citizenId);
      }
    }
  });
});
