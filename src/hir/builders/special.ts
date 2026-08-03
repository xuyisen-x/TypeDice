import type { CritFormCstNode, RepeatFormCstNode } from "../../syntax/generated/cst.js"
import { hirError } from "../errors.js"
import { rewriteHirForCrit } from "../rewriters/crit.js"
import type { HirEnv, HIRNode, NumberType } from "../types.js"
import { numberNormalize } from "../utils.js"
import { buildExpressionHir } from "./core.js"

export function buildRepeatForm(node: RepeatFormCstNode, env: HirEnv): HIRNode {
  const listHir = buildExpressionHir(node.children.expression[0], env)
  if (listHir.kind !== "list" || listHir.value.kind !== "explicit")
    hirError("重复表单的表达式必须是显式列表", node.children.expression[0])

  const countHir = buildExpressionHir(node.children.count[0], env)
  if (countHir.kind !== "number") hirError("重复表单的计数必须是数字", node.children.count[0])

  const normalizedCount = numberNormalize(countHir.value)
  if (normalizedCount.kind !== "constant") hirError("重复表单的计数必须是编译期常量", node.children.count[0])

  if (normalizedCount.value < 0) hirError("重复表单的计数不能为负数", node.children.count[0])
  const repeatedList: NumberType[] = []
  for (let i = 0; i < normalizedCount.value; i++) {
    repeatedList.push(...listHir.value.value)
  }
  return { kind: "list", value: { kind: "explicit", value: repeatedList } }
}

export function buildCritForm(node: CritFormCstNode, env: HirEnv): HIRNode {
  const baseHir = buildExpressionHir(node.children.expression[0], env)
  return rewriteHirForCrit(baseHir)
}
