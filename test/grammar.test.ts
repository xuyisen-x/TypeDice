import { describe, expect, it } from "vitest"

import type { ExpressionEntryCstNode } from "../src/syntax/generated/cst.js"
import { buildHir } from "../src/hir/builder.js"
import { lexDice } from "../src/syntax/lexer.js"
import { parseDiceTokens } from "../src/syntax/parser.js"

describe("Parser", () => {
  it("respects multiplication precedence when folding constants", () => {
    const tokens = lexDice("1 + 2 * 3")
    expect(tokens.ok).toBe(true)
    if (!tokens.ok) throw new Error("Lexing failed")

    const cst = parseDiceTokens(tokens.value)
    expect(cst.ok).toBe(true)
    if (!cst.ok) throw new Error("Parsing failed")

    const hir = buildHir(cst.value as ExpressionEntryCstNode, () => undefined)
    expect(hir).toEqual({
      ok: true,
      value: {
        kind: "number",
        value: { kind: "constant", value: 7 },
      },
    })
  })

  it("merges matching constant dice pools in addition", () => {
    const tokens = lexDice("2d6 + 2d6")
    expect(tokens.ok).toBe(true)
    if (!tokens.ok) throw new Error("Lexing failed")

    const cst = parseDiceTokens(tokens.value)
    expect(cst.ok).toBe(true)
    if (!cst.ok) throw new Error("Parsing failed")

    const hir = buildHir(cst.value as ExpressionEntryCstNode, () => undefined)
    expect(hir).toEqual({
      ok: true,
      value: {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "standard",
            count: { kind: "constant", value: 4 },
            sides: { kind: "constant", value: 6 },
          },
        },
      },
    })
  })

  it("should work", () => {
    const input = "2d6r[<=3] + 1"
    const tokens = lexDice(input)
    expect(tokens.ok).toBe(true)
    if (!tokens.ok) throw new Error("Lexing failed")
    const cst = parseDiceTokens(tokens.value)
    if (!cst.ok) console.log(cst.error)
    expect(cst.ok).toBe(true)
    if (!cst.ok) throw new Error("Parsing failed")
    console.log(cst.value)
  })
})
