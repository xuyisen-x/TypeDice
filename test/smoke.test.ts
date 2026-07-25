import { describe, expect, it } from "vitest"
import { canonicalize, buildHirOrThrow, ParserError, LexerError, HIRBuilderError } from "./helper.js"

describe("Smoke tests", () => {
  it("does math", () => {
    const folded = canonicalize("1 + 2 * 3", () => undefined)
    expect(folded).toBe("7")
  })

  it("merges dice and handles named expression", () => {
    const x = buildHirOrThrow("3d8 + 2d6", () => undefined)
    const folded = canonicalize("1d6 + 1 * ${x}", (name) => {
      if (name === "x") return x
      return undefined
    })
    expect(folded).toBe("3d6 + 3d8")
  })

  it("handles modifiers", () => {
    const folded = canonicalize("2d6r[<=3]+1", () => undefined)
    expect(folded).toBe("2d6r[<=3] + 1")
  })

  it("handles criticals", () => {
    const folded = canonicalize("@crit(2d6 + (1d6)d8)", () => undefined)
    expect(folded).toBe("4d6 + (2 * 2d6)d8")
  })

  it("catches bad syntax", () => {
    expect(() => canonicalize("2d6r[<=3]+1+", () => undefined)).toThrow(ParserError)
  })

  it("catches bad characters", () => {
    expect(() => canonicalize("true | false", () => undefined)).toThrow(LexerError)
  })

  it("catches bad types", () => {
    expect(() => canonicalize("1 + true", () => undefined)).toThrow(HIRBuilderError)
  })
})
