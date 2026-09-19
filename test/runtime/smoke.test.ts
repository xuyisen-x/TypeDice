import { describe, expect, it } from "vitest"
import { evaluate, numericResult } from "../helper.js"

describe("Runtime evaluation", () => {
  describe("string values", () => {
    it("evaluates string and string set literals", () => {
      expect(evaluate('"hello\\nworld"', [])).toEqual({ kind: "string", value: "hello\nworld" })
      expect(evaluate('{"a", "b"}', [])).toEqual({ kind: "stringSet", value: new Set(["a", "b"]) })
    })

    it.each([
      ['1d2 = 2 ? "hit" : "miss"', [2], { kind: "string", value: "hit" }],
      ['{1d2 = 2 ? "hit" : "miss", "fixed"}', [1], { kind: "stringSet", value: new Set(["miss", "fixed"]) }],
    ])("evaluates conditional value %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual(expected)
    })

    it("deduplicates dynamically evaluated string set elements", () => {
      expect(evaluate('{1d2 = 2 ? "same" : "other", "same"}', [2])).toEqual({
        kind: "stringSet",
        value: new Set(["same"]),
      })
    })
  })

  describe("dynamic string set operations", () => {
    it.each([
      ['{1d2 = 1 ? "a" : "x", "b"} - {"b"}', new Set(["a"])],
      ['{"a", 1d2 = 1 ? "b" : "x"} & {"b"}', new Set(["b"])],
      ['{"a", 1d2 = 1 ? "b" : "x"} ^ {"b", "c"}', new Set(["a", "c"])],
      ['{"a", 1d2 = 1 ? "b" : "x"} | {"b", "c"}', new Set(["a", "b", "c"])],
    ])("evaluates %s", (input, expected) => {
      expect(evaluate(input, [1])).toEqual({ kind: "stringSet", value: expected })
    })

    it.each([
      [1, true],
      [2, false],
    ])("evaluates dynamic membership for roll %s", (roll, expected) => {
      expect(evaluate('"a" in {1d2 = 1 ? "a" : "b"}', [roll])).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("dice expressions", () => {
    it("evaluates nested dice", () => {
      expect(numericResult(evaluate("(1d2)d6", [1, 6]))).toBe(6)
    })

    it("evaluates explosions", () => {
      expect(numericResult(evaluate("2d6x[=6]lt2", [6, 2, 6, 1]))).toBe(15)
    })

    it("evaluates special dice faces", () => {
      expect(evaluate("tolist(1df) # tolist(1dc)", [-1, 1])).toEqual({ kind: "list", value: [-1, 1] })
    })

    it("evaluates composed dice modifiers", () => {
      expect(evaluate("tolist(4d6kh2cs[>=5]cf[=6])", [6, 5, 3, 1])).toEqual({
        kind: "list",
        value: [-1, 1],
      })
    })
  })

  describe("dynamic zero divisors", () => {
    it.each([
      ["1 / (1d2 - 1)", Number.POSITIVE_INFINITY],
      ["-1 / (1d2 - 1)", Number.NEGATIVE_INFINITY],
      ["0 / (1d2 - 1)", Number.NaN],
      ["1 % (1d2 - 1)", Number.NaN],
    ])("evaluates %s", (input, expected) => {
      expect(evaluate(input, [1])).toEqual({ kind: "number", value: expected })
    })

    it("evaluates a zero divisor in a list operation", () => {
      expect(evaluate("1 / [1d2 - 1, 1]", [1])).toEqual({
        kind: "list",
        value: [Number.POSITIVE_INFINITY, 1],
      })
    })
  })
})
