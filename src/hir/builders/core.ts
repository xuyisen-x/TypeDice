import type {
  AtomCstNode,
  ExpressionCstNode,
  ExpressionEntryCstNode,
  ListExpressionCstNode,
  StringSetExpressionCstNode,
} from "../../syntax/generated/cst.js"
import { hirError, hirErrorToken } from "../errors.js"
import { buildFilterCall, buildRegularFunctionCall } from "./functions.js"
import { buildConditionalExpressionHir } from "./ternary.js"
import type { HirEnv, HIRNode, NumberType, StringType } from "../types.js"
import { buildCritForm, buildRepeatForm } from "./special.js"
import { parseStringLiteral } from "../../utils.js"

export function buildExpressionEntryHir(node: ExpressionEntryCstNode, env: HirEnv): HIRNode {
  return buildExpressionHir(node.children.expression[0], env)
}

export function buildExpressionHir(node: ExpressionCstNode, env: HirEnv): HIRNode {
  return buildConditionalExpressionHir(node.children.conditionalExpression[0], env)
}

export function buildAtomHir(node: AtomCstNode, env: HirEnv): HIRNode {
  if (node.children.NumberLiteral) {
    const token = node.children.NumberLiteral[0]
    const value = token.image.toLowerCase() === "inf" ? Number.POSITIVE_INFINITY : Number(token.image)
    return { kind: "number", value: { kind: "constant", value } }
  }
  if (node.children.StringLiteral) {
    const value = parseStringLiteral(node.children.StringLiteral[0].image)
    return { kind: "string", value: { kind: "constant", value } }
  }
  if (node.children.BooleanLiteral) {
    const token = node.children.BooleanLiteral[0]
    const value = token.image.toLowerCase() === "true"
    return { kind: "boolean", value: { kind: "constant", value } }
  }
  if (node.children.NamedExpression) {
    const token = node.children.NamedExpression[0]
    const name = token.image.slice(2, -1) // Remove ${ and }
    const resolved = env.resolveNamedExpression(name)
    if (resolved.kind === "value") return resolved.value
    hirErrorToken(resolved.message, token)
  }
  if (node.children.wrappedExpression) return buildExpressionHir(node.children.wrappedExpression[0], env)
  if (node.children.listExpression) return buildListExpression(node.children.listExpression[0], env)
  if (node.children.stringSetExpression) return buildStringSetExpression(node.children.stringSetExpression[0], env)
  if (node.children.regularFunctionCall) return buildRegularFunctionCall(node.children.regularFunctionCall[0], env)
  if (node.children.filterCall) return buildFilterCall(node.children.filterCall[0], env)
  if (node.children.repeatForm) return buildRepeatForm(node.children.repeatForm[0], env)
  /* v8 ignore else -- @preserve */
  if (node.children.critForm) return buildCritForm(node.children.critForm[0], env)
  /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
}

export function buildListExpression(node: ListExpressionCstNode, env: HirEnv): HIRNode {
  function getNumberTypeFromNode(node: ExpressionCstNode): NumberType {
    const nodeHir = buildExpressionHir(node, env)
    if (nodeHir.kind !== "number") hirError("列表元素必须是数字类型", node)
    return nodeHir.value
  }
  if (!node.children.element) return { kind: "list", value: { kind: "explicit", value: [] } }
  const first = getNumberTypeFromNode(node.children.element[0])
  const rest = node.children.elements?.map((elementNode) => getNumberTypeFromNode(elementNode)) ?? []
  return { kind: "list", value: { kind: "explicit", value: [first, ...rest] } }
}

export function buildStringSetExpression(node: StringSetExpressionCstNode, env: HirEnv): HIRNode {
  function getStringTypeFromNode(node: ExpressionCstNode): StringType {
    const nodeHir = buildExpressionHir(node, env)
    if (nodeHir.kind !== "string") hirError("字符串集合元素必须是字符串类型", node)
    return nodeHir.value
  }
  if (!node.children.element) return { kind: "stringSet", value: { kind: "explicit", value: [] } }
  const first = getStringTypeFromNode(node.children.element[0])
  const rest = node.children.elements?.map((elementNode) => getStringTypeFromNode(elementNode)) ?? []
  // Remove duplicate string constants from the set, preserving order
  const seenConstants = new Set<string>()
  const values = [first, ...rest].filter((value) => {
    if (value.kind !== "constant") return true
    if (seenConstants.has(value.value)) return false
    seenConstants.add(value.value)
    return true
  })
  return { kind: "stringSet", value: { kind: "explicit", value: values } }
}
