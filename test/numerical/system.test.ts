import { describe, expect, it } from "vitest"
import { buildHirFromString, hirToString, NumericalSystem } from "../../src/index.js"
import type { NumericalNode } from "../../src/index.js"
import { buildHir } from "../../src/hir/builder.js"
import { lexDice } from "../../src/syntax/lexer.js"
import { parseDiceTokens } from "../../src/syntax/parser.js"
import { buildHirOrThrow, evaluateHirOrThrow, numericResult, evaluatedValue, sequenceRandom } from "../helper.js"

function nodeAt<K extends NumericalNode["kind"]>(
  view: { resolvePath(path: string): NumericalNode },
  path: string,
  kind: K
): Extract<NumericalNode, { kind: K }> {
  const node = view.resolvePath(path)
  if (node.kind !== kind) throw new Error(`Expected ${kind} at ${path}, received ${node.kind}`)
  return node as Extract<NumericalNode, { kind: K }>
}

function fixture() {
  const system = new NumericalSystem()
  const draft = system.getDraft()
  draft.createEntry({ name: "角色" }, "")
  draft.createEntry({ name: "属性" }, "角色")
  draft.createExpression({ name: "力量", source: "3 + 2", isConstant: false }, "角色.属性")
  draft.createResource({ nonNegative: true, name: "生命值", current: 8, limit: "10" }, "角色")
  draft.createState({ name: "中毒", active: false }, "角色")
  const character = nodeAt(draft, "角色", "entry")
  const attributes = nodeAt(draft, "角色.属性", "entry")
  const strength = nodeAt(draft, "角色.属性.力量", "definition")
  const hp = nodeAt(draft, "角色.生命值", "resource")
  const poisoned = nodeAt(draft, "角色.中毒", "state")
  return { system, draft, character, attributes, strength, hp, poisoned }
}

describe("NumericalSystem and NumericalShadow", () => {
  it("previews all four entity kinds and publishes their IDs and ownership on commit", () => {
    const { system, draft, character, attributes, strength, hp, poisoned } = fixture()
    expect(system.root).toMatchObject({ name: "", entryId: "", kind: "entry" })
    expect(draft.rootId).toBe(system.rootId)
    expect(system.root.children.size).toBe(0)
    expect(() => system.resolvePath("角色")).toThrow("路径不存在")
    expect(character.entryId).toBe(system.rootId)
    expect(attributes.entryId).toBe(character.id)
    expect(strength.entryId).toBe(attributes.id)
    expect(hp.entryId).toBe(character.id)
    expect(poisoned.entryId).toBe(character.id)
    expect(strength.sourceCache).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: 5 } },
    })
    expect(hp.limitCache).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: 10 } },
    })
    const nodes = [draft.root, character, attributes, strength, hp, poisoned]
    expect(new Set(nodes.map((node) => node.id)).size).toBe(6)
    for (const node of nodes) {
      expect(node.id).toMatch(/^[\w-]{21}$/)
      expect(draft.get(node.id)).toBe(node)
      if (node.id !== system.rootId) expect(system.get(node.id)).toBeUndefined()
    }
    draft.commit()
    for (const node of nodes) expect(system.get(node.id)).toBe(node)
    expect(system.resolvePath("角色.属性.力量")).toBe(strength)
    expect(system.resolvePath("角色.生命值")).toBe(hp)
    expect(system.resolvePath("角色.中毒")).toBe(poisoned)
  })

  it.each(["preview", "committed"])("resolves absolute, relative, and parent paths in the %s view", (mode) => {
    const { system, draft, character, strength, hp, poisoned } = fixture()
    if (mode === "committed") draft.commit()
    const view = mode === "committed" ? system : draft
    expect(view.resolvePath("角色.属性.力量")).toBe(strength)
    expect(view.resolvePath(".力量", "角色.属性")).toBe(strength)
    expect(view.resolvePath(".属性.力量", "角色")).toBe(strength)
    expect(view.resolvePath(".#.生命值", "角色.属性")).toBe(hp)
    expect(view.resolvePath("角色.中毒", "角色.属性")).toBe(poisoned)
    expect(view.resolvePath(".#.#.角色.属性.力量", "角色.属性")).toBe(strength)
    expect(view.resolvePath("", "角色")).toBe(view.root)
    expect(view.resolvePath(".", "角色")).toBe(character)
    expect(view.resolvePath(".#", "角色")).toBe(view.root)
  })

  it("does not fall back from relative paths to the root", () => {
    const { draft } = fixture()
    draft.createResource({ nonNegative: true, name: "全局值", current: 10 }, "")
    expect(draft.resolvePath("全局值", "角色")).toMatchObject({ current: 10 })
    expect(() => draft.resolvePath(".全局值", "角色")).toThrow("路径不存在")
  })

  it("reports invalid paths, missing entries, and non-directory segments", () => {
    const { draft } = fixture()
    for (const path of ["..角色", "角色..属性", "角色.", "角 色", "${角色}", "角色.#属性"]) {
      expect(() => draft.resolvePath(path)).toThrow("非法路径")
    }
    expect(() => draft.resolvePath(".#")).toThrow("越过根词条")
    expect(() => draft.resolvePath("角色.生命值.current")).toThrow("中间段不是词条")
    expect(() => draft.resolvePath("不存在")).toThrow("路径不存在")
    expect(() => draft.createResolver("角色.生命值")).toThrow("当前路径不是词条")
    expect(() => draft.createResolver(".角色")).toThrow("必须使用绝对路径")
    expect(() => draft.createResolver("不存在")).toThrow("路径不存在")
  })

  it("rejects invalid creations without changing the parent indexes", () => {
    const { draft, character, hp } = fixture()
    const rootChildren = new Map(draft.root.children)
    const children = new Map(character.children)
    expect(() => draft.createState({ name: "生命值", active: true }, "角色")).toThrow("名称冲突")
    expect(() => draft.createResource({ nonNegative: true, name: "角色", current: 1 }, "")).toThrow("名称冲突")
    expect(() => draft.createEntry({ name: "子词条" }, "missing")).toThrow("路径不存在")
    expect(() => draft.createResource({ nonNegative: true, name: "数值", current: 1 }, "角色.生命值")).toThrow(
      "所属路径不是词条"
    )
    for (const name of ["", "a.b", "#", "a#b", "a b", "${a}"]) {
      expect(() => draft.createEntry({ name }, "")).toThrow("非法名称")
    }
    expect(draft.root.children).toEqual(rootChildren)
    expect(character.children).toEqual(children)
    expect(draft.resolvePath("角色.生命值")).toBe(hp)
    expect(() => draft.createResource({ nonNegative: true, name: "生命值", current: 1 }, "")).not.toThrow()
  })

  it("copies an existing parent's index without exposing new children before commit", () => {
    const { system, draft, character, hp } = fixture()
    draft.commit()
    const next = system.getDraft()
    next.createState({ name: "燃烧", active: true }, "角色")
    const nextCharacter = nodeAt(next, "角色", "entry")
    expect(nextCharacter).not.toBe(character)
    expect(nextCharacter.children).not.toBe(character.children)
    expect(character.children.has("燃烧")).toBe(false)
    expect(next.resolvePath("角色.生命值")).toBe(hp)
    expect(() => system.resolvePath("角色.燃烧")).toThrow("路径不存在")
    next.commit()
    expect(system.resolvePath("角色.燃烧")).toMatchObject({ kind: "state", active: true })
    expect(system.resolvePath("角色.生命值")).toBe(hp)
  })

  it("discards new nodes and copied indexes without publishing them", () => {
    const { system, draft, character } = fixture()
    draft.commit()
    const next = system.getDraft()
    next.createState({ name: "燃烧", active: true }, "角色")
    const state = next.resolvePath("角色.燃烧")
    next.discard()
    expect(system.resolvePath("角色")).toBe(character)
    expect(character.children.has("燃烧")).toBe(false)
    expect(system.get(state.id)).toBeUndefined()
    expect(() => next.commit()).toThrow("Shadow 已关闭")
  })

  it.each(["commit", "discard"] as const)("rejects all creation methods and commits after %s", (close) => {
    const system = new NumericalSystem()
    const draft = system.getDraft()
    draft[close]()
    expect(() => draft.createEntry({ name: "角色" }, "")).toThrow("Shadow 已关闭")
    expect(() => draft.createExpression({ name: "力量", source: "5", isConstant: true }, "")).toThrow("Shadow 已关闭")
    expect(() => draft.createResource({ nonNegative: true, name: "生命值", current: 8 }, "")).toThrow("Shadow 已关闭")
    expect(() => draft.createState({ name: "中毒", active: true }, "")).toThrow("Shadow 已关闭")
    expect(() => draft.setState({ active: true }, "中毒")).toThrow("Shadow 已关闭")
    expect(() => draft.setResource({ current: 1 }, "生命值")).toThrow("Shadow 已关闭")
    expect(() => draft.setEntry({ active: "false" }, "")).toThrow("Shadow 已关闭")
    expect(() => draft.setExpression({ source: "1" }, "力量")).toThrow("Shadow 已关闭")
    expect(() => draft.commit()).toThrow("Shadow 已关闭")
    expect(system.root.children.size).toBe(0)
  })

  it("keeps pre-existing resolvers current when their context entries are copied", () => {
    const system = new NumericalSystem()
    const draft = system.getDraft()
    const rootResolver = draft.createResolver("")
    draft.createState({ name: "全局状态", active: true }, "")
    expect(rootResolver(".全局状态")).toMatchObject({ kind: "value" })
    draft.createEntry({ name: "角色" }, "")
    draft.commit()
    const systemResolver = system.createResolver("角色")
    const next = system.getDraft()
    const draftResolver = next.createResolver("角色")
    next.createState({ name: "中毒", active: true }, "角色")
    const expected = { kind: "value", value: { kind: "boolean", value: { kind: "constant", value: true } } }
    expect(draftResolver(".中毒")).toEqual(expected)
    expect(systemResolver(".中毒").kind).toBe("error")
    next.commit()
    expect(systemResolver(".中毒")).toEqual(expected)
  })

  it("isolates repeated state and resource updates until commit and refreshes existing resolvers", () => {
    const { system, draft, character, hp, poisoned } = fixture()
    draft.commit()
    const next = system.getDraft()
    const preview = next.createResolver("角色")
    const published = system.createResolver("角色")

    next.setState({ active: true }, ".中毒", "角色")
    next.setResource({ current: 20 }, ".#.生命值", "角色.属性")
    expect(next.resolvePath("角色.中毒")).not.toBe(poisoned)
    expect(next.resolvePath("角色.生命值")).not.toBe(hp)
    expect(preview(".中毒")).toEqual({
      kind: "value",
      value: { kind: "boolean", value: { kind: "constant", value: true } },
    })
    expect(preview(".生命值")).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: 10 } },
    })
    expect(nodeAt(next, "角色.生命值", "resource").current).toBe(20)

    next.setState({ active: false }, "角色.中毒")
    next.setResource({ current: 0 }, "角色.生命值")
    expect(preview(".中毒")).toMatchObject({ value: { value: { value: false } } })
    expect(preview(".生命值")).toMatchObject({ value: { value: { value: 0 } } })
    next.setState({ active: true }, "角色.中毒")
    next.setResource({ current: -3 }, "角色.生命值")
    expect(preview(".生命值")).toMatchObject({ value: { value: { value: 0 } } })
    expect(published(".中毒")).toMatchObject({ value: { value: { value: false } } })
    expect(published(".生命值")).toMatchObject({ value: { value: { value: 8 } } })
    expect(poisoned.active).toBe(false)
    expect(hp.current).toBe(8)
    expect(next.resolvePath("角色")).toBe(character)

    next.commit()
    expect(published(".中毒")).toMatchObject({ value: { value: { value: true } } })
    expect(published(".生命值")).toMatchObject({ value: { value: { value: 0 } } })
    expect(nodeAt(system, "角色.中毒", "state")).toMatchObject({ id: poisoned.id, active: true })
    expect(nodeAt(system, "角色.生命值", "resource")).toMatchObject({ id: hp.id, current: -3 })
    expect(nodeAt(system, "角色.生命值", "resource").limitCache).toBe(hp.limitCache)
    expect(character.children.get("生命值")).toBe(hp.id)
    expect(character.children.get("中毒")).toBe(poisoned.id)
  })

  it("updates nodes created in the same draft before compiling references to them", () => {
    const { system, draft, hp, poisoned } = fixture()
    draft.setState({ active: true }, "角色.中毒")
    draft.setResource({ current: 4 }, "角色.生命值")
    draft.createExpression({ name: "结果", source: "${.中毒} ? ${.生命值} : 0", isConstant: true }, "角色")
    expect(hirToString(buildHirOrThrow("${角色.结果}", draft.createResolver("")))).toBe("4")
    expect(draft.get(hp.id)).toBe(hp)
    expect(draft.get(poisoned.id)).toBe(poisoned)
    expect(system.get(hp.id)).toBeUndefined()
    draft.commit()
    expect(system.resolvePath("角色.生命值")).toMatchObject({ current: 4 })
    expect(system.resolvePath("角色.中毒")).toMatchObject({ active: true })
  })

  it("discards changes to existing states and resources", () => {
    const { system, draft, hp, poisoned } = fixture()
    draft.commit()
    const next = system.getDraft()
    next.setState({ active: true }, "角色.中毒")
    next.setResource({ current: 1 }, "角色.生命值")
    next.discard()
    expect(system.resolvePath("角色.中毒")).toBe(poisoned)
    expect(system.resolvePath("角色.生命值")).toBe(hp)
    expect(poisoned.active).toBe(false)
    expect(hp.current).toBe(8)
    expect(() => next.commit()).toThrow("Shadow 已关闭")
  })

  it("rejects missing paths and incorrect node kinds without staging updates", () => {
    const { system, draft, character, attributes, strength, hp, poisoned } = fixture()
    draft.commit()
    const next = system.getDraft()
    expect(() => next.setState({ active: true }, "不存在")).toThrow("路径不存在")
    expect(() => next.setResource({ current: 1 }, "不存在")).toThrow("路径不存在")
    for (const path of ["角色", "角色.属性.力量", "角色.生命值"]) {
      expect(() => next.setState({ active: true }, path)).toThrow("指定路径不是状态")
    }
    for (const path of ["角色", "角色.属性.力量", "角色.中毒"]) {
      expect(() => next.setResource({ current: 1 }, path)).toThrow("指定路径不是资源")
    }
    next.commit()
    for (const node of [character, attributes, strength, hp, poisoned]) expect(system.get(node.id)).toBe(node)
  })

  it.each([
    { current: 20, nonNegative: true, limit: "10", expected: 10 },
    { current: -3, nonNegative: true, limit: "10", expected: 0 },
    { current: -3, nonNegative: false, limit: "10", expected: -3 },
    { current: 20, nonNegative: false, limit: undefined, expected: 20 },
    { current: -3, nonNegative: true, limit: undefined, expected: 0 },
    { current: 8, nonNegative: false, limit: "-2", expected: -2 },
    { current: -8, nonNegative: false, limit: "-2", expected: -8 },
    { current: 8, nonNegative: true, limit: "inf", expected: 8 },
    { current: 8, nonNegative: true, limit: "0", expected: 0 },
  ])("resolves resource constraints without changing the stored value: %j", ({ expected, ...input }) => {
    const draft = new NumericalSystem().getDraft()
    draft.createResource({ name: "数值", ...input }, "")
    expect(draft.createResolver("")("数值")).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: expected } },
    })
    expect(nodeAt(draft, "数值", "resource").current).toBe(input.current)
    draft.createExpression({ name: "引用", source: "${数值} + 1", isConstant: true }, "")
    expect(draft.createResolver("")("引用")).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: expected + 1 } },
    })
  })

  it.each(["1 +", "true", "1d6", "${不存在}"])(
    "ignores a failed resource limit while retaining nonnegative constraints: %s",
    (limit) => {
      const draft = new NumericalSystem().getDraft()
      draft.createResource({ name: "生命值", current: 8, nonNegative: true, limit }, "")
      const resource = nodeAt(draft, "生命值", "resource")
      const resolver = draft.createResolver("")
      expect(resource.limitCache?.kind).toBe("error")
      const limitError = resource.limitCache
      expect(resolver("生命值")).toEqual({
        kind: "value",
        value: { kind: "number", value: { kind: "constant", value: 8 } },
      })
      expect(buildHirFromString("${生命值} + 1", resolver)).toEqual({
        ok: true,
        value: { kind: "number", value: { kind: "constant", value: 9 } },
      })
      expect(resource.current).toBe(8)
      draft.setResource({ current: -3 }, "生命值")
      expect(resolver("生命值")).toEqual({
        kind: "value",
        value: { kind: "number", value: { kind: "constant", value: 0 } },
      })
      expect(resource.current).toBe(-3)
      expect(resource.limitCache).toBe(limitError)
    }
  )

  it("adapts expressions, resources, and states directly to buildHir", () => {
    const { system, draft } = fixture()
    draft.commit()
    const tokens = lexDice("${.中毒} ? 0 : ${.生命值} + ${.属性.力量}")
    if (!tokens.ok) throw new Error("Unexpected lexer failure")
    const cst = parseDiceTokens(tokens.value)
    if (!cst.ok) throw new Error("Unexpected parser failure")
    expect(buildHir(cst.value, system.createResolver("角色"))).toEqual({
      ok: true,
      value: { kind: "number", value: { kind: "constant", value: 13 } },
    })
  })

  it("compiles nested references relative to each definition's owner before and after commit", () => {
    const { system, draft } = fixture()
    draft.createResource({ nonNegative: true, name: "加值", current: 2 }, "角色.属性")
    draft.createResource({ nonNegative: true, name: "加值", current: 100 }, "角色")
    draft.createExpression(
      { name: "攻击", source: "${.力量} + ${.加值} + ${.#.生命值}", isConstant: true },
      "角色.属性"
    )
    draft.createExpression({ name: "结果", source: "${.属性.攻击} * 2", isConstant: true }, "角色")
    expect(hirToString(buildHirOrThrow("${角色.结果}", draft.createResolver("")))).toBe("30")
    draft.commit()
    expect(hirToString(buildHirOrThrow("${角色.结果}", system.createResolver("")))).toBe("30")
  })

  it("preserves dice in the creation-time HIR cache until explicit evaluation", () => {
    const { system, draft } = fixture()
    draft.createExpression({ name: "伤害", source: "1d6 + ${.生命值}", isConstant: false }, "角色")
    const definition = nodeAt(draft, "角色.伤害", "definition")
    const cache = definition.sourceCache
    const before = buildHirOrThrow("${.伤害}", draft.createResolver("角色"))
    expect(hirToString(before)).toBe("1d6 + 8")
    expect(cache).toEqual({ kind: "value", value: before })
    draft.commit()
    expect(system.createResolver("角色")(".伤害")).toBe(cache)
    const random = sequenceRandom(4)
    const evaluated = evaluateHirOrThrow(before, { random: random.random })
    expect(numericResult(evaluatedValue(evaluated.output))).toBe(12)
    expect(random.calls()).toHaveLength(1)
  })

  it("returns explicit compilation results without overwriting an existing cache", () => {
    const { draft, strength } = fixture()
    const cached = strength.sourceCache
    const failure = draft.compileExpressionDefinition({ ...strength, source: "1 +" })
    expect(failure).toMatchObject({ kind: "error", message: expect.stringContaining("力量") })
    const repaired = draft.compileExpressionDefinition({ ...strength, source: "10" })
    expect(repaired).toEqual({ kind: "value", value: { kind: "number", value: { kind: "constant", value: 10 } } })
    expect(strength.sourceCache).toBe(cached)
    expect(draft.createResolver("角色.属性")(".力量")).toBe(cached)
  })

  it("retains dependency errors until caches are explicitly recompiled in dependency order", () => {
    const draft = new NumericalSystem().getDraft()
    draft.createExpression({ name: "内部", source: "${缺失值}", isConstant: false }, "")
    draft.createExpression({ name: "外部", source: "${内部} + 1", isConstant: false }, "")
    const inner = nodeAt(draft, "内部", "definition")
    const outer = nodeAt(draft, "外部", "definition")
    expect(inner.sourceCache).toMatchObject({ kind: "error", message: expect.stringContaining("缺失值") })
    expect(outer.sourceCache).toMatchObject({ kind: "error", message: expect.stringContaining("缺失值") })
    draft.createResource({ nonNegative: true, name: "缺失值", current: 2 }, "")
    expect(draft.createResolver("")("外部").kind).toBe("error")
    inner.sourceCache = draft.compileExpressionDefinition(inner)
    outer.sourceCache = draft.compileExpressionDefinition(outer)
    expect(draft.createResolver("")("外部")).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: 3 } },
    })
  })

  it.each(["1 + 2", "true || false", "[1 + 2, 4]", '{"a", "b"}', '"text"'])(
    "accepts folded constants at creation: %s",
    (source) => {
      const draft = new NumericalSystem().getDraft()
      draft.createExpression({ name: "常量", source, isConstant: true }, "")
      expect(draft.createResolver("")("常量").kind).toBe("value")
    }
  )

  it.each(["1d6", "1d6 > 3", "[1d6]", '{1d6 > 3 ? "a" : "b"}'])(
    "stores an error for nonconstant HIR when isConstant is required: %s",
    (source) => {
      const draft = new NumericalSystem().getDraft()
      draft.createExpression({ name: "常量", source, isConstant: true }, "")
      const result = draft.createResolver("")("常量")
      expect(result).toEqual({ kind: "error", message: "表达式 常量 必须折叠为常量" })
      expect(nodeAt(draft, "常量", "definition").sourceCache).toBe(result)
    }
  )

  it("compiles active conditions and resource limits in their owning entry's context", () => {
    const { system, draft } = fixture()
    draft.createState({ name: "中毒", active: true }, "角色.属性")
    draft.createResource({ nonNegative: true, name: "生命值", current: 100 }, "角色.属性")
    draft.createEntry({ name: "效果", active: "!${.中毒}" }, "角色.属性")
    draft.createResource(
      { nonNegative: true, name: "护盾", current: 2, limit: "${.生命值} + ${.#.生命值}" },
      "角色.属性"
    )
    expect(nodeAt(draft, "角色.属性.效果", "entry").activeCache).toEqual({
      kind: "value",
      value: { kind: "boolean", value: { kind: "constant", value: false } },
    })
    const shield = nodeAt(draft, "角色.属性.护盾", "resource")
    expect(shield.limitCache).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: 108 } },
    })
    draft.commit()
    expect(nodeAt(system, "角色.属性.护盾", "resource").limitCache).toBe(shield.limitCache)
  })

  it("compiles omitted conditions and limits to true and infinity on explicit request", () => {
    const draft = new NumericalSystem().getDraft()
    draft.createEntry({ name: "角色" }, "")
    draft.createResource({ nonNegative: true, name: "生命值", current: 8 }, "角色")
    const character = nodeAt(draft, "角色", "entry")
    const hp = nodeAt(draft, "角色.生命值", "resource")
    expect(character.activeCache).toBeUndefined()
    expect(hp.limitCache).toBeUndefined()
    expect(draft.compileEntryActive(character)).toEqual({
      kind: "value",
      value: { kind: "boolean", value: { kind: "constant", value: true } },
    })
    expect(draft.compileResourceLimit(hp)).toEqual({
      kind: "value",
      value: { kind: "number", value: { kind: "constant", value: Infinity } },
    })
  })

  it.each([
    ["1", "必须是布尔值"],
    ["1d6 > 3", "必须折叠为常量"],
    ["true &&", "词条 效果"],
    ["${不存在}", "不存在"],
  ])("stores an active-condition error for %s", (active, message) => {
    const draft = new NumericalSystem().getDraft()
    draft.createEntry({ name: "效果", active }, "")
    expect(nodeAt(draft, "效果", "entry").activeCache).toMatchObject({
      kind: "error",
      message: expect.stringContaining(message),
    })
  })

  it.each([
    ["true", "必须是数值"],
    ["1d6", "必须折叠为常量"],
    ["1 +", "资源 生命值"],
    ["${不存在}", "不存在"],
  ])("stores a resource-limit error for %s", (limit, message) => {
    const draft = new NumericalSystem().getDraft()
    draft.createResource({ nonNegative: true, name: "生命值", current: 8, limit }, "")
    expect(nodeAt(draft, "生命值", "resource").limitCache).toMatchObject({
      kind: "error",
      message: expect.stringContaining(message),
    })
  })

  it("passes lookup and cached compilation errors through the existing HIR error interface", () => {
    const { draft } = fixture()
    draft.createExpression({ name: "语法错误", source: "1 +", isConstant: false }, "")
    draft.createExpression({ name: "类型错误", source: "true + 1", isConstant: false }, "")
    draft.createExpression({ name: "缺失引用", source: "${不存在}", isConstant: false }, "")
    const resolver = draft.createResolver("")
    for (const name of ["语法错误", "类型错误", "缺失引用", "不存在", "角色"]) {
      const result = buildHirFromString("${" + name + "}", resolver)
      expect(result).toMatchObject({ ok: false, error: { kind: "hir", message: expect.stringContaining(name) } })
    }
  })
})
