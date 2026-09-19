import { describe, expect, it } from "vitest"
import { evaluate } from "../helper.js"

describe("Runtime binary operators", () => {
  describe("number addition and subtraction", () => {
    it.each([
      ["1d6 + 2", [4], 6],
      ["10 - 1d6", [4], 6],
      ["1d6 + 2 - 3", [4], 3],
      ["10 - 1d6 + 3", [4], 9],
      ["1d6 - 1d8", [4, 6], -2],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("special number atoms", () => {
    it.each([
      ["NaN", Number.NaN],
      ["Inf", Number.POSITIVE_INFINITY],
      ["-Inf", Number.NEGATIVE_INFINITY],
    ])("evaluates %s", (input, expected) => {
      expect(evaluate(input, [])).toEqual({ kind: "number", value: expected })
    })
  })

  describe("number multiplication, division, and modulo", () => {
    it.each([
      ["1d6 * 3", [4], 12],
      ["1d6 * 1d8", [2, 3], 6],
      ["12 / 1d6", [3], 4],
      ["2 * 1d6 / 4", [3], 1.5],
      ["12 / 1d6 * 2", [3], 8],
      ["1d6 % 3", [5], 2],
      ["1d10 // 2", [7], 3],
      ["7 // 1d6", [2], 3],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("number division by a dynamically computed zero", () => {
    it.each([
      ["1 / (1d2 - 1)", Number.POSITIVE_INFINITY],
      ["-1 / (1d2 - 1)", Number.NEGATIVE_INFINITY],
      ["0 / (1d2 - 1)", Number.NaN],
      ["1 % (1d2 - 1)", Number.NaN],
      ["1 // (1d2 - 1)", Number.POSITIVE_INFINITY],
    ])("evaluates %s", (input, expected) => {
      expect(evaluate(input, [1])).toEqual({ kind: "number", value: expected })
    })
  })

  describe("number operator precedence", () => {
    it.each([
      ["1 + 2 * 1d6", [3], 7],
      ["(1 + 1d6) * 3", [2], 9],
      ["1 + 2 * 1d6 - 4 / 5", [3], 6.2],
      ["1 + (2 * (1d6 - 4)) / 5", [3], 0.6],
      ["1 + (2 * (1d6 - 4)) // 5", [3], 0],
      ["1 + (2 * (1d6 - 4)) % 5", [3], -1],
      ["-1 + -(2 * 1d6)", [3], -7],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("boolean and/or", () => {
    it.each([
      ["1d2 = 1 && 1d6 = 6", [1, 6], true],
      ["1d2 = 1 && 1d6 = 5", [1, 6], false],
      ["1d2 = 2 || 1d6 = 6", [1, 6], true],
      ["1d2 = 2 || 1d6 = 5", [1, 6], false],
      ["1d2 = 1 && 1d4 = 4 || 1d6 = 1", [1, 4], true],
      ["1d2 = 2 || 1d4 = 4 && 1d6 = 6", [1, 4, 6], true],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("number comparison", () => {
    it.each([
      ["1d6 < 4", [3], true],
      ["1d6 <= 3", [3], true],
      ["1d6 > 3", [4], true],
      ["1d6 >= 4", [4], true],
      ["1d6 = 4", [4], true],
      ["1d6 != 4", [3], true],
      ["1d6 < 4 && 1d8 > 4", [3, 5], true],
      ["1d6 < 3 || 1d8 > 4", [3, 5], true],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("success pool binary operations", () => {
    const successPool = "3d6cs[>=4]cf[=1]"
    const otherSuccessPool = "3d8cs[>=5]"

    it.each([
      [`${successPool} + 2`, [6, 4, 1], { kind: "number", value: 3 }],
      [`10 - ${successPool}`, [6, 4, 1], { kind: "number", value: 9 }],
      [`${successPool} * 3`, [6, 4, 1], { kind: "number", value: 3 }],
      [`${successPool} / 2`, [6, 4, 1], { kind: "number", value: 0.5 }],
      [`${successPool} // 2`, [6, 4, 1], { kind: "number", value: 0 }],
      [`${successPool} % 2`, [6, 4, 1], { kind: "number", value: 1 }],
      [`${successPool} + ${otherSuccessPool}`, [6, 4, 1, 8, 5, 2], { kind: "number", value: 3 }],
      [`${successPool} < ${otherSuccessPool}`, [6, 4, 1, 8, 5, 2], { kind: "boolean", value: true }],
      [`${successPool} + [1, 2]`, [6, 4, 1], { kind: "list", value: [2, 3] }],
      [`[1, 2] - ${successPool}`, [6, 4, 1], { kind: "list", value: [0, 1] }],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual(expected)
    })
  })

  describe("list concatenation", () => {
    it.each([
      ["tolist(1d6) # [2, 3]", [4], [4, 2, 3]],
      ["[1] # tolist(1d6) # [3]", [2], [1, 2, 3]],
      ["tolist(1d6) # []", [5], [5]],
      ["tolist(1d6) # tolist(1d8)", [4, 7], [4, 7]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("string set operations", () => {
    it.each([
      ['{1d2 = 1 ? "a" : "x", "b", "c"} - {"b", "d"}', [1], new Set(["a", "c"])],
      ['{1d2 = 1 ? "a" : "x", "b", "c"} & {"b", "c", "d"}', [1], new Set(["b", "c"])],
      ['{1d2 = 1 ? "a" : "x", "b", "c"} ^ {"b", "c", "d"}', [1], new Set(["a", "d"])],
      ['{1d2 = 1 ? "a" : "x", "b", "c"} | {"b", "c", "d"}', [1], new Set(["a", "b", "c", "d"])],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "stringSet", value: expected })
    })
  })

  describe("string set membership", () => {
    it.each([
      ['"a" in {1d2 = 1 ? "a" : "x", "b"}', [1], true],
      ['"a" in {1d2 = 1 ? "a" : "x", "b"}', [2], false],
      ['(1d2 = 1 ? "a" : "b") in {"a"}', [1], true],
      ['(1d2 = 1 ? "a" : "b") in {"a"}', [2], false],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("broadcast number to list", () => {
    it.each([
      ["1d6 + [2, 3]", [4], [6, 7]],
      ["[2, 3] + 1d6", [4], [6, 7]],
      ["1d10 - [1, 2]", [8], [7, 6]],
      ["[1, 2] - 1d10", [8], [-7, -6]],
      ["1d6 * [3, 4]", [2], [6, 8]],
      ["[3, 4] * 1d6", [2], [6, 8]],
      ["1d10 / [2, 5]", [10], [5, 2]],
      ["[2, 5] / 1d10", [10], [0.2, 0.5]],
      ["[10, 20] // 1d6", [3], [3, 6]],
      ["1d6 // [10, 20]", [3], [0, 0]],
      ["[10, 20] % 1d6", [3], [1, 2]],
      ["1d10 % [3, 4]", [10], [1, 2]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })
})
