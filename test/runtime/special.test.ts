import { describe, expect, it } from "vitest"
import { evaluate, numericResult } from "../helper"

describe("Runtime special expressions", () => {
  describe("critical strike numeric expressions", () => {
    it.each([
      ["@crit(1d6)", [2, 5], 7],
      ["@crit(2df)", [1, 0, -1, 1], 1],
      ["@crit(3dc)", [1, 0, 1, 1, 0, 1], 4],
      ["@crit(-3dc)", [1, 0, 1, 1, 0, 1], -4],
      ["@crit(1d6 + 1)", [2, 5], 8],
      ["@crit(1d6 * 2)", [2, 5], 14],
      ["@crit(1d6 - 1)", [2, 5], 6],
      ["@crit(1d6 / 2)", [2, 5], 3.5],
      ["@crit(1d6 // 2)", [2, 5], 3],
      ["@crit(1d6 % 2)", [2, 5], 1],
      ["@crit(@crit(1d6))", [1, 2, 3, 4], 10],
      ["@crit(1d6 + @crit(1d4))", [2, 3, 1, 2, 3, 4], 15],
      ["@crit(abs(-1d6))", [2, 5], 7],
      ["@crit(fmax(1, 2d6))", [1, 2, 3, 4], 10],
      ["@crit(sum(1d6, 1d8))", [2, 3, 4, 5], 14],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })

  describe("critical strike boolean expressions", () => {
    it.each([
      ["@crit(1d6 > 8)", [4, 5], true],
      ["@crit(1d6 >= 8)", [4, 4], true],
      ["@crit(1d6 < 8)", [3, 4], true],
      ["@crit(1d6 <= 8)", [4, 4], true],
      ["@crit(1d6 = 8)", [4, 4], true],
      ["@crit(1d6 != 8)", [4, 5], true],
      ["@crit(!(1d6 > 8))", [4, 4], true],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("critical strike collection expressions", () => {
    it("evaluates a list", () => {
      expect(evaluate("@crit([1d6, 2d6])", [1, 2, 3, 4, 5, 6])).toEqual({ kind: "list", value: [3, 18] })
    })

    it("evaluates a dice modifier", () => {
      expect(numericResult(evaluate("@crit(2d6kh1)", [1, 6, 3, 4]))).toBe(6)
    })

    it("evaluates a list function", () => {
      expect(evaluate("@crit(sortd([1d6, 1d4]))", [1, 5, 2, 4])).toEqual({
        kind: "list",
        value: [6, 6],
      })
    })
  })

  describe("critical strike conditional strings", () => {
    it.each([
      ['@crit(1d2 = 2 ? "hit" : "miss")', [1, 1], { kind: "string", value: "hit" }],
      ['@crit(1d2 = 2 ? {"hit"} : {"miss"})', [1, 1], { kind: "stringSet", value: new Set(["hit"]) }],
      ['@crit((1d2 = 2 ? "hit" : "miss") in {"hit"})', [1, 1], { kind: "boolean", value: true }],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual(expected)
    })
  })

  describe("repeat list", () => {
    it.each([
      ["@repeat([1d6, 1d8], 3)", [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]],
      ["@repeat([1d6, 1d8], 0)", [], []],
      ["@repeat([1d6, 1d8], 1)", [4, 7], [4, 7]],
      ["@repeat([1d6, 1d8], -1)", [], []],
      ["@repeat([1d6 + 1, 1d8 * 2], 9 % 6)", [1, 2, 3, 4, 5, 6], [2, 4, 4, 8, 6, 12]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })
})
