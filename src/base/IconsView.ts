import gsap, { Cubic, Expo, Quart } from "gsap";
import MotionPathPlugin from "gsap/dist/MotionPathPlugin";
import * as THREE from "three";
import { changeUvs } from "../creators/changeUvs";
import { createIconPostProcessing } from "../creators/createIconPostProcessing";
import ImgBg from "../imgs/bg.jpg";
import { BasicView } from "./BasicView";
import type { RenderPipeline } from "three/webgpu";

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

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  /** レター生成用Canvasのサンプリング倍率です。 */
  protected LETTER_DENSITY = 2;
  protected CANVAS_W = 250 * this.LETTER_DENSITY;
  protected CANVAS_H = 40 * this.LETTER_DENSITY;
  protected LETTER_SPACING = 30 / this.LETTER_DENSITY;
  protected LETTER_PARTICLE_SIZE = 40 / this.LETTER_DENSITY;

  protected _matrixLength = 8;
  protected _particleList: IconParticle[] = [];
  protected _particleMeshes: THREE.InstancedMesh[] = [];
  protected _activeParticleCount = 0;
  protected _wrap!: THREE.Object3D;
  protected _wordIndex = 0;
  protected _bg!: THREE.Mesh;
  private _particleDummy = new THREE.Object3D();
  private _hiddenParticleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private _postProcessing: RenderPipeline | null = null;
  /** 色相 0.0〜1.0 */
  protected _hue = 0.6;

  protected createWorld() {
    // ------------------------------
    // カメラの配置
    // ------------------------------
    this.camera.far = 100000;
    this.camera.near = 1;
    this.camera.position.z = 5000;
    this.camera.lookAt(this.HELPER_ZERO);

    // ------------------------------
    // 背景の作成
    // ------------------------------
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    const texture = new THREE.TextureLoader().load(ImgBg);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
    });

    const bg = new THREE.Mesh(plane, mat);
    this.scene.add(bg);
    this._bg = bg;

    // ------------------------------
    // 3D空間のパーツを配置
    // ------------------------------
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 1, +1).normalize();
    this.scene.add(light);

    // particle motion
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
    if (this._postProcessing) {
      this._postProcessing.render();
      return;
    }

    super.render();
  }

  /**
   * 背景プレーンをカメラの反対方向へ配置し、現在の視錐台全体を覆う大きさに更新します。
   *
   * @param distance 背景プレーンを原点からカメラ反対方向へ離す距離です。
   */
  protected updateBackground(distance: number) {
    // fov は GSAP で更新されるため、背景サイズを計算する前に投影行列へ反映する。
    this.camera.updateProjectionMatrix();

    // カメラ位置の逆方向に背景を置くことで、カメラが移動しても背景が常に奥側に見えるようにする。
    const vec = this.camera.position.clone();
    vec.negate();
    vec.normalize();
    vec.multiplyScalar(distance);
    this._bg.position.copy(vec);
    this._bg.lookAt(this.camera.position);

    // 背景位置での視錐台サイズを計算し、横長・縦長どちらの画面でも端まで覆える正方形にする。
    const viewDistance = this.camera.position.distanceTo(this._bg.position);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * viewDistance;
    const viewWidth = viewHeight * this.camera.aspect;
    const coverSize = Math.max(viewWidth, viewHeight) * 1.05;
    this._bg.scale.set(coverSize, coverSize, 1);
  }

  protected createParticle(sharedTexture: THREE.Texture) {
    // ------------------------------
    // パーティクルの作成
    // ------------------------------
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
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedTexture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    material.blending = THREE.AdditiveBlending;

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

  protected createLetter(canvas: HTMLCanvasElement, timeline: gsap.core.Timeline) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("contextを取得失敗しました");
    }

    this._particleList.forEach((particle) => {
      particle.visible = false;
    });
    this.updateParticleInstances(this._particleList.length);

    // Canvasのアルファ値から、文字を構成するピクセル座標を抽出する。
    const pixelColors = ctx.getImageData(0, 0, this.CANVAS_W, this.CANVAS_H).data;
    const letterDots: LetterDot[] = [];
    for (let i = 0; i < this.CANVAS_W; i++) {
      for (let j = 0; j < this.CANVAS_H; j++) {
        // 透明なピクセルはレターに使用しない。
        if (pixelColors[(i + j * this.CANVAS_W) * 4 + 3] !== 0) {
          letterDots.push({ x: i, y: j });
        }
      }
    }

    // レターのモーションを作成する
    const max = this.CANVAS_W * this.CANVAS_H;
    const staggerMax = Math.max(letterDots.length - 1, 1);

    for (let cnt = 0; cnt < letterDots.length; cnt++) {
      const { x: i, y: j } = letterDots[cnt];
      const word = this._particleList[cnt];

      // レター内の位置と現在の色相から、アイコンごとの色を決める。
      word.color.setHSL(
        this._hue + ((i * canvas.height) / max - 0.5) * 0.2,
        0.5,
        0.6 + 0.4 * Math.random(),
      );
      this._particleMeshes[word.atlasIndex]?.setColorAt(word.instanceIndex, word.color);

      // 収束後はCanvas上のピクセル位置に並び、奥行きにわずかな厚みを持たせる。
      const toObj = {
        x: (i - canvas.width / 2) * this.LETTER_SPACING,
        y: (canvas.height / 2 - j) * this.LETTER_SPACING,
        z: 120 * (Math.random() - 0.5),
      };

      // 画面全体を使うため、レターの周囲に広がる円盤状の領域から飛来させる。
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnRadius = 1200 + 3800 * Math.pow(Math.random(), 0.55);
      const fromObj = {
        x: Math.cos(spawnAngle) * spawnRadius - 500,
        y: Math.sin(spawnAngle) * spawnRadius * 0.55,
        z: 8000 + 5000 * Math.random(),
      };

      word.position.set(fromObj.x, fromObj.y, fromObj.z);
      word.scale = 5 + 3 * Math.random();

      // 飛来中はランダムに回転し、収束時に正位置へ揃える。
      const toRotationObj = {
        z: 0,
      };

      const fromRotationObj = {
        z: 10 * Math.PI * (Math.random() - 0.5),
      };

      word.rotationZ = fromRotationObj.z;

      // 横方向の走査順を基準に、表示開始をずらす。
      const delay = Cubic.easeInOut(cnt / staggerMax) * 3.0 + 1.5 * Math.random();

      timeline.to(
        word,
        6.0,
        {
          rotationZ: toRotationObj.z,
          ease: Cubic.easeInOut,
        },
        delay,
      );

      // 飛来時はアイコンを大きく表示し、文字へ収束するにつれて縮小する。
      timeline.to(
        word,
        6.5,
        {
          scale: 1,
          ease: Quart.easeInOut,
        },
        delay,
      );

      // タイムライン上の開始位置まで、対象のインスタンスを非表示にする。
      word.visible = false;
      timeline.set(word, { visible: true }, delay);

      // 始点と終点の間に弧を作り、画面中央へ吸い込まれる軌道にする。
      timeline.to(
        word.position,
        7.0,
        {
          motionPath: {
            path: [
              fromObj,
              {
                x: (fromObj.x + toObj.x) / 2 - Math.sin(spawnAngle) * (400 + 900 * Math.random()),
                y: (fromObj.y + toObj.y) / 2 + Math.cos(spawnAngle) * (200 + 450 * Math.random()),
                z: (fromObj.z + toObj.z) / 2,
              },
              toObj,
            ],
          },
          delay: delay / 1.0,
          ease: Expo.easeInOut,
        },
        0,
      );
    }

    this._wrap.position.z = -5000;
    timeline.to(this._wrap.position, 12.0, { z: 6000, ease: Quart.easeIn }, 0);
    this._activeParticleCount = letterDots.length;

    // 色は文字生成時にしか変わらないため、このタイミングでだけGPUへ転送する。
    for (const mesh of this._particleMeshes) {
      if (mesh?.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
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
