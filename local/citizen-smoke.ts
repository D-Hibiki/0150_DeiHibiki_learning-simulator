import { decideWithOllama, getOllamaStatus } from "./ollama-policy";
import { deriveInferenceSeed, type CitizenObservation } from "../src/agent-world/protocol";

const status = await getOllamaStatus();
if (!status.available || !status.modelInstalled || !status.modelDigest) throw new Error(status.message);

const observation: CitizenObservation = {
  tick: 3,
  citizen: {
    id: 0,
    paperPreference: 0.78,
    digitalPreference: 0.62,
    adaptability: 0.66,
    socialSusceptibility: 0.55,
    resourceConstraint: 0.25,
    channel: "digital",
    lastOpportunityScore: 0.7,
    lastAccessSucceeded: true,
    continuityTicks: 2,
    cumulativeOpportunityScore: 1.4,
  },
  environment: {
    paperAvailability: 1,
    digitalAvailability: 0.15,
    paperFreshness: 1,
    digitalFreshness: 1,
  },
  neighborStates: [{ citizenId: 1, channel: "paper", lastOpportunityScore: 0.8, lastAccessSucceeded: true }],
  receivedMessages: [{
    messageId: "2:1:0",
    sourceId: 1,
    recipientId: 0,
    sentTick: 2,
    deliverTick: 3,
    channelSignal: "paper",
    strength: 0.8,
  }],
  memories: [],
};

const startedAt = performance.now();
const action = await decideWithOllama(observation, status.model, {
  inferenceSeed: deriveInferenceSeed(12345, observation.citizen.id, observation.tick),
  expectedModelDigest: status.modelDigest,
});
console.log(JSON.stringify({ action, latencyMs: Math.round(performance.now() - startedAt) }, null, 2));
