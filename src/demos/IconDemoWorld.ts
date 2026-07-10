import gsap, { Cubic, Quart } from "gsap";
import * as THREE from "three";
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
  constructor(private readonly config: IconDemoConfig) {
    super();
    this.createWorld();
    this.createParticle(this.createIconAtlas());
    this.scene.add(createParticleCloud());
  }

  /** WebGPU初期化中にTimelineだけが進まないよう、初回描画後に演出を開始する。 */
  public override async startRendering(): Promise<void> {
    await super.startRendering();
    this.playNextWord();
  }

  public override onTick(): void {
    super.onTick();
    this.camera.lookAt(this.HELPER_ZERO);
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
      .set(this.camera.position, { x, y, z }, 0)
      .to(
        this.camera.position,
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
