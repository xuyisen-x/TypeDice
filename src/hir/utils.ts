import { normalizeNaturalNumber } from "../utils.js"
import type { HIRNode, ListType, NumberType } from "./types.js"

type ConstantNumberType = Extract<NumberType, { kind: "constant" }>
type ConstantListType = { kind: "explicit"; value: ConstantNumberType[] }

export function isConstantList(value: ListType): value is ConstantListType {
  return value.kind === "explicit" && value.value.every((item) => item.kind === "constant")
}

export function numberNormalize(n: NumberType): NumberType {
  if (n.kind !== "constant") return n
  return { kind: "constant", value: normalizeNaturalNumber(n.value) }
}

export const TYPE_NAME: Readonly<Record<HIRNode["kind"], string>> = {
  number: "数字",
  boolean: "布尔",
  list: "列表",
  string: "字符串",
  stringSet: "字符串集合",
}
