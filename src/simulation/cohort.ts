import type { RandomGenerator } from "pure-rand";
import type { Composition, Learner, LearnerType } from "../types/model";
import { nextUnit } from "./random";

const TYPE_ORDER: LearnerType[] = ["paper", "digital", "hybrid"];
const BASE_AFFINITY: Record<LearnerType, { paper: number; digital: number }> = {
  paper: { paper: 0.9, digital: 0.3 },
  digital: { paper: 0.3, digital: 0.9 },
  hybrid: { paper: 0.8, digital: 0.8 },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function allocateCohortCounts(count: number, composition: Composition): Record<LearnerType, number> {
  const exact = TYPE_ORDER.map((type) => ({
    type,
    exact: (count * composition[type]) / 100,
  }));
  const allocated = Object.fromEntries(
    exact.map(({ type, exact: value }) => [type, Math.floor(value)]),
  ) as Record<LearnerType, number>;
  let remaining = count - Object.values(allocated).reduce((sum, value) => sum + value, 0);
  const ranked = exact
    .map(({ type, exact: value }, order) => ({ type, remainder: value - Math.floor(value), order }))
    .sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (let i = 0; i < remaining; i += 1) allocated[ranked[i].type] += 1;
  return allocated;
}

export function generateCohort(
  count: number,
  composition: Composition,
  generator: RandomGenerator,
): Learner[] {
  const counts = allocateCohortCounts(count, composition);
  const types = TYPE_ORDER.flatMap((type) => Array<LearnerType>(counts[type]).fill(type));
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextUnit(generator) * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types.map((type, id) => {
    const base = BASE_AFFINITY[type];
    return {
      id,
      type,
      paperAffinity: clamp01(base.paper + (nextUnit(generator) * 0.2 - 0.1)),
      digitalAffinity: clamp01(base.digital + (nextUnit(generator) * 0.2 - 0.1)),
      learningAbility: 0.5 + nextUnit(generator) * 0.5,
    };
  });
}
