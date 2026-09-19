import { describe, expect, it } from "vitest"
import type { NodeLayout, OutputNode } from "../../src/index.js"
import { buildHirOrThrow, evaluateHirOrThrow, sequenceRandom } from "../helper.js"

function childNodes(node: OutputNode): OutputNode[] {
  const layout = node.layout
  switch (layout.kind) {
    case "atom":
      return []
    case "list":
    case "stringSet":
      return layout.children
    case "unary":
      return [layout.operand]
    case "binary":
      return layout.operands
    case "ternary":
      return [layout.condition, layout.trueBranch, layout.falseBranch]
    case "function":
      return [...layout.args, ...(layout.modParam ? [layout.modParam.param] : [])]
    case "dice":
      return [layout.count, ...(typeof layout.face === "string" ? [] : [layout.face])]
    case "diceModifier":
      return [
        layout.pool,
        ...(layout.argument ? [layout.argument] : []),
        ...(layout.modParam ? [layout.modParam.param] : []),
        ...(layout.timeLimit ? [layout.timeLimit] : []),
        ...(layout.countLimit ? [layout.countLimit] : []),
      ]
  }
}

function expectShortCircuitedSubtree(node: OutputNode): void {
  expect(node.status).toBe("short-circuited")
  for (const child of childNodes(node)) expectShortCircuitedSubtree(child)
}

function requireBinaryLayout(node: OutputNode): Extract<NodeLayout, { kind: "binary" }> {
  if (node.layout.kind !== "binary") throw new Error("Expected a binary layout")
  return node.layout
}

function requireTernaryLayout(node: OutputNode): Extract<NodeLayout, { kind: "ternary" }> {
  if (node.layout.kind !== "ternary") throw new Error("Expected a ternary layout")
  return node.layout
}

describe("Runtime short-circuiting", () => {
  describe("boolean operators", () => {
    it.each([
      ["1d2 = 1 && 1d6 = 6", [2], [2]],
      ["1d2 = 1 || 1d6 = 6", [1], [2]],
      ["1d2 = 2 && (-1d6 - 1d8 > 0)", [1], [2]],
      ['1d2 = 2 && "a" in {1d4 = 1 ? "a" : "b"}', [1], [2]],
      ['1d2 = 1 || (1d4 = 1 ? "a" : "b") in {"a"}', [1], [2]],
      ["1d2 = 2 && (!(-1d6 > 0) || (1d8 + floor(1d10 / 2) - 2 * 1d12) > 0 || (1d4 = 1 ? 1d6 : 1d8) > 0)", [1], [2]],
      [
        "1d2 = 2 && (len(sort(tolist(2d6))) > 0 || len(fmax([1d6, 2], 1d2)) > 0 || len(tolist(2d6cs[>3])) > 0 || len(filter[>3]([1d6, 4])) > 0 || len(abs([1d6])) > 0)",
        [1],
        [2],
      ],
      [
        "1d2 = 2 && (len(1d4 = 1 ? [1d6] : [1d8]) > 0 || len(tolist(1d6) # tolist(1d8)) > 0 || len(tolist(1d6) + 1d4) > 0 || len(1d4 + tolist(1d6)) > 0)",
        [1],
        [2],
      ],
      [
        "1d2 = 2 && ((1d4 + 1)dF > 0 || (1d4 + 1)dC > 0 || 2d6kh1 > 0 || 2d6min3 > 0 || 2d6sf[<3] > 0 || 2d6r[<3]lt(1d4 + 1)lc(1d4 + 1) > 0)",
        [1],
        [2],
      ],
      [
        '1d2 = 2 && ("a" in ({1d4 = 1 ? "a" : "b"} | {1d6 = 1 ? "c" : "d"}) || !((1d4 = 1 ? "a" : "b") in (1d6 = 1 ? {"a"} : {"b"})))',
        [1],
        [2],
      ],
      ["1d2 = 2 && ((1d4 = 1 ? true : false) ? (1d6 = 1 ? true : false) : false)", [1], [2]],
    ])("short-circuits the right operand in %s", (input, rolls, expectedCalls) => {
      const source = sequenceRandom(...rolls)
      const output = evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output
      const layout = requireBinaryLayout(output)

      expect(layout.operands[0].status).toBe("evaluated")
      expectShortCircuitedSubtree(layout.operands[1])
      expect(source.calls()).toEqual(expectedCalls)
    })

    it.each([
      ["1d2 = 1 && 1d6 = 6", [1, 6], [2, 6]],
      ["1d2 = 2 || 1d6 = 6", [1, 6], [2, 6]],
    ])("evaluates the required right operand in %s", (input, rolls, expectedCalls) => {
      const source = sequenceRandom(...rolls)
      const output = evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output
      const layout = requireBinaryLayout(output)

      expect(layout.operands[0].status).toBe("evaluated")
      expect(layout.operands[1].status).toBe("evaluated")
      expect(source.calls()).toEqual(expectedCalls)
    })
  })

  describe("ternary branches", () => {
    it.each([
      ["number", "1d2 = 1 ? 1d6 + 1 : 1d8 + 1", [1, 4], [2, 6], "true"],
      ["number", "1d2 = 1 ? 1d6 + 1 : 1d8 + 1", [2, 7], [2, 8], "false"],
      ["boolean", "1d2 = 1 ? 1d6 > 3 : 1d8 > 4", [1, 4], [2, 6], "true"],
      ["boolean", "1d2 = 1 ? 1d6 > 3 : 1d8 > 4", [2, 7], [2, 8], "false"],
      ["list", "1d2 = 1 ? [1d6] : [1d8]", [1, 4], [2, 6], "true"],
      ["list", "1d2 = 1 ? [1d6] : [1d8]", [2, 7], [2, 8], "false"],
      ["string", '1d2 = 1 ? (1d4 = 1 ? "a" : "b") : (1d6 = 1 ? "c" : "d")', [1, 1], [2, 4], "true"],
      ["string", '1d2 = 1 ? (1d4 = 1 ? "a" : "b") : (1d6 = 1 ? "c" : "d")', [2, 1], [2, 6], "false"],
      ["string set", '1d2 = 1 ? {1d4 = 1 ? "a" : "b"} : {1d6 = 1 ? "c" : "d"}', [1, 1], [2, 4], "true"],
      ["string set", '1d2 = 1 ? {1d4 = 1 ? "a" : "b"} : {1d6 = 1 ? "c" : "d"}', [2, 1], [2, 6], "false"],
      ["dice pool", "1d2 = 1 ? 1d6 : 1d8", [1, 4], [2, 6], "true"],
      ["dice pool", "1d2 = 1 ? 1d6 : 1d8", [2, 7], [2, 8], "false"],
      ["success pool", "1d2 = 1 ? 1d6cs[>=4] : 1d8cs[>=5]", [1, 4], [2, 6], "true"],
      ["success pool", "1d2 = 1 ? 1d6cs[>=4] : 1d8cs[>=5]", [2, 7], [2, 8], "false"],
    ])("short-circuits the unselected %s branch", (_type, input, rolls, expectedCalls, selected) => {
      const source = sequenceRandom(...rolls)
      const output = evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output
      const layout = requireTernaryLayout(output)
      const selectedBranch = selected === "true" ? layout.trueBranch : layout.falseBranch
      const unselectedBranch = selected === "true" ? layout.falseBranch : layout.trueBranch

      expect(layout.condition.status).toBe("evaluated")
      expect(selectedBranch.status).toBe("evaluated")
      expectShortCircuitedSubtree(unselectedBranch)
      expect(source.calls()).toEqual(expectedCalls)
    })

    it("does not raise a runtime error from an unselected branch", () => {
      const source = sequenceRandom(2, 4)
      const output = evaluateHirOrThrow(buildHirOrThrow("1d2 = 1 ? fmax(tolist(0d6)) : 1d6 + 1"), {
        random: source.random,
      }).output
      const layout = requireTernaryLayout(output)

      expectShortCircuitedSubtree(layout.trueBranch)
      expect(layout.falseBranch.status).toBe("evaluated")
      expect(source.calls()).toEqual([2, 6])
    })
  })
})
