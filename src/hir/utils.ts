import { normalizeNaturalNumber } from "../utils.js"
import type { ListType, NumberType } from "./types.js"

type ConstantNumberType = Extract<NumberType, { kind: "constant" }>
type ConstantListType = { kind: "explicit"; value: ConstantNumberType[] }

export function isConstantList(value: ListType): value is ConstantListType {
  return value.kind === "explicit" && value.value.every((item) => item.kind === "constant")
}

export function numberNormalize(n: NumberType): NumberType {
  if (n.kind !== "constant") return n
  return { kind: "constant", value: normalizeNaturalNumber(n.value) }
}
