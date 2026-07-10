import gsap, { Cubic, Expo, Quart } from "gsap";
import MotionPathPlugin from "gsap/dist/MotionPathPlugin";
import * as THREE from "three";
import { changeUvs } from "../creators/changeUvs";
import { createIconPostProcessing } from "../creators/createIconPostProcessing";
import ImgBg from "../imgs/bg.jpg";
import { getTslRuntime } from "../utils/getTslRuntime";
import { BasicView } from "./BasicView";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type RenderPipeline } from "three/webgpu";

gsap.registerPlugin(MotionPathPlugin);

type IconParticle = {
  atlasIndex: number;
  instanceIndex: number;
  position: THREE.Vector3;
  rotationZ: number;
  scale: number;
  color: THREE.Color;
  visible: boolean;
};

type LetterDot = {
  x: number;
  y: number;
};

type IconTslRuntime = {
  instanceColor: unknown;
  luminance(value: unknown): unknown;
  materialColor: unknown;
  mix(...values: unknown[]): unknown;
  mul(...values: unknown[]): unknown;
  texture(value: THREE.Texture): unknown;
  vec4(...values: unknown[]): unknown;
};

const { instanceColor, luminance, materialColor, mix, mul, texture, vec4 } =
  getTslRuntime<IconTslRuntime>();
const BACKGROUND_SATURATION = 0.78;
// MRTのemissiveへ出す強度。Bloom前の本体色が白飛びしない範囲に留める。
const CHARACTER_EMISSIVE_INTENSITY = 0.68;

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected readonly HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  /** レター生成用Canvasのサンプリング倍率です。 */
  protected readonly LETTER_DENSITY = 2;
  protected readonly CANVAS_W = 250 * this.LETTER_DENSITY;
  protected readonly CANVAS_H = 40 * this.LETTER_DENSITY;
  protected readonly LETTER_SPACING = 30 / this.LETTER_DENSITY;
  protected readonly LETTER_PARTICLE_SIZE = 40 / this.LETTER_DENSITY;

  protected readonly _matrixLength = 8;
  protected _particleList: IconParticle[] = [];
  protected _particleMeshes: THREE.InstancedMesh[] = [];
  protected _activeParticleCount = 0;
  protected _wrap!: THREE.Object3D;
  protected _wordIndex = 0;
  protected _background!: THREE.Mesh<THREE.PlaneGeometry, MeshBasicNodeMaterial>;
  private readonly _particleDummy = new THREE.Object3D();
  private readonly _hiddenParticleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  // 操作中は文字ごとのインスタンス色を使わず、形状だけを白線で確認できるようにする。
  private readonly _wireframeMaterial = new MeshBasicNodeMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.75,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: false,
  });
  private _particleMaterial!: MeshStandardNodeMaterial;
  private _postProcessing: RenderPipeline | null = null;
  private _isDebugView = false;
  /** 色相 0.0〜1.0 */
  protected _hue = 0.6;

  protected createWorld(): void {
    // 描画範囲と初期位置を、文字パーティクルの移動距離に合わせる。
    this.camera.far = 100000;
    this.camera.near = 1;
    this.camera.position.z = 5000;
    this.camera.lookAt(this.HELPER_ZERO);

    // カメラ移動中も視錐台を覆える背景プレーンを用意する。
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    const backgroundTexture = new THREE.TextureLoader().load(ImgBg);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    const mat = new MeshBasicNodeMaterial({ map: backgroundTexture });
    const backgroundColor = materialColor as { readonly rgb: unknown; readonly a: unknown };
    const grayscale = luminance(backgroundColor.rgb);
    // Textureと色相アニメーションを合成した後で彩度を落とし、両デモの濃さを揃える。
    mat.colorNode = vec4(
      mix(grayscale, backgroundColor.rgb, BACKGROUND_SATURATION),
      backgroundColor.a,
    ) as never;

    const bg = new THREE.Mesh(plane, mat);
    this.scene.add(bg);
    this._background = bg;

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 1, +1).normalize();
    this.scene.add(light);

    this._wrap = new THREE.Object3D();
    this.scene.add(this._wrap);
  }

  public override onTick(): void {
    super.onTick();

    this.updateParticleInstances(this._activeParticleCount);
  }

  /**
   * レンダラーの初期化後にポストエフェクトを構築します。
   */
  public override async startRendering(): Promise<void> {
    await super.startRendering();

    if (this.renderer) {
      this._postProcessing = createIconPostProcessing(this.renderer, this.scene, this.camera);
      this.render();
    }
  }

  /**
   * ポストエフェクトが利用できる場合は、RenderPipelineを通してシーンを描画します。
   */
  public override render(): void {
    if (this._postProcessing && !this._isDebugView) {
      this._postProcessing.render();
      return;
    }

    super.render();
  }

  /** 押下中は文字をワイヤーフレーム化し、加工前のシーンを直接描画します。 */
  protected setDebugView(enabled: boolean): void {
    this._isDebugView = enabled;
    const material = enabled ? this._wireframeMaterial : this._particleMaterial;

    for (const mesh of this._particleMeshes) {
      if (mesh) {
        mesh.material = material;
      }
    }
  }

  /**
   * 背景プレーンをカメラの反対方向へ配置し、現在の視錐台全体を覆う大きさに更新します。
   *
   * @param distance 背景プレーンを原点からカメラ反対方向へ離す距離です。
   */
  protected updateBackground(distance: number): void {
    // fov は GSAP で更新されるため、背景サイズを計算する前に投影行列へ反映する。
    this.camera.updateProjectionMatrix();

    // カメラ位置の逆方向に背景を置くことで、カメラが移動しても背景が常に奥側に見えるようにする。
    const vec = this.camera.position.clone();
    vec.negate();
    vec.normalize();
    vec.multiplyScalar(distance);
    this._background.position.copy(vec);
    this._background.lookAt(this.camera.position);

    // 背景位置での視錐台サイズを計算し、横長・縦長どちらの画面でも端まで覆える正方形にする。
    const viewDistance = this.camera.position.distanceTo(this._background.position);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * viewDistance;
    const viewWidth = viewHeight * this.camera.aspect;
    const coverSize = Math.max(viewWidth, viewHeight) * 1.05;
    this._background.scale.set(coverSize, coverSize, 1);
  }

  protected createParticle(sharedTexture: THREE.Texture): void {
    const ux = 1 / this._matrixLength;
    const uy = 1 / this._matrixLength;

    const particleCount = this.CANVAS_W * this.CANVAS_H;
    const atlasCount = this._matrixLength * this._matrixLength;
    const particleBuckets = Array.from({ length: atlasCount }, () => [] as IconParticle[]);

    this._particleList = [];
    this._particleMeshes = [];
    this._activeParticleCount = 0;

    for (let i = 0; i < particleCount; i++) {
      const atlasIndex = Math.floor(atlasCount * Math.random());
      const particle: IconParticle = {
        atlasIndex,
        instanceIndex: particleBuckets[atlasIndex].length,
        position: new THREE.Vector3(),
        rotationZ: 0,
        scale: 1,
        color: new THREE.Color(0xffffff),
        visible: false,
      };

      particleBuckets[atlasIndex].push(particle);
      this._particleList.push(particle);
    }

    // テクスチャの透明領域で、背後にある粒子の深度を塞がないようにする。
    const atlasTextureNode = texture(sharedTexture) as { readonly rgb: unknown };
    const material = new MeshStandardNodeMaterial({
      color: 0xffffff,
      map: sharedTexture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    material.emissiveNode = mul(
      atlasTextureNode.rgb,
      instanceColor,
      CHARACTER_EMISSIVE_INTENSITY,
    ) as never;
    material.blending = THREE.AdditiveBlending;
    this._particleMaterial = material;

    for (let atlasIndex = 0; atlasIndex < atlasCount; atlasIndex++) {
      const particles = particleBuckets[atlasIndex];
      if (particles.length === 0) {
        continue;
      }

      const ox = atlasIndex % this._matrixLength;
      const oy = Math.floor(atlasIndex / this._matrixLength);
      const geometry = new THREE.PlaneGeometry(
        this.LETTER_PARTICLE_SIZE,
        this.LETTER_PARTICLE_SIZE,
        1,
        1,
      );
      changeUvs(geometry, ux, uy, ox, oy);

      const mesh = new THREE.InstancedMesh(geometry, material, particles.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      for (const particle of particles) {
        mesh.setMatrixAt(particle.instanceIndex, this._hiddenParticleMatrix);
        mesh.setColorAt(particle.instanceIndex, particle.color);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      this._particleMeshes[atlasIndex] = mesh;
      this._wrap.add(mesh);
    }
  }

  protected createLetter(canvas: HTMLCanvasElement, timeline: gsap.core.Timeline): void {
    // 単語ごとに使用数が変わるため、前の単語で使ったインスタンスも含めて一度すべて隠す。
    for (const particle of this._particleList) {
      particle.visible = false;
    }
    this.updateParticleInstances(this._particleList.length);

    const letterDots = this.extractLetterDots(canvas);
    const staggerMax = letterDots.length - 1;
    const pixelCount = canvas.width * canvas.height;

    for (let index = 0; index < letterDots.length; index++) {
      const particle = this._particleList[index];
      const dot = letterDots[index];

      particle.color.setHSL(
        this._hue + ((dot.x * canvas.height) / pixelCount - 0.5) * 0.2,
        0.5,
        0.6 + 0.4 * Math.random(),
      );
      this._particleMeshes[particle.atlasIndex]?.setColorAt(particle.instanceIndex, particle.color);
      this.addParticleMotion(timeline, particle, dot, canvas, index / staggerMax);
    }

    this._wrap.position.z = -5000;
    timeline.to(this._wrap.position, { z: 6000, duration: 12, ease: Quart.easeIn }, 0);
    this._activeParticleCount = letterDots.length;

    // 色は単語の切り替え時にしか変わらないため、行列のように毎フレーム転送しない。
    for (const mesh of this._particleMeshes) {
      if (mesh?.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private extractLetterDots(canvas: HTMLCanvasElement): LetterDot[] {
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const dots: LetterDot[] = [];

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        if (pixels[(x + y * canvas.width) * 4 + 3] !== 0) {
          dots.push({ x, y });
        }
      }
    }

    return dots;
  }

  private addParticleMotion(
    timeline: gsap.core.Timeline,
    particle: IconParticle,
    dot: LetterDot,
    canvas: HTMLCanvasElement,
    staggerProgress: number,
  ): void {
    const to = {
      x: (dot.x - canvas.width / 2) * this.LETTER_SPACING,
      y: (canvas.height / 2 - dot.y) * this.LETTER_SPACING,
      z: 120 * (Math.random() - 0.5),
    };
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnRadius = 1200 + 3800 * Math.pow(Math.random(), 0.55);
    const from = {
      x: Math.cos(spawnAngle) * spawnRadius - 500,
      y: Math.sin(spawnAngle) * spawnRadius * 0.55,
      z: 8000 + 5000 * Math.random(),
    };
    const control = {
      x: (from.x + to.x) / 2 - Math.sin(spawnAngle) * (400 + 900 * Math.random()),
      y: (from.y + to.y) / 2 + Math.cos(spawnAngle) * (200 + 450 * Math.random()),
      z: (from.z + to.z) / 2,
    };
    const delay = Cubic.easeInOut(staggerProgress) * 3 + 1.5 * Math.random();

    particle.position.set(from.x, from.y, from.z);
    particle.rotationZ = 10 * Math.PI * (Math.random() - 0.5);
    particle.scale = 5 + 3 * Math.random();
    particle.visible = false;

    // 同じ開始位置を指定し、移動・回転・縮小を1つの動きとして重ねる。
    timeline
      .set(particle, { visible: true }, delay)
      .to(particle, { rotationZ: 0, duration: 6, ease: Cubic.easeInOut }, delay)
      .to(particle, { scale: 1, duration: 6.5, ease: Quart.easeInOut }, delay)
      .to(
        particle.position,
        {
          motionPath: { path: [from, control, to] },
          duration: 7,
          ease: Expo.easeInOut,
        },
        delay,
      );
  }

  /**
   * GSAP が更新した各パーティクルの状態を、対応する InstancedMesh のインスタンスバッファへ反映します。
   *
   * パーティクルは atlas のセルごとに別々の InstancedMesh に分かれているため、
   * `atlasIndex` で更新先の Mesh を選び、`instanceIndex` でその Mesh 内のインスタンス番号を指定します。
   *
   * @param count `_particleList` の先頭から更新する粒子数です。現在の文字で使う粒子だけを対象にします。
   */
  private updateParticleInstances(count: number): void {
    // Object3D に位置・回転・スケールを入れて matrix を作り、InstancedMesh の transform として使う。
    const dummy = this._particleDummy;

    for (let i = 0; i < count; i++) {
      const particle = this._particleList[i];
      const mesh = this._particleMeshes[particle.atlasIndex];

      if (!mesh) {
        continue;
      }

      if (particle.visible) {
        // 表示中の粒子は、GSAP が更新した Vector3 と回転値からインスタンス行列を組み立てる。
        dummy.position.copy(particle.position);
        dummy.rotation.set(0, 0, particle.rotationZ);
        dummy.scale.setScalar(particle.scale);
        dummy.updateMatrix();

        mesh.setMatrixAt(particle.instanceIndex, dummy.matrix);
      } else {
        // InstancedMesh はインスタンス単位の visible を持たないため、非表示粒子は 0 スケールで消す。
        mesh.setMatrixAt(particle.instanceIndex, this._hiddenParticleMatrix);
      }
    }

    // setMatrixAt は CPU 側の配列を書き換えるだけなので、最後に GPU へアップロードする。
    for (const mesh of this._particleMeshes) {
      if (!mesh) {
        continue;
      }

      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
