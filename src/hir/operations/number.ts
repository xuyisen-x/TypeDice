import type { IToken } from "chevrotain"
import type { BooleanType, NumberType } from "../types.js"

function additiveOperation(lhs: NumberType, rhs: NumberType, positive: boolean): NumberType {
  type AdditiveParts = {
    constant: number
    positive: NumberType[]
    negative: NumberType[]
  }
  function collectAdditiveParts(num: NumberType, positive: boolean, parts: AdditiveParts): void {
    if (num.kind === "constant") {
      parts.constant += positive ? num.value : -num.value
    } else if (num.kind === "binary" && num.value.kind === "add") {
      if (positive) {
        parts.constant += num.value.constant
        parts.positive.push(...num.value.positive)
        parts.negative.push(...num.value.negative)
      } else {
        parts.constant -= num.value.constant
        parts.positive.push(...num.value.negative)
        parts.negative.push(...num.value.positive)
      }
    } else if (num.kind === "negative") {
      collectAdditiveParts(num.value, !positive, parts)
    } else {
      if (positive) parts.positive.push(num)
      else parts.negative.push(num)
    }
  }

  function mergeConstantDicePools(values: NumberType[]): NumberType[] {
    type MergeEntry = {
      count: number
      build: (count: number) => NumberType
    }

    const result: (NumberType | MergeEntry)[] = []
    const entries = new Map<number | "fudge" | "coin", MergeEntry>()

    for (const value of values) {
      if (value.kind !== "dicePool") {
        result.push(value)
        continue
      }

      const pool = value.value

      if (pool.kind === "standard" && pool.count.kind === "constant" && pool.sides.kind === "constant") {
        const key = pool.sides.value
        const existing = entries.get(key)
        if (existing) {
          existing.count += pool.count.value
        } else {
          const newEntry: MergeEntry = {
            count: pool.count.value,
            build: (mergedCount) => ({
              kind: "dicePool",
              value: {
                kind: "standard",
                count: { kind: "constant", value: mergedCount },
                sides: pool.sides,
              },
            }),
          }
          entries.set(key, newEntry)
          result.push(newEntry)
        }
      } else if (pool.kind === "fudge" && pool.count.kind === "constant") {
        const key = "fudge"
        const existing = entries.get(key)
        if (existing) {
          existing.count += pool.count.value
        } else {
          const newEntry: MergeEntry = {
            count: pool.count.value,
            build: (mergedCount) => ({
              kind: "dicePool",
              value: {
                kind: "fudge",
                count: { kind: "constant", value: mergedCount },
              },
            }),
          }
          entries.set(key, newEntry)
          result.push(newEntry)
        }
      } else if (pool.kind === "coin" && pool.count.kind === "constant") {
        const key = "coin"
        const existing = entries.get(key)
        if (existing) {
          existing.count += pool.count.value
        } else {
          const newEntry: MergeEntry = {
            count: pool.count.value,
            build: (mergedCount) => ({
              kind: "dicePool",
              value: {
                kind: "coin",
                count: { kind: "constant", value: mergedCount },
              },
            }),
          }
          entries.set(key, newEntry)
          result.push(newEntry)
        }
      } else {
        result.push(value)
      }
    }

    return result.map((entry) => {
      if ("build" in entry) {
        return entry.build(entry.count)
      } else {
        return entry
      }
    })
  }

  let parts: AdditiveParts = { constant: 0, positive: [], negative: [] }
  collectAdditiveParts(lhs, true, parts)
  collectAdditiveParts(rhs, positive, parts)
  parts.positive = mergeConstantDicePools(parts.positive)
  parts.negative = mergeConstantDicePools(parts.negative)

  if (parts.positive.length === 0 && parts.negative.length === 0) {
    return { kind: "constant", value: parts.constant }
  } else if (parts.constant === 0 && parts.positive.length === 1 && parts.negative.length === 0) {
    return parts.positive[0]
  } else if (parts.constant === 0 && parts.positive.length === 0 && parts.negative.length === 1) {
    return { kind: "negative", value: parts.negative[0] }
  } else {
    return {
      kind: "binary",
      value: {
        kind: "add",
        constant: parts.constant,
        positive: parts.positive,
        negative: parts.negative,
      },
    }
  }
}

// 数与数的算术运算
export function numberPlusNumber(lhs: NumberType, rhs: NumberType): NumberType {
  return additiveOperation(lhs, rhs, true)
}
export function numberMinusNumber(lhs: NumberType, rhs: NumberType): NumberType {
  return additiveOperation(lhs, rhs, false)
}
export function numberMultiplyNumber(lhs: NumberType, rhs: NumberType): NumberType {
  type MultiplicativeParts = {
    constant: number
    factors: NumberType[]
  }
  function collectMultiplicativeParts(value: NumberType, parts: MultiplicativeParts): void {
    if (value.kind === "constant") {
      parts.constant *= value.value
    } else if (value.kind === "binary" && value.value.kind === "multiply") {
      parts.constant *= value.value.constant
      parts.factors.push(...value.value.factors)
    } else if (value.kind === "negative") {
      parts.constant *= -1
      collectMultiplicativeParts(value.value, parts)
    } else {
      parts.factors.push(value)
    }
  }
  let parts: MultiplicativeParts = { constant: 1, factors: [] }
  collectMultiplicativeParts(lhs, parts)
  collectMultiplicativeParts(rhs, parts)

  if (parts.constant === 0) {
    return { kind: "constant", value: 0 }
  } else if (parts.constant === 1 && parts.factors.length === 1) {
    return parts.factors[0]
  } else if (parts.factors.length === 0) {
    return { kind: "constant", value: parts.constant }
  } else {
    return { kind: "binary", value: { kind: "multiply", constant: parts.constant, factors: parts.factors } }
  }
}
export function numberDivideNumber(lhs: NumberType, rhs: NumberType, op: IToken): NumberType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value / rhs.value }
  } else if (rhs.kind === "constant" && rhs.value === 1) {
    return lhs
  } else {
    return { kind: "binary", value: { kind: "divide", lhs, rhs } }
  }
}
export function numberIntDivideNumber(lhs: NumberType, rhs: NumberType, op: IToken): NumberType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: Math.floor(lhs.value / rhs.value) }
  } else {
    return { kind: "binary", value: { kind: "intDivide", lhs, rhs } }
  }
}
export function numberModuloNumber(lhs: NumberType, rhs: NumberType, op: IToken): NumberType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value % rhs.value }
  } else {
    return { kind: "binary", value: { kind: "modulo", lhs, rhs } }
  }
}
// 数与数之间的比较运算
export function numberLessNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value < rhs.value }
  } else {
    return { kind: "compare", value: { kind: "lessThan", lhs, rhs } }
  }
}
export function numberLessEqualNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value <= rhs.value }
  } else {
    return { kind: "compare", value: { kind: "lessThanOrEqual", lhs, rhs } }
  }
}
export function numberGreaterNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value > rhs.value }
  } else {
    return { kind: "compare", value: { kind: "greaterThan", lhs, rhs } }
  }
}
export function numberGreaterEqualNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value >= rhs.value }
  } else {
    return { kind: "compare", value: { kind: "greaterThanOrEqual", lhs, rhs } }
  }
}
export function numberEqualNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value === rhs.value }
  } else {
    return { kind: "compare", value: { kind: "equal", lhs, rhs } }
  }
}
export function numberNotEqualNumber(lhs: NumberType, rhs: NumberType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value !== rhs.value }
  } else {
    return { kind: "compare", value: { kind: "notEqual", lhs, rhs } }
  }
}
