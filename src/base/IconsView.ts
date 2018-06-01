import { Container, Stage, Text } from "@createjs/easeljs/dist/easeljs.module";
import { Cubic, Expo, Quart } from "gsap/umd/EasePack";
import * as TimelineMax from "gsap/umd/TimelineMax";
import * as THREE from "three";
import { FONT_BASE } from "../utils/load-font";
import { BasicView } from "./BasicView";

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class IconsView extends BasicView {
  protected HELPER_ZERO = new THREE.Vector3(0, 0, 0);

  protected CANVAS_W: number = 250;
  protected CANVAS_H: number = 40;

  protected _matrixLength: number = 8;
  protected _particleList = [];
  protected _wrap: THREE.Object3D;
  protected _wordIndex = 0;
  protected _bg: THREE.Mesh;
  /** 色相 0.0〜1.0 */
  protected _hue: number = 0.6;

  static createParticleCloud(): THREE.Points {
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
    const texture = new THREE.TextureLoader().load("imgs/fire_particle.png");
    const material = new THREE.PointsMaterial({
      size: 20,
      color: 0x666666,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      map: texture
    });

    // 物体を作成
    const points = new THREE.Points(geometry, material);
    return points;
  }

  static createCanvas(label: string, fontSize: number, w: number, h: number) {
    // レターオブジェクトを生成します。
    const canvas: HTMLCanvasElement = document.createElement(
      "canvas"
    ) as HTMLCanvasElement;
    canvas.setAttribute("width", w + "px");
    canvas.setAttribute("height", h + "px");

    const stage = new Stage(canvas);
    const text1 = new Text(label, fontSize + "px " + FONT_BASE, "#FFF");
    text1.textAlign = "center";
    text1.x = w / 2;
    stage.addChild(text1);
    stage.update();

    return canvas;
  }

  /**
   * ジオメトリ内のUVを変更します。
   * @param geometry    {THREE.PlaneGeometry}
   * @param unitx    {number}
   * @param unity    {number}
   * @param offsetx    {number}
   * @param offsety    {number}
   */
  static change_uvs(
    geometry: THREE.PlaneGeometry,
    unitx: number,
    unity: number,
    offsetx: number,
    offsety: number
  ) {
    const faceVertexUvs = geometry.faceVertexUvs[0];
    faceVertexUvs.forEach((uvs, i) => {
      uvs.forEach((uv, j) => {
        uv.x = (uv.x + offsetx) * unitx;
        uv.y = (uv.y + offsety) * unity;
      });
    });
  }

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
      map: new THREE.TextureLoader().load("imgs/bg.png")
    });
    const bg = new THREE.Mesh(plane, mat);
    bg.position.z = -10000;
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

  protected createParticle(texture: THREE.Texture) {
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
        IconsView.change_uvs(geometry, ux, uy, ox, oy);

        const material = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });

        material.blending = THREE.AdditiveBlending;

        const word: THREE.Mesh = new THREE.Mesh(geometry, material);
        this._wrap.add(word);

        this._particleList.push(word);
      }
    }
  }

  protected createLetter(canvas: HTMLCanvasElement, timeline: TimelineMax) {
    const ctx: CanvasRenderingContext2D = canvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;

    this._particleList.forEach(item => {
      item.visible = false;
    });

    // 透過領域を判定する
    const pixcelColors = ctx.getImageData(0, 0, this.CANVAS_W, this.CANVAS_H)
      .data;
    const existDotList = [];
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
          z: 0
        };

        const fromObj = {
          x: 2000 * (Math.random() - 0.5) - 500,
          y: 1000 * (Math.random() - 0.5),
          z: +10000
        };

        word.position.x = fromObj.x;
        word.position.y = fromObj.y;
        word.position.z = fromObj.z;

        const toRotationObj = {
          z: 0
        };

        const fromRotationObj = {
          z: 10 * Math.PI * (Math.random() - 0.5)
        };

        word.rotation.z = fromRotationObj.z;

        const delay =
          Cubic.easeInOut.getRatio(cnt / 1600) * 3.0 + 1.5 * Math.random();

        timeline.to(
          word.rotation,
          6.0,
          {
            z: toRotationObj.z,
            ease: Cubic.easeInOut
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
            bezier: [
              fromObj,
              {
                x: (0 + toObj.x) / 2 + 300,
                y: (fromObj.y + toObj.y) / 2 + 500 * Math.random(),
                z: (fromObj.z + toObj.z) / 2
              },
              toObj
            ],
            delay: delay / 1.0,
            ease: Expo.easeInOut
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
