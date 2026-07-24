import type {
  AtomCstNode,
  ExpressionCstNode,
  ExpressionEntryCstNode,
  ListExpressionCstNode,
} from "../../syntax/generated/cst.js"
import { hirError, hirErrorToken } from "../errors.js"
import { buildFilterCall, buildRegularFunctionCall } from "./functions.js"
import { buildConditionalExpressionHir } from "./ternary.js"
import type { HirEnv, HIRNode, NumberType } from "../types.js"
import { buildCritForm, buildRepeatForm } from "./special.js"

export function buildExpressionEntryHir(node: ExpressionEntryCstNode, env: HirEnv): HIRNode {
  return buildExpressionHir(node.children.expression[0], env)
}

export function buildExpressionHir(node: ExpressionCstNode, env: HirEnv): HIRNode {
  return buildConditionalExpressionHir(node.children.conditionalExpression[0], env)
}

export function buildAtomHir(node: AtomCstNode, env: HirEnv): HIRNode {
  if (node.children.NumberLiteral) {
    const token = node.children.NumberLiteral[0]
    const value = parseFloat(token.image)
    if (isNaN(value)) hirErrorToken("无效的数字字面量", token)
    return { kind: "number", value: { kind: "constant", value } }
  } else if (node.children.BooleanLiteral) {
    const token = node.children.BooleanLiteral[0]
    const value = token.image.toLowerCase() === "true"
    return { kind: "boolean", value: { kind: "constant", value } }
  } else if (node.children.NamedExpression) {
    const token = node.children.NamedExpression[0]
    const name = token.image.slice(2, -1) // Remove ${ and }
    const resolved = env.resolveNamedExpression(name)
    if (!resolved) hirErrorToken(`未定义的命名表达式: ${name}`, token)
    return resolved
  } else if (node.children.wrappedExpression) {
    return buildExpressionHir(node.children.wrappedExpression[0], env)
  } else if (node.children.listExpression) {
    return buildListExpression(node.children.listExpression[0], env)
  } else if (node.children.regularFunctionCall) {
    return buildRegularFunctionCall(node.children.regularFunctionCall[0], env)
  } else if (node.children.filterCall) {
    return buildFilterCall(node.children.filterCall[0], env)
  } else if (node.children.repeatForm) {
    return buildRepeatForm(node.children.repeatForm[0], env)
  } else if (node.children.critForm) {
    return buildCritForm(node.children.critForm[0], env)
  } else throw new Error("Unreachable")
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
