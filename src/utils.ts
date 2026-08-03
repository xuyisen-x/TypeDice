export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`)
}

export function normalizeNaturalNumber(value: number): number {
  const normalized = Math.max(0, Math.floor(value))
  return Number.isFinite(normalized) ? normalized : 0
}

export function formatFiniteNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString()

  let rounded = Number(value.toFixed(2))

  // Keep a non-zero value non-zero. Apart from preserving its sign, this also
  // prevents a valid divisor from becoming zero after formatting.
  if (rounded === 0 && value !== 0) rounded = Math.sign(value) * 0.01

  return rounded.toString()
}

export const PRECEDENCE = {
  ternary: 0,
  or: 1,
  and: 2,
  compare: 3,
  concat: 4,
  additive: 5,
  multiplicative: 6,
  unary: 7,
  dice: 8,
  atom: 9,
} as const
