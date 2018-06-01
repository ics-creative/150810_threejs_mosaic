import * as THREE from "three";

/**
 * ジオメトリ内のUVを変更します。
 * @param geometry    {THREE.PlaneGeometry}
 * @param unitx    {number}
 * @param unity    {number}
 * @param offsetx    {number}
 * @param offsety    {number}
 */
export function changeUvs(
  geometry: THREE.PlaneGeometry,
  unitx: number,
  unity: number,
  offsetx: number,
  offsety: number
): void {
  const faceVertexUvs = geometry.faceVertexUvs[0];
  faceVertexUvs.forEach((uvs, i) => {
    uvs.forEach((uv, j) => {
      uv.x = (uv.x + offsetx) * unitx;
      uv.y = (uv.y + offsety) * unity;
    });
  });
}
