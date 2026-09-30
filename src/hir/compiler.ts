import type { StandardError } from "../errors.js"
import {
  recognitionExceptionToStandardError,
  lexingErrorToStandardError,
  hirBuildErrorToStandardError,
} from "../errors.js"
import { lexDice } from "../syntax/lexer.js"
import { parseDiceTokens } from "../syntax/parser.js"
import type { Result } from "../utils.js"
import { buildHir } from "./builder.js"
import type { HIRNode, resolveNamedExpressionResult } from "./types.js"

export function buildHirFromString(
  input: string,
  env: (name: string) => resolveNamedExpressionResult
): Result<HIRNode, StandardError> {
  const tokens = lexDice(input)
  if (!tokens.ok) return { ok: false, error: lexingErrorToStandardError(tokens.error[0]) }
  const cst = parseDiceTokens(tokens.value)
  if (!cst.ok) return { ok: false, error: recognitionExceptionToStandardError(cst.error[0]) }
  const hir = buildHir(cst.value, env)
  if (!hir.ok) return { ok: false, error: hirBuildErrorToStandardError(hir.error) }
  return { ok: true, value: hir.value }
}
