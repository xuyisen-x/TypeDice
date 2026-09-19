import { describe, expect, it } from "vitest"
import { evaluate } from "../helper"

describe("Runtime functions", () => {
  describe("number elementwise functions", () => {
    it.each([
      ["ceil(1d6 / 2)", [3], 2],
      ["floor(1d6 / 2)", [3], 1],
      ["round(1d6 / 2)", [3], 2],
      ["round(-1d6 / 2)", [3], -1],
      ["abs(-1d6)", [4], 4],
      ["abs(1d6 - 5)", [3], 2],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("list elementwise functions", () => {
    it.each([
      ["ceil([1d6 / 2, 1d8 / 2])", [3, 5], [2, 3]],
      ["floor([1d6 / 2, 1d8 / 2])", [3, 5], [1, 2]],
      ["round([1d6 / 2, 1d8 / 2])", [3, 5], [2, 3]],
      ["abs([-1d6, -1d8])", [3, 5], [3, 5]],
      ["abs(tolist(1d6x))", [6, 4], [6, 4]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("aggregate functions", () => {
    it.each([
      ["fmax(1d6, 1d8, 1d10)", [3, 7, 5], 7],
      ["fmin(1d6, 1d8, 1d10)", [3, 7, 5], 3],
      ["sum(1d6, 1d8, 1d10)", [3, 7, 5], 15],
      ["sum(tolist(2d6))", [3, 5], 8],
      ["avg([1d6, 1d8, 1d10])", [3, 7, 5], 5],
      ["avg(tolist(0d6))", [], 0],
      ["len(tolist(2d6x))", [6, 2, 4], 3],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "number", value: expected })
    })
  })

  describe("list selection functions", () => {
    it.each([
      ["fmax([1d6, 3, 2], 2)", [4], [4, 3]],
      ["fmax([1d6, 1, 2], 2)", [1], [1, 2]],
      ["fmin([1d6, 3, 2], 2)", [4], [3, 2]],
      ["fmax([1, 3, 2], 1d2)", [2], [3, 2]],
      ["fmin([1d6, 2], 1d2 - 1)", [4, 1], []],
      ["fmin([1d6, 2], 3)", [4], [4, 2]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("sort functions", () => {
    it.each([
      ["sort([3, 1d6, 2])", [1], [1, 2, 3]],
      ["sort([1d6, 1, 2])", [1], [1, 1, 2]],
      ["sort([0 / (1d2 - 1), 1])", [1], [Number.NaN, 1]],
      ["sortd([3, 1d6, 2])", [1], [3, 2, 1]],
      ["sort(tolist(3d6))", [3, 1, 2], [1, 2, 3]],
      ["sortd(tolist(3d6))", [3, 1, 2], [3, 2, 1]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("tolist", () => {
    it.each([
      ["tolist(2d6)", [2, 5], [2, 5]],
      ["tolist(1d6x)", [6, 4], [6, 4]],
      ["tolist(3d6cs[>=5]cf[=1])", [6, 4, 1], [1, 0, -1]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })

  describe("filter", () => {
    it.each([
      ["filter[=3]([1, 1d6, 5])", [3], [3]],
      ["filter[!=3]([1, 1d6, 5])", [3], [1, 5]],
      ["filter[>=3]([1, 1d6, 5])", [3], [3, 5]],
      ["filter[>3]([1, 1d6, 5])", [3], [5]],
      ["filter[<=3]([1, 1d6, 5])", [3], [1, 3]],
      ["filter[<3]([1, 1d6, 5])", [3], [1]],
      ["filter[>=(1d6)]([1, 3, 5])", [3], [3, 5]],
    ])("evaluates %s", (input, rolls, expected) => {
      expect(evaluate(input, rolls)).toEqual({ kind: "list", value: expected })
    })
  })
})
