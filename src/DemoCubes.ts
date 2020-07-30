import * as THREE from "three";
import { BasicView } from "./base/BasicView";
import gsap, { Cubic, Bounce, Expo } from "gsap";

import "./styles/style.css";

window.addEventListener("DOMContentLoaded", () => new DemoCubesWorld());

export class DemoCubesWorld extends BasicView {
  /** オブジェクトの個数 */
  public static OBJ_NUM: number = 3000;
  public rot: number = 0; // カメラの円運動用
  /** カメラの座標管理用オブジェクト */
  private cameraPositionTarget: THREE.Vector3;
  /** カメラの視点管理用オブジェクト */
  private cameraLookAtTarget: THREE.Vector3;
  /** ボックスの境界線の更新のための配列 */
  private edgesPool: THREE.LineSegments[] = [];
  /** ボックスの一辺の長さ */
  private STEP: number = 100;

  constructor() {
    super();

    this.scene.fog = new THREE.Fog(0x000000, 100, 12500);
    this.cameraPositionTarget = new THREE.Vector3();
    this.cameraLookAtTarget = new THREE.Vector3();

    const timeline = gsap.timeline();
    timeline.repeat(-1);

    // カメラの動きをTweenで作る
    timeline.set(this, { rot: 135 }, 0);
    timeline.to(this, 7, { rot: 0, ease: Cubic.easeInOut }, 0);
    timeline.set(this.cameraPositionTarget, { y: 0 }, 0);
    timeline.to(
      this.cameraPositionTarget,
      6,
      { y: 400, ease: Cubic.easeInOut },
      0
    );
    timeline.set(this.cameraLookAtTarget, { y: 500 }, 0);
    timeline.to(this.cameraLookAtTarget, 6, { y: 0, ease: Cubic.easeInOut }, 0);

    const geometryBox = new THREE.BoxBufferGeometry(
      this.STEP,
      this.STEP,
      this.STEP,
      1,
      1,
      1
    );
    const edges = new THREE.EdgesGeometry(geometryBox);
    const materialBox = new THREE.LineBasicMaterial({ color: 0xff0000 });

    for (let i: number = 0; i < DemoCubesWorld.OBJ_NUM; i++) {
      // 立方体を作る
      const egh = new THREE.LineSegments(edges, materialBox);
      // ランダムに立方体を配置
      egh.position.x =
        this.STEP * Math.round((20000 * (Math.random() - 0.5)) / this.STEP) +
        this.STEP / 2;
      egh.position.z =
        this.STEP * Math.round((20000 * (Math.random() - 0.5)) / this.STEP) +
        this.STEP / 2;
      egh.updateMatrix();
      this.scene.add(egh);
      this.edgesPool.push(egh);

      // 秒数
      const sec: number = 2 * Math.random() + 3;

      // 立方体の落下する動き
      timeline.set(egh.position, { y: 8000 }, 0);
      timeline.to(
        egh.position,
        sec,
        { y: this.STEP / 2 + 1, ease: Bounce.easeOut },
        0
      );
    }

    this.createTimescale(timeline);

    timeline.call(
      () => {
        this.createTimescale(timeline);
      },
      [],
      timeline.duration()
    );

    // 地面
    const grid = new THREE.GridHelper(10000, this.STEP, 0x444444, 0x444444);
    this.scene.add(grid);

    this.startRendering();
  }

  /**
   * 毎フレーム実行される BasicView のライフサイクルイベントです。
   */
  public onTick(): void {
    this.camera.position.x = 1000 * Math.cos((this.rot * Math.PI) / 180);
    this.camera.position.z = 1000 * Math.sin((this.rot * Math.PI) / 180);
    this.camera.position.y = this.cameraPositionTarget.y;
    this.camera.lookAt(this.cameraLookAtTarget);

    this.edgesPool.forEach((item) => {
      item.updateMatrix();
    });
  }

  /**
   * タイムリマップを作成します。
   * @param timeline    タイムリマップさせたいインスタンス
   */
  private createTimescale(timeline: gsap.core.Timeline): void {
    const totalTimeline = gsap.timeline();
    totalTimeline
      .set(timeline, { timeScale: 1.5 })
      .to(timeline, 1.5, { timeScale: 0.01, ease: Expo.easeInOut }, "+=0.8")
      .to(timeline, 1.5, { timeScale: 1.5, ease: Expo.easeInOut }, "+=5");
  }
}
