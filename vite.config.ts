import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // ビルド成果物のベースURL

  // ビルド成果物の出力先ディレクトリ (プロジェクトルートからの相対パス)
  build: {
    outDir: "./docs", // ビルド成果物をプロジェクトルートの 'docs' に出力
    rollupOptions: {
      input: {
        // エントリーポイントとなる各HTMLファイルへのパスを指定
        // __dirname は vite.config.ts がある docs ディレクトリを指す
        // そのため resolve(__dirname, 'ファイル名') で docs/ファイル名 を指定できる
        // もし index.html が存在しない場合は、この行は削除してください
        main: resolve(__dirname, "index.html"),
        demoIcons: resolve(__dirname, "DemoIcons.html"),
        demoCubes: resolve(__dirname, "DemoCubes.html"),
        demoIcons_4000: resolve(__dirname, "DemoIcons_4000.html"),
      },
    }
  },
  // 開発サーバーの設定
  server: {
    open: true, // サーバー起動時にブラウザを自動で開く
  },
});
