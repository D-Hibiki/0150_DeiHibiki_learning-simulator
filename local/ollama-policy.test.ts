import { describe, expect, it, vi } from "vitest";
import type { CitizenObservation } from "../src/agent-world/protocol";
import {
  CitizenDecisionRequestSchema,
  DEFAULT_OLLAMA_MODEL,
  OLLAMA_GENERATION_OPTIONS,
  decideWithOllama,
  type OllamaDecisionOptions,
} from "./ollama-policy";

const observation: CitizenObservation = {
  tick: 1,
  citizen: {
    id: 0,
    paperPreference: 0.7,
    digitalPreference: 0.3,
    adaptability: 0.5,
    socialSusceptibility: 0.4,
    resourceConstraint: 0.2,
    channel: "paper",
    lastOpportunityScore: 0,
    lastAccessSucceeded: false,
    continuityTicks: 0,
    cumulativeOpportunityScore: 0,
  },
  environment: {
    paperAvailability: 1,
    digitalAvailability: 1,
    paperFreshness: 1,
    digitalFreshness: 1,
  },
  neighborStates: [{
    citizenId: 1,
    channel: "digital",
    lastOpportunityScore: 0.6,
    lastAccessSucceeded: true,
  }],
  receivedMessages: [],
  memories: [],
};

describe("CitizenDecisionRequestSchema", () => {
  it("accepts the bounded Agent World observation contract", () => {
    expect(CitizenDecisionRequestSchema.parse({
      observation,
      model: DEFAULT_OLLAMA_MODEL,
      inferenceSeed: 123,
      modelDigest: "sha256:model",
    })).toEqual({
      observation,
      model: DEFAULT_OLLAMA_MODEL,
      inferenceSeed: 123,
      modelDigest: "sha256:model",
    });
  });

  it("rejects out-of-range and unknown fields before prompting Ollama", () => {
    expect(() => CitizenDecisionRequestSchema.parse({
      observation: {
        ...observation,
        environment: { ...observation.environment, digitalAvailability: 2 },
      },
    })).toThrow();

    expect(() => CitizenDecisionRequestSchema.parse({
      observation,
      injectedTool: "shell",
    })).toThrow();
  });

  it("sends the recorded seed and bounded generation options to the pinned model", async () => {
    const chat = vi.fn().mockResolvedValue({
      message: { content: JSON.stringify({ channel: "paper", effort: 0.8, message: null }) },
    });
    const list = vi.fn().mockResolvedValue({
      models: [{ name: DEFAULT_OLLAMA_MODEL, digest: "sha256:model" }],
    });

    await expect(decideWithOllama(observation, DEFAULT_OLLAMA_MODEL, {
      client: { chat, list } as unknown as NonNullable<OllamaDecisionOptions["client"]>,
      inferenceSeed: 123,
      expectedModelDigest: "sha256:model",
      timeoutMs: 1_000,
    })).resolves.toMatchObject({ citizenId: 0, tick: 1, channel: "paper" });
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        ...OLLAMA_GENERATION_OPTIONS,
        seed: 123,
      }),
    }));
  });

  it("stops retries when the inference deadline aborts", async () => {
    const chat = vi.fn(() => new Promise(() => undefined));
    const list = vi.fn().mockResolvedValue({
      models: [{ name: DEFAULT_OLLAMA_MODEL, digest: "sha256:model" }],
    });

    await expect(decideWithOllama(observation, DEFAULT_OLLAMA_MODEL, {
      client: { chat, list } as unknown as NonNullable<OllamaDecisionOptions["client"]>,
      inferenceSeed: 123,
      expectedModelDigest: "sha256:model",
      timeoutMs: 5,
    })).rejects.toThrow(/timed out/i);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("rejects a changed model digest before inference", async () => {
    const chat = vi.fn();
    const list = vi.fn().mockResolvedValue({
      models: [{ name: DEFAULT_OLLAMA_MODEL, digest: "sha256:changed" }],
    });

    await expect(decideWithOllama(observation, DEFAULT_OLLAMA_MODEL, {
      client: { chat, list } as unknown as NonNullable<OllamaDecisionOptions["client"]>,
      inferenceSeed: 123,
      expectedModelDigest: "sha256:approved",
      timeoutMs: 1_000,
    })).rejects.toThrow(/digest/);
    expect(chat).not.toHaveBeenCalled();
  });
});
