import type * as THREE from "three";
import { RenderPipeline, TSL, type WebGPURenderer } from "three/webgpu";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { gaussianBlur } from "three/examples/jsm/tsl/display/GaussianBlurNode.js";

// TypeScript 7でTSLの型全体を展開すると型チェックが著しく遅くなるため、
// このファイルで使用する実行時APIの形だけを局所的に定義する。
type PostProcessingTslRuntime = {
  add(...values: unknown[]): unknown;
  abs(value: unknown): unknown;
  distance(...values: unknown[]): unknown;
  mix(...values: unknown[]): unknown;
  mul(...values: unknown[]): unknown;
  pass(...values: unknown[]): unknown;
  smoothstep(...values: unknown[]): unknown;
  sub(...values: unknown[]): unknown;
  uniform(value: unknown): unknown;
  vec2(...values: unknown[]): unknown;
  viewportUV: unknown;
};

const { abs, add, distance, mix, mul, pass, smoothstep, sub, uniform, vec2, viewportUV } =
  TSL as unknown as PostProcessingTslRuntime;

/**
 * アイコンデモ用のポストエフェクトを構築します。
 *
 * 画面中央の水平帯にピントを残し、その外側をぼかします。
 * Bloomは元のシーンから明部を抽出し、チルトシフト後の映像へ加算します。
 * 最終合成では画面の四隅を暗くし、視線を中央へ集めます。
 */
export function createIconPostProcessing(
  renderer: WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): RenderPipeline {
  const scenePass = pass(scene, camera) as {
    getTextureNode(): unknown;
  };
  const sceneColor = scenePass.getTextureNode();

  // ピント位置と遷移幅は画面のUV座標で指定する。
  const focusPosition = uniform(0.5);
  const focusRadius = uniform(0.14);
  const transitionWidth = uniform(0.24);
  const blurDirection = vec2(uniform(1.2), uniform(1.2));

  // ぼかしは半解像度で生成し、全画面エフェクトの負荷を抑える。
  const blurredScene = gaussianBlur(sceneColor as never, blurDirection as never, 3, {
    resolutionScale: 0.5,
  });
  const viewportUvNode = viewportUV as { readonly y: unknown };
  const distanceFromFocus = abs(sub(viewportUvNode.y, focusPosition));
  const blurStrength = smoothstep(
    focusRadius,
    add(focusRadius, transitionWidth),
    distanceFromFocus,
  );
  const tiltShiftedScene = mix(sceneColor, blurredScene, blurStrength);

  // 高輝度部分だけを広げ、アイコンと近景粒子へ発光感を与える。
  const bloomNode = bloom(sceneColor as never, 1.35, 0.5, 0.58);

  // 画面中央からの距離に応じて、外周を滑らかに暗くする。
  const distanceFromCenter = distance(viewportUV, vec2(0.5, 0.5));
  const vignetteAmount = smoothstep(uniform(0.24), uniform(0.68), distanceFromCenter);
  const vignetteBrightness = mix(uniform(1), uniform(0.3), vignetteAmount);
  const vignettedScene = mul(tiltShiftedScene, vignetteBrightness);

  const pipeline = new RenderPipeline(renderer);
  // BloomをVignetteの後で加算し、外周の発光まで減衰させない。
  pipeline.outputNode = add(vignettedScene, bloomNode) as never;
  return pipeline;
}
