import type { ListType, NumberType } from "./hir/types.js"

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`)
}

type ConstantNumberType = Extract<NumberType, { kind: "constant" }>
type ConstantListType = { kind: "explicit"; value: ConstantNumberType[] }

export function isConstantList(value: ListType): value is ConstantListType {
  return value.kind === "explicit" && value.value.every((item) => item.kind === "constant")
}

export function numberNormalize(n: NumberType): NumberType {
  if (n.kind !== "constant") return n
  const newValue = Math.max(0, Math.floor(n.value))
  return isNaN(newValue) || !isFinite(newValue) ? { kind: "constant", value: 0 } : { kind: "constant", value: newValue }
}
