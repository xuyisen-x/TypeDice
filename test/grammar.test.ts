import { describe, expect, it } from "vitest"

import type { HIRNode } from "../src/index.js"
import { buildHirFromString, hirToString } from "../src/index.js"

class ParserError extends Error {
  constructor(
    message: string,
    readonly location: {
      startOffset: number
      endOffset?: number
      startLine?: number
      endLine?: number
      startColumn?: number
      endColumn?: number
    } | null
  ) {
    super(message)
  }
}

class LexerError extends Error {
  constructor(
    message: string,
    readonly location: {
      startOffset: number
      endOffset?: number
      startLine?: number
      endLine?: number
      startColumn?: number
      endColumn?: number
    } | null
  ) {
    super(message)
  }
}

class HIRBuilderError extends Error {
  constructor(
    message: string,
    readonly location: {
      startOffset: number
      endOffset?: number
      startLine?: number
      endLine?: number
      startColumn?: number
      endColumn?: number
    } | null
  ) {
    super(message)
  }
}

function testHelper(input: string, env: (name: string) => HIRNode | undefined): string {
  const result = buildHirFromString(input, env)
  if (!result.ok) {
    if (result.error.kind === "lexer") {
      throw new LexerError(result.error.message, result.error.location)
    } else if (result.error.kind === "parser") {
      throw new ParserError(result.error.message, result.error.location)
    } else if (result.error.kind === "hir") {
      throw new HIRBuilderError(result.error.message, result.error.location)
    } else {
      throw new Error("Unknown error kind")
    }
  }
  return hirToString(result.value)
}

describe("HIR Builder", () => {
  it("respects multiplication precedence when folding constants", () => {
    const folded = testHelper("1 + 2 * 3", () => undefined)
    expect(folded).toBe("7")
  })

  it("merges matching constant dice pools in addition", () => {
    const folded = testHelper("1d6 + 3d8 + 2d6", () => undefined)
    expect(folded).toBe("3d6 + 3d8")
  })

  it("should work", () => {
    const folded = testHelper("2d6r[<=3]+1", () => undefined)
    expect(folded).toBe("2d6r[<=3] + 1")
  })

  it("should not work due to ParserError", () => {
    expect(() => testHelper("2d6r[<=3]+1+", () => undefined)).toThrow(ParserError)
  })

  it("should not work due to LexerError", () => {
    expect(() => testHelper("true | false", () => undefined)).toThrow(LexerError)
  })

  it("should not work due to HIRBuilderError", () => {
    expect(() => testHelper("1 + true", () => undefined)).toThrow(HIRBuilderError)
  })
})
