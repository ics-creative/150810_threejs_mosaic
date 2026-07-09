import * as THREE from "three";
import { Inspector } from "three/addons/inspector/Inspector.js";
import { WebGPURenderer } from "three/webgpu";

/**
 * BasicView は、Three.js のプロジェクトを簡単にセットアップすることができるクラスです。
 * シーン、カメラ、レンダラー、ビューポートのシンプルなテンプレートを提供しています。
 * @author IKEDA Yausunobu a.k.a @clockmaker
 */
export class BasicView {
  /** シーンオブジェクトです。 */
  public scene: THREE.Scene;
  /** カメラオブジェクトです。(PerspectiveCamera のみ) */
  public camera: THREE.PerspectiveCamera;
  /** レンダラーオブジェクトです。WebGPU または WebGL を使用します。 */
  public renderer: WebGPURenderer | null = null; // 初期値は null
  /** HTML 要素です。 */
  public containerElement: HTMLElement;
  /** レンダリングループが開始されたかどうかのフラグ */
  private isRenderingStarted = false;
  /** 非同期初期化が完了したかどうかの Promise */
  private initPromise: Promise<void>;

  constructor() {
    this.containerElement = document.createElement("div");
    document.body.appendChild(this.containerElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      200000,
    );
    this.camera.position.z = -1000; // カメラの位置を少し手前に

    // 非同期でレンダラーを初期化
    this.initPromise = this.initRenderer();

    window.addEventListener("resize", () => {
      this.handleResize();
    });
  }

  /**
   * レンダラーを非同期で初期化します。
   * WebGPU > WebGL2 > WebGL1 の優先順位で試行します。
   */
  private async initRenderer(): Promise<void> {
    const webgpuRenderer = new WebGPURenderer({
      alpha: false,
      antialias: true, // WebGPU では AA は通常デフォルトで有効または設定方法が異なる場合がある
    });
    webgpuRenderer.inspector = new Inspector();
    await webgpuRenderer.init(); // 非同期初期化
    webgpuRenderer.setPixelRatio(window.devicePixelRatio);
    webgpuRenderer.setSize(window.innerWidth, window.innerHeight);
    webgpuRenderer.setClearColor(0x000000, 1); // クリアカラー設定

    this.renderer = webgpuRenderer;
    this.containerElement.appendChild(this.renderer.domElement);
  }

  /**
   * レンダリングを開始します。
   * レンダラーの初期化完了後に実行されます。
   */
  public async startRendering(): Promise<void> {
    // 初期化が完了するのを待つ
    await this.initPromise;

    // レンダラーが正常に初期化された場合のみ開始
    if (this.renderer && !this.isRenderingStarted) {
      this.isRenderingStarted = true;
      this.update();
    } else if (!this.renderer) {
      console.error("Renderer not initialized. Cannot start rendering.");
    }
  }

  /**
   * レンダリングを即座に実行します。
   */
  public render(): void {
    if (this.renderer) {
      // レンダラーが存在するか確認
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * 毎フレーム実行される関数です。
   */
  public onTick(): void {
    // to override
  }

  /**
   * ウインドウリサイズ時のイベントハンドラーです。
   */
  protected handleResize(): void {
    // レンダラーが初期化されてからリサイズ処理を行う
    if (this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * requestAnimationFrame で呼び出されるメソッドです。
   */
  protected update(): void {
    // レンダラーが存在し、ループが開始されている場合のみ実行
    if (this.renderer && this.isRenderingStarted) {
      requestAnimationFrame(this.update.bind(this));
      this.onTick();
      this.render();
    }
  }
}
