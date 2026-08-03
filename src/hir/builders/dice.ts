import type { DiceExpressionCstNode, DiceTailCstNode, DiceWithModifiersCstNode } from "../../syntax/generated/cst.js"
import { hirError } from "../errors.js"
import { processModifier } from "./modifiers.js"
import { buildAtomHir } from "./core.js"
import type { HirEnv, HIRNode, NumberType } from "../types.js"
import { numberNormalize } from "../utils.js"

export function buildDiceWithModifierHir(node: DiceWithModifiersCstNode, env: HirEnv): HIRNode {
  const baseHir = buildDiceExpressionHir(node.children.base[0], env)
  const modifiers = node.children.modifier ?? []
  return modifiers.reduce((acc, modifierNode) => {
    return processModifier(modifierNode, env)(acc)
  }, baseHir)
}

export function buildDiceExpressionHir(node: DiceExpressionCstNode, env: HirEnv): HIRNode {
  if (node.children.pureTail) {
    const builder = processDiceTail(node.children.pureTail[0], env)
    return builder({ kind: "constant", value: 1 })
  } else if (node.children.count && !node.children.tail) {
    const countNode = buildAtomHir(node.children.count[0], env)
    return countNode
  } else if (node.children.count && node.children.tail) {
    const countNode = buildAtomHir(node.children.count[0], env)
    if (countNode.kind !== "number") hirError("骰子数量必须是数字类型", node.children.count[0])
    const builder = processDiceTail(node.children.tail[0], env)
    return builder(countNode.value)
  } else throw new Error("Unreachable")
}

export function processDiceTail(node: DiceTailCstNode, env: HirEnv): (n: NumberType) => HIRNode {
  if (node.children.Df) {
    return (base: NumberType) => {
      const normalizedBase = numberNormalize(base)
      return { kind: "number", value: { kind: "dicePool", value: { kind: "fudge", count: normalizedBase } } }
    }
  } else if (node.children.Dc) {
    return (base: NumberType) => {
      const normalizedBase = numberNormalize(base)
      return { kind: "number", value: { kind: "dicePool", value: { kind: "coin", count: normalizedBase } } }
    }
  } else if (node.children.D && node.children.sides) {
    const sidesNode = buildAtomHir(node.children.sides[0], env)
    if (sidesNode.kind !== "number") hirError("骰子面数必须是数字类型", node.children.sides[0])
    return (base: NumberType) => {
      const normalizedBase = numberNormalize(base)
      const normalizedSides = numberNormalize(sidesNode.value)
      return {
        kind: "number",
        value: { kind: "dicePool", value: { kind: "standard", count: normalizedBase, sides: normalizedSides } },
      }
    }
  } else throw new Error("Unreachable")
}
