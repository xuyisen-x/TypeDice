import { describe, expect, it } from "vitest"
import { buildHirOrThrow, evaluateHirOrThrow } from "../helper.js"

describe("Runtime errors", () => {
  describe("empty aggregate inputs", () => {
    it.each([
      ["fmax(tolist(0d6))", "函数fmax不能用于空列表"],
      ["fmin(tolist(0d6))", "函数fmin不能用于空列表"],
    ])("throws an error for %s", (input, expected) => {
      expect(() => evaluateHirOrThrow(buildHirOrThrow(input))).toThrow(expected)
    })
  })

  describe("invalid random results", () => {
    it.each([
      ["1d6", 1.5, "随机数生成器必须返回整数"],
      ["1d6", 0, "随机数生成器为6面骰返回了无效结果0"],
      ["1d6", 7, "随机数生成器为6面骰返回了无效结果7"],
      ["1dF", -2, "随机数生成器为fudge面骰返回了无效结果-2"],
      ["1dF", 2, "随机数生成器为fudge面骰返回了无效结果2"],
      ["1dC", -1, "随机数生成器为coin面骰返回了无效结果-1"],
      ["1dC", 2, "随机数生成器为coin面骰返回了无效结果2"],
    ])("throws an error when %s rolls %s", (input, result, expected) => {
      expect(() => evaluateHirOrThrow(buildHirOrThrow(input), { random: () => result })).toThrow(expected)
    })
  })
})
