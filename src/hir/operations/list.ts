import type { IToken } from "chevrotain"
import type { ListType, NumberType } from "../types.js"
import { isConstantList } from "../utils.js"
import {
  numberDivideNumber,
  numberIntDivideNumber,
  numberMinusNumber,
  numberModuloNumber,
  numberMultiplyNumber,
  numberPlusNumber,
} from "./number.js"

function mapConstantList(
  list: ListType,
  number: NumberType,
  operation: (item: NumberType, number: NumberType) => NumberType
): ListType | undefined {
  if (!isConstantList(list) || number.kind !== "constant") return undefined
  return { kind: "explicit", value: list.value.map((item) => operation(item, number)) }
}

// 数与列表的运算
export function numberPlusList(lhs: NumberType, rhs: ListType): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberPlusNumber(number, item)) ?? {
      kind: "binary",
      value: { kind: "addReverse", lhs, rhs },
    }
  )
}
export function numberMinusList(lhs: NumberType, rhs: ListType): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberMinusNumber(number, item)) ?? {
      kind: "binary",
      value: { kind: "subtractReverse", lhs, rhs },
    }
  )
}
export function numberMultiplyList(lhs: NumberType, rhs: ListType): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberMultiplyNumber(number, item)) ?? {
      kind: "binary",
      value: { kind: "multiplyReverse", lhs, rhs },
    }
  )
}
export function numberDivideList(lhs: NumberType, rhs: ListType, op: IToken): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberDivideNumber(number, item, op)) ?? {
      kind: "binary",
      value: { kind: "divideReverse", lhs, rhs },
    }
  )
}
export function numberIntDivideList(lhs: NumberType, rhs: ListType, op: IToken): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberIntDivideNumber(number, item, op)) ?? {
      kind: "binary",
      value: { kind: "intDivideReverse", lhs, rhs },
    }
  )
}
export function numberModuloList(lhs: NumberType, rhs: ListType, op: IToken): ListType {
  return (
    mapConstantList(rhs, lhs, (item, number) => numberModuloNumber(number, item, op)) ?? {
      kind: "binary",
      value: { kind: "moduloReverse", lhs, rhs },
    }
  )
}
// 列表与数的运算
export function listPlusNumber(lhs: ListType, rhs: NumberType): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberPlusNumber(item, number)) ?? {
      kind: "binary",
      value: { kind: "add", lhs, rhs },
    }
  )
}
export function listMinusNumber(lhs: ListType, rhs: NumberType): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberMinusNumber(item, number)) ?? {
      kind: "binary",
      value: { kind: "subtract", lhs, rhs },
    }
  )
}
export function listMultiplyNumber(lhs: ListType, rhs: NumberType): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberMultiplyNumber(item, number)) ?? {
      kind: "binary",
      value: { kind: "multiply", lhs, rhs },
    }
  )
}
export function listDivideNumber(lhs: ListType, rhs: NumberType, op: IToken): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberDivideNumber(item, number, op)) ?? {
      kind: "binary",
      value: { kind: "divide", lhs, rhs },
    }
  )
}
export function listIntDivideNumber(lhs: ListType, rhs: NumberType, op: IToken): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberIntDivideNumber(item, number, op)) ?? {
      kind: "binary",
      value: { kind: "intDivide", lhs, rhs },
    }
  )
}
export function listModuloNumber(lhs: ListType, rhs: NumberType, op: IToken): ListType {
  return (
    mapConstantList(lhs, rhs, (item, number) => numberModuloNumber(item, number, op)) ?? {
      kind: "binary",
      value: { kind: "modulo", lhs, rhs },
    }
  )
}
// 列表与列表的运算
export function listConcatList(lhs: ListType, rhs: ListType): ListType {
  if (lhs.kind === "explicit" && rhs.kind === "explicit") {
    return { kind: "explicit", value: [...lhs.value, ...rhs.value] }
  } else {
    return { kind: "binary", value: { kind: "concat", lhs, rhs } }
  }
}
