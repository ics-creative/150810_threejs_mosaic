import { Container, Text } from "@createjs/easeljs";
import gsap, { Cubic, Quart } from "gsap";
import * as THREE from "three";
import { IconsView } from "./base/IconsView";
import { createCanvas } from "./creators/createCanvas";
import { createParticleCloud } from "./creators/createParticleCloud";
import "./styles/style.css";
import { FONT_ICON, loadFont } from "./utils/load-font";

window.addEventListener("DOMContentLoaded", async () => {
  await loadFont();
  new DemoIconsWorld();
});

/**
 * 3Dのパーティクル表現のクラスです。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
class DemoIconsWorld extends IconsView {
  private WORD_LIST = ["WebGL", "HTML5", "THREE"];

  constructor() {
    super();
    this.setup();
    this.createLogo();
    this.startRendering();
  }

  public onTick(): void {
    super.onTick();

    this.camera.lookAt(this.HELPER_ZERO);

    // 背景をカメラの反対側に配置
    const vec = this.camera.position.clone();
    vec.negate();
    vec.normalize();
    vec.multiplyScalar(25000);
    this._bg.position.copy(vec);
    this._bg.lookAt(this.camera.position);
  }

  /**
   * セットアップします。
   */
  protected setup(): void {
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

    const icons = createParticleCloud();
    this.scene.add(icons);
  }

  /**
   * ロゴを生成し、モーションします。
   */
  private createLogo(): void {
    const canvas = createCanvas(
      this.WORD_LIST[this._wordIndex],
      42,
      this.CANVAS_W,
      this.CANVAS_H
    );

    this._wordIndex++;
    if (this._wordIndex >= this.WORD_LIST.length) {
      this._wordIndex = 0;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        const tm = gsap.timeline();
        tm.to("#coverBlack", 1.0, { css: { opacity: 1.0 } });
        tm.call(() => {
          this.createLogo();
        });
      },
    });
    this.createLetter(canvas, timeline);

    // ------------------------
    // 3種類のカメラモーションのいずれかを適用する
    // ------------------------
    if (Math.random() < 0.3) {
      timeline.set(this.camera.position, { x: 200, y: -200, z: 1000 }, 0);
      timeline.to(
        this.camera.position,
        14.0,
        { x: 0, y: 0, z: 5000, ease: Quart.easeInOut },
        0
      );
      timeline.set(this.camera, { fov: 90 }, 0);
      timeline.to(this.camera, 14.0, { fov: 45, ease: Quart.easeInOut }, 0);
    } else if (Math.random() < 0.5) {
      timeline.set(this.camera.position, { x: 100, y: +1000, z: 1000 }, 0);
      timeline.to(
        this.camera.position,
        14.0,
        { x: 0, y: 0, z: 5000, ease: Quart.easeInOut },
        0
      );
    } else {
      timeline.set(this.camera.position, { x: -3000, y: 3000, z: 0 }, 0);
      timeline.to(
        this.camera.position,
        15.0,
        { x: 0, y: 0, z: 5000, ease: Quart.easeInOut },
        0
      );
    }

    // 黒マットのフェードイン
    timeline.to("#coverBlack", 1.0, { css: { opacity: 0.0 } }, 0.0);

    // ------------------------
    // 3種類のタイムリマップのいずれかを適用する
    // ------------------------
    if (Math.random() < 0.3) {
      timeline.timeScale(3.0);

      timeline.call(
        () => {
          gsap.to(timeline, 1.0, {
            timeScale: 0.05,
            ease: Cubic.easeInOut,
          });
          gsap.to(timeline, 0.5, {
            timeScale: 3.0,
            delay: 3.5,
            ease: Cubic.easeInOut,
          });
          gsap.to(timeline, 0.5, {
            timeScale: 0.05,
            delay: 4.0,
            ease: Cubic.easeInOut,
          });
          gsap.to(timeline, 2.0, {
            timeScale: 5.0,
            delay: 9.0,
            ease: Cubic.easeIn,
          });
        },
        [],
        3.5
      );
    } else if (Math.random() < 0.5) {
      timeline.timeScale(6.0);
      gsap.to(timeline, 4.0, { timeScale: 0.005, ease: Cubic.easeOut });
      gsap.to(timeline, 4.0, {
        timeScale: 2.0,
        ease: Cubic.easeIn,
        delay: 5.0,
      });
    } else {
      timeline.timeScale(1.0);
    }

    // 背景の色変更
    (this._bg.material as THREE.MeshLambertMaterial).color.setHSL(
      this._hue,
      1.0,
      0.5
    );

    // 色相を移動
    this._hue += 0.2;
    if (this._hue >= 1.0) {
      this._hue = 0.0;
    }
  }
}
