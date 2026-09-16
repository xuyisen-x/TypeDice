import type {
  EvaluationOptions,
  EvaluationResult,
  HIRNode,
  resolveNamedExpressionResult,
  StandardErrorLocation,
} from "../src/index.js"
import { buildHirFromString, evaluateHir, hirToString } from "../src/index.js"

/* v8 ignore next -- @preserve */
export const emptyEnv = (_name: string): resolveNamedExpressionResult => {
  return { kind: "error", message: `未定义的命名表达式: ${_name}` }
}

export class ParserError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class LexerError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class HIRBuilderError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export function buildHirOrThrow(input: string, env = emptyEnv): HIRNode {
  const result = buildHirFromString(input, env)
  if (!result.ok) {
    switch (result.error.kind) {
      case "lexer":
        throw new LexerError(result.error.message, result.error.location)
      case "parser":
        throw new ParserError(result.error.message, result.error.location)
      case "hir":
        throw new HIRBuilderError(result.error.message, result.error.location)
    }
  }
  return result.value
}

export function canonicalize(input: string, env = emptyEnv): string {
  return hirToString(buildHirOrThrow(input, env))
}

export function evaluateHirOrThrow(value: HIRNode, options?: EvaluationOptions): EvaluationResult {
  const result = evaluateHir(value, options)
  if (!result.ok) {
    throw new EvaluationError(result.error)
  }
  return result.value
}
