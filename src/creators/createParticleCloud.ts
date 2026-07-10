import * as THREE from "three";

// PointsNodeMaterial を three/webgpu からインポート
import { PointsNodeMaterial } from "three/webgpu";
import Img from "../imgs/fire_particle.png";
import { getTslRuntime } from "../utils/getTslRuntime";

type ParticleTslRuntime = {
  attribute(name: string, type: string): unknown;
  mul(...values: unknown[]): unknown;
  texture(value: THREE.Texture): unknown;
  vec4(...values: unknown[]): unknown;
};

const { attribute, mul, texture, vec4 } = getTslRuntime<ParticleTslRuntime>();
const CLOUD_SIZE = 14_000;
const INNER_SPREAD = 0.3;

// 広がりを中心側へ寄せ、前景・中景にも粒子の層を作る。
function getParticleSpread(): number {
  return CLOUD_SIZE * (INNER_SPREAD + (1 - INNER_SPREAD) * Math.random() ** 2);
}

// カメラの主移動域（+Z）へ奥行きを寄せ、近景粒子を残す。
function getParticleDepth(spread: number): number {
  return spread * (Math.random() - 0.25);
}

/**
 * パーティクルクラウドを作成します。
 */
export function createParticleCloud(): THREE.Group {
  const dustCount = 60_000;
  const spriteCount = 4_000;
  const positions = new Float32Array(dustCount * 3);
  const colors = new Float32Array(dustCount * 3);
  const particleColor = new THREE.Color(0xffffff);

  // 背景を埋める微粒子の位置と色を生成する。
  for (let i = 0; i < dustCount; i++) {
    const spread = getParticleSpread();
    positions[i * 3] = spread * (Math.random() - 0.5);
    positions[i * 3 + 1] = spread * (Math.random() - 0.5);
    positions[i * 3 + 2] = getParticleDepth(spread);

    const hue = 0.52 + 0.14 * Math.random();
    particleColor.setHSL(hue, 0.2 + 0.35 * Math.random(), 0.55 + 0.35 * Math.random());
    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
  }

  // 遠景の微粒子はPointsとして一括描画する。
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  dustGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const dustMaterial = new PointsNodeMaterial({
    color: 0xffffff,
    opacity: 0.7,
    transparent: true,
    vertexColors: true,
  });
  dustMaterial.blending = THREE.AdditiveBlending;
  dustMaterial.depthTest = false;
  dustMaterial.depthWrite = false;

  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;

  // 近景の粒子はカメラに正対するスプライトとして描画する。
  const baseGeometry = new THREE.PlaneGeometry(1, 1);
  const spriteGeometry = new THREE.InstancedBufferGeometry();
  if (baseGeometry.index) {
    spriteGeometry.index = baseGeometry.index;
  }
  for (const name in baseGeometry.attributes) {
    spriteGeometry.setAttribute(name, baseGeometry.attributes[name]);
  }

  const spriteScales = new Float32Array(spriteCount);
  const spriteColors = new Float32Array(spriteCount * 3);
  for (let i = 0; i < spriteCount; i++) {
    spriteScales[i] = 20 + 70 * Math.pow(Math.random(), 2);

    particleColor.setHSL(
      0.52 + 0.14 * Math.random(),
      0.2 + 0.35 * Math.random(),
      0.65 + 0.3 * Math.random(),
    );
    spriteColors[i * 3] = particleColor.r;
    spriteColors[i * 3 + 1] = particleColor.g;
    spriteColors[i * 3 + 2] = particleColor.b;
  }

  spriteGeometry.instanceCount = spriteCount;
  spriteGeometry.setAttribute("instanceScale", new THREE.InstancedBufferAttribute(spriteScales, 1));
  spriteGeometry.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(spriteColors, 3));

  const scaleNode = attribute("instanceScale", "float");
  const colorNode = attribute("instanceColor", "vec3");
  const spriteTexture = new THREE.TextureLoader().load(Img);
  spriteTexture.colorSpace = THREE.SRGBColorSpace;
  const spriteTextureNode = texture(spriteTexture) as { readonly a: unknown };

  const spriteMaterial = new PointsNodeMaterial();
  spriteMaterial.sizeNode = scaleNode as never;
  spriteMaterial.colorNode = mul(spriteTextureNode, vec4(colorNode, 1)) as never;
  spriteMaterial.opacityNode = spriteTextureNode.a as never;
  spriteMaterial.transparent = true;
  spriteMaterial.alphaTest = 0.01;
  spriteMaterial.blending = THREE.AdditiveBlending;
  spriteMaterial.depthTest = false;
  spriteMaterial.depthWrite = false;

  const sprites = new THREE.InstancedMesh(spriteGeometry, spriteMaterial, spriteCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < spriteCount; i++) {
    const spread = getParticleSpread();
    matrix.setPosition(
      spread * (Math.random() - 0.5),
      spread * (Math.random() - 0.5),
      getParticleDepth(spread),
    );
    sprites.setMatrixAt(i, matrix);
  }
  sprites.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  sprites.instanceMatrix.needsUpdate = true;
  sprites.frustumCulled = false;

  const cloud = new THREE.Group();
  cloud.add(dust, sprites);

  return cloud;
}
