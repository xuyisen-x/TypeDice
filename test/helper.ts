import type { HIRNode, StandardErrorLocation } from "../src/index.js"
import { buildHirFromString, hirToString } from "../src/index.js"

export const emptyEnv = (_name: string): HIRNode | undefined => undefined

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
