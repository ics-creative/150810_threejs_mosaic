import gsap, { Cubic, Expo, Quart } from "gsap";
import MotionPathPlugin from "gsap/dist/MotionPathPlugin";
import * as THREE from "three";
import { changeUvs } from "../creators/changeUvs";
import ImgBg from "../imgs/bg.jpg";
import { BasicView } from "./BasicView";

gsap.registerPlugin(MotionPathPlugin);

type IconParticle = {
  atlasIndex: number;
  instanceIndex: number;
  position: THREE.Vector3;
  rotationZ: number;
  color: THREE.Color;
  visible: boolean;
};

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  protected CANVAS_W = 250;
  protected CANVAS_H = 40;

  protected _matrixLength = 8;
  protected _particleList: IconParticle[] = [];
  protected _particleMeshes: THREE.InstancedMesh[] = [];
  protected _activeParticleCount = 0;
  protected _wrap!: THREE.Object3D;
  protected _wordIndex = 0;
  protected _bg!: THREE.Mesh;
  private _particleDummy = new THREE.Object3D();
  private _hiddenParticleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
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
        color: new THREE.Color(0xffffff),
        visible: false,
      };

      particleBuckets[atlasIndex].push(particle);
      this._particleList.push(particle);
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedTexture,
      transparent: true,
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
      const geometry = new THREE.PlaneGeometry(40, 40, 1, 1);
      changeUvs(geometry, ux, uy, ox, oy);

      const mesh = new THREE.InstancedMesh(geometry, material, particles.length);
      mesh.frustumCulled = false;

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

    // 透過領域を判定する
    const pixelColors = ctx.getImageData(0, 0, this.CANVAS_W, this.CANVAS_H).data;
    const existDotList: boolean[][] = [];
    for (let i = 0; i < this.CANVAS_W; i++) {
      existDotList[i] = [];
      for (let j = 0; j < this.CANVAS_H; j++) {
        // 透過しているか判定
        const flag = pixelColors[(i + j * this.CANVAS_W) * 4 + 3] === 0;
        existDotList[i][j] = flag;
      }
    }

    // レターのモーションを作成する
    let cnt = 0;
    const max = this.CANVAS_W * this.CANVAS_H;
    for (let i = 0; i < this.CANVAS_W; i++) {
      for (let j = 0; j < this.CANVAS_H; j++) {
        // 透過していたらパスする
        if (existDotList[i][j] === true) {
          continue;
        }

        const word = this._particleList[cnt];
        word.color.setHSL(
          this._hue + ((i * canvas.height) / max - 0.5) * 0.2,
          0.5,
          0.6 + 0.4 * Math.random(),
        );

        const toObj = {
          x: (i - canvas.width / 2) * 30,
          y: (canvas.height / 2 - j) * 30,
          z: 0,
        };

        const fromObj = {
          x: 2000 * (Math.random() - 0.5) - 500,
          y: 1000 * (Math.random() - 0.5),
          z: +10000,
        };

        word.position.set(fromObj.x, fromObj.y, fromObj.z);

        const toRotationObj = {
          z: 0,
        };

        const fromRotationObj = {
          z: 10 * Math.PI * (Math.random() - 0.5),
        };

        word.rotationZ = fromRotationObj.z;

        const delay = Cubic.easeInOut(cnt / 1600) * 3.0 + 1.5 * Math.random();

        timeline.to(
          word,
          6.0,
          {
            rotationZ: toRotationObj.z,
            ease: Cubic.easeInOut,
          },
          delay,
        );

        //
        word.visible = false;
        timeline.set(word, { visible: true }, delay);

        timeline.to(
          word.position,
          7.0,
          {
            motionPath: {
              path: [
                fromObj,
                {
                  x: (0 + toObj.x) / 2 + 300,
                  y: (fromObj.y + toObj.y) / 2 + 500 * Math.random(),
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

        cnt++;
      }
    }

    this._wrap.position.z = -5000;
    timeline.to(this._wrap.position, 12.0, { z: 6000, ease: Quart.easeIn }, 0);
    this._activeParticleCount = cnt;
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
        dummy.scale.setScalar(1);
        dummy.updateMatrix();

        mesh.setMatrixAt(particle.instanceIndex, dummy.matrix);
        mesh.setColorAt(particle.instanceIndex, particle.color);
      } else {
        // InstancedMesh はインスタンス単位の visible を持たないため、非表示粒子は 0 スケールで消す。
        mesh.setMatrixAt(particle.instanceIndex, this._hiddenParticleMatrix);
      }
    }

    // setMatrixAt / setColorAt は CPU 側の配列を書き換えるだけなので、最後に GPU へアップロードする。
    for (const mesh of this._particleMeshes) {
      if (!mesh) {
        continue;
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
