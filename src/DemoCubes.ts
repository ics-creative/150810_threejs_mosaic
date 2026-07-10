import gsap, { Bounce, Cubic, Expo } from "gsap";
import * as THREE from "three";
import { BasicView } from "./base/BasicView";
import "./styles/style.css";

window.addEventListener("DOMContentLoaded", () => new DemoCubesWorld(), { once: true });

export class DemoCubesWorld extends BasicView {
  private static readonly OBJECT_COUNT = 3000;
  private static readonly GRID_STEP = 100;

  private rot = 0;
  private readonly cameraPositionTarget = new THREE.Vector3();
  private readonly cameraLookAtTarget = new THREE.Vector3();

  constructor() {
    super();
    this.scene.fog = new THREE.Fog(0x000000, 100, 12_500);

    const timeline = this.createAnimationTimeline();
    this.createCubeField(timeline);
    this.scene.add(new THREE.GridHelper(10_000, DemoCubesWorld.GRID_STEP, 0x444444, 0x444444));

    this.playTimeRemap(timeline);
    timeline.call(() => this.playTimeRemap(timeline), [], timeline.duration());
    void this.startRendering();
  }

  public override onTick(): void {
    this.camera.position.x = 1000 * Math.cos(THREE.MathUtils.degToRad(this.rot));
    this.camera.position.z = 1000 * Math.sin(THREE.MathUtils.degToRad(this.rot));
    this.camera.position.y = this.cameraPositionTarget.y;
    this.camera.lookAt(this.cameraLookAtTarget);
  }

  /** カメラ移動を含む、繰り返し再生するメインタイムラインを生成します。 */
  private createAnimationTimeline(): gsap.core.Timeline {
    const timeline = gsap.timeline({ repeat: -1 });
    timeline
      .set(this, { rot: 135 }, 0)
      .to(this, { rot: 0, duration: 7, ease: Cubic.easeInOut }, 0)
      .set(this.cameraPositionTarget, { y: 0 }, 0)
      .to(this.cameraPositionTarget, { y: 400, duration: 6, ease: Cubic.easeInOut }, 0)
      .set(this.cameraLookAtTarget, { y: 500 }, 0)
      .to(this.cameraLookAtTarget, { y: 0, duration: 6, ease: Cubic.easeInOut }, 0);
    return timeline;
  }

  /** 共有ジオメトリを使うワイヤーフレーム群と落下モーションを生成します。 */
  private createCubeField(timeline: gsap.core.Timeline): void {
    const step = DemoCubesWorld.GRID_STEP;
    const box = new THREE.BoxGeometry(step, step, step);
    const edges = new THREE.EdgesGeometry(box);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });

    for (let index = 0; index < DemoCubesWorld.OBJECT_COUNT; index++) {
      const cube = new THREE.LineSegments(edges, material);
      cube.position.x = step * Math.round((20_000 * (Math.random() - 0.5)) / step) + step / 2;
      cube.position.z = step * Math.round((20_000 * (Math.random() - 0.5)) / step) + step / 2;
      this.scene.add(cube);

      timeline
        .set(cube.position, { y: 8000 }, 0)
        .to(
          cube.position,
          { y: step / 2 + 1, duration: 2 * Math.random() + 3, ease: Bounce.easeOut },
          0,
        );
    }
  }

  /** メインタイムラインの速度を別タイムラインから緩急制御します。 */
  private playTimeRemap(timeline: gsap.core.Timeline): void {
    gsap
      .timeline()
      .set(timeline, { timeScale: 1.5 })
      .to(timeline, { timeScale: 0.01, duration: 1.5, ease: Expo.easeInOut }, "+=0.8")
      .to(timeline, { timeScale: 1.5, duration: 1.5, ease: Expo.easeInOut }, "+=5");
  }
}
