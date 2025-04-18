import * as THREE from "three";

import { attribute, texture, mul, vec4 } from "three/tsl";

// PointsNodeMaterial を three/webgpu からインポート
import { PointsNodeMaterial } from "three/webgpu";

// InstancedMesh 関連をインポート
import {
  InstancedMesh,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Matrix4,
  PlaneGeometry,
  Color,
} from "three";

import Img from "../imgs/fire_particle.png";

/**
 * パーティクルクラウドを作成します。
 */
export function createParticleCloud(): THREE.InstancedMesh {
  const numParticles = 50000;
  const SIZE = 10000;
  const positions: { x: number; y: number; z: number }[] = [];
  const scales: number[] = [];
  const colors: number[] = [];
  const particleColor = new Color(0xffffff);

  for (let i = 0; i < numParticles; i++) {
    positions.push({
      x: SIZE * (Math.random() - 0.5),
      y: SIZE * (Math.random() - 0.5),
      z: SIZE * (Math.random() - 0.5),
    });
    scales.push(100.0);
    colors.push(particleColor.r, particleColor.g, particleColor.b);
  }

  const baseGeometry = new PlaneGeometry(1, 1);
  const instancedGeometry = new InstancedBufferGeometry();
  if (baseGeometry.index) {
    instancedGeometry.index = baseGeometry.index;
  }
  for (const name in baseGeometry.attributes) {
    instancedGeometry.setAttribute(name, baseGeometry.attributes[name]);
  }
  instancedGeometry.instanceCount = numParticles;

  instancedGeometry.setAttribute(
    "instanceScale",
    new InstancedBufferAttribute(new Float32Array(scales), 1),
  );
  instancedGeometry.setAttribute(
    "instanceColor",
    new InstancedBufferAttribute(new Float32Array(colors), 3),
  );

  // マテリアルを作成 (PointsNodeMaterial を使用)
  const material = new PointsNodeMaterial();

  // --- 以下の設定を段階的に戻す ---

  // アトリビュート参照ノードを作成
  const instanceScaleAttr = attribute("instanceScale", "float");
  const instanceColorAttr = attribute("instanceColor", "vec3");

  // テクスチャノードを作成
  const textureInstance = new THREE.TextureLoader().load(Img);
  textureInstance.colorSpace = THREE.SRGBColorSpace;
  const textureNode = texture(textureInstance);

  // ノードプロパティを設定
  material.sizeNode = instanceScaleAttr;
  material.colorNode = mul(textureNode, vec4(instanceColorAttr, 1.0));
  material.opacityNode = textureNode.a;

  // ブレンディングと透過設定
  material.blending = THREE.AdditiveBlending;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;

  const mesh = new InstancedMesh(instancedGeometry, material, numParticles);

  const matrix = new Matrix4();
  for (let i = 0; i < numParticles; i++) {
    const { x, y, z } = positions[i];
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  return mesh;
}
