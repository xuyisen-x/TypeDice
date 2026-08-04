import { describe, expect, it } from "vitest"
import { canonicalize, HIRBuilderError, ParserError } from "../helper.js"

describe("Critical Strike", () => {
  describe("valid critical strike expressions", () => {
    it.each([
      ["@crit(1d6)", "2d6"],
      ["@crit(2df)", "4dF"],
      ["@crit(3dc)", "6dC"],
      ["@crit(-3dc)", "-6dC"],
      ["@crit(1d6 + 1)", "2d6 + 1"],
      ["@crit(1d6 * 2)", "2 * 2d6"],
      ["@crit((2d6)d6)", "(2 * 4d6)d6"],
      ["@crit(1d6 - 1)", "2d6 - 1"],
      ["@crit(1d6 / 2)", "2d6 / 2"],
      ["@crit(1d6 // 2)", "2d6 // 2"],
      ["@crit(1d6 % 2)", "2d6 % 2"],
      ["@crit(@crit(1d6))", "4d6"],
      ["@crit(1d6 + @crit(1d4))", "2d6 + 4d4"],
      ["@crit(true)", "true"],
      ["@crit(1d6 > 8)", "2d6 > 8"],
      ["@crit(1d6 >= 8)", "2d6 >= 8"],
      ["@crit(1d6 < 8)", "2d6 < 8"],
      ["@crit(1d6 <= 8)", "2d6 <= 8"],
      ["@crit(1d6 = 8)", "2d6 = 8"],
      ["@crit(1d6 != 8)", "2d6 != 8"],
      ["@crit(!(1d6 > 8))", "!(2d6 > 8)"],
      ["@crit(1d6 > 8 || 2d6 < 4d8)", "2d6 > 8 || 4d6 < 8d8"],
      ["@crit(1d6 > 8 && 2d6 < 4d8)", "2d6 > 8 && 4d6 < 8d8"],
      ["@crit([1d6, 2d6])", "[2d6, 4d6]"],
      ["@crit([1d6] # [2d6])", "[2d6, 4d6]"],
      ["@crit(tolist(2d6) # [2d6])", "tolist(4d6) # [4d6]"],
      ["@crit(1d6kh1)", "2d6kh"],
      ["@crit(1d6kl1)", "2d6kl"],
      ["@crit(1d6dl1)", "2d6dl"],
      ["@crit(1d6dh1)", "2d6dh"],
      ["@crit(2d6min3)", "4d6min3"],
      ["@crit(2d6max3)", "4d6max3"],
      ["@crit(2d6r[=3])", "4d6r[=3]"],
      ["@crit(2d6r[<3]lc1lt1)", "4d6r[<3]lt1lc1"],
      ["@crit(2d6r[<3]lt1lc1)", "4d6r[<3]lt1lc1"],
      ["@crit(2d6r[<3]lc(2d8))", "4d6r[<3]lc(4d8)"],
      ["@crit(2d6r[<3]lt1)", "4d6r[<3]lt1"],
      ["@crit(2d6x)", "4d6x"],
      ["@crit(2d6x[>(1d6)]lc1lt1)", "4d6x[>(2d6)]lt1lc1"],
      ["@crit(2d6x[>3]lt1lc1)", "4d6x[>3]lt1lc1"],
      ["@crit(2d6xcf[<4])", "4d6xcf[<4]"],
      ["@crit(4d6xsf[>4])", "8d6xsf[>4]"],
      ["@crit(2d6xcf[<2]cs[>4])", "4d6xcf[<2]cs[>4]"],
      ["@crit(2d6xcs[<2]cf[>4])", "4d6xcs[<2]cf[>4]"],
      ["@crit(2d6x[>3]lt1lc1min3cf[<4])", "4d6x[>3]lt1lc1min3cf[<4]"],
      ["@crit(dF = 1 ? dF : dC)", "2dF = 1 ? 2dF : 2dC"],
      ["@crit(dF = 1 ? [dF] : [dC])", "2dF = 1 ? [2dF] : [2dC]"],
      ["@crit(dF = 1 ? dF > 0 : dC > 0)", "2dF = 1 ? 2dF > 0 : 2dC > 0"],
      ["@crit(floor(1d6))", "floor(2d6)"],
      ["@crit(ceil(1d6))", "ceil(2d6)"],
      ["@crit(round(1d6))", "round(2d6)"],
      ["@crit(abs(1d6))", "abs(2d6)"],
      ["@crit(len(tolist(1d6)))", "len(tolist(2d6))"],
      ["@crit(fmax(1, 2d6))", "fmax([1, 4d6])"],
      ["@crit(fmin(1, 2d6))", "fmin([1, 4d6])"],
      ["@crit(fmin(2d6))", "4d6"],
      ["@crit(sum(2d6, 4d8))", "4d6 + 8d8"],
      ["@crit(sum(tolist(1d6) + 1d6))", "sum(tolist(2d6) + 2d6)"],
      ["@crit(avg(2d6, 4d8))", "avg([4d6, 8d8])"],
      ["@crit(floor([1d6 / 2, 1d8 / 2]))", "floor([2d6 / 2, 2d8 / 2])"],
      ["@crit(ceil([1d6 / 2, 1d8 / 2]))", "ceil([2d6 / 2, 2d8 / 2])"],
      ["@crit(round([1d6 / 2, 1d8 / 2]))", "round([2d6 / 2, 2d8 / 2])"],
      ["@crit(abs([1d6, -1d8]))", "abs([2d6, -2d8])"],
      ["@crit(fmax(tolist(1d6), 2d6))", "fmax(tolist(2d6), 4d6)"],
      ["@crit(fmin(tolist(1d6), 2d6))", "fmin(tolist(2d6), 4d6)"],
      ["@crit(sort(tolist(1d6) + 2d6))", "sort(tolist(2d6) + 4d6)"],
      ["@crit(sortd([1d6, 1d4]))", "sortd([2d6, 2d4])"],
      ["@crit(tolist(2d6cs[>(1d4)]))", "tolist(4d6cs[>(2d4)])"],
      ["@crit(filter[>(1d5)](1d6, 2d6, 3d6))", "filter[>(2d5)]([2d6, 4d6, 6d6])"],
      ["@crit(tolist(1d6) + 1d6)", "tolist(2d6) + 2d6"],
      ["@crit(1d6 + tolist(1d6))", "2d6 + tolist(2d6)"],
      ["@crit(tolist(1d6) - 1d6)", "tolist(2d6) - 2d6"],
      ["@crit(1d6 - tolist(1d6))", "2d6 - tolist(2d6)"],
      ["@crit(tolist(1d6) * 1d6)", "tolist(2d6) * 2d6"],
      ["@crit(1d6 * tolist(1d6))", "2d6 * tolist(2d6)"],
      ["@crit(tolist(1d6) / 1d6)", "tolist(2d6) / 2d6"],
      ["@crit(1d6 / tolist(1d6))", "2d6 / tolist(2d6)"],
      ["@crit(tolist(1d6) // 1d6)", "tolist(2d6) // 2d6"],
      ["@crit(1d6 // tolist(1d6))", "2d6 // tolist(2d6)"],
      ["@crit(tolist(1d6) % 1d6)", "tolist(2d6) % 2d6"],
      ["@crit(1d6 % tolist(1d6))", "2d6 % tolist(2d6)"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid critical strike expressions", () => {
    it.each(["@crit()", "@crit(1d6, 1)", "@crit(1d6, 1, 2)", "@crit(1d6, 1, 2, 3)"])("rejects %s", (input) => {
      expect(() => canonicalize(input)).toThrow(ParserError)
    })
  })
})

describe("Repeat List", () => {
  describe("valid repeat list expressions", () => {
    it.each([
      ["@repeat([1, 2], 3)", "[1, 2, 1, 2, 1, 2]"],
      ["@repeat([1, 2], 0)", "[]"],
      ["@repeat([1, 2], 1)", "[1, 2]"],
      ["@repeat([1, 2], -1)", "[]"],
      ["@repeat([1, 2], 9 % 6)", "[1, 2, 1, 2, 1, 2]"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid repeat list expressions", () => {
    it.each([
      "@repeat(tolist(10d8), 3)",
      "@repeat([1, 2], false)",
      "@repeat([1, 2], [1, 2])",
      "@repeat([1, 2], 1d6)",
      "@repeat(false, 1)",
    ])("rejects %s", (input) => {
      expect(() => canonicalize(input)).toThrow(HIRBuilderError)
    })
    it.each(["@repeat([1, 2])", "@repeat([1, 2], 1, 2)", "@repeat([1, 2], 1, 2, 3)"])("rejects %s", (input) => {
      expect(() => canonicalize(input)).toThrow(ParserError)
    })
  })
})
