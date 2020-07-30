import * as THREE from "three";

import Img from "../imgs/fire_particle.png";

/**
 * パーティクルクラウドを作成します。
 */
export function createParticleCloud(): THREE.Points {
  // 形状データを作成
  const geometry = new THREE.Geometry();
  const numParticles = 50000;
  const SIZE = 10000;
  for (let i = 0; i < numParticles; i++) {
    geometry.vertices.push(
      new THREE.Vector3(
        SIZE * (Math.random() - 0.5),
        SIZE * (Math.random() - 0.5),
        SIZE * (Math.random() - 0.5)
      )
    );
  }

  // マテリアルを作成
  const texture = new THREE.TextureLoader().load(Img);
  const material = new THREE.PointsMaterial({
    size: 20,
    color: 0x666666,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    map: texture,
  });

  // 物体を作成
  const points = new THREE.Points(geometry, material);
  return points;
}
