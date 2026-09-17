import type { ConditionalExpressionCstNode } from "../../syntax/generated/cst.js"
import { hirError } from "../errors.js"
import { buildExpressionHir } from "./core.js"
import type { HirEnv, HIRNode } from "../types.js"
import { buildBinaryExpressionHir } from "./binary.js"

export function buildConditionalExpressionHir(node: ConditionalExpressionCstNode, env: HirEnv): HIRNode {
  const conditionNode = node.children.condition[0]
  const conditionHir = buildBinaryExpressionHir(conditionNode, env)

  // If there is no trueBranch or falseBranch, it is a normal binary expression
  // just return the conditionHir
  if (!node.children.trueBranch || !node.children.falseBranch) return conditionHir

  // If there is a trueBranch and falseBranch, it is a ternary expression
  if (conditionHir.kind !== "boolean") hirError("三元表达式的条件必须是布尔类型", conditionNode)

  const trueBranchNode = node.children.trueBranch[0]
  const falseBranchNode = node.children.falseBranch[0]
  const trueBranchHir = buildExpressionHir(trueBranchNode, env)
  const falseBranchHir = buildConditionalExpressionHir(falseBranchNode, env)

  if (trueBranchHir.kind !== falseBranchHir.kind) {
    hirError("三元表达式的假分支和真分支类型不一致", falseBranchNode)
  }

  // Constant folding for ternary expressions
  if (conditionHir.value.kind === "constant") {
    return conditionHir.value.value ? trueBranchHir : falseBranchHir
  }

  if (trueBranchHir.kind === "number" && falseBranchHir.kind === "number") {
    return {
      kind: "number",
      value: {
        kind: "ternary",
        condition: conditionHir.value,
        trueValue: trueBranchHir.value,
        falseValue: falseBranchHir.value,
      },
    }
  }
  if (trueBranchHir.kind === "list" && falseBranchHir.kind === "list")
    return {
      kind: "list",
      value: {
        kind: "ternary",
        condition: conditionHir.value,
        trueValue: trueBranchHir.value,
        falseValue: falseBranchHir.value,
      },
    }
  if (trueBranchHir.kind === "string" && falseBranchHir.kind === "string")
    return {
      kind: "string",
      value: {
        kind: "ternary",
        condition: conditionHir.value,
        trueValue: trueBranchHir.value,
        falseValue: falseBranchHir.value,
      },
    }
  if (trueBranchHir.kind === "stringSet" && falseBranchHir.kind === "stringSet")
    return {
      kind: "stringSet",
      value: {
        kind: "ternary",
        condition: conditionHir.value,
        trueValue: trueBranchHir.value,
        falseValue: falseBranchHir.value,
      },
    }
  /* v8 ignore else -- @preserve */
  if (trueBranchHir.kind === "boolean" && falseBranchHir.kind === "boolean")
    return {
      kind: "boolean",
      value: {
        kind: "ternary",
        condition: conditionHir.value,
        trueValue: trueBranchHir.value,
        falseValue: falseBranchHir.value,
      },
    }

  /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
}
