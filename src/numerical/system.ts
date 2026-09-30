import { nanoid } from "nanoid"
import { buildHirFromString } from "../hir/compiler.js"
import type { HirEnv, resolveNamedExpressionResult } from "../hir/types.js"
import type {
  Entry,
  EntryInfo,
  ExpressionDefinition,
  ExpressionInfo,
  NumericalNode,
  Resource,
  ResourceInfo,
  State,
  StateInfo,
} from "./types.js"
import { isConstant } from "./utils.js"

abstract class NumericalView {
  abstract readonly rootId: string
  abstract get(id: string): NumericalNode | undefined
  get root(): Entry {
    const root = this.get(this.rootId)
    if (!root || root.kind !== "entry") throw new Error(`根词条不存在：${this.rootId}`)
    return root
  }

  protected walk(path: string, current: Entry): NumericalNode {
    // special case: empty path means root, "." means current
    if (path === "") return this.root
    if (path === ".") return current

    const relative = path.startsWith(".")
    const segments = (relative ? path.slice(1) : path).split(".")
    if (segments.some((segment) => segment !== "#" && !this.isNameValid(segment))) throw new Error(`非法路径：${path}`)

    return segments.reduce<NumericalNode>(
      (node, segment) => {
        if (node.kind !== "entry") throw new Error(`路径中间段不是词条：${node.name}（${path}）`)
        if (segment === "#") {
          if (node.entryId === "") throw new Error(`路径越过根词条：${path}`)
          const parent = this.get(node.entryId)
          if (!parent || parent.kind !== "entry") throw new Error(`父词条不存在：${node.entryId}`)
          return parent
        } else {
          const childId = node.children.get(segment)
          const child = childId ? this.get(childId) : undefined
          if (!child) throw new Error(`路径不存在：${path}（未找到 ${segment}）`)
          return child
        }
      },
      relative ? current : this.root
    )
  }

  protected entryAt(path: string): Entry {
    if (path.startsWith(".")) throw new Error(`当前词条必须使用绝对路径：${path}`)
    const node = this.walk(path, this.root)
    if (node.kind !== "entry") throw new Error(`当前路径不是词条：${path}`)
    return node
  }

  protected resolverFor(currentId: string): HirEnv["resolveNamedExpression"] {
    return (path) => {
      try {
        const current = this.get(currentId)
        if (!current || current.kind !== "entry") throw new Error(`当前词条不存在：${currentId}`)
        const node = this.walk(path, current)
        switch (node.kind) {
          case "entry":
            throw new Error(`不能将词条作为表达式引用：${path}`)
          case "resource": {
            let current = node.current
            // limited by the limit expression
            // ignore the limit if there is something wrong with the limit expression
            if (
              node.limitCache &&
              node.limitCache.kind === "value" &&
              node.limitCache.value.kind === "number" &&
              node.limitCache.value.value.kind === "constant"
            )
              current = Math.min(current, node.limitCache.value.value.value)
            // limited by the nonNegative flag
            if (node.nonNegative) current = Math.max(current, 0)
            return { kind: "value", value: { kind: "number", value: { kind: "constant", value: current } } }
          }
          case "state":
            return { kind: "value", value: { kind: "boolean", value: { kind: "constant", value: node.active } } }
          case "definition":
            if (!node.sourceCache) throw new Error(`表达式 ${node.name} 尚未编译`)
            return node.sourceCache
        }
      } catch (error) {
        if (error instanceof Error) return { kind: "error", message: error.message }
        throw error
      }
    }
  }

  protected isNameValid(name: string): boolean {
    return !(!name || /[.#${}\s]/u.test(name))
  }

  resolvePath(path: string, currentPath = ""): NumericalNode {
    return this.walk(path, path.startsWith(".") ? this.entryAt(currentPath) : this.root)
  }

  createResolver(currentPath: string): HirEnv["resolveNamedExpression"] {
    return this.resolverFor(this.entryAt(currentPath).id)
  }

  // ==================================================
  // compile functions
  // ==================================================
  compileExpressionDefinition(definition: ExpressionDefinition): resolveNamedExpressionResult {
    // 本版只有定义，使用其兜底初始值；相对引用以定义的实际所属词条为起点。
    const result = buildHirFromString(definition.source, this.resolverFor(definition.entryId))
    if (!result.ok) return { kind: "error", message: `表达式 ${definition.name}：${result.error.message}` }
    if (definition.isConstant && !isConstant(result.value)) {
      return { kind: "error", message: `表达式 ${definition.name} 必须折叠为常量` }
    }
    return { kind: "value", value: result.value }
  }

  compileEntryActive(entry: Entry): resolveNamedExpressionResult {
    const currentId = entry.id === this.rootId ? this.rootId : entry.entryId
    const result = buildHirFromString(entry.active ?? "true", this.resolverFor(currentId))
    if (!result.ok) return { kind: "error", message: `词条 ${entry.name}：${result.error.message}` }
    if (!isConstant(result.value)) return { kind: "error", message: `词条 ${entry.name} 的激活条件必须折叠为常量` }
    if (result.value.kind !== "boolean") return { kind: "error", message: `词条 ${entry.name} 的激活条件必须是布尔值` }
    return { kind: "value", value: result.value }
  }

  compileResourceLimit(resource: Resource): resolveNamedExpressionResult {
    const result = buildHirFromString(resource.limit ?? "inf", this.resolverFor(resource.entryId))
    if (!result.ok) return { kind: "error", message: `资源 ${resource.name}：${result.error.message}` }
    if (!isConstant(result.value)) return { kind: "error", message: `资源 ${resource.name} 的上限必须折叠为常量` }
    if (result.value.kind !== "number") return { kind: "error", message: `资源 ${resource.name} 的上限必须是数值` }
    return { kind: "value", value: result.value }
  }
}

export class NumericalShadow extends NumericalView {
  readonly rootId: string
  get(id: string): NumericalNode | undefined {
    if (this.deleted.has(id)) return undefined
    if (this.updated.has(id)) return this.updated.get(id)
    return this.base.get(id)
  }

  private updated = new Map<string, NumericalNode>()
  private deleted = new Set<string>()
  private status: "open" | "committed" | "discarded" = "open"

  constructor(
    private readonly base: NumericalView,
    private readonly publish: (updated: Map<string, NumericalNode>, deleted: Set<string>) => void
  ) {
    super()
    this.rootId = base.rootId
  }

  private assertOpen(): void {
    if (this.status !== "open") throw new Error("Shadow 已关闭")
  }

  discard() {
    this.status = "discarded"
  }

  commit() {
    this.assertOpen()
    this.publish(this.updated, this.deleted)
    this.updated.clear()
    this.deleted.clear()
    this.status = "committed"
  }

  // ==================================================
  // insert functions
  // ==================================================

  private insert<T extends NumericalNode>(node: T, path: string, currentPath: string) {
    if (!this.isNameValid(node.name))
      throw new Error(`非法名称：${JSON.stringify(node.name)}，名称不能为空或包含 .、#、$、{、}、空白`)

    const entry = this.resolvePath(path, currentPath)
    if (entry.kind !== "entry") throw new Error(`所属路径不是词条：${path}`)
    if (entry.children.has(node.name)) throw new Error(`同一词条下名称冲突：${node.name}`)

    // 维护node的一些基础信息
    node.entryId = entry.id

    // 复制父词条，避免修改原始数据
    const newEntry = this.updated.has(entry.id) ? entry : { ...entry, children: new Map(entry.children) }

    newEntry.children.set(node.name, node.id) // 维护父词条的子节点集合
    this.updated.set(node.id, node)
    this.updated.set(newEntry.id, newEntry) // 维护父词条的更新
  }

  createEntry(input: EntryInfo, entryPath: string, currentPath = "") {
    this.assertOpen()

    const entry: Entry = {
      id: nanoid(),
      name: input.name,
      entryId: "", //will be covered in insert
      kind: "entry",
      children: new Map(),
      active: input.active,
    }
    this.insert(entry, entryPath, currentPath)
    entry.activeCache = entry.active ? this.compileEntryActive(entry) : undefined
  }

  createExpression(input: ExpressionInfo, entryPath: string, currentPath = "") {
    this.assertOpen()

    const definition: ExpressionDefinition = {
      id: nanoid(),
      name: input.name,
      entryId: "", //will be covered in insert
      kind: "definition",
      source: input.source,
      isConstant: input.isConstant,
    }
    this.insert(definition, entryPath, currentPath)
    definition.sourceCache = this.compileExpressionDefinition(definition)
  }

  createResource(input: ResourceInfo, entryPath: string, currentPath = "") {
    this.assertOpen()

    const resource: Resource = {
      id: nanoid(),
      name: input.name,
      entryId: "", //will be covered in insert
      kind: "resource",
      current: input.current,
      nonNegative: input.nonNegative,
      limit: input.limit,
    }
    this.insert(resource, entryPath, currentPath)
    resource.limitCache = resource.limit ? this.compileResourceLimit(resource) : undefined
  }

  createState(input: StateInfo, entryPath: string, currentPath = "") {
    this.assertOpen()

    const state: State = {
      id: nanoid(),
      name: input.name,
      entryId: "", //will be covered in insert
      kind: "state",
      active: input.active,
    }
    this.insert(state, entryPath, currentPath)
  }

  // ==================================================
  // update functions
  // ==================================================

  // Check the rename and copy the node if necessary, and synchronize the name index of the parent entry.
  private prepareUpdate<T extends NumericalNode>(node: T, input: { name?: string }): T {
    const tempFunc = () => {
      if (Object.hasOwn(input, "name") && input.name !== node.name) {
        if (typeof input.name !== "string" || !this.isNameValid(input.name))
          throw new Error(`非法名称：${JSON.stringify(input.name)}，名称不能为空或包含 .、#、$、{、}、空白`)
        if (node.id === this.rootId) throw new Error("不能重命名根词条")

        const owner = this.get(node.entryId)
        if (!owner || owner.kind !== "entry") throw new Error(`所属词条不存在：${node.entryId}`)
        if (owner.children.has(input.name)) throw new Error(`同一词条下名称冲突：${input.name}`)
        return owner
      } else {
        return undefined
      }
    }
    const parent = tempFunc() // if the name is changed, we need to update the parent entry's children map
    const updated = this.updated.has(node.id) ? node : { ...node }
    if (updated !== node && updated.kind === "entry") updated.children = new Map(updated.children)
    if (parent) {
      const updatedParent = this.updated.has(parent.id) ? parent : { ...parent, children: new Map(parent.children) }
      updatedParent.children.delete(node.name)
      updatedParent.children.set(input.name!, node.id)
      updated.name = input.name!
      this.updated.set(updatedParent.id, updatedParent)
    }
    this.updated.set(updated.id, updated)
    return updated
  }

  setEntry(input: Partial<EntryInfo>, path: string, currentPath = ""): void {
    this.assertOpen()
    const node = this.resolvePath(path, currentPath)
    if (node.kind !== "entry") throw new Error(`指定路径不是词条：${path}`)

    const hasActive = Object.hasOwn(input, "active")
    const hasName = Object.hasOwn(input, "name")
    if (!hasActive && !hasName) return
    if (hasActive && input.active !== undefined && typeof input.active !== "string")
      throw new Error("词条激活条件必须是字符串或 undefined")

    const entry = this.prepareUpdate(node, input)
    if (hasActive) entry.active = input.active
    entry.activeCache = entry.active ? this.compileEntryActive(entry) : undefined
  }

  setExpression(input: Partial<ExpressionInfo>, path: string, currentPath = ""): void {
    this.assertOpen()
    const node = this.resolvePath(path, currentPath)
    if (node.kind !== "definition") throw new Error(`指定路径不是表达式定义：${path}`)

    const hasSource = Object.hasOwn(input, "source")
    const hasConstant = Object.hasOwn(input, "isConstant")
    const hasName = Object.hasOwn(input, "name")
    if (!hasSource && !hasConstant && !hasName) return
    if (hasSource && typeof input.source !== "string") throw new Error("表达式源文本必须是字符串")
    if (hasConstant && typeof input.isConstant !== "boolean") throw new Error("isConstant 必须是布尔值")

    const definition = this.prepareUpdate(node, input)
    if (hasSource) definition.source = input.source!
    if (hasConstant) definition.isConstant = input.isConstant!
    definition.sourceCache = this.compileExpressionDefinition(definition)
  }

  setResource(input: Partial<ResourceInfo>, path: string, currentPath = ""): void {
    this.assertOpen()
    const node = this.resolvePath(path, currentPath)
    if (node.kind !== "resource") throw new Error(`指定路径不是资源：${path}`)

    const hasCurrent = Object.hasOwn(input, "current")
    const hasNonNegative = Object.hasOwn(input, "nonNegative")
    const hasLimit = Object.hasOwn(input, "limit")
    const hasName = Object.hasOwn(input, "name")
    if (!hasCurrent && !hasNonNegative && !hasLimit && !hasName) return
    if (hasCurrent && typeof input.current !== "number") throw new Error("资源数值必须是数字")
    if (hasNonNegative && typeof input.nonNegative !== "boolean") throw new Error("nonNegative 必须是布尔值")
    if (hasLimit && input.limit !== undefined && typeof input.limit !== "string")
      throw new Error("资源上限必须是字符串或 undefined")

    const resource = this.prepareUpdate(node, input)
    if (hasCurrent) resource.current = input.current!
    if (hasNonNegative) resource.nonNegative = input.nonNegative!
    if (hasLimit) resource.limit = input.limit
    if (hasLimit || (hasName && input.name !== node.name))
      resource.limitCache = resource.limit ? this.compileResourceLimit(resource) : undefined
  }

  setState(input: Partial<StateInfo>, path: string, currentPath = ""): void {
    this.assertOpen()
    const node = this.resolvePath(path, currentPath)
    if (node.kind !== "state") throw new Error(`指定路径不是状态：${path}`)

    const hasActive = Object.hasOwn(input, "active")
    const hasName = Object.hasOwn(input, "name")
    if (!hasActive && !hasName) return
    if (hasActive && typeof input.active !== "boolean") throw new Error("状态必须是布尔值")

    const state = this.prepareUpdate(node, input)
    if (hasActive) state.active = input.active!
  }
}

export class NumericalSystem extends NumericalView {
  readonly rootId: string = nanoid()
  get(id: string): NumericalNode | undefined {
    return this.data.get(id)
  }

  private data = new Map<string, NumericalNode>([
    [this.rootId, { kind: "entry", id: this.rootId, children: new Map(), name: "", entryId: "" }],
  ])

  getDraft(): NumericalShadow {
    return new NumericalShadow(this, (updated, deleted) => {
      for (const id of deleted) this.data.delete(id)
      for (const [id, node] of updated) this.data.set(id, node)
    })
  }
}
