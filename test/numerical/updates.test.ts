import { describe, expect, it } from "vitest"
import { NumericalSystem } from "../../src/index.js"
import type { EntryInfo, ExpressionInfo, ResourceInfo, StateInfo } from "../../src/index.js"

function fixture() {
  const system = new NumericalSystem()
  const initial = system.getDraft()
  initial.createState({ name: "启用", active: true }, "")
  initial.createEntry({ name: "角色", active: "${.启用}" }, "")
  initial.createEntry({ name: "属性" }, ".角色")
  initial.createExpression({ name: "力量", source: "3 + 2", isConstant: true }, ".属性", "角色")
  initial.createResource({ name: "生命值", current: 8, limit: "10", nonNegative: true }, "角色")
  initial.createState({ name: "中毒", active: false }, "角色")
  const entry = initial.resolvePath("角色")
  const expression = initial.resolvePath("角色.属性.力量")
  const resource = initial.resolvePath("角色.生命值")
  const state = initial.resolvePath("角色.中毒")
  if (
    entry.kind !== "entry" ||
    expression.kind !== "definition" ||
    resource.kind !== "resource" ||
    state.kind !== "state"
  )
    throw new Error("Unexpected fixture node kinds")
  initial.commit()
  return { system, draft: system.getDraft(), entry, expression, resource, state }
}

describe("NumericalShadow partial updates", () => {
  it("updates only supplied fields and isolates all four node kinds until commit", () => {
    const { system, draft, entry, expression, resource, state } = fixture()
    const entryPatch: Partial<EntryInfo> = { active: "false" }
    const expressionPatch: Partial<ExpressionInfo> = { source: "6 * 2" }
    const resourcePatch: Partial<ResourceInfo> = { current: 0, nonNegative: false }
    const statePatch: Partial<StateInfo> = { active: true }
    draft.setEntry(entryPatch, "角色")
    draft.setExpression(expressionPatch, ".力量", "角色.属性")
    draft.setResource(resourcePatch, ".#.生命值", "角色.属性")
    draft.setState(statePatch, "角色.中毒")
    expect(draft.resolvePath("角色")).toMatchObject({
      id: entry.id,
      name: entry.name,
      entryId: entry.entryId,
      children: entry.children,
      activeCache: { kind: "value", value: { value: { value: false } } },
    })
    expect(draft.resolvePath("角色.属性.力量")).toMatchObject({
      id: expression.id,
      name: expression.name,
      isConstant: true,
      source: "6 * 2",
      sourceCache: { kind: "value", value: { value: { value: 12 } } },
    })
    expect(draft.resolvePath("角色.生命值")).toMatchObject({
      id: resource.id,
      current: 0,
      nonNegative: false,
      limit: "10",
      limitCache: resource.limitCache,
    })
    expect(draft.resolvePath("角色.中毒")).toMatchObject({ id: state.id, name: state.name, active: true })
    for (const node of [entry, expression, resource, state]) {
      expect(draft.get(node.id)).not.toBe(node)
      expect(system.get(node.id)).toBe(node)
    }
    expect(entry.active).toBe("${.启用}")
    expect(expression.source).toBe("3 + 2")
    expect(resource.current).toBe(8)
    expect(state.active).toBe(false)
    draft.commit()
    expect(system.createResolver("角色")(".中毒")).toMatchObject({ value: { value: { value: true } } })
    expect(system.createResolver("角色.属性")(".力量")).toMatchObject({ value: { value: { value: 12 } } })
  })

  it.each([
    ["setEntry", "角色.属性", "能力"],
    ["setExpression", "角色.属性.力量", "肌力"],
    ["setResource", "角色.生命值", "HP"],
    ["setState", "角色.中毒", "毒素"],
  ] as const)("renames through %s while preserving identity, ownership, and base indexes", (method, path, name) => {
    const { system, draft } = fixture()
    const original = system.resolvePath(path)
    const ownerPath = path.slice(0, path.lastIndexOf("."))
    const owner = system.resolvePath(ownerPath)
    if (owner.kind !== "entry") throw new Error("Expected entry")
    const renamedPath = `${ownerPath}.${name}`
    draft[method]({ name }, path)
    expect(draft.resolvePath(renamedPath)).toMatchObject({ id: original.id, entryId: original.entryId, name })
    expect(() => draft.resolvePath(path)).toThrow("路径不存在")
    expect(system.resolvePath(path)).toBe(original)
    expect(owner.children.get(original.name)).toBe(original.id)
    expect(owner.children.has(name)).toBe(false)
    if (method === "setEntry") {
      expect(draft.resolvePath(`${renamedPath}.力量`).entryId).toBe(original.id)
    }
    draft[method]({ name: `${name}新` }, renamedPath)
    expect(() => draft.resolvePath(renamedPath)).toThrow("路径不存在")
    draft.commit()
    expect(system.resolvePath(`${renamedPath}新`).id).toBe(original.id)
    expect(() => system.resolvePath(path)).toThrow("路径不存在")
  })

  it("copies entry children before subsequent insertions and discards all edits together", () => {
    const { system, draft, entry } = fixture()
    draft.setEntry({ name: "英雄", active: "false" }, "角色")
    draft.createState({ name: "燃烧", active: true }, ".", "英雄")
    draft.setExpression({ source: "9" }, "英雄.属性.力量")
    draft.setResource({ limit: "3" }, "英雄.生命值")
    draft.setState({ active: true }, "英雄.中毒")
    expect(entry.children.has("燃烧")).toBe(false)
    expect(() => system.resolvePath("英雄")).toThrow("路径不存在")
    draft.discard()
    expect(system.resolvePath("角色")).toBe(entry)
    expect(system.resolvePath("角色.属性.力量")).toMatchObject({ source: "3 + 2" })
    expect(system.resolvePath("角色.生命值")).toMatchObject({ limit: "10" })
    expect(system.resolvePath("角色.中毒")).toMatchObject({ active: false })
  })

  it("clears optional conditions and limits only when explicitly supplied", () => {
    const { system, draft, entry, resource } = fixture()
    draft.setEntry({ name: "角色" }, "角色")
    draft.setResource({ current: 20 }, "角色.生命值")
    expect(draft.resolvePath("角色")).toMatchObject({ active: entry.active })
    expect(draft.resolvePath("角色.生命值")).toMatchObject({ limit: "10", limitCache: resource.limitCache })
    draft.setEntry({ active: undefined }, "角色")
    draft.setResource({ limit: undefined }, "角色.生命值")
    expect(draft.resolvePath("角色")).toMatchObject({ active: undefined, activeCache: undefined })
    expect(draft.resolvePath("角色.生命值")).toMatchObject({ limit: undefined, limitCache: undefined, current: 20 })
    expect(draft.createResolver("角色")(".生命值")).toMatchObject({ value: { value: { value: 20 } } })
    expect(entry.activeCache?.kind).toBe("value")
    expect(resource.limitCache?.kind).toBe("value")
    draft.commit()
    expect(system.createResolver("角色")(".生命值")).toMatchObject({ value: { value: { value: 20 } } })
  })

  it("recompiles definition source and isConstant changes, including errors and repairs", () => {
    const { draft, expression } = fixture()
    const resolver = draft.createResolver("角色.属性")
    draft.setExpression({ source: "1d6" }, "角色.属性.力量")
    expect(resolver(".力量")).toEqual({ kind: "error", message: "表达式 力量 必须折叠为常量" })
    draft.setExpression({ isConstant: false }, "角色.属性.力量")
    expect(resolver(".力量").kind).toBe("value")
    draft.setExpression({ source: "1 +" }, "角色.属性.力量")
    expect(resolver(".力量").kind).toBe("error")
    draft.setExpression({ name: "加值", source: "${.#.生命值} + 1", isConstant: true }, "角色.属性.力量")
    expect(resolver(".加值")).toMatchObject({ kind: "value", value: { value: { value: 9 } } })
    expect(expression.source).toBe("3 + 2")
    expect(expression.sourceCache).toMatchObject({ kind: "value", value: { value: { value: 5 } } })
  })

  it("refreshes active and limit caches while preserving the failed-limit fallback", () => {
    const { draft } = fixture()
    draft.setEntry({ active: "${.启用} && false" }, "角色")
    expect(draft.resolvePath("角色")).toMatchObject({
      activeCache: { kind: "value", value: { value: { value: false } } },
    })
    draft.setEntry({ active: "1" }, "角色")
    expect(draft.resolvePath("角色")).toMatchObject({ activeCache: { kind: "error" } })
    const resolver = draft.createResolver("角色")
    draft.setResource({ limit: "3", current: 8 }, "角色.生命值")
    expect(resolver(".生命值")).toMatchObject({ value: { value: { value: 3 } } })
    draft.setResource({ limit: "${不存在}", current: -5, nonNegative: false }, "角色.生命值")
    expect(draft.resolvePath("角色.生命值")).toMatchObject({ limitCache: { kind: "error" } })
    expect(resolver(".生命值")).toMatchObject({ value: { value: { value: -5 } } })
    draft.setResource({ nonNegative: true }, "角色.生命值")
    expect(resolver(".生命值")).toMatchObject({ value: { value: { value: 0 } } })
    draft.setResource({ current: 8, limit: "4" }, "角色.生命值")
    expect(resolver(".生命值")).toMatchObject({ value: { value: { value: 4 } } })
  })

  it.each(["", "a.b", "#", "a b", "${x}", undefined])(
    "rejects invalid rename %j before applying other fields",
    (name) => {
      const { system, draft, entry, expression, resource, state } = fixture()
      expect(() => draft.setEntry({ name, active: "false" }, "角色")).toThrow("非法名称")
      expect(() => draft.setExpression({ name, source: "9" }, "角色.属性.力量")).toThrow("非法名称")
      expect(() => draft.setResource({ name, current: 1 }, "角色.生命值")).toThrow("非法名称")
      expect(() => draft.setState({ name, active: true }, "角色.中毒")).toThrow("非法名称")
      for (const node of [entry, expression, resource, state]) expect(draft.get(node.id)).toBe(node)
      draft.commit()
      for (const node of [entry, expression, resource, state]) expect(system.get(node.id)).toBe(node)
    }
  )

  it("rejects sibling name conflicts without partially applying other fields", () => {
    const { draft, entry, resource, state } = fixture()
    expect(() => draft.setEntry({ name: "生命值", active: "false" }, "角色.属性")).toThrow("名称冲突")
    expect(() => draft.setResource({ name: "中毒", current: 1 }, "角色.生命值")).toThrow("名称冲突")
    expect(() => draft.setState({ name: "属性", active: true }, "角色.中毒")).toThrow("名称冲突")
    expect(draft.get(entry.id)).toBe(entry)
    expect(draft.get(resource.id)).toBe(resource)
    expect(draft.get(state.id)).toBe(state)
  })

  it("rejects undefined required fields before renaming or changing other fields", () => {
    const { draft, expression, resource, state } = fixture()
    expect(() => draft.setExpression({ name: "加值", source: undefined }, "角色.属性.力量")).toThrow(
      "源文本必须是字符串"
    )
    expect(() => draft.setExpression({ source: "9", isConstant: undefined }, "角色.属性.力量")).toThrow("isConstant")
    expect(() => draft.setResource({ name: "HP", current: undefined }, "角色.生命值")).toThrow("数值必须是数字")
    expect(() => draft.setResource({ current: 1, nonNegative: undefined }, "角色.生命值")).toThrow("nonNegative")
    expect(() => draft.setState({ name: "毒素", active: undefined }, "角色.中毒")).toThrow("状态必须是布尔值")
    for (const node of [expression, resource, state]) expect(draft.get(node.id)).toBe(node)
  })

  it("treats empty patches as no-ops but still checks path and node kind", () => {
    const { draft, entry, expression, resource, state } = fixture()
    draft.setEntry({}, "角色")
    draft.setExpression({}, "角色.属性.力量")
    draft.setResource({}, "角色.生命值")
    draft.setState({}, "角色.中毒")
    for (const node of [entry, expression, resource, state]) expect(draft.get(node.id)).toBe(node)
    expect(() => draft.setEntry({}, "角色.中毒")).toThrow("指定路径不是词条")
    expect(() => draft.setExpression({}, "角色.生命值")).toThrow("指定路径不是表达式定义")
    for (const method of ["setEntry", "setExpression", "setResource", "setState"] as const) {
      expect(() => draft[method]({}, "不存在")).toThrow("路径不存在")
    }
  })

  it("preserves internal fields when structurally compatible input contains node metadata", () => {
    const { draft, state } = fixture()
    const patch = { active: true, id: "replacement", entryId: "missing", kind: "entry", sourceCache: undefined }
    draft.setState(patch, "角色.中毒")
    expect(draft.resolvePath("角色.中毒")).toEqual({ ...state, active: true })
    expect(draft.get("replacement")).toBeUndefined()
  })

  it("preserves the nameless root and can compile its condition in the root context", () => {
    const { system, draft } = fixture()
    const root = system.root
    expect(() => draft.setEntry({ name: "新根", active: "false" }, "")).toThrow("不能重命名根词条")
    expect(draft.root).toBe(root)
    draft.setEntry({ name: "", active: "${.启用}" }, "")
    expect(draft.root).toMatchObject({
      id: root.id,
      name: "",
      entryId: "",
      activeCache: { kind: "value", value: { value: { value: true } } },
    })
    expect(root.active).toBeUndefined()
  })
})
