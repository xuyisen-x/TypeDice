import { describe, expect, it } from "vitest"
import { buildHirOrThrow, canonicalize, HIRBuilderError } from "../helper.js"

describe("HIR unary operators", () => {
  describe("negation", () => {
    it.each([
      ["-1", "-1"],
      ["-(-1)", "1"],
      ["-(-(-1))", "-1"],
      ["-(1 + 2)", "-3"],
      ["-0", "0"],
      ["-1d6", "-1d6"],
      ["---1d6", "-1d6"],
      ["-(1d6 - 2)", "-1d6 + 2"],
      ["-fmax([1d7, 2])", "-fmax([1d7, 2])"],
      ["--fmax([1d7, 2])", "fmax([1d7, 2])"],
      ["-(2 * 3 * 1d6)", "-6 * 1d6"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("positive", () => {
    it.each([
      ["+1", "1"],
      ["+(1 + 2)", "3"],
      ["+(-1)", "-1"],
      ["+0", "0"],
      ["+1d6", "1d6"],
      ["+(1d6 + 1d8)", "1d6 + 1d8"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("not", () => {
    it.each([
      ["!true", "false"],
      ["!false", "true"],
      ["!!true", "true"],
      ["!!false", "false"],
      ["!!(1d8 > 7)", "1d8 > 7"],
      ["!(!true)", "true"],
      ["!(!false)", "false"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid unary expressions", () => {
    it.each(["-true", "+false", "!2", "![1, 2, 3]", "+[1, 2, 3]", "-[1, 2, 3]"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })
})
