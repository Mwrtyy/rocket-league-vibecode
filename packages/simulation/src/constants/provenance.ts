export type ConstantStatus = 'verified' | 'measured' | 'derived' | 'tuned' | 'temporary';

export interface SourcedConstant<T extends number | string = number> {
  readonly value: T;
  readonly unit: string;
  readonly status: ConstantStatus;
  readonly source: string;
  readonly sourceDate?: string;
  readonly confidence: number;
  readonly notes?: string;
}

export function sourced<T extends number | string>(constant: SourcedConstant<T>): SourcedConstant<T> {
  if (constant.confidence < 0 || constant.confidence > 1) {
    throw new RangeError('Constant confidence must be between 0 and 1.');
  }
  return Object.freeze(constant);
}
