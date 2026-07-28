export const UU_PER_METRE = 100;
export const METRES_PER_UU = 1 / UU_PER_METRE;

export function uuToMetres(value: number): number {
  return value * METRES_PER_UU;
}

export function metresToUu(value: number): number {
  return value * UU_PER_METRE;
}
