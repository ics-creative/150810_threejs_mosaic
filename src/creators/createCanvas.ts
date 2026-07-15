import { FONT_BASE } from "../utils/load-font";

/**
 * 文字を記述したキャンバスを返します。
 * @param label
 * @param fontSize
 * @param w
 * @param h
 */
export function createCanvas(
  label: string,
  fontSize: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const context = canvas.getContext("2d")!;

  context.fillStyle = "white";
  context.font = `${fontSize}px ${FONT_BASE}`;
  context.letterSpacing = "-0.08em";
  context.textAlign = "center";
  context.textBaseline = "top";

  context.fillText(label, w / 2, 0);

  return canvas;
}
