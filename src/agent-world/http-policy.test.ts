import { afterEach, describe, expect, it, vi } from "vitest";
import type { CitizenObservation } from "./protocol";
import { deriveInferenceSeed } from "./protocol";
import { createHttpCitizenDecisionProvider } from "./http-policy";

const observation: CitizenObservation = {
  tick: 1,
  citizen: {
    id: 0,
    paperPreference: 0.8,
    digitalPreference: 0.4,
    adaptability: 0.5,
    socialSusceptibility: 0.5,
    resourceConstraint: 0.2,
    channel: "paper",
    lastOpportunityScore: 0,
    lastAccessSucceeded: false,
    continuityTicks: 0,
    cumulativeOpportunityScore: 0,
  },
  environment: { paperAvailability: 1, digitalAvailability: 1, paperFreshness: 1, digitalFreshness: 1 },
  neighborStates: [],
  receivedMessages: [],
  memories: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("createHttpCitizenDecisionProvider", () => {
  it("returns the validated gateway action", async () => {
    const action = { citizenId: 0, tick: 1, channel: "paper" as const, effort: 0.8, message: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ action }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createHttpCitizenDecisionProvider({
      worldSeed: 12345,
      modelDigest: "sha256:model",
    }).decide(observation)).resolves.toEqual(action);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      observation,
      inferenceSeed: deriveInferenceSeed(12345, observation.citizen.id, observation.tick),
      modelDigest: "sha256:model",
    });
  });

  it("fails the run instead of silently replacing an invalid LLM decision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status: 503 })));
    await expect(createHttpCitizenDecisionProvider({
      worldSeed: 12345,
      modelDigest: "sha256:model",
    }).decide(observation)).rejects.toThrow("Citizen decision failed");
  });
});
