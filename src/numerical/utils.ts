import type { HIRNode } from "../hir/types.js"
import { assertNever } from "../utils.js"

export function isConstant(node: HIRNode): boolean {
  switch (node.kind) {
    case "number":
    case "boolean":
    case "string":
      return node.value.kind === "constant"
    case "list":
    case "stringSet":
      return node.value.kind === "explicit" && node.value.value.every((item) => item.kind === "constant")
    default:
      assertNever(node)
  }
}
