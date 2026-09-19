import { describe, expect, it } from "vitest"
import { evaluate, numericResult } from "../helper.js"

describe("Runtime dice modifiers", () => {
  describe("keep and drop", () => {
    it.each([
      ["4d6kh2", [1, 6, 3, 5], 11],
      ["4d6kh2", [3, 3, 2, 1], 6],
      ["4d6kl2", [1, 6, 3, 5], 4],
      ["4d6dh2", [1, 6, 3, 5], 4],
      ["4d6dl2", [1, 6, 3, 5], 11],
      ["4d6kh(1d2)", [1, 6, 3, 5, 2], 11],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })

  describe("minimum and maximum", () => {
    it.each([
      ["3d6min3", [1, 3, 6], 12],
      ["3d6max3", [1, 3, 6], 7],
      ["4d6kh2min3", [1, 2, 5, 6], 11],
      ["4d6kh2max3", [1, 2, 5, 6], 6],
      ["2d6min(1d4)", [1, 6, 3], 9],
      ["2d6max(1d4)", [1, 6, 3], 4],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })

  describe("reroll", () => {
    it.each([
      ["2d6r[=3]", [3, 5, 4], 9],
      ["2d6r[>3]lt1", [4, 2, 6], 8],
      ["2d6r[<3]lc1", [1, 2, 5], 7],
      ["2d6r[<3]lc1lt1", [1, 2, 5], 7],
      ["2d6r[<3]lt1lc1", [1, 2, 5], 7],
      ["2d6r[<3]", [2, 5, 1, 4], 9],
      ["2d6r[<(1d3)]lt1", [1, 5, 3, 4], 9],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })

  describe("explosion", () => {
    it.each([
      ["2d6x", [6, 2, 6, 3], 17],
      ["1dFxlt1", [1, 0], 1],
      ["1dCxlt1", [1, 0], 1],
      ["2d6x[>3]lt1", [4, 2, 6], 12],
      ["2d6x[>3]lc1", [4, 5, 2], 11],
      ["2d6x[>3]lc1lt1", [4, 5, 2], 11],
      ["2d6x[>3]lt1lc1", [4, 5, 2], 11],
      ["2d6x[!=3]lt1lc1", [3, 5, 2], 10],
      ["2d6x[>3]lc(1d2)lt1", [4, 5, 1, 2], 11],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })

  describe("invalid computed dice faces", () => {
    it.each([
      ["1d(1d2 - 1)", [1]],
      ["1d(1d2 - 2)", [1]],
    ])("evaluates %s as an empty pool", (input, rolls) => {
      expect(numericResult(evaluate(input, rolls))).toBe(0)
    })
  })

  describe("success and failure", () => {
    it.each([
      ["2d6xcf[<4]", [5, 2], -1],
      ["2d6xsf[<4]", [5, 2], 5],
      ["2d6xcs[<4]", [5, 2], 1],
      ["2d6xcs[>4]cf[<2]", [5, 1], 0],
      ["2d6xcf[<2]cs[>4]", [5, 1], 0],
      ["2d6x[>3]lt1lc1min3cf[<4]", [4, 2, 5], -1],
      ["2d6x[>3]lt1lc1max3cf[<4]", [4, 2, 5], -3],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(numericResult(evaluate(input, rolls))).toBe(expected)
    })
  })
})
