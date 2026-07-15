import { getTslRuntime } from "./getTslRuntime";

type TwinkleTslRuntime = {
  add(...values: unknown[]): unknown;
  floor(value: unknown): unknown;
  fract(value: unknown): unknown;
  hash(value: unknown): unknown;
  mix(...values: unknown[]): unknown;
  mul(...values: unknown[]): unknown;
  smoothstep(...values: unknown[]): unknown;
  step(...values: unknown[]): unknown;
  sub(...values: unknown[]): unknown;
  time: unknown;
};

const { add, floor, fract, hash, mix, mul, smoothstep, step, sub, time } =
  getTslRuntime<TwinkleTslRuntime>();

/** 個体ごとに不規則な短い閃光を生成します。 */
export function createTwinkle(seed: unknown, eventThreshold: number): unknown {
  const rate = mix(18, 24, hash(mul(seed, 65_535)));
  const clock = add(mul(time, rate), mul(seed, 131));
  const event = step(eventThreshold, hash(add(floor(clock), mul(seed, 65_535))));
  const flash = sub(1, smoothstep(0.08, 0.5, fract(clock)));
  return mul(event, flash);
}
