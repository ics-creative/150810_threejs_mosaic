import * as WebFont from "webfontloader";

export const FONT_BASE = "Source Sans Pro";
export const FONT_ICON = "FontAwesome";

/**
 * 3Dのパーティクル表現のデモクラスです。プリロードしてから実行します。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export function loadFont(): Promise<void> {
  return new Promise((resolve, reject) => {
    // ウェブフォントのロードを待ってから初期化
    WebFont.load({
      custom: {
        families: [FONT_BASE, FONT_ICON],
        urls: [
          "https://fonts.googleapis.com/css?family=Source+Code+Pro:900",
          "https://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css"
        ],
        testStrings: {
          FontAwesome: "\uf001"
        }
      },
      // Web Fontが使用可能になったとき
      active: () => {
        resolve();
      },
      inactive: () => {
        reject();
      }
    });
  });
}
