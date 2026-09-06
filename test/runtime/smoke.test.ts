import { describe, expect, it } from "vitest"
import type { DicePool, EvaluationOptions, OutputNode, RuntimeValue } from "../../src/index.js"
import { buildHirOrThrow, evaluateHirOrThrow } from "../helper.js"

type RandomSource = NonNullable<EvaluationOptions["random"]>
type RandomFace = Parameters<RandomSource>[0]

function sequenceRandom(...values: number[]): {
  random: RandomSource
  calls: () => RandomFace[]
} {
  let index = 0
  const faces: RandomFace[] = []
  return {
    random: (face) => {
      if (index >= values.length) throw new Error("The deterministic random sequence was exhausted")
      faces.push(face)
      return values[index++]
    },
    calls: () => faces,
  }
}

function evaluatedValue(node: OutputNode): RuntimeValue {
  if (node.status !== "evaluated") throw new Error("Expected an evaluated node")
  return node.value
}

function dicePool(node: OutputNode): DicePool {
  const value = evaluatedValue(node)
  if (value.kind !== "dicepool") throw new Error("Expected a dice pool")
  return value.value
}

describe("Runtime evaluation", () => {
  it("tracks nested dice groups and roll rounds", () => {
    const source = sequenceRandom(1, 6)
    const output = evaluateHirOrThrow(buildHirOrThrow("(1d2)d6"), { random: source.random }).output
    const outerPool = dicePool(output)

    expect(outerPool).toMatchObject({ groupID: 1, total: 6, face: 6 })
    expect(outerPool.details).toMatchObject([{ rollID: 1, rollRound: 2, result: 6, reason: "initial" }])

    expect(output.layout.kind).toBe("dice")
    if (output.layout.kind !== "dice" || typeof output.layout.face === "string") return
    const innerPool = dicePool(output.layout.count)
    expect(innerPool).toMatchObject({ groupID: 0, total: 1, face: 2 })
    expect(innerPool.details).toMatchObject([{ rollID: 0, rollRound: 1, result: 1, reason: "initial" }])
    expect(output.readyRound).toBe(2)
  })

  it("tracks explosion sources without mutating the input pool node", () => {
    const source = sequenceRandom(6, 2, 6, 1)
    const output = evaluateHirOrThrow(buildHirOrThrow("2d6x[=6]lt2"), { random: source.random }).output
    const result = dicePool(output)

    expect(result).toMatchObject({ groupID: 0, total: 15, face: 6 })
    expect(result.details).toMatchObject([
      { rollID: 0, rollRound: 1, result: 6, reason: "initial" },
      { rollID: 1, rollRound: 1, result: 2, reason: "initial" },
      { rollID: 2, rollRound: 2, result: 6, reason: "explosion", sourceID: 0 },
      { rollID: 3, rollRound: 3, result: 1, reason: "explosion", sourceID: 2 },
    ])
    expect(output.readyRound).toBe(3)

    expect(output.layout.kind).toBe("diceModifier")
    if (output.layout.kind !== "diceModifier") return
    expect(dicePool(output.layout.pool).details).toHaveLength(2)
  })

  it("strictly short-circuits boolean operations", () => {
    const source = sequenceRandom(1)
    const output = evaluateHirOrThrow(buildHirOrThrow("1d2 = 2 && 1d6 = 6"), { random: source.random }).output

    expect(evaluatedValue(output)).toEqual({ kind: "boolean", value: false })
    expect(source.calls()).toEqual([2])
    expect(output.layout.kind).toBe("binary")
    if (output.layout.kind !== "binary") return
    expect(output.layout.operands[1].status).toBe("short-circuited")
  })

  it("passes special dice faces to the random source", () => {
    const source = sequenceRandom(-1, 1)
    const output = evaluateHirOrThrow(buildHirOrThrow("tolist(1df) # tolist(1dc)"), { random: source.random }).output

    expect(evaluatedValue(output)).toEqual({ kind: "list", value: [-1, 1] })
    expect(source.calls()).toEqual(["fudge", "coin"])
  })

  it("evaluates keep, success, failure, and list conversion in order", () => {
    const source = sequenceRandom(6, 5, 3, 1)
    const output = evaluateHirOrThrow(buildHirOrThrow("tolist(4d6kh2cs[>=5]cf[=6])"), { random: source.random }).output

    expect(evaluatedValue(output)).toEqual({ kind: "list", value: [-1, 1] })
  })

  it.each([
    ["1 / (1d2 - 1)", Number.POSITIVE_INFINITY],
    ["-1 / (1d2 - 1)", Number.NEGATIVE_INFINITY],
    ["0 / (1d2 - 1)", Number.NaN],
    ["1 % (1d2 - 1)", Number.NaN],
  ])("evaluates a dynamically computed zero divisor in %s", (input, expected) => {
    const source = sequenceRandom(1)
    expect(evaluatedValue(evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output)).toEqual({
      kind: "number",
      value: expected,
    })
  })

  it("evaluates zero divisors in a dynamic list operation", () => {
    const source = sequenceRandom(1)
    expect(
      evaluatedValue(evaluateHirOrThrow(buildHirOrThrow("1 / [1d2 - 1, 1]"), { random: source.random }).output)
    ).toEqual({ kind: "list", value: [Number.POSITIVE_INFINITY, 1] })
  })
})
