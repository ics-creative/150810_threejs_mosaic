import type { PlaneGeometry } from "three";

/**
 * UV 座標をクリップ可能な状態に変更します。
 * @param geometry  ジオメトリ
 * @param unitX  水平方向の分割数
 * @param unitY 垂直方向の分割数
 * @param offsetX
 * @param offsetY
 */
export function changeUvs(
  geometry: PlaneGeometry,
  unitX: number,
  unitY: number,
  offsetX: number,
  offsetY: number,
) {
  const uvs = geometry.attributes.uv;

  for (let i = 0; i < uvs.count; i++) {
    uvs.setX(i, (uvs.getX(i) + offsetX) * unitX);
    uvs.setY(i, (uvs.getY(i) + offsetY) * unitY);
  }
}
