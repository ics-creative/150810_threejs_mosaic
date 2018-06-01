import { Container, Stage, Text } from "@createjs/easeljs/dist/easeljs.module";
import { Cubic, Expo, Quart } from "gsap/umd/EasePack";
import * as TimelineMax from "gsap/umd/TimelineMax";
import * as TweenMax from "gsap/umd/TweenMax";
import * as THREE from "three";
import * as WebFont from "webfontloader";
import { BasicView } from "./BasicView";

window.addEventListener("load", () => {
  new demo.DemoIconsPreload();
});

namespace demo {
  var FONT_NAME = "Source Code Pro";

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
            "http://fonts.googleapis.com/css?family=Source+Code+Pro:600",
            "http://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css"
          ],
          testStrings: {
            FontAwesome: "\uf001"
          }
        },
        // Web Fontが使用可能になったとき
        active: () => {
          new DemoIconsWorld();
        }
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
    private matrixLength: number = 8;
    private particleList = [];
    private wrap: THREE.Object3D;
    private WORD_LIST = ["WebGL", "HTML5", "three.js"];
    private wordIndex = 0;

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
      var plane = new THREE.PlaneBufferGeometry(20000, 20000, 1, 1);
      var mat = new THREE.MeshBasicMaterial({
        map: THREE.ImageUtils.loadTexture("imgs/bg.png")
      });
      var bg = new THREE.Mesh(plane, mat);
      bg.position.z = -10000;
      this.scene.add(bg);

      // ------------------------------
      // 3D空間のパーツを配置
      // ------------------------------
      var light = new THREE.DirectionalLight(0xffffff);
      light.position.set(0, 1, +1).normalize();
      this.scene.add(light);

      // particle motion
      this.wrap = new THREE.Object3D();
      this.scene.add(this.wrap);

      // ------------------------------
      // パーティクルのテクスチャアトラスを生成
      // ------------------------------
      var container = new Container();

      var SIZE = 256;
      for (
        var i = 0, len = this.matrixLength * this.matrixLength;
        i < len;
        i++
      ) {
        var char = String.fromCharCode(61730 + i);
        var text2: Text = new Text(char, "200px FontAwesome", "#FFF");
        text2.textBaseline = "middle";
        text2.textAlign = "center";
        text2.x = SIZE * (i % this.matrixLength) + SIZE / 2;
        text2.y = SIZE * Math.floor(i / this.matrixLength) + SIZE / 2;
        container.addChild(text2);
      }

      container.cache(0, 0, SIZE * this.matrixLength, SIZE * this.matrixLength);
      const cacheUrl: string = container.cacheCanvas.toDataURL();
      var image = new Image();
      image.src = cacheUrl;

      var texture: THREE.Texture = new THREE.Texture(image);
      texture.needsUpdate = true;

      // ------------------------------
      // パーティクルの作成
      // ------------------------------
      var ux = 1 / this.matrixLength;
      var uy = 1 / this.matrixLength;

      this.particleList = [];
      for (var i = 0; i < this.CANVAS_W; i++) {
        for (var j = 0; j < this.CANVAS_H; j++) {
          var ox = (this.matrixLength * Math.random()) >> 0;
          var oy = (this.matrixLength * Math.random()) >> 0;

          var geometry = new THREE.PlaneGeometry(40, 40, 1, 1);
          this.change_uvs(geometry, ux, uy, ox, oy);

          var material = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
          });

          material.blending = THREE.AdditiveBlending;

          var word: THREE.Mesh = new THREE.Mesh(geometry, material);
          this.wrap.add(word);

          this.particleList.push(word);
        }
      }
    }

    /**
     * ロゴを生成し、モーションします。
     */
    private createLogo(): void {
      // レターオブジェクトを生成します。
      var canvas: HTMLCanvasElement = <HTMLCanvasElement>(
        document.createElement("canvas")
      );
      canvas.setAttribute("width", this.CANVAS_W + "px");
      canvas.setAttribute("height", this.CANVAS_H + "px");

      var stage = new Stage(canvas);
      var text1 = new Text(
        this.WORD_LIST[this.wordIndex],
        "36px " + FONT_NAME,
        "#FFF"
      );
      this.wordIndex++;
      if (this.wordIndex >= this.WORD_LIST.length) {
        this.wordIndex = 0;
      }

      text1.textAlign = "center";
      text1.x = this.CANVAS_W / 2;
      stage.addChild(text1);
      stage.update();

      var timeline: TimelineMax = new TimelineMax({
        onComplete: () => {
          this.createLogo();
        }
      });

      var ctx: CanvasRenderingContext2D = <CanvasRenderingContext2D>(
        canvas.getContext("2d")
      );

      for (var i = 0; i < this.particleList.length; i++) {
        this.particleList[i].visible = false;
      }

      // 透過領域を判定する
      var pixcelColors = ctx.getImageData(0, 0, this.CANVAS_W, this.CANVAS_H)
        .data;
      var existDotList = [];
      var existDotCount = 0;
      for (var i = 0; i < this.CANVAS_W; i++) {
        existDotList[i] = [];
        for (var j = 0; j < this.CANVAS_H; j++) {
          // 透過しているか判定
          var flag = pixcelColors[(i + j * this.CANVAS_W) * 4 + 3] == 0;
          existDotList[i][j] = flag;

          if (flag == true) existDotCount++;
        }
      }

      // レターのモーションを作成する
      var cnt = 0;
      var max = this.CANVAS_W * this.CANVAS_H;
      for (var i = 0; i < this.CANVAS_W; i++) {
        for (var j = 0; j < this.CANVAS_H; j++) {
          // 透過していたらパスする
          if (existDotList[i][j] == true) continue;

          var word: THREE.Mesh = this.particleList[cnt];
          (<THREE.MeshLambertMaterial>word.material).color.setHSL(
            0.5 + ((i * canvas.height) / max) * 0.4,
            0.6,
            0.6 + 0.4 * Math.random()
          );
          (<THREE.MeshLambertMaterial>word.material).blending =
            THREE.AdditiveBlending;
          this.wrap.add(word);

          var toObj = {
            x: (i - canvas.width / 2) * 30,
            y: (canvas.height / 2 - j) * 30,
            z: 0
          };

          var fromObj = {
            x: 2000 * (Math.random() - 0.5) - 500,
            y: 1000 * (Math.random() - 0.5),
            z: +10000
          };

          word.position.x = fromObj.x;
          word.position.y = fromObj.y;
          word.position.z = fromObj.z;

          var toRotationObj = {
            z: 0
          };

          var fromRotationObj = {
            z: 10 * Math.PI * (Math.random() - 0.5)
          };

          word.rotation.z = fromRotationObj.z;

          var delay =
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

      this.wrap.position.z = -5000;
      timeline.to(this.wrap.position, 12.0, { z: 6000, ease: Quart.easeIn }, 0);

      // 3種類のモーションを適用する
      if (Math.random() < 0.3) {
        timeline.timeScale(3.0);

        timeline.addCallback(function() {
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
      var faceVertexUvs = geometry.faceVertexUvs[0];
      for (var i = 0; i < faceVertexUvs.length; i++) {
        var uvs = faceVertexUvs[i];
        for (var j = 0; j < uvs.length; j++) {
          var uv = uvs[j];
          uv.x = (uv.x + offsetx) * unitx;
          uv.y = (uv.y + offsety) * unity;
        }
      }
    }
  }
}
