import { describe, expect, it } from "vitest"
import { buildHirOrThrow, canonicalize, HIRBuilderError } from "../helper.js"

describe("Functions", () => {
  describe("valid function calls", () => {
    it.each([
      ["ceil(1.2)", "2"],
      ["floor(1.8)", "1"],
      ["round(1.5)", "2"],
      ["round(1.4)", "1"],
      ["round(1.6)", "2"],
      ["round(-1.5)", "-1"],
      ["round(-1.4)", "-1"],
      ["round(-1.6)", "-2"],
      ["abs(-1.5)", "1.5"],
      ["abs(1.5)", "1.5"],
      ["abs(-1d6)", "abs(-1d6)"],
      ["abs(1d6)", "abs(1d6)"],
      ["ceil(1d6 / 2)", "ceil(1d6 / 2)"],
      ["floor(1d6 / 2)", "floor(1d6 / 2)"],
      ["round(1d6 / 2)", "round(1d6 / 2)"],
      ["ceil(1.1, 2.2, 3.3)", "[2, 3, 4]"],
      ["floor([1.1, 2.2, 3.3])", "[1, 2, 3]"],
      ["round([1.1, 2.2, 3.3])", "[1, 2, 3]"],
      ["abs([-1.1, -2.2, -3.3])", "[1.1, 2.2, 3.3]"],
      ["abs([1.1, 2.2, 3.3])", "[1.1, 2.2, 3.3]"],
      ["abs(tolist(1d6x))", "abs(tolist(1d6x))"],
      ["floor(tolist(1d6x))", "floor(tolist(1d6x))"],
      ["ceil(tolist(1d6x))", "ceil(tolist(1d6x))"],
      ["round(tolist(1d6x))", "round(tolist(1d6x))"],
      ["fmax(1d6, 2d6)", "fmax([1d6, 2d6])"],
      ["fmax(1, 2, 3)", "3"],
      ["fmin(1, 2, 3)", "1"],
      ["fmin(1d6)", "1d6"],
      ["fmin([1d6])", "1d6"],
      ["fmin(tolist(1d6x))", "fmin(tolist(1d6x))"],
      ["sum(1, 2, 3)", "6"],
      ["sum(1d6, 2d6, 3d6)", "6d6"],
      ["sum(tolist(1d6x))", "sum(tolist(1d6x))"],
      ["sum([])", "0"],
      ["avg(1, 2, 3)", "2"],
      ["avg([1, 2, 3])", "2"],
      ["avg([])", "0"],
      ["avg(tolist(1d6x))", "avg(tolist(1d6x))"],
      ["avg([1d6, 2d6, 3d6])", "avg([1d6, 2d6, 3d6])"],
      ["len([1, 2, 3])", "3"],
      ["len(tolist(1d6x))", "len(tolist(1d6x))"],
      ["len([1d6, 2d6, 3d6])", "3"],
      ["fmax([1, 2, 3], 2)", "[2, 3]"],
      ["fmax([1, 3, 2], 2)", "[3, 2]"],
      ["fmin([1, 3, 2], 2)", "[1, 2]"],
      ["fmin([1, 3, 2, 2, 2, 2], 2)", "[1, 2]"],
      ["fmin([1, 1d6, 2], 2)", "fmin([1, 1d6, 2], 2)"],
      ["fmax([1, 3, 2], 2d6)", "fmax([1, 3, 2], 2d6)"],
      ["fmin([1, 1d6, 2], 0)", "[]"],
      ["fmin([1, 1d6, 2], 3)", "[1, 1d6, 2]"],
      ["fmin([1, 1d6, 2], 4)", "[1, 1d6, 2]"],
      ["sort([3, 1, 2])", "[1, 2, 3]"],
      ["sortd([3, 1, 2])", "[3, 2, 1]"],
      ["sort([])", "[]"],
      ["sort([3, 2, 1d6])", "sort([3, 2, 1d6])"],
      ["sortd([3, 2, 1d6])", "sortd([3, 2, 1d6])"],
      ["tolist(1d6x)", "tolist(1d6x)"],
      ["tolist(1d6x[>=3]cs[>5])", "tolist(1d6x[>=3]cs[>5])"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("valid filter calls", () => {
    it.each([
      ["filter[=3]([1, 2, 3, 3, 4, 5, 6])", "[3, 3]"],
      ["filter[!=3]([1, 2, 3, 3, 4, 5, 6])", "[1, 2, 4, 5, 6]"],
      ["filter[>=3]([1, 2, 3, 3, 4, 5, 6])", "[3, 3, 4, 5, 6]"],
      ["filter[>3]([1, 2, 3, 3, 4, 5, 6])", "[4, 5, 6]"],
      ["filter[<=3]([1, 2, 3, 3, 4, 5, 6])", "[1, 2, 3, 3]"],
      ["filter[<3]([1, 2, 3, 3, 4, 5, 6])", "[1, 2]"],
      ["filter[=3](tolist(1d6x))", "filter[=3](tolist(1d6x))"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid function calls", () => {
    it.each(["fmin([])", "fmax([])", "ceil(true)", "floor(false)", "tolist(1)", "tolist(false)"])(
      "rejects %s",
      (input) => {
        expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
      }
    )
  })
})
