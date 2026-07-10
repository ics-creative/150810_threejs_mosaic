import type * as THREE from "three";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { gaussianBlur } from "three/examples/jsm/tsl/display/GaussianBlurNode.js";
import { getTslRuntime } from "../utils/getTslRuntime";

type PostProcessingTslRuntime = {
  add(...values: unknown[]): unknown;
  abs(value: unknown): unknown;
  distance(...values: unknown[]): unknown;
  emissive: unknown;
  max(...values: unknown[]): unknown;
  mix(...values: unknown[]): unknown;
  mrt(values: Record<string, unknown>): unknown;
  mul(...values: unknown[]): unknown;
  output: unknown;
  pass(...values: unknown[]): unknown;
  smoothstep(...values: unknown[]): unknown;
  sub(...values: unknown[]): unknown;
  uniform(value: unknown): unknown;
  vec2(...values: unknown[]): unknown;
  viewportUV: unknown;
};

const {
  abs,
  add,
  distance,
  emissive,
  max,
  mix,
  mrt,
  mul,
  output,
  pass,
  smoothstep,
  sub,
  uniform,
  vec2,
  viewportUV,
} = getTslRuntime<PostProcessingTslRuntime>();

/**
 * アイコンデモ用のポストエフェクトを構築します。
 *
 * 画面中央の水平帯にピントを残し、その外側をぼかします。
 * BloomはCharacterのemissive出力から生成し、チルトシフト後の映像へ加算します。
 * 最終合成では画面中央を基準に楕円状のVignetteをかけます。
 */
export function createIconPostProcessing(
  renderer: WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): RenderPipeline {
  const scenePass = pass(scene, camera) as {
    getTextureNode(name: string): unknown;
    setMRT(value: unknown): void;
  };
  scenePass.setMRT(mrt({ output, emissive }));
  const sceneColor = scenePass.getTextureNode("output");
  const emissiveColor = scenePass.getTextureNode("emissive");

  // ピント位置と遷移幅は画面のUV座標で指定する。
  const focusPosition = uniform(0.5);
  // 中央16%にピントを残し、その外側を広く使って周辺のボケへ緩やかにつなぐ。
  const focusRadius = uniform(0.08);
  const transitionWidth = uniform(0.36);
  const blurDirection = vec2(uniform(1.8), uniform(1.8));

  // ぼかしは半解像度で生成し、全画面エフェクトの負荷を抑える。
  const blurredScene = gaussianBlur(sceneColor as never, blurDirection as never, 4, {
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

  // Characterのemissiveと、シーンを42%へ抑えた高輝度粒子を1本のBloomへまとめる。
  // 背景画像は閾値を越えにくくし、Characterと粒子の発光だけを残す。
  const bloomSource = max(emissiveColor, mul(sceneColor, uniform(0.42)));
  const bloomNode = bloom(bloomSource as never, 1.7, 0.58, 0.16);

  // UV上の円形距離は横長画面では楕円として見えるため、自然なレンズ周辺減光になる。
  const distanceFromCenter = distance(viewportUV, vec2(0.5, 0.5));
  const vignetteAmount = smoothstep(uniform(0.12), uniform(0.62), distanceFromCenter);
  const vignetteBrightness = mix(uniform(1), uniform(0.08), vignetteAmount);

  const pipeline = new RenderPipeline(renderer);
  // 最終合成へ適用し、Bloomを含む映像全体を画面端で減衰させる。
  pipeline.outputNode = mul(add(tiltShiftedScene, bloomNode), vignetteBrightness) as never;
  return pipeline;
}
