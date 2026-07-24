import type { BooleanType } from "../types.js"

// 布尔逻辑运算
export function booleanAndBoolean(lhs: BooleanType, rhs: BooleanType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value && rhs.value }
  } else if (lhs.kind === "constant" && lhs.value === false) {
    return { kind: "constant", value: false }
  } else if (rhs.kind === "constant" && rhs.value === false) {
    return { kind: "constant", value: false }
  } else if (lhs.kind === "constant" && lhs.value === true) {
    return rhs
  } else if (rhs.kind === "constant" && rhs.value === true) {
    return lhs
  } else {
    return { kind: "binary", value: { kind: "and", lhs, rhs } }
  }
}

export function booleanOrBoolean(lhs: BooleanType, rhs: BooleanType): BooleanType {
  if (lhs.kind === "constant" && rhs.kind === "constant") {
    return { kind: "constant", value: lhs.value || rhs.value }
  } else if (lhs.kind === "constant" && lhs.value === true) {
    return { kind: "constant", value: true }
  } else if (rhs.kind === "constant" && rhs.value === true) {
    return { kind: "constant", value: true }
  } else if (lhs.kind === "constant" && lhs.value === false) {
    return rhs
  } else if (rhs.kind === "constant" && rhs.value === false) {
    return lhs
  } else {
    return { kind: "binary", value: { kind: "or", lhs, rhs } }
  }
}
