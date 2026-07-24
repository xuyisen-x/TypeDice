import type { HIRNode } from "./types.js"
import type { Result } from "../utils.js"
import type { ExpressionEntryCstNode } from "../syntax/generated/cst.js"
import { type HirBuildError, HirBuildException } from "./errors.js"
import { buildExpressionEntryHir } from "./builders/core.js"

// 有些优化会非常激进，比如 x || true -> true, x && false -> false, x * 0 -> 0
// 这可能会导致原本可能再运行时抛出错误的表达式在编译时就被优化掉了，导致运行时不会抛出错误。

export function buildHir(
  node: ExpressionEntryCstNode,
  resolveNamedExpression: (name: string) => HIRNode | undefined
): Result<HIRNode, HirBuildError> {
  try {
    const hir = buildExpressionEntryHir(node, { resolveNamedExpression })
    return { ok: true, value: hir }
  } catch (e) {
    if (e instanceof HirBuildException) {
      return {
        ok: false,
        error: { message: e.message, location: e.location },
      }
    }
    throw e
  }
}
