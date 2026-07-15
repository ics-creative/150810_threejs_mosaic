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
  // 中央から中域まで解像感を残し、上下端だけをボケへつなぐ。
  const focusRadius = uniform(0.16);
  const transitionWidth = uniform(0.26);
  const blurDirection = vec2(uniform(1.35), uniform(1.35));

  // ぼかしだけ解像度を少し落とし、輪郭を保ちながら全画面処理の負荷を抑える。
  const blurredScene = gaussianBlur(sceneColor as never, blurDirection as never, 4, {
    resolutionScale: 0.75,
  });
  const viewportUvNode = viewportUV as { readonly y: unknown };
  const distanceFromFocus = abs(sub(viewportUvNode.y, focusPosition));
  const blurStrength = smoothstep(
    focusRadius,
    add(focusRadius, transitionWidth),
    distanceFromFocus,
  );
  const tiltShiftedScene = mix(sceneColor, blurredScene, blurStrength);

  // 平常時は閾値未満にし、瞬間的に光った粒子だけを短い範囲へ拡散する。
  const bloomNode = bloom(emissiveColor as never, 0.9, 0.34, 0.18);

  // UV上の円形距離は横長画面では楕円として見えるため、自然なレンズ周辺減光になる。
  const distanceFromCenter = distance(viewportUV, vec2(0.5, 0.5));
  const vignetteAmount = smoothstep(uniform(0.12), uniform(0.62), distanceFromCenter);
  const vignetteBrightness = mix(uniform(1), uniform(0.08), vignetteAmount);
  const bloomBrightness = mix(uniform(1), uniform(0.15), vignetteAmount);

  const pipeline = new RenderPipeline(renderer);
  // Bloomは端でも少し残し、Vignetteで光沢まで完全に潰さない。
  pipeline.outputNode = add(
    mul(tiltShiftedScene, vignetteBrightness),
    mul(bloomNode, bloomBrightness),
  ) as never;
  return pipeline;
}
