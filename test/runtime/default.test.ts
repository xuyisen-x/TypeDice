import { describe, expect, it } from "vitest"
import { buildHirOrThrow, dicePool, evaluateHirOrThrow } from "../helper.js"

describe("Default random source", () => {
  it.each([
    ["100d6", 1, 6],
    ["100dF", -1, 1],
    ["100dC", 0, 1],
  ])("generates results in range for %s", (input, minimum, maximum) => {
    const pool = dicePool(evaluateHirOrThrow(buildHirOrThrow(input)).output)

    for (const detail of pool.details) {
      expect(Number.isInteger(detail.result)).toBe(true)
      expect(detail.result).toBeGreaterThanOrEqual(minimum)
      expect(detail.result).toBeLessThanOrEqual(maximum)
    }
  })
})
