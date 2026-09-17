import { describe, expect, it } from "vitest"
import { buildHirOrThrow, canonicalize, HIRBuilderError, LexerError, ParserError } from "../helper.js"

describe("HIR atoms", () => {
  describe("number literals", () => {
    it.each([
      ["0", "0"],
      ["1.", "1"],
      [".5", "0.5"],
      ["1.25e2", "125"],
      ["NaN", "NaN"],
      ["nan", "NaN"],
      ["Inf", "Inf"],
      ["INF", "Inf"],
      ["-Inf", "-Inf"],
      ["1e309", "Inf"],
      ["1e309 + 1e309", "Inf"],
      ["-1e309 + -1e309", "-Inf"],
      ["1e309 - 1e309 + 1d6", "1d6 + NaN"],
      [" + 1d6 + 1e309 - 1e309", "1d6 + NaN"],
      ["(1e309 + 1e309) - (1e309 + 1e309) + 10", "NaN"],
      ["0.001", "0.01"],
      ["0.01 - 0.0123", "-0.01"],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("boolean literals", () => {
    it.each([
      ["true", "true"],
      ["FALSE", "false"],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("string literals", () => {
    it.each([
      ['""', '""'],
      ['"hello"', '"hello"'],
      ['"你好 🎲"', '"你好 🎲"'],
      ['"line\\nbreak"', '"line\\nbreak"'],
      ['"quote: \\" and slash: \\\\"', '"quote: \\" and slash: \\\\"'],
      ['"\\u4f60\\u597d"', '"你好"'],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("dice literals", () => {
    it.each([
      ["1d6", "1d6"],
      ["2D10", "2d10"],
      ["D10", "1d10"],
      ["3d4.5", "3d4"],
      ["3d(-1)", "3d0"],
      ["(-1)d3", "0d3"],
      ["(1e309 + 1e309)d6", "0d6"],
      ["((1e309 + 1e309) - (1e309 + 1e309))d6", "0d6"],
      ["DF", "1dF"],
      ["2DF", "2dF"],
      ["1dF", "1dF"],
      ["DC", "1dC"],
      ["2DC", "2dC"],
      ["1dC", "1dC"],
    ])("folds %s into %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("list literals", () => {
    it.each([
      ["[]", "[]"],
      ["[1, 2, 3]", "[1, 2, 3]"],
      ["[.1, 2e1, 3.0]", "[0.1, 20, 3]"],
      ["[1,2,3]", "[1, 2, 3]"],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("string set literals", () => {
    it.each([
      ["{}", "{}"],
      ['{"a", "b"}', '{"a", "b"}'],
      ['{ "a","b" }', '{"a", "b"}'],
      ['{"", "你好", "line\\nbreak"}', '{"", "你好", "line\\nbreak"}'],
      ['{true ? "a" : "b", "c"}', '{"a", "c"}'],
      ['{"a", "b", "a", "a"}', '{"a", "b"}'],
      ['{"a", "\\u0061"}', '{"a"}'],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("parenthesized atoms", () => {
    it.each([
      ["(((1)))", "1"],
      ["((true))", "true"],
      ["([1, 2])", "[1, 2]"],
      ['(("hello"))', '"hello"'],
      ['(({"a", "b"}))', '{"a", "b"}'],
    ])("removes redundant parentheses from %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("invalid lists", () => {
    it.each(["[true, false]", "[1, [1, 2], 3]"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
    it.each(["[1, 2, 3,]", "2d-1"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(ParserError)
    })
  })

  describe("invalid strings and string sets", () => {
    it.each(['["a"]', '"a" + "b"', "{1}", '{"a", 1}', '{"a" + "b"}'])("rejects %s during HIR construction", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
    it("rejects a trailing comma during parsing", () => {
      expect(() => buildHirOrThrow('{"a",}')).toThrow(ParserError)
    })
    it.each(['"unterminated', '"bad\\qescape"', '"line\nbreak"'])("rejects %s during lexing", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(LexerError)
    })
  })

  it("valid named expressions", () => {
    const x = buildHirOrThrow("1d6 + 2d4")
    const y = buildHirOrThrow("3 + 3d6")
    const folded = canonicalize("${x} + ${y}", (name) => {
      if (name === "x") return { kind: "value", value: x }
      if (name === "y") return { kind: "value", value: y }
      return { kind: "error", message: `未定义的命名表达式: ${name}` }
    })
    expect(folded).toBe("4d6 + 2d4 + 3")
  })

  it("invalid named expressions", () => {
    expect(() => canonicalize("${x} + 1")).toThrow(HIRBuilderError)
  })

  describe("invalid dice expressions", () => {
    it.each(["1dtrue", "falsed6", "1d[1,2,3]", "[3,4,5]d8"])("rejects %s", (input) => {
      expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
    })
  })
})
