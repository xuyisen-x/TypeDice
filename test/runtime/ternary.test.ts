import { describe, expect, it } from "vitest"
import { evaluate } from "../helper"

describe("Runtime ternary operator", () => {
  describe("number branches", () => {
    it.each([
      ["1d2 = 1 ? 1 : 2", [1], 1],
      ["1d2 = 1 ? 1 : 2", [2], 2],
      ["1d2 = 1 ? 1d6 + 1 : 1d8 + 2", [1, 5], 6],
      ["1d2 = 1 ? 1d6 + 1 : 1d8 + 2", [2, 7], 9],
      ["1d2 = 1 ? (1d4 = 4 ? 1 : 2) : 3", [1, 4], 1],
      ["1d2 = 1 ? (1d4 = 4 ? 1 : 2) : 3", [1, 3], 2],
      ["1d2 = 1 ? (1d4 = 4 ? 1 : 2) : 3", [2], 3],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("boolean branches", () => {
    it.each([
      ["1d2 = 1 ? false : true", [1], false],
      ["1d2 = 1 ? false : true", [2], true],
      ["1d2 = 1 ? 1d6 > 3 : false", [1, 4], true],
      ["1d2 = 1 ? 1d6 > 3 : false", [2], false],
      ["1d2 = 1 ? 1d6 > 3 : 1d8 > 7", [2, 8], true],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "boolean", value: expected })
    })
  })

  describe("list branches", () => {
    it.each([
      ["1d2 = 1 ? [1, 2] : [3, 4]", [1], [1, 2]],
      ["1d2 = 1 ? [1, 2] : [3, 4]", [2], [3, 4]],
      ["1d2 = 1 ? [1d6, 2] : [3, 1d8]", [1, 5], [5, 2]],
      ["1d2 = 1 ? [1d6, 2] : [3, 1d8]", [2, 7], [3, 7]],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("string branches", () => {
    it.each([
      ['1d2 = 1 ? "a" : "b"', [1], "a"],
      ['1d2 = 1 ? "a" : "b"', [2], "b"],
      ['1d2 = 1 ? (1d4 = 4 ? "a" : "b") : "c"', [1, 3], "b"],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "string", value: expected })
    })
  })

  describe("string set branches", () => {
    it.each([
      ['1d2 = 1 ? {"a"} : {"b"}', [1], new Set(["a"])],
      ['1d2 = 1 ? {"a"} : {"b"}', [2], new Set(["b"])],
      ['1d2 = 1 ? {1d4 = 4 ? "a" : "b"} : {"c"}', [1, 4], new Set(["a"])],
    ])("evaluates %s with rolls %j", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "stringSet", value: expected })
    })
  })
})
