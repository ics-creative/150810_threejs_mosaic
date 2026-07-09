declare module "three/tsl" {
  type TslNode = any;

  export const viewportSize: TslNode;
  export function attribute(name: string, type: string): TslNode;
  export function mul(...values: unknown[]): TslNode;
  export function texture(value: unknown): TslNode;
  export function vec4(...values: unknown[]): TslNode;
}
