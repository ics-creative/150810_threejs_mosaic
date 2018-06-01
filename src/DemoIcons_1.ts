import { Container, Stage, Text } from "@createjs/easeljs/dist/easeljs.module";
import { Cubic, Expo, Quart } from "gsap/umd/EasePack";
import * as TimelineMax from "gsap/umd/TimelineMax";
import * as TweenMax from "gsap/umd/TweenMax";
import * as THREE from "three";
import { IconsView } from "./base/IconsView";
import "./styles/style.css";
import { FONT_ICON, loadFont } from "./utils/load-font";

window.addEventListener("DOMContentLoaded", async () => {
  await loadFont();
  const world = new DemoIconsWorld();
});

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
class DemoIconsWorld extends IconsView {
  private WORD_LIST = ["WebGL", "HTML5", "three.js"];

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
    this.createWorld();

    // ------------------------------
    // パーティクルのテクスチャアトラスを生成
    // ------------------------------
    const container = new Container();

    const SIZE = 256;
    const len = this._matrixLength * this._matrixLength;
    for (let i = 0; i < len; i++) {
      const char = String.fromCharCode(61730 + i);
      const text2 = new Text(char, "200px " + FONT_ICON, "#FFF");
      text2.textBaseline = "middle";
      text2.textAlign = "center";
      text2.x = SIZE * (i % this._matrixLength) + SIZE / 2;
      text2.y = SIZE * Math.floor(i / this._matrixLength) + SIZE / 2;
      container.addChild(text2);
    }

    container.cache(0, 0, SIZE * this._matrixLength, SIZE * this._matrixLength);

    const texture: THREE.Texture = new THREE.Texture(container.cacheCanvas);
    texture.needsUpdate = true;

    this.createParticle(texture);
  }

  /**
   * ロゴを生成し、モーションします。
   */
  private createLogo(): void {
    const canvas = IconsView.createCanvas(
      this.WORD_LIST[this._wordIndex],
      36,
      this.CANVAS_W,
      this.CANVAS_H
    );

    const timeline: TimelineMax = new TimelineMax({
      onComplete: () => {
        this.createLogo();
      }
    });

    this.createLetter(canvas, timeline);

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
}
