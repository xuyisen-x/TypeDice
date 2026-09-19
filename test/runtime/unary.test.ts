import { describe, expect, it } from "vitest"
import { evaluate } from "../helper"

describe("Runtime unary operators", () => {
  describe("negation", () => {
    it.each([
      ["-1d6", [4], -4],
      ["-(-(1d6 + 1))", [4], 5],
      ["-(-(-1d6))", [4], -4],
      ["-(1d6 + 2)", [4], -6],
      ["---1d6", [4], -4],
      ["-(1d6 - 2)", [4], -2],
      ["-fmax([1d7, 2])", [5], -5],
      ["--fmax([1d7, 2])", [5], 5],
      ["-(2 * 3 * 1d6)", [4], -24],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("positive", () => {
    it.each([
      ["+(1d6 + 2)", [4], 6],
      ["+(-1d6)", [4], -4],
      ["+(1d6 * 2)", [4], 8],
      ["+(1d6 + 1d8)", [3, 7], 10],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("not", () => {
    it.each([
      ["!(1d8 > 7)", [8], false],
      ["!(1d8 > 7)", [7], true],
      ["!!(1d8 > 7)", [8], true],
      ["!!(1d8 > 7)", [7], false],
      ["!(!(1d8 > 7))", [8], true],
      ["!(!(1d8 > 7))", [7], false],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })
})
