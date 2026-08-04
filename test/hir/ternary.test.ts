import { describe, expect, it } from "vitest"
import { canonicalize, HIRBuilderError } from "../helper.js"

describe("Ternary operator", () => {
  describe("valid ternary expressions", () => {
    it.each([
      ["true ? 1 : 2", "1"],
      ["false ? 1d6 : 2d6", "2d6"],
      ["2d6 > 3 ? 1 : 2", "2d6 > 3 ? 1 : 2"],
      ["2d6 > 3 ? 2d6 > 3 ? 1 : 2 : 3", "2d6 > 3 ? (2d6 > 3 ? 1 : 2) : 3"],
      ["true ? false : true", "false"],
      ["true ? 1d6 > 3 : false", "1d6 > 3"],
      ["2d8 > 7 ? 1d6 > 3 : false", "2d8 > 7 ? 1d6 > 3 : false"],
      ["true ? [1, 2] : [3, 4]", "[1, 2]"],
      ["len(tolist(3d6x)) > 6 ? [1, 2] : [3, 4]", "len(tolist(3d6x)) > 6 ? [1, 2] : [3, 4]"],
      ["(1d6 > 3 ? true : false) ? 1d6 > 3 : false", "(1d6 > 3 ? true : false) ? 1d6 > 3 : false"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid ternary expressions", () => {
    it.each(["true ? 1 : [1, 3]", "1 ? 1 : 2", "[1, 3] ? 1 : 2"])("rejects %s", (input) => {
      expect(() => canonicalize(input)).toThrow(HIRBuilderError)
    })
  })
})
