import { describe, expect, it } from "vitest"
import { buildHirFromString, hirToString, rewriteHirForCrit } from "../../src/index.js"
import { buildHirOrThrow, canonicalize, emptyEnv, HIRBuilderError } from "../helper.js"

describe("Other HIR integration behavior", () => {
  describe("standard errors", () => {
    it.each([
      [
        "true ~ false",
        {
          kind: "lexer",
          location: {
            startOffset: 5,
            endOffset: 5,
            startLine: 1,
            endLine: 1,
            startColumn: 6,
          },
          message: '无法识别字符 "~"',
        },
      ],
      [
        "1 2",
        {
          kind: "parser",
          location: {
            startOffset: 2,
            endOffset: 2,
            startLine: 1,
            endLine: 1,
            startColumn: 3,
            endColumn: 3,
          },
          message: "存在无法解析的多余输入 “2”",
        },
      ],
      [
        "1 +",
        {
          kind: "parser",
          location: {
            startOffset: 3,
            endOffset: 3,
            startLine: 1,
            endLine: 1,
            startColumn: 4,
            endColumn: 4,
          },
          message: "此处期望 单独的原子表达式或骰子表达式，但遇到 输入结束",
        },
      ],
      [
        "1 + true",
        {
          kind: "hir",
          location: {
            startOffset: 2,
            endOffset: 2,
            startLine: 1,
            endLine: 1,
            startColumn: 3,
            endColumn: 3,
          },
          message: '二元运算符"+"不适用于数字类型与布尔类型',
        },
      ],
    ] as const)("standardizes the first error from %s", (input, expectedError) => {
      expect(buildHirFromString(input, emptyEnv)).toEqual({ ok: false, error: expectedError })
    })

    it("uses the start of an empty input as its parser error location", () => {
      const result = buildHirFromString("", emptyEnv)
      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "parser",
          location: {
            startOffset: 0,
            endOffset: 0,
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 1,
          },
        },
      })
    })

    it("places an EOF error after a trailing line break", () => {
      const result = buildHirFromString("1 +\n", emptyEnv)
      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "parser",
          location: {
            startOffset: 4,
            endOffset: 4,
            startLine: 2,
            endLine: 2,
            startColumn: 1,
            endColumn: 1,
          },
        },
      })
    })
  })

  describe("canonical round trips", () => {
    it.each([
      "!(1d6 > 2 && 2 < 3d6)",
      "1e309 - 1e309 + 1d6",
      "2d6r[<3]lc(1d4)lt2 + (1d8 > 4 ? tolist(1d10) : [1d12])",
      "(10d6xkh3dh3 + 5d20r[<2]r[>3]) * fmax(floor(3.5), 2 + 2 + 4, fmin([1,2,3] # [1,2,3])) + filter[>3]([1,2,3,4]) + fmax(tolist(1d10))",
    ])("keeps the canonical form stable for %s", (input) => {
      const first = canonicalize(input)
      expect(canonicalize(first)).toBe(first)
    })
  })

  it("rewrites critical dice without mutating the source HIR", () => {
    const source = buildHirOrThrow("1d6 + [2d8]")
    const before = hirToString(source)

    const rewritten = rewriteHirForCrit(source)

    expect(rewritten).not.toBe(source)
    expect(hirToString(rewritten)).toBe("2d6 + [4d8]")
    expect(hirToString(source)).toBe(before)
  })

  it.each([
    ['@crit(1d2 = 1 ? "a" : "b")', '2d2 = 1 ? "a" : "b"'],
    ['@crit(1d2 = 1 ? {"a"} : {"b"})', '2d2 = 1 ? {"a"} : {"b"}'],
    ['@crit({1d2 = 1 ? "a" : "b"})', '{2d2 = 1 ? "a" : "b"}'],
    ['@crit({1d2 = 1 ? "a" : "b"} | {1d4 = 1 ? "c" : "d"})', '{2d2 = 1 ? "a" : "b"} | {2d4 = 1 ? "c" : "d"}'],
    ['@crit((1d2 = 1 ? "a" : "b") in {1d4 = 1 ? "a" : "c"})', '(2d2 = 1 ? "a" : "b") in {2d4 = 1 ? "a" : "c"}'],
  ])("rewrites critical dice inside string values in %s", (input, expected) => {
    expect(canonicalize(input)).toBe(expected)
  })

  it("resolves every named-expression occurrence without mutating the resolved HIR", () => {
    const resolved = buildHirOrThrow("1d6 + 2d8")
    let calls = 0

    const result = canonicalize("${x} + ${x}", (name) => {
      calls += 1
      return name === "x"
        ? { kind: "value", value: resolved }
        : { kind: "error", message: `未定义的命名表达式: ${name}` }
    })

    expect(calls).toBe(2)
    expect(result).toBe("2d6 + 4d8")
    expect(hirToString(resolved)).toBe("1d6 + 2d8")
  })

  describe("function argument shapes", () => {
    it.each(["sum([1, 2], 3)", "floor([1, 2], 3)", "filter[>1]([1, 2], 3)", "fmax([1, 2], true)"])(
      "rejects mixed list arguments in %s",
      (input) => {
        expect(() => buildHirOrThrow(input)).toThrow(HIRBuilderError)
      }
    )

    it.each([
      ["fmin([1d6, 2], -1)", "[]"],
      ["fmin([1d6, 2], 1e309)", "[]"],
      ["fmax([1d6, 2], 2)", "[1d6, 2]"],
    ])("normalizes a constant selection count in %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })

  describe("case-insensitive keywords", () => {
    it.each([
      ["FMAX(1, 2) + 2D6KH1", "2d6kh + 2"],
      ["FILTER[>1]([1, 2, 3])", "[2, 3]"],
      ["@CRIT(1D6)", "2d6"],
    ])("canonicalizes %s as %s", (input, expected) => {
      expect(canonicalize(input)).toBe(expected)
    })
  })
})
