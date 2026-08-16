import type { SimulationConfig, TrialCount } from "../types/model";

export const MODEL_VERSION = "1.0.0" as const;

export const ENVIRONMENTS = {
  normal: {
    paperAvailability: 1,
    digitalAvailability: 1,
    paperFreshness: 1,
    digitalFreshness: 1,
  },
  blackout: {
    paperAvailability: 1,
    digitalAvailability: 0.2,
    paperFreshness: 1,
    digitalFreshness: 1,
  },
  rapidUpdate: {
    paperAvailability: 1,
    digitalAvailability: 1,
    paperFreshness: 0.5,
    digitalFreshness: 1,
  },
} as const;

export const DEFAULT_CONFIG: SimulationConfig = {
  learnerCount: 100,
  composition: { paper: 33, digital: 33, hybrid: 34 },
  successThreshold: 0.5,
  environmentId: "normal",
  environment: { ...ENVIRONMENTS.normal },
  baseSeed: 12345,
  trialCount: 1,
};

const TRIAL_COUNTS = new Set<TrialCount>([1, 10, 100, 1000]);

function inUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.learnerCount) || config.learnerCount < 10 || config.learnerCount > 10_000) {
    throw new RangeError("learnerCount must be an integer from 10 to 10000");
  }
  if (!TRIAL_COUNTS.has(config.trialCount)) {
    throw new RangeError("trialCount must be one of 1, 10, 100, or 1000");
  }
  if (!Number.isInteger(config.baseSeed) || config.baseSeed < 0 || config.baseSeed > 0xffff_ffff) {
    throw new RangeError("baseSeed must be an unsigned 32-bit integer");
  }
  if (!inUnitInterval(config.successThreshold)) {
    throw new RangeError("successThreshold must be from 0 to 1");
  }
  const shares = Object.values(config.composition);
  if (shares.some((share) => !Number.isFinite(share) || share < 0)) {
    throw new RangeError("composition shares must be finite non-negative numbers");
  }
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (Math.abs(total - 100) > 1e-9) {
    throw new RangeError("composition shares must total 100");
  }
  if (Object.values(config.environment).some((value) => !inUnitInterval(value))) {
    throw new RangeError("environment values must be from 0 to 1");
  }
}
