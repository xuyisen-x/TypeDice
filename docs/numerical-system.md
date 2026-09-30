# 数值系统第一版

`NumericalSystem` 负责正式状态的扁平存储、路径定位，以及生成 `buildHir` 的引用解析回调。通过 `getDraft()` 创建 `NumericalShadow`，在草稿中创建、更新和预览节点，最后 `commit()` 或 `discard()`。

## 数据类型

所有实体共享 `OwnedObject`：`id: string`（由 nanoid 生成）、`name: string`、`entryId: string`，并通过 `kind` 区分类型。词条的 `entryId` 指向父词条，其他对象的 `entryId` 指向所属词条。
所有数据类型统一使用 `type`，不使用 `readonly`。修改应通过 Shadow 的创建和更新接口进行；直接修改查询返回的对象会绕过草稿隔离、索引维护和缓存更新。

| 类型                              | kind         | 所属关系          | 数据                                                                                                     |
| --------------------------------- | ------------ | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `Entry` 词条                      | `entry`      | `entryId: string` | `children: Map<string, string>`、`active?: string`、`activeCache?: resolveNamedExpressionResult`         |
| `ExpressionDefinition` 表达式定义 | `definition` | `entryId: string` | `source: string`、`isConstant: boolean`、`sourceCache?: resolveNamedExpressionResult`                    |
| `Resource` 资源                   | `resource`   | `entryId: string` | `current: number`、`nonNegative: boolean`、`limit?: string`、`limitCache?: resolveNamedExpressionResult` |
| `State` 状态                      | `state`      | `entryId: string` | `active: boolean`                                                                                        |

表达式在语义上分为四类：

- **定义**：负责命名表达式的 ID、名称、所属词条和结果／错误缓存，同时提供最低优先级的初始值。只要存在任何其他初始值，定义的数值就不被采纳，但定义仍负责定位命名表达式和保存其最终编译缓存。
- **初始值**：替代定义提供的兜底值；多个初始值按优先级选择。
- **调整值**：按值类型对应的运算，合并到选中的初始值上。
- **强制覆盖值**：替代初始值与调整值合并后的结果。

**第一版只实现定义**，不添加其他三类的数据类型或合并逻辑。`createExpression` 创建 `ExpressionDefinition`，随后通过路径或 ID 查询该定义。`source` 是定义提供的兜底初始值源文本，本版直接编译它。

值类型由现有 HIR 编译器推导。`isConstant: true` 要求编译折叠后为常量，包括所有元素均为常量的列表或字符串集合。

三个可选缓存字段均使用 `resolveNamedExpressionResult`：缺省表示尚未编译，成功时为 `{ kind: "value", value: HIRNode }`，失败时为 `{ kind: "error", message: string }`，不保存随机求值结果。

- `sourceCache`：创建定义或通过 `setExpression` 更新定义时保存的 HIR 或错误。
- `activeCache`：创建或更新词条时编译的激活条件，必须是布尔常量；本版尚未应用词条激活效果。
- `limitCache`：创建资源或通过 `setResource` 更新上限、名称时编译的上限，必须是数值常量。只修改 `current` 或 `nonNegative` 时保留上限缓存。

未提供激活条件或资源上限时，相应缓存为空；显式调用编译方法时，默认分别为 `true` 和 `inf`。`compileExpressionDefinition`、`compileEntryActive`、`compileResourceLimit` 仅返回编译结果，不直接写入节点缓存。

常量判定函数 `isConstant` 位于 `src/numerical/utils.ts`，用于检查编译结果是否满足定义的 `isConstant` 约束。

根词条由构造函数创建，`name` 和 `entryId` 都为 `""`，自身仍有 nanoid 生成的非空 `id`。空 `entryId` 表示根没有父词条；根的直接子节点使用 `root.id` 作为 `entryId`。全部实体保存在同一个 `Map<string, NumericalNode>` 中，通过 `get(id)` 查询。实体内部不嵌套子词条或对象。

每个词条（包括根）通过 `children: Map<string, string>` 保存直接子节点的 `name → id` 索引，涵盖子词条、表达式定义、资源和状态。路径查找先从 `children` 取得 ID，再通过当前视图的 `get(id)` 取得实体，不扫描全表或自动重建索引。

创建方法会同时在 Shadow 中保存新节点和父词条的 `children` 索引。更新方法修改基础状态中的节点前会复制节点，涉及词条时还会复制 `children` Map。改名同时更新父词条索引，节点 ID、所属词条和子节点身份保持不变。

## 创建和部分更新

创建与更新方法均位于 `NumericalShadow`，返回 `void`。创建方法的第二个参数定位所属词条，更新方法的第二个参数定位要修改的节点；第三个参数 `currentPath = ""` 指定相对路径的上下文。

| 创建方法                                                           | 对应更新方法                                                        | 可编辑信息                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| `createEntry(input: EntryInfo, entryPath, currentPath?)`           | `setEntry(input: Partial<EntryInfo>, path, currentPath?)`           | `name`、`active`                          |
| `createExpression(input: ExpressionInfo, entryPath, currentPath?)` | `setExpression(input: Partial<ExpressionInfo>, path, currentPath?)` | `name`、`source`、`isConstant`            |
| `createResource(input: ResourceInfo, entryPath, currentPath?)`     | `setResource(input: Partial<ResourceInfo>, path, currentPath?)`     | `name`、`current`、`nonNegative`、`limit` |
| `createState(input: StateInfo, entryPath, currentPath?)`           | `setState(input: Partial<StateInfo>, path, currentPath?)`           | `name`、`active`                          |

四种 Info 类型从包入口导出，不包含 `id`、`kind`、`entryId`、子节点索引或缓存。更新只采用 input 自身存在的可编辑字段，省略的字段不变，`{}` 不产生修改；仍会检查草稿是否关闭、路径和节点类型。必填字段不能显式设为 `undefined`，可选的词条 `active` 和资源 `limit` 可以通过 `undefined` 清除，并清除相应缓存。`false` 和 `0` 都是有效更新值。

改名检查名称合法性和同级四类节点的名称冲突，根词条保持空名称。修改校验失败时不应用该次更新；表达式编译失败则和创建时一样保存错误缓存。设置根词条激活条件时，以根词条为引用上下文。

```ts
const draft = system.getDraft()
draft.setEntry({ name: "英雄", active: "true" }, "角色")
draft.setState({ active: true }, ".中毒", "英雄")
draft.setResource({ current: 12, limit: "15", nonNegative: true }, "英雄.生命值")
draft.setExpression({ source: "1d6 + ${.生命值}", isConstant: false }, "英雄.攻击")
draft.setResource({ limit: undefined }, "英雄.生命值")
draft.commit()
```

资源更新保存原始 `current`，在引用时应用限制。更新自身编译输入会刷新自身缓存，但不会自动重编译其他依赖节点；改名也不会重写其他表达式的路径文本。移动、删除、依赖自动追踪和多个草稿的版本冲突检查尚未实现。旧的 `setStateActive`、`setResourceCurrent` 已由部分更新接口替代。

## 路径规则

`resolvePath(path, currentPath = "")` 返回实际实体，失败抛出带原因的 `Error`。参数不包含 `${}`。

| 路径             | 含义                     |
| ---------------- | ------------------------ |
| `角色.属性.力量` | 从根查找                 |
| `.力量`          | 从当前词条查找           |
| `.属性.力量`     | 从当前词条进入子词条     |
| `.#.力量`        | 从当前词条的父词条查找   |
| `.#.#.力量`      | 从当前词条的祖父词条查找 |
| `""`             | 根词条                   |
| `.`              | 当前词条                 |

`currentPath` 是词条的绝对路径；根上下文使用 `""`。绝对查询不依赖 `currentPath`。`#` 是独立的父词条路径段，不能越过根。中间段必须是词条。相对路径查找失败不回退到根。

第一版对文档中尚未确定的边界采用以下规则：同级四类实体共享名称空间，名称不能为空或包含 `. # $ { }` 及空白。拒绝连续分隔符、末尾分隔符等空路径段。不提供转义语法。

## HIR 接入

```ts
import { NumericalSystem, buildHirFromString } from "typedice"

const system = new NumericalSystem()
const draft = system.getDraft()
draft.createEntry({ name: "角色" }, "")
draft.createResource({ name: "生命值", current: 8, nonNegative: true, limit: "10" }, "角色")
draft.createState({ name: "中毒", active: false }, "角色")
draft.createExpression({ name: "攻击", source: "1d6 + ${.生命值}", isConstant: false }, "角色")

const resolver = draft.createResolver("角色")
const result = buildHirFromString("${.中毒} ? 0 : ${.攻击}", resolver)
// 如果已有 CST，可以直接使用 buildHir(cst, resolver)。
// result 保留骰子 HIR，后续由 evaluateHir 显式求值。
// draft.resolvePath("角色.攻击") 可以取得定义及创建时的编译缓存。
draft.commit()
```

`createResolver(currentPath)` 先验证并定位上下文词条，失败抛出 `Error`。返回的函数符合 `HirEnv["resolveNamedExpression"]`：

- 引用资源先应用成功编译的上限，再应用 `nonNegative` 下界，生成 number 常量 HIR；上限编译失败时忽略上限，保留错误缓存。读取不会修改原始 `current`。
- 引用状态生成 `active` 对应的 boolean 常量 HIR。
- 引用表达式定位其定义，返回已有的 `sourceCache`；未编译时返回错误。编译定义时的相对引用以定义实际所属词条为起点。
- 引用词条、找不到对象或编译失败，返回 `{ kind: "error", message }`，交给现有 HIR 错误接口处理。

回调每次通过当前视图读取节点，复用定义已有的编译缓存，不进行随机求值。尚未实现依赖自动失效：资源、状态或其他定义改变后，依赖它们的缓存需要显式重新编译。已生成的 HIR 是当次编译的结果。

## 本版范围

本版实现创建、部分更新、Shadow 预览和提交、编译缓存、资源引用时的上限及非负限制。暂不实现初始值、调整值、强制覆盖值及其合并，也不应用词条激活效果，不实现时机行为、依赖自动失效、响应式、软链接及循环引用检查。调用方应提供无循环的表达式引用。
