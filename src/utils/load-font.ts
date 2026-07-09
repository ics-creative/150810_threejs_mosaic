export const FONT_BASE = "Source Code Pro";
export const FONT_ICON = "FontAwesome";

const FONT_STYLESHEET_URLS = [
  "https://fonts.googleapis.com/css?family=Source+Code+Pro:600",
  "https://netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css",
];

/**
 * 3Dのパーティクル表現のデモクラスです。プリロードしてから実行します。
 * @author Yausnobu Ikeda a.k.a clockmaker
 */
export async function loadFont(): Promise<void> {
  // フォント定義が書かれた CSS を先に読み込み、Font Loading API が @font-face を参照できる状態にする。
  const stylesheetLoads = FONT_STYLESHEET_URLS.map(loadStylesheet);
  await Promise.all(stylesheetLoads);

  // CSS に登録された @font-face を Font Loading API で実際に読み込む。
  await Promise.all([
    document.fonts.load(`600 1em "${FONT_BASE}"`),
    document.fonts.load(`1em "${FONT_ICON}"`, "\uf001"),
  ]);
  await document.fonts.ready;
}

function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", () => resolve(), { once: true });
    document.head.appendChild(link);
  });
}
