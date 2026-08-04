import { describe, expect, it } from "vitest"
import { buildHirOrThrow, canonicalize, HIRBuilderError } from "../helper.js"

describe("HIR dice modifiers operators", () => {
  describe("valid dice modifiers", () => {
    it.each([
      ["1d6kh1", "1d6kh"],
      ["1d6kl1", "1d6kl"],
      ["1d6dh", "1d6dh"],
      ["1d6dl", "1d6dl"],
      ["2d6kh2", "2d6kh2"],
      ["2d6kl2", "2d6kl2"],
      ["2d6dh2", "2d6dh2"],
      ["2d6dl2", "2d6dl2"],
      ["2d6min3", "2d6min3"],
      ["2d6max3", "2d6max3"],
      ["2d6r[=3]", "2d6r[=3]"],
      ["2d6r[>3]", "2d6r[>3]"],
      ["2d6r[<3]", "2d6r[<3]"],
      ["2d6r[<3]lt1", "2d6r[<3]lt1"],
      ["2d6r[<3]lc1", "2d6r[<3]lc1"],
      ["2d6r[<3]lc1lt1", "2d6r[<3]lt1lc1"],
      ["2d6r[<3]lt1lc1", "2d6r[<3]lt1lc1"],
      ["2d6x", "2d6x"],
      ["2d6x[>3]", "2d6x[>3]"],
      ["2d6x[<3]", "2d6x[<3]"],
      ["2d6x[=3]", "2d6x[=3]"],
      ["2d6x[!=3]", "2d6x[!=3]"],
      ["2d6x[3]", "2d6x[=3]"],
      ["2d6x[>3]lt1", "2d6x[>3]lt1"],
      ["2d6x[>3]lc1", "2d6x[>3]lc1"],
      ["2d6x[>3]lc1lt1", "2d6x[>3]lt1lc1"],
      ["2d6x[>3]lt1lc1", "2d6x[>3]lt1lc1"],
      ["2d6xcf[<4]", "2d6xcf[<4]"],
      ["2d6xsf[<4]", "2d6xsf[<4]"],
      ["2d6xcs[<4]", "2d6xcs[<4]"],
      ["2d6xcs[>4]cf[<2]", "2d6xcs[>4]cf[<2]"],
      ["2d6xcf[<2]cs[>4]", "2d6xcf[<2]cs[>4]"],
      ["2d6x[>3]lt1lc1min3cf[<4]", "2d6x[>3]lt1lc1min3cf[<4]"],
      ["2d6x[>3]lt1lc1max3cf[<4]", "2d6x[>3]lt1lc1max3cf[<4]"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid dice modifiers", () => {
    it.each([
      "[1d6]kh1",
      "[1d6]kh",
      "[1d6]cs[>3]",
      "[1d6]cf[>3]",
      "[1d6]sf[>3]",
      "[1d6]xcs[>3]",
      "1d6kh[1]",
      "1d6kl[1]",
      "1d6dh[1]",
      "1d6dl[1]",
      "2d6kh[2]",
      "2d6kl[2]",
      "2d6dh[2]",
      "2d6dl[2]",
      "2d6min[3]",
      "2d6max[3]",
      "2d6r[=3]lt[1]",
      "2d6r[>3]lt[1]",
      "2d6r[<3]lt[1]",
      "2d6r[<3]lc[1]",
      "2d6r[<3]lc[1]lt[1]",
      "2d6r[<3]lt[1]lc[1]",
      "2d6r[<3]lc1lt[1]",
      "2d6r[<3]lt1lc[1]",
      "2d6xlt[1]",
      "2d6xcf[<3]kh1",
      "2d6xcf[<3]dh2",
      "2d6xcf[<3]min1",
      "2d6xcf[<3]max1",
      "2d6xcf[<3]r[1]",
      "2d6xcf[<3]x[1]",
      "2d6xcf[<2]cs[>false]",
    ])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })
})
