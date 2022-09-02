import type { PlaneGeometry } from "three";

/**
 * ジオメトリ内のUVを変更します。
 * @param geometry
 * @param unitx
 * @param unity
 * @param offsetx
 * @param offsety
 */
export function changeUvs(
  geometry: PlaneGeometry,
  unitx: number,
  unity: number,
  offsetx: number,
  offsety: number
): void {
  const faceVertexUvs = geometry.faceVertexUvs[0];
  faceVertexUvs.forEach((uvs) => {
    uvs.forEach((uv) => {
      uv.x = (uv.x + offsetx) * unitx;
      uv.y = (uv.y + offsety) * unity;
    });
  });
}
