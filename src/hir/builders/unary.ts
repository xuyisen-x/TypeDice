import { tokenMatcher, type IToken } from "chevrotain"
import type { UnaryExpressionCstNode } from "../../syntax/generated/cst.js"
import type { HirEnv, HIRNode } from "../types.js"
import { hirErrorToken } from "../errors.js"
import { LogicalNot, Minus, Plus } from "../../syntax/lexer.js"
import { buildDiceWithModifierHir } from "./dice.js"

function applyUnaryOperator(op: IToken, operand: HIRNode): HIRNode {
  if (tokenMatcher(op, Minus)) {
    if (operand.kind !== "number") hirErrorToken("一元负号只能用于数字类型", op)
    const value = operand.value
    if (value.kind === "constant") {
      return { kind: "number", value: { kind: "constant", value: -value.value } }
    } else if (value.kind === "negative") {
      return { kind: "number", value: value.value }
    } else if (value.kind === "binary" && value.value.kind === "add") {
      return {
        kind: "number",
        value: {
          kind: "binary",
          value: {
            kind: "add",
            constant: -value.value.constant,
            positive: value.value.negative,
            negative: value.value.positive,
          },
        },
      }
    } else if (value.kind === "binary" && value.value.kind === "multiply") {
      return {
        kind: "number",
        value: {
          kind: "binary",
          value: {
            kind: "multiply",
            constant: -value.value.constant,
            factors: value.value.factors,
          },
        },
      }
    } else {
      return { kind: "number", value: { kind: "negative", value } }
    }
  } else if (tokenMatcher(op, LogicalNot)) {
    if (operand.kind !== "boolean") hirErrorToken("逻辑非只能用于布尔类型", op)
    if (operand.value.kind === "constant") {
      return { kind: "boolean", value: { kind: "constant", value: !operand.value.value } }
    } else if (operand.value.kind === "not") {
      return { kind: "boolean", value: operand.value.value }
    } else {
      return { kind: "boolean", value: { kind: "not", value: operand.value } }
    }
  } else if (tokenMatcher(op, Plus)) {
    if (operand.kind !== "number") hirErrorToken("一元正号只能用于数字类型", op)
    return operand
  } else hirErrorToken(`未知的一元运算符${op.image}`, op)
}

export function buildUnaryExpressionHir(node: UnaryExpressionCstNode, env: HirEnv): HIRNode {
  const operand = buildDiceWithModifierHir(node.children.operand[0], env)
  const operators = node.children.operator ?? []

  return operators.reduceRight((acc, op) => applyUnaryOperator(op, acc), operand)
}
