export * from "./hir/types.js"
export type { StandardError, StandardErrorKind, StandardErrorLocation } from "./errors.js"
export { hirToString } from "./hir/stringify.js"

import type { StandardError } from "./errors.js"
import type { HIRNode } from "./hir/types.js"
import { lexDice } from "./syntax/lexer.js"
import type { Result } from "./utils.js"
import {
  recognitionExceptionToStandardError,
  lexingErrorToStandardError,
  hirBuildErrorToStandardError,
} from "./errors.js"
import { parseDiceTokens } from "./syntax/parser.js"
import { buildHir } from "./hir/builder.js"

export function buildHirFromString(
  input: string,
  env: (name: string) => HIRNode | undefined
): Result<HIRNode, StandardError> {
  const tokens = lexDice(input)
  if (!tokens.ok) return { ok: false, error: lexingErrorToStandardError(tokens.error[0]) }
  const cst = parseDiceTokens(tokens.value)
  if (!cst.ok) return { ok: false, error: recognitionExceptionToStandardError(cst.error[0]) }
  const hir = buildHir(cst.value, env)
  if (!hir.ok) return { ok: false, error: hirBuildErrorToStandardError(hir.error) }
  return { ok: true, value: hir.value }
}
