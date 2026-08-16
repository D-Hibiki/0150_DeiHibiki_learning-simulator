import { xoroshiro128plus, type RandomGenerator } from "pure-rand";

const UINT32_RANGE = 0x1_0000_0000;

export function createBaseGenerator(seed: number): RandomGenerator {
  return xoroshiro128plus(seed | 0);
}

export function jumpGenerator(generator: RandomGenerator): RandomGenerator {
  if (!generator.jump) throw new Error("Selected PRNG does not support jump");
  return generator.jump();
}

export function nextUnit(generator: RandomGenerator): number {
  return (generator.unsafeNext() >>> 0) / UINT32_RANGE;
}
