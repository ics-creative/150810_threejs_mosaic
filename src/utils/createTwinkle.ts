import { getTslRuntime } from "./getTslRuntime";

type TwinkleTslRuntime = {
  add(...values: unknown[]): unknown;
  fract(value: unknown): unknown;
  hash(value: unknown): unknown;
  mix(...values: unknown[]): unknown;
  mul(...values: unknown[]): unknown;
  smoothstep(...values: unknown[]): unknown;
  sub(...values: unknown[]): unknown;
  time: unknown;
};

const { add, fract, hash, mix, mul, smoothstep, sub, time } = getTslRuntime<TwinkleTslRuntime>();

/**
 * 個体ごとに位相と周期が異なる高速な明滅を生成します。
 * rateScaleは1を基準にした点滅周波数で、0.5なら周期が2倍になります。
 */
export function createTwinkle(seed: unknown, rateScale = 1): unknown {
  const rate = mul(mix(36, 54, hash(mul(seed, 65_535))), rateScale);
  const clock = add(mul(time, rate), mul(seed, 131));
  return sub(1, smoothstep(0.08, 0.5, fract(clock)));
}
