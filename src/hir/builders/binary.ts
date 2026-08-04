import { tokenMatcher, type IToken } from "chevrotain"
import {
  Equal,
  Greater,
  GreaterEqual,
  Hash,
  Less,
  LessEqual,
  LogicalAnd,
  LogicalOr,
  Minus,
  NotEqual,
  Percent,
  Plus,
  Slash,
  SlashSlash,
  Star,
} from "../../syntax/lexer.js"
import type { HirEnv, HIRNode } from "../types.js"
import {
  numberDivideNumber,
  numberEqualNumber,
  numberGreaterEqualNumber,
  numberGreaterNumber,
  numberIntDivideNumber,
  numberLessEqualNumber,
  numberLessNumber,
  numberMinusNumber,
  numberModuloNumber,
  numberMultiplyNumber,
  numberNotEqualNumber,
  numberPlusNumber,
} from "../operations/number.js"
import { hirErrorToken } from "../errors.js"
import {
  listConcatList,
  listDivideNumber,
  listIntDivideNumber,
  listMinusNumber,
  listModuloNumber,
  listMultiplyNumber,
  listPlusNumber,
  numberDivideList,
  numberIntDivideList,
  numberMinusList,
  numberModuloList,
  numberMultiplyList,
  numberPlusList,
} from "../operations/list.js"
import { booleanAndBoolean, booleanOrBoolean } from "../operations/boolean.js"
import type { BinaryExpressionCstNode } from "../../syntax/generated/cst.js"
import { buildUnaryExpressionHir } from "./unary.js"

function binaryPrecedence(op: IToken): number {
  if (tokenMatcher(op, LogicalOr)) return 1
  if (tokenMatcher(op, LogicalAnd)) return 2
  if (
    tokenMatcher(op, Less) ||
    tokenMatcher(op, LessEqual) ||
    tokenMatcher(op, Greater) ||
    tokenMatcher(op, GreaterEqual) ||
    tokenMatcher(op, Equal) ||
    tokenMatcher(op, NotEqual)
  )
    return 3
  if (tokenMatcher(op, Hash)) return 4
  if (tokenMatcher(op, Plus) || tokenMatcher(op, Minus)) return 5
  /* v8 ignore else -- @preserve */
  if (tokenMatcher(op, Star) || tokenMatcher(op, Slash) || tokenMatcher(op, SlashSlash) || tokenMatcher(op, Percent))
    return 6
  /* v8 ignore next -- @preserve */ throw new Error(`Unreachable: unknown binary operator ${op.image}`)
}

function reduceBinary(values: HIRNode[], operators: IToken[]): void {
  const op = operators.pop()
  const rhs = values.pop()
  const lhs = values.pop()

  /* v8 ignore next -- @preserve */
  if (!op || !lhs || !rhs) throw new Error("Unreachable: invalid binary reduction state")

  values.push(buildBinaryOperationHir(lhs, op, rhs))
}

function buildBinaryOperationHir(lhs: HIRNode, op: IToken, rhs: HIRNode): HIRNode {
  if (lhs.kind === "number" && rhs.kind === "number") {
    if (tokenMatcher(op, Plus)) {
      return { kind: "number", value: numberPlusNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Minus)) {
      return { kind: "number", value: numberMinusNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Star)) {
      return { kind: "number", value: numberMultiplyNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Slash)) {
      return { kind: "number", value: numberDivideNumber(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, SlashSlash)) {
      return { kind: "number", value: numberIntDivideNumber(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, Percent)) {
      return { kind: "number", value: numberModuloNumber(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, Less)) {
      return { kind: "boolean", value: numberLessNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, LessEqual)) {
      return { kind: "boolean", value: numberLessEqualNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Greater)) {
      return { kind: "boolean", value: numberGreaterNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, GreaterEqual)) {
      return { kind: "boolean", value: numberGreaterEqualNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Equal)) {
      return { kind: "boolean", value: numberEqualNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, NotEqual)) {
      return { kind: "boolean", value: numberNotEqualNumber(lhs.value, rhs.value) }
    } else hirErrorToken(`二元运算符${op.image}不适用于数字类型与数字类型`, op)
  }
  if (lhs.kind === "number" && rhs.kind === "boolean") hirErrorToken("无法将布尔类型与数字类型进行二元运算", op)
  if (lhs.kind === "number" && rhs.kind === "list") {
    if (tokenMatcher(op, Plus)) {
      return { kind: "list", value: numberPlusList(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Minus)) {
      return { kind: "list", value: numberMinusList(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Star)) {
      return { kind: "list", value: numberMultiplyList(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Slash)) {
      return { kind: "list", value: numberDivideList(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, SlashSlash)) {
      return { kind: "list", value: numberIntDivideList(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, Percent)) {
      return { kind: "list", value: numberModuloList(lhs.value, rhs.value, op) }
    } else hirErrorToken(`二元运算符${op.image}不适用于数字类型与列表类型`, op)
  }
  if (lhs.kind === "boolean" && rhs.kind === "number") hirErrorToken("无法将布尔类型与数字类型进行二元运算", op)
  if (lhs.kind === "boolean" && rhs.kind === "boolean") {
    if (tokenMatcher(op, LogicalAnd)) {
      return { kind: "boolean", value: booleanAndBoolean(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, LogicalOr)) {
      return { kind: "boolean", value: booleanOrBoolean(lhs.value, rhs.value) }
    } else hirErrorToken(`二元运算符${op.image}不适用于布尔类型与布尔类型`, op)
  }
  if (lhs.kind === "boolean" && rhs.kind === "list") hirErrorToken("无法将布尔类型与列表类型进行二元运算", op)
  if (lhs.kind === "list" && rhs.kind === "number") {
    if (tokenMatcher(op, Plus)) {
      return { kind: "list", value: listPlusNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Minus)) {
      return { kind: "list", value: listMinusNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Star)) {
      return { kind: "list", value: listMultiplyNumber(lhs.value, rhs.value) }
    } else if (tokenMatcher(op, Slash)) {
      return { kind: "list", value: listDivideNumber(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, SlashSlash)) {
      return { kind: "list", value: listIntDivideNumber(lhs.value, rhs.value, op) }
    } else if (tokenMatcher(op, Percent)) {
      return { kind: "list", value: listModuloNumber(lhs.value, rhs.value, op) }
    } else hirErrorToken(`二元运算符${op.image}不适用于列表类型与数字类型`, op)
  }
  if (lhs.kind === "list" && rhs.kind === "boolean") hirErrorToken("无法将布尔类型与列表类型进行二元运算", op)
  /* v8 ignore else -- @preserve */
  if (lhs.kind === "list" && rhs.kind === "list") {
    if (tokenMatcher(op, Hash)) {
      return { kind: "list", value: listConcatList(lhs.value, rhs.value) }
    } else hirErrorToken(`二元运算符${op.image}不适用于列表类型与列表类型`, op)
  }
  /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
}

export function buildBinaryExpressionHir(node: BinaryExpressionCstNode, env: HirEnv): HIRNode {
  const first = buildUnaryExpressionHir(node.children.lhs[0], env)
  const operators = node.children.operator ?? []
  const rhsNodes = node.children.rhs ?? []

  /* v8 ignore next -- @preserve */
  if (operators.length !== rhsNodes.length) throw new Error("Unreachable: operators and rhsNodes length mismatch")

  // If there are no operators, just return the first operand's HIR
  if (operators.length === 0) return first

  const values: HIRNode[] = [first]
  const opStack: IToken[] = []

  for (let i = 0; i < operators.length; i++) {
    const currentOp = operators[i]

    while (opStack.length > 0) {
      const topOp = opStack[opStack.length - 1]
      if (binaryPrecedence(topOp) < binaryPrecedence(currentOp)) break
      reduceBinary(values, opStack)
    }

    const rhs = buildUnaryExpressionHir(rhsNodes[i], env)

    opStack.push(currentOp)
    values.push(rhs)
  }

  while (opStack.length > 0) reduceBinary(values, opStack)

  /* v8 ignore next -- @preserve */
  if (values.length !== 1) throw new Error("Unreachable: invalid binary expression reduction")
  return values[0]
}
