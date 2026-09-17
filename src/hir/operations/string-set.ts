import type { BooleanType, StringSetBinaryType, StringSetType, StringType } from "../types.js"

type ConstantString = Extract<StringType, { kind: "constant" }>
type ExplicitStringSet = Extract<StringSetType, { kind: "explicit" }>

function constantValues(value: StringSetType): string[] | undefined {
  if (value.kind !== "explicit" || !value.value.every((item): item is ConstantString => item.kind === "constant")) {
    return undefined
  }
  return value.value.map((item) => item.value)
}

function explicit(values: Iterable<string>): ExplicitStringSet {
  return {
    kind: "explicit",
    value: [...new Set(values)].map((value) => ({ kind: "constant", value })),
  }
}

function binary(kind: StringSetBinaryType["kind"], lhs: StringSetType, rhs: StringSetType): StringSetType {
  return { kind: "binary", value: { kind, lhs, rhs } }
}

export function stringSetDifference(lhs: StringSetType, rhs: StringSetType): StringSetType {
  const lhsValues = constantValues(lhs)
  const rhsValues = constantValues(rhs)
  if (!lhsValues || !rhsValues) return binary("difference", lhs, rhs)

  const rhsSet = new Set(rhsValues)
  return explicit(lhsValues.filter((value) => !rhsSet.has(value)))
}

export function stringSetIntersection(lhs: StringSetType, rhs: StringSetType): StringSetType {
  const lhsValues = constantValues(lhs)
  const rhsValues = constantValues(rhs)
  if (!lhsValues || !rhsValues) return binary("intersection", lhs, rhs)

  const rhsSet = new Set(rhsValues)
  return explicit(lhsValues.filter((value) => rhsSet.has(value)))
}

export function stringSetSymmetricDifference(lhs: StringSetType, rhs: StringSetType): StringSetType {
  const lhsValues = constantValues(lhs)
  const rhsValues = constantValues(rhs)
  if (!lhsValues || !rhsValues) return binary("symmetricDifference", lhs, rhs)

  const lhsSet = new Set(lhsValues)
  const rhsSet = new Set(rhsValues)
  return explicit([
    ...lhsValues.filter((value) => !rhsSet.has(value)),
    ...rhsValues.filter((value) => !lhsSet.has(value)),
  ])
}

export function stringSetUnion(lhs: StringSetType, rhs: StringSetType): StringSetType {
  const lhsValues = constantValues(lhs)
  const rhsValues = constantValues(rhs)
  if (!lhsValues || !rhsValues) return binary("union", lhs, rhs)
  return explicit([...lhsValues, ...rhsValues])
}

export function stringInStringSet(string: StringType, set: StringSetType): BooleanType {
  const setValues = constantValues(set)
  if (string.kind === "constant" && setValues) {
    return { kind: "constant", value: setValues.includes(string.value) }
  }
  return { kind: "membership", value: { lhs: string, rhs: set } }
}
