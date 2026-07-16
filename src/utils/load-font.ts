export const FONT_BASE = "Source Code Pro";
export const FONT_ICON = "Material Symbols Outlined";

// Google Fontsのicon_namesはアルファベット順で指定する。Canvasアトラスも同じ配列を使い、
// CSSで取得するサブセットと描画対象が食い違わないようにする。
export const MATERIAL_SYMBOL_NAMES = [
  "account_circle",
  "add",
  "alarm",
  "apps",
  "arrow_back",
  "arrow_downward",
  "arrow_forward",
  "arrow_upward",
  "auto_awesome",
  "bolt",
  "bookmark",
  "build",
  "calendar_month",
  "call",
  "camera_alt",
  "chat",
  "check_circle",
  "cloud",
  "code",
  "computer",
  "dark_mode",
  "delete",
  "devices",
  "download",
  "edit",
  "favorite",
  "filter_alt",
  "fingerprint",
  "folder",
  "headphones",
  "help",
  "home",
  "image",
  "language",
  "light_mode",
  "link",
  "location_on",
  "lock",
  "mail",
  "map",
  "menu",
  "mic",
  "notifications",
  "palette",
  "person",
  "photo_camera",
  "play_arrow",
  "public",
  "refresh",
  "rocket_launch",
  "search",
  "send",
  "settings",
  "share",
  "shield",
  "shopping_cart",
  "smartphone",
  "star",
  "terminal",
  "thumb_up",
  "upload",
  "videocam",
  "visibility",
  "wifi",
] as const;

const MATERIAL_SYMBOLS_STYLESHEET_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,700,0,200&icon_names=${MATERIAL_SYMBOL_NAMES.join(",")}&display=block`;

const FONT_STYLESHEET_URLS = [
  "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@600&display=block",
  MATERIAL_SYMBOLS_STYLESHEET_URL,
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
    document.fonts.load(`700 1em "${FONT_ICON}"`, MATERIAL_SYMBOL_NAMES[0]),
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
