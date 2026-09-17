import { describe, expect, it } from "vitest"
import { buildHirOrThrow, canonicalize, HIRBuilderError } from "../helper.js"

describe("HIR arithmetic", () => {
  describe("number addition and subtraction", () => {
    it.each([
      ["1 + 2", "3"],
      ["1 - 2", "-1"],
      ["1 + 2 - 3", "0"],
      ["1 - 2 + 3", "2"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number multiplication and division", () => {
    it.each([
      ["2 * 3", "6"],
      ["6 / 3", "2"],
      ["2 * 3 / 4", "1.5"],
      ["2 / 3 * 4", "2.67"],
      ["2 % 3", "2"],
      ["1.5 % 0.4", "0.3"],
      ["7 // 2", "3"],
      ["7 // 2.5", "2"],
      ["1d6 // 2d6", "1d6 // 2d6"],
      ["1d6 / (1 + 1)d6", "1d6 / 2d6"],
      ["6 / 3 % 1d6", "2 % 1d6"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number addition optimization", () => {
    it.each([
      ["1 + 2 + 3", "6"],
      ["1 + 2d6 - (2d6 - 3d6)", "5d6 - 2d6 + 1"],
      ["1 - 2d6 - (3d8 + 2d6 - 1d10) + 11", "1d10 - 4d6 - 3d8 + 12"],
      ["- 2d6 - (-3d8 + 2d6 - 1d10) + 1 - 1", "3d8 + 1d10 - 4d6"],
      ["1 + 3d6 - 1", "3d6"],
      ["1 - 4d10 - 1", "-4d10"],
      ["1dF + 2dF - 1dF", "3dF - 1dF"],
      ["2dFkh + 3dC - 1dC + 1dC", "2dFkh + 4dC - 1dC"],
      ["1d6 + 2d6 - fmax(1d6, 2d6)", "3d6 - fmax([1d6, 2d6])"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number multiplication optimization", () => {
    it.each([
      ["2 * 3 * 4", "24"],
      ["3 * 3d6 * 4", "12 * 3d6"],
      ["2 * 3d6 * 0", "0"],
      ["3 * (-3d6) * (-4)", "12 * 3d6"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number division optimization", () => {
    it.each([
      ["6 / 3 / 2", "1"],
      ["3d6 / 1", "3d6"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number divided by zero", () => {
    it.each([
      ["1 / 0", "Inf"],
      ["-1 / 0", "-Inf"],
      ["0 / 0", "NaN"],
      ["1.6 % 0", "NaN"],
      ["1 // 0", "Inf"],
      ["-1 // 0", "-Inf"],
      ["1 + 2 / (1 - 1)", "Inf"],
      ["1d7 // 0", "1d7 // 0"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number operator precedence", () => {
    it.each([
      ["1 + 2 * 3", "7"],
      ["(1 + 2) * 3", "9"],
      ["1 + 2 * 3 - 4 / 5", "6.2"],
      ["1 + (2 * (3 - 4)) / 5", "0.6"],
      ["1 + (2 * (3 - 4)) // 5", "0"],
      ["1 + (2 * (3 - 4)) % 5", "-1"],
      ["-1 + -(2 * 3)", "-7"],
      ["(1d6 + 2d8) * (3d10 - 4d6)", "(1d6 + 2d8) * (3d10 - 4d6)"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number invalid arithmetic expressions", () => {
    it.each(["1 + true", "false - 2", "2 # 2", "2 && 2", "2 || 1d8"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })

  describe("boolean and/or", () => {
    it.each([
      ["true && false", "false"],
      ["true || false", "true"],
      ["true && true", "true"],
      ["false || false", "false"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("boolean operator precedence", () => {
    it.each([
      ["true && false || true", "true"],
      ["true || false && false", "true"],
      ["(true || false) && false", "false"],
      ["(true || false) && false", "false"],
      ["(true || false) && !true", "false"],
      ["(true || !true) && false", "false"],
      ["!(true || !true) && !false", "false"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("number comparison", () => {
    it.each([
      ["1 < 2", "true"],
      ["1d10 < 2d6", "1d10 < 2d6"],
      ["1 <= 2", "true"],
      ["1d10 <= 2d6", "1d10 <= 2d6"],
      ["1 > 2", "false"],
      ["1d10 > 2d6", "1d10 > 2d6"],
      ["1 >= 2", "false"],
      ["1d10 >= 2d6", "1d10 >= 2d6"],
      ["1 = 2", "false"],
      ["1d10 = 2d6", "1d10 = 2d6"],
      ["1 != 2", "true"],
      ["1d10 != 2d6", "1d10 != 2d6"],
      ["1 < 2 && 3 > 4", "false"],
      ["1 < 2 || 3 > 4", "true"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("boolean short-circuiting", () => {
    it.each([
      ["false && (1d6 > 3)", "false"],
      ["(1d6 > 3) && false", "false"],
      ["true && (1d6 > 3)", "1d6 > 3"],
      ["(1d6 > 3) && true", "1d6 > 3"],
      ["true || (1d6 > 3)", "true"],
      ["(1d6 > 3) || true", "true"],
      ["false || (1d6 > 3)", "1d6 > 3"],
      ["(1d6 > 3) || false", "1d6 > 3"],
    ])("short-circuits %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("boolean folding with division by zero", () => {
    it.each([
      ["false && (1 / 0 > 0)", "false"],
      ["true || (1 / 0 > 0)", "true"],
      ["(1 / 0 > 0) && false", "false"],
      ["(1 / 0 > 0) || true", "true"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("boolean invalid comparison expressions", () => {
    it.each(["true < false", "false > true", "true + true", "true # true"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })

  describe("list concatenation", () => {
    it.each([
      ["[1, 2] # [3, 4]", "[1, 2, 3, 4]"],
      ["[1] # [2] # [3]", "[1, 2, 3]"],
      ["[1, 2] # []", "[1, 2]"],
      ["tolist(1d6) # tolist(2d6)", "tolist(1d6) # tolist(2d6)"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("list invalid binary operations", () => {
    it.each([
      "[1, 2] + [3, 4]",
      "[1, 2] - [3, 4]",
      "[1, 2] * [3, 4]",
      "[1, 2] / [3, 4]",
      "[1, 2] % [3, 4]",
      "[1, 2] && true",
      "true && [1, 2]",
      "[1, 2] # 3",
      "3 # [1, 2]",
      "[1, 2] || false",
      "false || [1, 2]",
    ])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })

  describe("string set operations", () => {
    it.each([
      ['{"a", "b", "c"} - {"b", "d"}', '{"a", "c"}'],
      ['{"a", "b", "c"} & {"b", "c", "d"}', '{"b", "c"}'],
      ['{"a", "b", "c"} ^ {"b", "c", "d"}', '{"a", "d"}'],
      ['{"a", "b", "c"} | {"b", "c", "d"}', '{"a", "b", "c", "d"}'],
      ['{} - {"a"}', "{}"],
      ['{} & {"a"}', "{}"],
      ['{} ^ {"a"}', '{"a"}'],
      ['{} | {"a"}', '{"a"}'],
      ['{"a", "b"} - {"b"} - {"a"}', "{}"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    it.each([
      ['{"x"} | {} - {"x"}', '{"x"}'],
      ['{"x"} | {} ^ {"x"}', '{"x"}'],
      ['{"x"} ^ {"x"} & {}', '{"x"}'],
      ['{"x"} ^ {"x"} - {"x"}', '{"x"}'],
    ])("respects string set precedence in %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    const a = '{1d2 = 1 ? "a" : "A"}'
    const b = '{1d2 = 1 ? "b" : "B"}'
    const c = '{1d2 = 1 ? "c" : "C"}'

    it.each([
      [`(${a} | ${b}) ^ ${c}`, `(${a} | ${b}) ^ ${c}`],
      [`${a} & (${b} ^ ${c})`, `${a} & (${b} ^ ${c})`],
      [`(${a} & ${b}) - ${c}`, `(${a} & ${b}) - ${c}`],
      [`${a} - (${b} - ${c})`, `${a} - (${b} - ${c})`],
      [`${a} | ${b} ^ ${c} & ${a} - ${b}`, `${a} | ${b} ^ ${c} & ${a} - ${b}`],
    ])("preserves required parentheses in %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    it.each(['{"a"} - 1', '1 & {"a"}', '{"a"} ^ [1]', 'true | {"a"}'])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })

  describe("string set membership", () => {
    it.each([
      ['"a" in {"a", "b", "c"}', "true"],
      ['"d" in {"a", "b", "c"}', "false"],
      ['"a" in {}', "false"],
      ['"a"in{"a"}', "true"],
      ['"a" IN {"a"}', "true"],
      ['"a" in {"A"}', "false"],
      ['"\\u0061" in {"a"}', "true"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    it.each([
      ['"a" in {} | {"a"}', "true"],
      ['"a" in {"a"} ^ {"a"}', "false"],
      ['"a" in {"a"} & {}', "false"],
      ['"a" in {"a"} - {"a"}', "false"],
      ['"a" in {"a"} && true', "true"],
    ])("respects membership precedence in %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    it.each([
      ['"a" in ({1d2 = 1 ? "a" : "b"} | {"c"})', '"a" in {1d2 = 1 ? "a" : "b"} | {"c"}'],
      ['(1d2 = 1 ? "a" : "b") in {"a"}', '(1d2 = 1 ? "a" : "b") in {"a"}'],
      ['"a" in (1d2 = 1 ? {"a"} : {"b"})', '"a" in (1d2 = 1 ? {"a"} : {"b"})'],
      ['!("a" in {1d2 = 1 ? "a" : "b"})', '!("a" in {1d2 = 1 ? "a" : "b"})'],
    ])("canonicalizes dynamic membership %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })

    it.each(['1 in {"1"}', '"a" in [1]', '{"a"} in {"a"}', '"a" in "a"'])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })

  describe("broadcast number to list", () => {
    it.each([
      ["1 + [2, 3]", "[3, 4]"],
      ["[2, 3] + 1", "[3, 4]"],
      ["10 - [1, 2]", "[9, 8]"],
      ["[1, 2] - 10", "[-9, -8]"],
      ["2 * [3, 4]", "[6, 8]"],
      ["[3, 4] * 2", "[6, 8]"],
      ["10 / [2, 5]", "[5, 2]"],
      ["[2, 5] / 10", "[0.2, 0.5]"],
      ["[10, 20] // 3", "[3, 6]"],
      ["3 // [10, 20]", "[0, 0]"],
      ["[10, 20] % 3", "[1, 2]"],
      ["10 % [3, 4]", "[1, 2]"],
      ["[3, 4] % 10", "[3, 4]"],
      ["1 + [2d6, 3d6]", "1 + [2d6, 3d6]"],
      ["[2, 3] + 1d6", "[2, 3] + 1d6"],
      ["10d8 - [1, 2]", "10d8 - [1, 2]"],
      ["[1d3, 2] - 10", "[1d3, 2] - 10"],
      ["2 * [3d8, 4d8]", "2 * [3d8, 4d8]"],
      ["[3, 4] * 2dF", "[3, 4] * 2dF"],
      ["10dC / [2, 5]", "10dC / [2, 5]"],
      ["[2, 5] / 10d9", "[2, 5] / 10d9"],
      ["[10, 20] // 3d8", "[10, 20] // 3d8"],
      ["3dC // [10, 20]", "3dC // [10, 20]"],
      ["[10, 20d8] % 3", "[10, 20d8] % 3"],
      ["10 % [3, 4dC]", "10 % [3, 4dC]"],
      ["[3, dF] % 10", "[3, 1dF] % 10"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("broadcast number to list divided by zero", () => {
    it.each([
      ["1 / [0, 1]", "[Inf, 1]"],
      ["1 % [0, 1]", "[NaN, 0]"],
      ["1 // [0, 1]", "[Inf, 1]"],
      ["[1, 2] / 0", "[Inf, Inf]"],
      ["[1, 2] % 0", "[NaN, NaN]"],
      ["[1, 2] // 0", "[Inf, Inf]"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })
})
