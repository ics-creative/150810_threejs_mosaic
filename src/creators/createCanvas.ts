import { FONT_BASE } from "../utils/load-font";

/**
 * 文字を記述したキャンバスを返します。
 * @param label
 * @param fontSize
 * @param width
 * @param height
 */
export function createCanvas(
  label: string,
  fontSize: number,
  w: number,
  h: number
): HTMLCanvasElement {
  // レターオブジェクトを生成します。
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", w + "px");
  canvas.setAttribute("height", h + "px");

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error();
  }

  context.fillStyle = "white";
  context.font = fontSize + "px " + FONT_BASE;
  context.textAlign = "center";
  context.textBaseline = "top";

  context.fillText(label, w / 2, 0);

  return canvas;
}
