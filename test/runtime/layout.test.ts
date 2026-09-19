import { describe, expect, it } from "vitest"
import type { OutputNode } from "../../src/index.js"
import { buildHirOrThrow, evaluateHirOrThrow, sequenceRandom } from "../helper.js"

function evaluateOutput(input: string, rolls: number[]): OutputNode {
  const source = sequenceRandom(...rolls)
  return evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output
}

describe("Runtime layout precedence", () => {
  describe("arithmetic operators", () => {
    it("leaves a higher-precedence multiplication unparenthesized inside addition", () => {
      expect(evaluateOutput("1d6 + 2 * 1d8", [3, 4])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["+"],
          operands: [
            { parenthesized: false, layout: { kind: "dice" } },
            { parenthesized: false, layout: { kind: "binary", operators: ["*"] } },
          ],
        },
      })
    })

    it("parenthesizes a lower-precedence addition inside multiplication", () => {
      expect(evaluateOutput("(1d6 + 1) * 2", [3])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["*"],
          operands: [
            { parenthesized: false, layout: { kind: "atom", text: "2" } },
            { parenthesized: true, layout: { kind: "binary", operators: ["+"] } },
          ],
        },
      })
    })

    it("parenthesizes a same-precedence right operand", () => {
      expect(evaluateOutput("1d6 / (1d8 / 2)", [3, 4])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["/"],
          operands: [
            { parenthesized: false, layout: { kind: "dice" } },
            { parenthesized: true, layout: { kind: "binary", operators: ["/"] } },
          ],
        },
      })
    })

    it("leaves a same-precedence left operand unparenthesized", () => {
      expect(evaluateOutput("(1d6 / 2) / 1d8", [3, 4])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["/"],
          operands: [
            { parenthesized: false, layout: { kind: "binary", operators: ["/"] } },
            { parenthesized: false, layout: { kind: "dice" } },
          ],
        },
      })
    })
  })

  describe("unary operators", () => {
    it.each([
      ["-(1d6 / 2)", "-", "/"],
      ["!(1d6 > 3)", "!", ">"],
    ])("parenthesizes the operand in %s", (input, unaryOperator, binaryOperator) => {
      expect(evaluateOutput(input, [4])).toMatchObject({
        layout: {
          kind: "unary",
          operator: unaryOperator,
          operand: {
            parenthesized: true,
            layout: { kind: "binary", operators: [binaryOperator] },
          },
        },
      })
    })
  })

  describe("boolean operators", () => {
    it("leaves logical and unparenthesized inside logical or", () => {
      expect(evaluateOutput("1d6 > 3 && 1d8 > 4 || 1d10 > 5", [4, 5])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["||"],
          operands: [
            { parenthesized: false, layout: { kind: "binary", operators: ["&&"] } },
            { parenthesized: false, layout: { kind: "binary", operators: [">"] } },
          ],
        },
      })
    })

    it("parenthesizes logical or inside logical and", () => {
      expect(evaluateOutput("1d6 > 3 && (1d8 > 4 || 1d10 > 5)", [4, 5])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["&&"],
          operands: [
            { parenthesized: false, layout: { kind: "binary", operators: [">"] } },
            { parenthesized: true, layout: { kind: "binary", operators: ["||"] } },
          ],
        },
      })
    })

    it("parenthesizes a ternary used as a comparison operand", () => {
      expect(evaluateOutput("(1d2 = 1 ? 1d6 + 1 : 1d8 + 1) > 3", [1, 4])).toMatchObject({
        layout: {
          kind: "binary",
          operators: [">"],
          operands: [{ parenthesized: true, layout: { kind: "ternary" } }, { parenthesized: false }],
        },
      })
    })
  })

  describe("string set and membership operators", () => {
    const a = '{1d2 = 1 ? "a" : "A"}'
    const b = '{1d2 = 1 ? "b" : "B"}'
    const c = '{1d2 = 1 ? "c" : "C"}'
    const d = '{1d2 = 1 ? "d" : "D"}'

    it("nests tighter set operators without parentheses", () => {
      expect(evaluateOutput(`${a} | ${b} ^ ${c} & ${d}`, [1, 1, 1, 1])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["|"],
          operands: [
            { parenthesized: false },
            {
              parenthesized: false,
              layout: {
                kind: "binary",
                operators: ["^"],
                operands: [
                  { parenthesized: false },
                  { parenthesized: false, layout: { kind: "binary", operators: ["&"] } },
                ],
              },
            },
          ],
        },
      })
    })

    it("parenthesizes a lower-precedence set operand", () => {
      expect(evaluateOutput(`(${a} | ${b}) & ${c}`, [1, 1, 1])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["&"],
          operands: [{ parenthesized: true, layout: { kind: "binary", operators: ["|"] } }, { parenthesized: false }],
        },
      })
    })

    it("parenthesizes a same-precedence right set operand", () => {
      expect(evaluateOutput(`${a} - (${b} - ${c})`, [1, 1, 1])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["-"],
          operands: [{ parenthesized: false }, { parenthesized: true, layout: { kind: "binary", operators: ["-"] } }],
        },
      })
    })

    it.each([
      ['(1d2 = 1 ? "a" : "b") in {"a"}', "left"],
      ['"a" in (1d2 = 1 ? {"a"} : {"b"})', "right"],
    ])("parenthesizes the ternary membership operand on the %s", (input, side) => {
      const output = evaluateOutput(input, [1])
      if (output.layout.kind !== "binary") throw new Error("Expected a binary layout")
      const operand = output.layout.operands[side === "left" ? 0 : 1]

      expect(operand).toMatchObject({ parenthesized: true, layout: { kind: "ternary" } })
    })
  })

  describe("list concatenation", () => {
    it("parenthesizes concatenation inside an additive list operation", () => {
      expect(evaluateOutput("(tolist(1d6) # tolist(1d8)) + 1d4", [3, 4, 2])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["+"],
          operands: [{ parenthesized: true, layout: { kind: "binary", operators: ["#"] } }, { parenthesized: false }],
        },
      })
    })

    it("leaves an additive list operation unparenthesized inside concatenation", () => {
      expect(evaluateOutput("tolist(1d6) # (tolist(1d8) + 1d4)", [3, 4, 2])).toMatchObject({
        layout: {
          kind: "binary",
          operators: ["#"],
          operands: [{ parenthesized: false }, { parenthesized: false, layout: { kind: "binary", operators: ["+"] } }],
        },
      })
    })
  })

  describe("dice operators", () => {
    it("parenthesizes a non-atomic dice count", () => {
      expect(evaluateOutput("(1d2 + 1)d6", [1, 4, 5])).toMatchObject({
        layout: {
          kind: "dice",
          count: { parenthesized: true, layout: { kind: "binary", operators: ["+"] } },
          face: { parenthesized: false },
        },
      })
    })

    it("parenthesizes a non-atomic dice face", () => {
      expect(evaluateOutput("1d(1d6 + 1)", [4, 3])).toMatchObject({
        layout: {
          kind: "dice",
          count: { parenthesized: false },
          face: { parenthesized: true, layout: { kind: "binary", operators: ["+"] } },
        },
      })
    })

    it("parenthesizes a non-atomic modifier argument", () => {
      expect(evaluateOutput("4d6kh(1d2 + 1)", [1, 6, 3, 5, 1])).toMatchObject({
        layout: {
          kind: "diceModifier",
          modifier: "kh",
          argument: { parenthesized: true, layout: { kind: "binary", operators: ["+"] } },
        },
      })
    })

    it("parenthesizes a non-atomic repetition limit", () => {
      expect(evaluateOutput("2d6x[>3]lt(1d2 + 1)", [4, 2, 1, 6, 1])).toMatchObject({
        layout: {
          kind: "diceModifier",
          modifier: "x",
          timeLimit: { parenthesized: true, layout: { kind: "binary", operators: ["+"] } },
        },
      })
    })
  })

  describe("ternary operators", () => {
    it("parenthesizes a nested ternary in the true branch only", () => {
      expect(evaluateOutput("1d2 = 1 ? (1d4 = 1 ? 1 : 2) : (1d6 = 1 ? 3 : 4)", [1, 1])).toMatchObject({
        layout: {
          kind: "ternary",
          trueBranch: { parenthesized: true, layout: { kind: "ternary" } },
          falseBranch: { parenthesized: false, layout: { kind: "ternary" } },
        },
      })
    })

    it("parenthesizes a ternary used as another ternary's condition", () => {
      expect(evaluateOutput("(1d2 = 1 ? true : false) ? 1 : 2", [1])).toMatchObject({
        layout: {
          kind: "ternary",
          condition: { parenthesized: true, layout: { kind: "ternary" } },
        },
      })
    })

    it.each([
      ["boolean", "(1d2 = 1 ? true : false) ? (1d4 = 1 ? true : false) : false"],
      ["list", "(1d2 = 1 ? true : false) ? (1d4 = 1 ? [1] : [2]) : [3]"],
      ["string", '(1d2 = 1 ? true : false) ? (1d4 = 1 ? "a" : "b") : "c"'],
      ["string set", '(1d2 = 1 ? true : false) ? (1d4 = 1 ? {"a"} : {"b"}) : {"c"}'],
    ])("parenthesizes nested ternaries for the %s visitor", (_type, input) => {
      expect(evaluateOutput(input, [1, 1])).toMatchObject({
        layout: {
          kind: "ternary",
          condition: { parenthesized: true, layout: { kind: "ternary" } },
          trueBranch: { parenthesized: true, layout: { kind: "ternary" } },
        },
      })
    })
  })
})
