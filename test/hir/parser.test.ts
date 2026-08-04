import { describe, expect, it } from "vitest"
import { canonicalize, ParserError } from "../helper.js"

describe("HIR parser", () => {
  describe("white space handling", () => {
    it.each([
      [" 1 ", "1"],
      ["( 1 )", "1"],
      [" true ? 1 : 2", "1"],
      ["[ 1 , 2 ]", "[1, 2]"],
      ["fmin( 1, 2 )", "1"],
      ["filter[>=( 1 + 1 )]( 1 , 2 )", "[2]"],
      ["@repeat( [ 1 ] , 2 )", "[1, 1]"],
      ["@crit( 1d6 )", "2d6"],
      ["!( ( 1d6 > 2 && (1 + 1) < 3d6 ) )", "!(1d6 > 2 && 2 < 3d6)"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid input handling", () => {
    it.each([
      "",
      "1 +",
      "1 + 2 3",
      "1 + (2 * 3",
      "1 + 2)",
      "[1, 2,]",
      "[1, 2",
      "@repeat( [ 1 ] , )",
      "@repeat( [ 1 ] , 2",
      "&& true",
      "fmax()",
      "filter[ > 3 ]([1, 2, 3])",
    ])("rejects %s", (input) => {
      expect(() => canonicalize(input)).toThrow(ParserError)
    })
  })
})
