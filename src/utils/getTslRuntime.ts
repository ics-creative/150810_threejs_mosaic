import { TSL } from "three/webgpu";

/**
 * TSLの型全体はTypeScript 7での展開コストが大きいため、
 * 呼び出し側が実際に使うAPIだけを定義して取得します。
 */
export function getTslRuntime<T>(): T {
  return TSL as unknown as T;
}
