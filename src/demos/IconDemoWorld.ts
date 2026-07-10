import gsap, { Cubic, Quart } from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { IconsView } from "../base/IconsView";
import { createCanvas } from "../creators/createCanvas";
import { createParticleCloud } from "../creators/createParticleCloud";
import { FONT_ICON, loadFont } from "../utils/load-font";

type IconDemoConfig = {
  /** 順番に表示する単語と、その描画サイズ。 */
  words: readonly string[];
  fontSize: number;
  backgroundDistance: number;
  /** 数値なら連番、配列なら候補からランダムにアトラスを作る。 */
  iconSource: number | readonly number[];
  /** cameraWeightsはドリーズーム・俯瞰・対角、timeRemapWeightsは強・極低速・等速の順。 */
  cameraWeights: readonly number[];
  timeRemapWeights: readonly number[];
  advanceHue: boolean;
};

const COVER_SELECTOR = "#coverBlack";
const INTERACTION_TIME_SCALE = 0.1;
const CAMERA_MOTIONS = [
  { from: [200, -200, 1000], duration: 14, fov: [90, 45] },
  { from: [100, 1000, 1000], duration: 14, fov: null },
  { from: [-3000, 3000, 0], duration: 15, fov: null },
] as const;

export function startIconDemo(config: IconDemoConfig): void {
  window.addEventListener(
    "DOMContentLoaded",
    async () => {
      await loadFont();
      const world = new IconDemoWorld(config);
      await world.startRendering();
      document.body.classList.add("is-ready");
    },
    { once: true },
  );
}

/** 2つのアイコンデモに共通するシーン構築・抽選・単語切り替えを管理する。 */
class IconDemoWorld extends IconsView {
  private controls: OrbitControls | null = null;
  private readonly activePointerIds = new Set<number>();
  private readonly cameraPositionTarget = new THREE.Vector3();
  private readonly particleCloud: THREE.Group;

  constructor(private readonly config: IconDemoConfig) {
    super();
    this.createWorld();
    this.cameraPositionTarget.copy(this.camera.position);
    this.createParticle(this.createIconAtlas());
    this.particleCloud = createParticleCloud();
    this.scene.add(this.particleCloud);
  }

  /** WebGPU初期化中にTimelineだけが進まないよう、初回描画後に演出を開始する。 */
  public override async startRendering(): Promise<void> {
    await super.startRendering();
    this.setupInteraction();
    this.playNextWord();
  }

  public override onTick(): void {
    super.onTick();

    if (this.activePointerIds.size === 0) {
      this.camera.position.copy(this.cameraPositionTarget);
      this.camera.lookAt(this.HELPER_ZERO);
    } else {
      this.controls!.update();
    }

    this.updateBackground(this.config.backgroundDistance);
  }

  private playNextWord(): void {
    const word = this.config.words[this._wordIndex]!;
    this._wordIndex = (this._wordIndex + 1) % this.config.words.length;
    const canvas = createCanvas(
      word,
      this.config.fontSize * this.LETTER_DENSITY,
      this.CANVAS_W,
      this.CANVAS_H,
    );
    const timeline = gsap.timeline({ onComplete: () => this.transitionToNextWord() });

    // 粒子・カメラ・黒マットを同じTimelineへ置き、1つのtimeScaleで同期させる。
    this.createLetter(canvas, timeline);
    this.addCameraMotion(timeline);
    timeline.to(COVER_SELECTOR, { opacity: 0, duration: 1 }, 0);
    this.applyTimeRemap(timeline);

    if (this.config.advanceHue) {
      this._background.material.color.setHSL(this._hue, 1, 0.5);
      this._hue = (this._hue + 0.2) % 1;
    }
  }

  private addCameraMotion(timeline: gsap.core.Timeline): void {
    const motion = CAMERA_MOTIONS[this.pickIndex(this.config.cameraWeights)]!;
    const [x, y, z] = motion.from;

    timeline
      .set(this.cameraPositionTarget, { x, y, z }, 0)
      .to(
        this.cameraPositionTarget,
        { x: 0, y: 0, z: 5000, duration: motion.duration, ease: Quart.easeInOut },
        0,
      );

    // FOVも動かす先頭プリセットだけ、カメラ移動へドリーズームを重ねる。
    if (motion.fov) {
      timeline
        .set(this.camera, { fov: motion.fov[0] }, 0)
        .to(
          this.camera,
          { fov: motion.fov[1], duration: motion.duration, ease: Quart.easeInOut },
          0,
        );
    }
  }

  private applyTimeRemap(timeline: gsap.core.Timeline): void {
    const mode = this.pickIndex(this.config.timeRemapWeights);
    if (mode === 2) {
      timeline.timeScale(1);
      return;
    }

    timeline.timeScale(mode === 0 ? 3 : 6);

    // 別Timelineから操作しないと、減速した瞬間に速度制御自身まで遅くなってしまう。
    const startController = (): void => {
      const controller = gsap.timeline();
      if (mode === 0) {
        controller
          .to(timeline, { timeScale: 0.05, duration: 1, ease: Cubic.easeInOut })
          .to(timeline, { timeScale: 3, duration: 0.5, ease: Cubic.easeInOut }, 3.5)
          .to(timeline, { timeScale: 0.05, duration: 0.5, ease: Cubic.easeInOut }, 4)
          .to(timeline, { timeScale: 5, duration: 2, ease: Cubic.easeIn }, 9);
      } else {
        controller
          .to(timeline, { timeScale: 0.005, duration: 4, ease: Cubic.easeOut })
          .to(timeline, { timeScale: 2, duration: 4, ease: Cubic.easeIn }, 5);
      }
    };

    // 強いリマップはメインTimelineが3.5秒へ到達してから、極低速版は直ちに開始する。
    if (mode === 0) {
      timeline.call(startController, [], 3.5);
    } else {
      startController();
    }
  }

  private transitionToNextWord(): void {
    // 黒マットはtimeScaleの影響を受けない別Tweenにし、常に1秒で次の周期へ移る。
    gsap.to(COVER_SELECTOR, {
      opacity: 1,
      duration: 1,
      onComplete: () => this.playNextWord(),
    });
  }

  /** Canvasを押している間だけ、自動演出から手動カメラへ切り替えます。 */
  private setupInteraction(): void {
    const canvas = this.renderer!.domElement;
    this.controls = this.createControls();

    // captureで先にControlsを有効化し、最初のpointerdownからドラッグを認識させる。
    canvas.addEventListener("pointerdown", this.handlePointerDown, { capture: true });
    canvas.addEventListener("lostpointercapture", this.handlePointerEnd);
    window.addEventListener("pointerup", this.handlePointerEnd);
    window.addEventListener("pointercancel", this.handlePointerEnd);
    window.addEventListener("blur", this.handleWindowBlur);
    document.body.classList.add("has-hold-interaction");
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.activePointerIds.has(event.pointerId)) {
      return;
    }

    this.activePointerIds.add(event.pointerId);
    if (this.activePointerIds.size > 1) {
      return;
    }

    this.controls!.target.copy(this.HELPER_ZERO);
    this.controls!.update();
    this.controls!.enabled = true;
    this.setInteractionActive(true);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (this.activePointerIds.delete(event.pointerId) && this.activePointerIds.size === 0) {
      this.endInteraction();
    }
  };

  private readonly handleWindowBlur = (): void => {
    if (this.activePointerIds.size > 0) {
      this.activePointerIds.clear();
      this.endInteraction();
    }
  };

  private endInteraction(): void {
    // disposeして内部の追跡ポインターも破棄し、blurやcapture喪失後へ持ち越さない。
    this.controls!.dispose();
    this.camera.position.copy(this.cameraPositionTarget);
    this.camera.lookAt(this.HELPER_ZERO);
    this.controls = this.createControls();
    this.setInteractionActive(false);
  }

  private createControls(): OrbitControls {
    const controls = new OrbitControls(this.camera, this.renderer!.domElement);
    controls.enabled = false;
    controls.target.copy(this.HELPER_ZERO);
    return controls;
  }

  private setInteractionActive(active: boolean): void {
    // 操作用ワイヤーフレームだけを残し、背景の色面と装飾粒子を隠す。
    this._background.visible = !active;
    this.particleCloud.visible = !active;
    this.setDebugView(active);
    document.body.classList.toggle("is-interacting", active);

    // ルートの速度を変え、各Timelineが持つタイムリマップの比率はそのまま維持する。
    gsap.globalTimeline.timeScale(active ? INTERACTION_TIME_SCALE : 1);
  }

  private createIconAtlas(): THREE.CanvasTexture {
    const cellSize = 256;
    const canvas = document.createElement("canvas");
    canvas.width = cellSize * this._matrixLength;
    canvas.height = cellSize * this._matrixLength;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.font = `200px ${FONT_ICON}`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    // 8×8の各セルへ1アイコンずつ描き、全InstancedMeshで同じTextureを共有する。
    const source = this.config.iconSource;
    for (let index = 0; index < this._matrixLength ** 2; index++) {
      const code =
        typeof source === "number"
          ? source + index
          : source[Math.floor(Math.random() * source.length)];
      const x = cellSize * (index % this._matrixLength) + cellSize / 2;
      const y = cellSize * Math.floor(index / this._matrixLength) + cellSize / 2;
      context.fillText(String.fromCharCode(code), x, y);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private pickIndex(weights: readonly number[]): number {
    const threshold = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    let sum = 0;
    return weights.findIndex((weight) => (sum += weight) >= threshold);
  }
}
