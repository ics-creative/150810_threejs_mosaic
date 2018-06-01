import { Container, Stage, Text } from "@createjs/easeljs/dist/easeljs.module";
import { Cubic, Expo, Quart } from "gsap/umd/EasePack";
import * as TimelineMax from "gsap/umd/TimelineMax";
import * as TweenMax from "gsap/umd/TweenMax";
import * as THREE from "three";
import * as WebFont from "webfontloader";
import { BasicView } from "./base/BasicView";
import "./styles/style.css";

window.addEventListener("DOMContentLoaded", () => new DemoIconsPreload());

const FONT_NAME = "Source Code Pro";

/**
 * 3Dのパーティクル表現のデモクラスです。プリロードしてから実行します。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export class DemoIconsPreload {
  constructor() {
    // ウェブフォントのロードを待ってから初期化
    WebFont.load({
      custom: {
        families: ["Source Code Pro", "FontAwesome"],
        urls: [
          "https://fonts.googleapis.com/css?family=Source+Code+Pro:600",
          "https://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css"
        ],
        testStrings: {
          FontAwesome: "\uf001"
        }
      },
      // Web Fontが使用可能になったとき
      active: () => new DemoIconsWorld()
    });
  }
}

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
class DemoIconsWorld extends BasicView {
  private CANVAS_W: number = 160;
  private CANVAS_H: number = 40;
  private _matrixLength: number = 8;
  private _particleList = [];
  private _wrap: THREE.Object3D;
  private WORD_LIST = ["WebGL", "HTML5", "three.js"];
  private _wordIndex = 0;

  constructor() {
    super();
    this.setup();
    this.createLogo();
    this.startRendering();
  }

  /**
   * セットアップします。
   */
  private setup(): void {
    // ------------------------------
    // カメラの配置
    // ------------------------------
    this.camera.far = 100000;
    this.camera.position.z = 5000;
    this.camera.lookAt(this.scene.position);

    // ------------------------------
    // 背景の作成
    // ------------------------------
    const plane = new THREE.PlaneBufferGeometry(20000, 20000, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load("imgs/bg.png")
    });
    const bg = new THREE.Mesh(plane, mat);
    bg.position.z = -10000;
    this.scene.add(bg);

    // ------------------------------
    // 3D空間のパーツを配置
    // ------------------------------
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 1, +1).normalize();
    this.scene.add(light);

    // particle motion
    this._wrap = new THREE.Object3D();
    this.scene.add(this._wrap);

    // ------------------------------
    // パーティクルのテクスチャアトラスを生成
    // ------------------------------
    const container = new Container();

    const SIZE = 256;
    for (
      let i = 0, len = this._matrixLength * this._matrixLength;
      i < len;
      i++
    ) {
      const char = String.fromCharCode(61730 + i);
      const text2: Text = new Text(char, "200px FontAwesome", "#FFF");
      text2.textBaseline = "middle";
      text2.textAlign = "center";
      text2.x = SIZE * (i % this._matrixLength) + SIZE / 2;
      text2.y = SIZE * Math.floor(i / this._matrixLength) + SIZE / 2;
      container.addChild(text2);
    }

    container.cache(0, 0, SIZE * this._matrixLength, SIZE * this._matrixLength);
    const cacheUrl: string = container.cacheCanvas.toDataURL();
    const image = new Image();
    image.src = cacheUrl;

    const texture: THREE.Texture = new THREE.Texture(image);
    texture.needsUpdate = true;

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
        this.change_uvs(geometry, ux, uy, ox, oy);

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

  /**
   * ロゴを生成し、モーションします。
   */
  private createLogo(): void {
    // レターオブジェクトを生成します。
    const canvas: HTMLCanvasElement = document.createElement(
      "canvas"
    ) as HTMLCanvasElement;
    canvas.setAttribute("width", this.CANVAS_W + "px");
    canvas.setAttribute("height", this.CANVAS_H + "px");

    const stage = new Stage(canvas);
    const text1 = new Text(
      this.WORD_LIST[this._wordIndex],
      "36px " + FONT_NAME,
      "#FFF"
    );
    this._wordIndex++;
    if (this._wordIndex >= this.WORD_LIST.length) {
      this._wordIndex = 0;
    }

    text1.textAlign = "center";
    text1.x = this.CANVAS_W / 2;
    stage.addChild(text1);
    stage.update();

    const timeline: TimelineMax = new TimelineMax({
      onComplete: () => {
        this.createLogo();
      }
    });

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
          0.5 + ((i * canvas.height) / max) * 0.4,
          0.6,
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

    // 3種類のモーションを適用する
    if (Math.random() < 0.3) {
      timeline.timeScale(3.0);

      timeline.addCallback(() => {
        TweenMax.to(timeline, 1.0, {
          timeScale: 0.05,
          ease: Cubic.easeInOut
        });
        TweenMax.to(timeline, 0.5, {
          timeScale: 3.0,
          delay: 3.5,
          ease: Cubic.easeInOut
        });
        TweenMax.to(timeline, 0.5, {
          timeScale: 0.05,
          delay: 4.0,
          ease: Cubic.easeInOut
        });
        TweenMax.to(timeline, 2.0, {
          timeScale: 5.0,
          delay: 9.0,
          ease: Cubic.easeIn
        });
      }, 3.5);
    } else if (Math.random() < 0.5) {
      timeline.timeScale(6.0);
      TweenMax.to(timeline, 4.0, { timeScale: 0.005, ease: Cubic.easeOut });
      TweenMax.to(timeline, 4.0, {
        timeScale: 2.0,
        ease: Cubic.easeIn,
        delay: 5.0
      });
    } else {
      timeline.timeScale(1.0);
    }
  }

  /**
   * ジオメトリ内のUVを変更します。
   * @param geometry    {THREE.PlaneGeometry}
   * @param unitx    {number}
   * @param unity    {number}
   * @param offsetx    {number}
   * @param offsety    {number}
   */
  private change_uvs(
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
}
