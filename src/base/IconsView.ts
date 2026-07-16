import gsap, { Cubic, Quart } from "gsap";
import MotionPathPlugin from "gsap/MotionPathPlugin";
import * as THREE from "three";
import { changeUvs } from "../creators/changeUvs";
import { createIconPostProcessing } from "../creators/createIconPostProcessing";
import ImgBg from "../imgs/bg.jpg";
import { createTwinkle } from "../utils/createTwinkle";
import { getTslRuntime } from "../utils/getTslRuntime";
import { BasicView } from "./BasicView";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type RenderPipeline } from "three/webgpu";

gsap.registerPlugin(MotionPathPlugin);

type IconParticle = {
  atlasIndex: number;
  instanceIndex: number;
};

type ParticleBuffers = {
  array: Float32Array;
  buffer: THREE.InstancedInterleavedBuffer;
};

type LetterDot = {
  x: number;
  y: number;
};

type MeasuredPathSegment = number[] & {
  samples: number[];
  totalLength: number;
};

type TslNode = {
  readonly x: TslNode;
  readonly y: TslNode;
  readonly z: TslNode;
  readonly w: TslNode;
  readonly rgb: TslNode;
};

type TslUniform = TslNode & { value: number };

type IconTslRuntime = {
  add(...values: unknown[]): TslNode;
  attribute(name: string, type: string): TslNode;
  clamp(...values: unknown[]): TslNode;
  cos(value: unknown): TslNode;
  div(...values: unknown[]): TslNode;
  exp2(value: unknown): TslNode;
  lessThan(...values: unknown[]): TslNode;
  luminance(value: unknown): TslNode;
  materialColor: unknown;
  mix(...values: unknown[]): TslNode;
  mul(...values: unknown[]): TslNode;
  positionGeometry: TslNode;
  pow(...values: unknown[]): TslNode;
  select(...values: unknown[]): TslNode;
  sin(value: unknown): TslNode;
  step(...values: unknown[]): TslNode;
  sub(...values: unknown[]): TslNode;
  texture(value: THREE.Texture): TslNode;
  uniform(value: number): TslUniform;
  vec3(...values: unknown[]): TslNode;
  vec4(...values: unknown[]): TslNode;
};

const {
  add,
  attribute,
  clamp,
  cos,
  div,
  exp2,
  lessThan,
  luminance,
  materialColor,
  mix,
  mul,
  positionGeometry,
  pow,
  select,
  sin,
  step,
  sub,
  texture,
  uniform,
  vec3,
  vec4,
} = getTslRuntime<IconTslRuntime>();
const BACKGROUND_SATURATION = 0.78;
const PARTICLE_MOVE_DURATION = 7;
const PARTICLE_ROTATION_DURATION = 6;
const PARTICLE_SCALE_DURATION = 6.5;
const PARTICLE_BUFFER_STRIDE = 29;
const PARTICLE_PATH_OFFSETS = [0, 3, 6, 9, 12, 15, 18] as const;
const PARTICLE_MOTION_OFFSET = 21;
const PARTICLE_COLOR_OFFSET = 25;
const PARTICLE_TWINKLE_OFFSET = 28;

function easeInOutPower(progress: TslNode, power: number): TslNode {
  return select(
    lessThan(progress, 0.5),
    div(pow(mul(progress, 2), power), 2),
    sub(1, div(pow(mul(sub(1, progress), 2), power), 2)),
  );
}

function easeInOutExpo(progress: TslNode): TslNode {
  const easeIn = (value: TslNode): TslNode =>
    add(mul(exp2(mul(10, sub(value, 1))), value), mul(pow(value, 6), sub(1, value)));
  return select(
    lessThan(progress, 0.5),
    mul(easeIn(mul(progress, 2)), 0.5),
    sub(1, mul(easeIn(mul(sub(1, progress), 2)), 0.5)),
  );
}

function cubicBezier(
  point0: TslNode,
  control1: TslNode,
  control2: TslNode,
  point1: TslNode,
  progress: TslNode,
): TslNode {
  const point01 = mix(point0, control1, progress);
  const point12 = mix(control1, control2, progress);
  const point23 = mix(control2, point1, progress);
  return mix(mix(point01, point12, progress), mix(point12, point23, progress), progress);
}

function createParticlePositionNode(time: TslUniform): TslNode {
  const point0 = attribute("pathPoint0", "vec3");
  const control1 = attribute("pathControl1", "vec3");
  const control2 = attribute("pathControl2", "vec3");
  const point1 = attribute("pathPoint1", "vec3");
  const control3 = attribute("pathControl3", "vec3");
  const control4 = attribute("pathControl4", "vec3");
  const point2 = attribute("pathPoint2", "vec3");
  const motion = attribute("particleMotion", "vec4");
  const elapsed = sub(time, motion.x);
  const pathProgress = easeInOutExpo(clamp(div(elapsed, PARTICLE_MOVE_DURATION), 0, 1));
  const firstProgress = clamp(div(pathProgress, motion.w), 0, 1);
  const secondProgress = clamp(div(sub(pathProgress, motion.w), sub(1, motion.w)), 0, 1);
  const pathPosition = select(
    lessThan(pathProgress, motion.w),
    cubicBezier(point0, control1, control2, point1, firstProgress),
    cubicBezier(point1, control3, control4, point2, secondProgress),
  );

  const rotationProgress = easeInOutPower(clamp(div(elapsed, PARTICLE_ROTATION_DURATION), 0, 1), 3);
  const scaleProgress = easeInOutPower(clamp(div(elapsed, PARTICLE_SCALE_DURATION), 0, 1), 4);
  const rotation = mul(motion.y, sub(1, rotationProgress));
  const particleScale = mul(mix(motion.z, 1, scaleProgress), step(0, elapsed));
  const rotationCosine = cos(rotation);
  const rotationSine = sin(rotation);
  const localX = mul(
    sub(mul(positionGeometry.x, rotationCosine), mul(positionGeometry.y, rotationSine)),
    particleScale,
  );
  const localY = mul(
    add(mul(positionGeometry.x, rotationSine), mul(positionGeometry.y, rotationCosine)),
    particleScale,
  );

  return add(pathPosition, vec3(localX, localY, 0));
}

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected readonly HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  /** 文字Canvasの縦横サンプリング倍率です。必要なインスタンス数は倍率の二乗で増えます。 */
  protected readonly LETTER_DENSITY = 4;
  protected readonly CANVAS_W = 250 * this.LETTER_DENSITY;
  protected readonly CANVAS_H = 40 * this.LETTER_DENSITY;
  protected readonly LETTER_SPACING = 30 / this.LETTER_DENSITY;
  /** アイコン幅を格子間隔と一致させ、隣接粒子を隙間なく並べます。 */
  protected readonly LETTER_PARTICLE_SIZE = this.LETTER_SPACING;

  protected readonly _matrixLength = 8;
  protected _particleList: IconParticle[] = [];
  protected _particleMeshes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.Material>[] = [];
  protected _wrap!: THREE.Object3D;
  protected _wordIndex = 0;
  protected _background!: THREE.Mesh<THREE.PlaneGeometry, MeshBasicNodeMaterial>;
  private readonly _particleMeshActiveCounts = new Uint32Array(this._matrixLength ** 2);
  private readonly _particleColor = new THREE.Color();
  private readonly _particleTime = uniform(0);
  private _particleBuffers: ParticleBuffers[] = [];
  // fragmentNodeを固定し、NodeMaterialが自動で乗算するinstanceColorも通さない。
  private readonly _wireframeMaterial = new MeshBasicNodeMaterial({
    wireframe: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    fragmentNode: vec4(1) as never,
  });
  private _particleMaterial!: MeshStandardNodeMaterial;
  private _particleTimeline: gsap.core.Timeline | null = null;
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

    // 文字Timelineの時刻だけをGPUへ渡し、全粒子の曲線・回転・縮尺はvertex shaderで評価する。
    if (this._particleTimeline) {
      this._particleTime.value = this._particleTimeline.time();
    }
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
    this._particleBuffers = [];

    for (let i = 0; i < particleCount; i++) {
      const atlasIndex = Math.floor(atlasCount * Math.random());
      const particle: IconParticle = {
        atlasIndex,
        instanceIndex: particleBuckets[atlasIndex].length,
      };

      particleBuckets[atlasIndex].push(particle);
      this._particleList.push(particle);
    }

    // 個体ごとに発生タイミングを変え、文字全体が同時に点滅しないようにする。
    const twinkleSeed = attribute("twinkleSeed", "float");
    // キラキラ感を体感でき、動画収録時のビットレート軽減のため、Characterの点滅周期だけ20倍にする。
    const twinkle = createTwinkle(twinkleSeed, 0.05);
    const particleColor = attribute("color", "vec3");
    const particlePosition = createParticlePositionNode(this._particleTime);

    // テクスチャの透明領域で、背後にある粒子の深度を塞がないようにする。
    const atlasTextureNode = texture(sharedTexture);
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
      particleColor,
      mix(0.18, 0.28, twinkle),
    ) as never;
    // 輝度の点滅は残しつつ、opacityの振れ幅は0.04に抑える。
    material.opacityNode = mix(0.9, 0.91, twinkle) as never;
    material.positionNode = particlePosition as never;
    material.blending = THREE.AdditiveBlending;
    // 通常表示と白ワイヤーフレームで同じGeometryとGPU上の位置計算を共有する。
    this._wireframeMaterial.positionNode = particlePosition as never;
    this._particleMaterial = material;

    for (let atlasIndex = 0; atlasIndex < atlasCount; atlasIndex++) {
      const particles = particleBuckets[atlasIndex];
      if (particles.length === 0) {
        continue;
      }

      const ox = atlasIndex % this._matrixLength;
      const oy = Math.floor(atlasIndex / this._matrixLength);
      const baseGeometry = new THREE.PlaneGeometry(
        this.LETTER_PARTICLE_SIZE,
        this.LETTER_PARTICLE_SIZE,
        1,
        1,
      );
      changeUvs(baseGeometry, ux, uy, ox, oy);

      const geometry = new THREE.InstancedBufferGeometry();
      if (baseGeometry.index) {
        geometry.index = baseGeometry.index;
      }
      for (const name in baseGeometry.attributes) {
        geometry.setAttribute(name, baseGeometry.attributes[name]);
      }
      geometry.instanceCount = 0;
      // WebGPUのvertex buffer上限を超えないよう、全instance属性を1本のbufferへまとめる。
      const particleArray = new Float32Array(particles.length * PARTICLE_BUFFER_STRIDE);
      const particleBuffer = new THREE.InstancedInterleavedBuffer(
        particleArray,
        PARTICLE_BUFFER_STRIDE,
      );
      // パス属性は単語切替時にだけ更新する。DynamicDrawUsageにするとWebGPUでは
      // 変更のないフレームまで転送対象になるため、既定のStaticDrawUsageを維持する。
      const attributes = [
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[0]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[1]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[2]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[3]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[4]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[5]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_PATH_OFFSETS[6]),
        new THREE.InterleavedBufferAttribute(particleBuffer, 4, PARTICLE_MOTION_OFFSET),
        new THREE.InterleavedBufferAttribute(particleBuffer, 3, PARTICLE_COLOR_OFFSET),
        new THREE.InterleavedBufferAttribute(particleBuffer, 1, PARTICLE_TWINKLE_OFFSET),
      ] as const;
      const attributeNames = [
        "pathPoint0",
        "pathControl1",
        "pathControl2",
        "pathPoint1",
        "pathControl3",
        "pathControl4",
        "pathPoint2",
        "particleMotion",
        "color",
        "twinkleSeed",
      ] as const;

      for (let index = 0; index < attributes.length; index++) {
        geometry.setAttribute(attributeNames[index], attributes[index]);
      }

      this._particleBuffers[atlasIndex] = {
        array: particleArray,
        buffer: particleBuffer,
      };

      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;

      this._particleMeshes[atlasIndex] = mesh;
      this._wrap.add(mesh);
    }
  }

  protected createLetter(canvas: HTMLCanvasElement, timeline: gsap.core.Timeline): void {
    const letterDots = this.extractLetterDots(canvas);
    const staggerMax = letterDots.length - 1;
    const pixelCount = canvas.width * canvas.height;
    this._particleTimeline = timeline;
    this._particleTime.value = 0;
    this._particleMeshActiveCounts.fill(0);

    for (let index = 0; index < letterDots.length; index++) {
      const particle = this._particleList[index];
      const dot = letterDots[index];
      const buffers = this._particleBuffers[particle.atlasIndex];

      this.writeParticleMotion(buffers, particle.instanceIndex, dot, canvas, index / staggerMax);

      this._particleColor.setHSL(
        this._hue + ((dot.x * canvas.height) / pixelCount - 0.5) * 0.2,
        0.5,
        0.6 + 0.4 * Math.random(),
      );
      const particleOffset = particle.instanceIndex * PARTICLE_BUFFER_STRIDE;
      const colorOffset = particleOffset + PARTICLE_COLOR_OFFSET;
      buffers.array[colorOffset] = this._particleColor.r;
      buffers.array[colorOffset + 1] = this._particleColor.g;
      buffers.array[colorOffset + 2] = this._particleColor.b;
      buffers.array[particleOffset + PARTICLE_TWINKLE_OFFSET] = Math.random();
      this._particleMeshActiveCounts[particle.atlasIndex] = particle.instanceIndex + 1;
    }

    this._wrap.position.z = -5000;
    timeline.to(this._wrap.position, { z: 6000, duration: 12, ease: Quart.easeIn }, 0);

    // 使用粒子は各atlas内でも先頭から連続するため、描画数と属性転送をその範囲だけに絞る。
    for (let atlasIndex = 0; atlasIndex < this._particleMeshes.length; atlasIndex++) {
      const mesh = this._particleMeshes[atlasIndex];
      const activeCount = this._particleMeshActiveCounts[atlasIndex];
      mesh.geometry.instanceCount = activeCount;
      if (activeCount > 0) {
        const buffer = this._particleBuffers[atlasIndex].buffer;
        buffer.clearUpdateRanges();
        buffer.addUpdateRange(0, activeCount * PARTICLE_BUFFER_STRIDE);
        buffer.needsUpdate = true;
      }
    }
  }

  private extractLetterDots(canvas: HTMLCanvasElement): LetterDot[] {
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const dots: LetterDot[] = [];

    // 透明でない全ピクセルを採用し、行と列がずれない正方格子へ配置する。
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        if (pixels[(x + y * canvas.width) * 4 + 3] !== 0) {
          dots.push({ x, y });
        }
      }
    }

    return dots;
  }

  private writeParticleMotion(
    buffers: ParticleBuffers,
    instanceIndex: number,
    dot: LetterDot,
    canvas: HTMLCanvasElement,
    staggerProgress: number,
  ): void {
    const to = {
      x: (dot.x - canvas.width / 2) * this.LETTER_SPACING,
      y: (canvas.height / 2 - dot.y) * this.LETTER_SPACING,
      z: 0,
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

    // MotionPathPluginが3点を通る曲線へ変換した2区間のCubic Bezierを、そのままGPU属性へ展開する。
    // Tweenを粒子数分作らずに済む一方、始点・制御点・終点・delayは全粒子が個別に保持する。
    const rawPath = MotionPathPlugin.arrayToRawPath([from, control, to]);
    MotionPathPlugin.cacheRawPathMeasurements(rawPath, 12);
    const segment = rawPath[0] as MeasuredPathSegment;
    const particleOffset = instanceIndex * PARTICLE_BUFFER_STRIDE;
    const depths = [from.z, from.z, control.z, control.z, control.z, to.z, to.z];
    for (let pointIndex = 0; pointIndex < PARTICLE_PATH_OFFSETS.length; pointIndex++) {
      this.writeVector(
        buffers.array,
        particleOffset + PARTICLE_PATH_OFFSETS[pointIndex],
        segment[pointIndex * 2],
        segment[pointIndex * 2 + 1],
        depths[pointIndex],
      );
    }

    const motionOffset = particleOffset + PARTICLE_MOTION_OFFSET;
    buffers.array[motionOffset] = delay;
    buffers.array[motionOffset + 1] = 10 * Math.PI * (Math.random() - 0.5);
    // 小さいやつ、大きいやつに偏らせる
    // 参考：ランダムの数式まとめ https://ics.media/entry/11292/
    const value = 1 - (Math.random() + Math.random()) / 2;
    // 飛来時のスケールを粒子ごとに散らす。
    buffers.array[motionOffset + 2] = (10 + 500 * value) / this.LETTER_PARTICLE_SIZE;
    // MotionPathPluginと同じ12分割の弧長計測で、2区間の切り替え時刻を合わせる。
    buffers.array[motionOffset + 3] = segment.samples[11] / segment.totalLength;
  }

  private writeVector(array: Float32Array, offset: number, x: number, y: number, z: number): void {
    array[offset] = x;
    array[offset + 1] = y;
    array[offset + 2] = z;
  }
}
