import gsap, { Cubic, Expo, Quart } from "gsap";
import MotionPathPlugin from "gsap/dist/MotionPathPlugin";
import * as THREE from "three";
import { changeUvs } from "../creators/changeUvs";
import ImgBg from "../imgs/bg.jpg";
import { BasicView } from "./BasicView";

gsap.registerPlugin(MotionPathPlugin);

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  protected CANVAS_W: number = 250;
  protected CANVAS_H: number = 40;

  protected _matrixLength: number = 8;
  protected _particleList: THREE.Mesh[] = [];
  protected _wrap!: THREE.Object3D;
  protected _wordIndex = 0;
  protected _bg!: THREE.Mesh;
  /** 色相 0.0〜1.0 */
  protected _hue: number = 0.6;

  constructor() {
    super();
  }
  protected setup() {}

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
    const plane = new THREE.PlaneBufferGeometry(50000, 50000, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load(ImgBg),
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

  protected createParticle(sharedTexture: THREE.Texture) {
    // ------------------------------
    // パーティクルの作成
    // ------------------------------
    const ux = 1 / this._matrixLength;
    const uy = 1 / this._matrixLength;

    this._particleList = [];
    for (let i = 0; i < this.CANVAS_W; i++) {
      for (let j = 0; j < this.CANVAS_H; j++) {
        const ox = Math.floor(this._matrixLength * Math.random());
        const oy = Math.floor(this._matrixLength * Math.random());

        const geometry = new THREE.PlaneGeometry(40, 40, 1, 1);
        changeUvs(geometry, ux, uy, ox, oy);

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: sharedTexture,
          transparent: true,
          side: THREE.DoubleSide,
        });

        material.blending = THREE.AdditiveBlending;

        const word = new THREE.Mesh(geometry, material);
        this._wrap.add(word);

        this._particleList.push(word);
      }
    }
  }

  protected createLetter(
    canvas: HTMLCanvasElement,
    timeline: gsap.core.Timeline
  ) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("contextを取得失敗しました");
    }

    this._particleList.forEach((item) => {
      item.visible = false;
    });

    // 透過領域を判定する
    const pixcelColors = ctx.getImageData(0, 0, this.CANVAS_W, this.CANVAS_H)
      .data;
    const existDotList: boolean[][] = [];
    let existDotCount = 0;
    for (let i = 0; i < this.CANVAS_W; i++) {
      existDotList[i] = [];
      for (let j = 0; j < this.CANVAS_H; j++) {
        // 透過しているか判定
        const flag = pixcelColors[(i + j * this.CANVAS_W) * 4 + 3] === 0;
        existDotList[i][j] = flag;

        if (flag === true) {
          existDotCount++;
        }
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

        const word: THREE.Mesh = this._particleList[cnt];
        (word.material as THREE.MeshLambertMaterial).color.setHSL(
          this._hue + ((i * canvas.height) / max - 0.5) * 0.2,
          0.5,
          0.6 + 0.4 * Math.random()
        );
        (word.material as THREE.MeshLambertMaterial).blending =
          THREE.AdditiveBlending;
        this._wrap.add(word);

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

        word.position.x = fromObj.x;
        word.position.y = fromObj.y;
        word.position.z = fromObj.z;

        const toRotationObj = {
          z: 0,
        };

        const fromRotationObj = {
          z: 10 * Math.PI * (Math.random() - 0.5),
        };

        word.rotation.z = fromRotationObj.z;

        const delay = Cubic.easeInOut(cnt / 1600) * 3.0 + 1.5 * Math.random();

        timeline.to(
          word.rotation,
          6.0,
          {
            z: toRotationObj.z,
            ease: Cubic.easeInOut,
          },
          delay
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
          0
        );

        cnt++;
      }
    }

    this._wrap.position.z = -5000;
    timeline.to(this._wrap.position, 12.0, { z: 6000, ease: Quart.easeIn }, 0);
  }
}
