import { tokenMatcher } from "chevrotain"
import type {
  ExplodeModifierCstNode,
  KeepDropModifierCstNode,
  LimitCstNode,
  MinMaxModifierCstNode,
  ModifierCstNode,
  ModParamCstNode,
  RerollModifierCstNode,
  SuccessFailureModifierCstNode,
} from "../../syntax/generated/cst.js"
import { hirError, hirErrorToken } from "../errors.js"
import { buildAtomHir } from "./core.js"
import type { HirEnv, HIRNode, LimitType, ModParamType } from "../types.js"
import { numberNormalize } from "../utils.js"
import {
  Cf,
  Cs,
  Dh,
  Dl,
  Equal,
  Greater,
  GreaterEqual,
  Kh,
  Kl,
  Less,
  LessEqual,
  Max,
  Min,
  NotEqual,
  Sf,
} from "../../syntax/lexer.js"

export function processModifier(node: ModifierCstNode, env: HirEnv): (x: HIRNode) => HIRNode {
  if (node.children.keepDropModifier) return processKeepDropModifier(node.children.keepDropModifier[0], env)
  if (node.children.minMaxModifier) return processMinMaxModifier(node.children.minMaxModifier[0], env)
  if (node.children.rerollModifier) return rerollModifier(node.children.rerollModifier[0], env)
  if (node.children.explodeModifier) return processExplodeModifier(node.children.explodeModifier[0], env)
  /* v8 ignore else -- @preserve */
  if (node.children.successFailureModifier)
    return processSuccessFailureModifier(node.children.successFailureModifier[0], env)
  /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
}

export function processKeepDropModifier(node: KeepDropModifierCstNode, env: HirEnv): (x: HIRNode) => HIRNode {
  const keepDropToken = node.children.KeepDropModifierOperator[0]
  const count: HIRNode = node.children.count
    ? buildAtomHir(node.children.count[0], env)
    : { kind: "number", value: { kind: "constant", value: 1 } }

  if (count.kind !== "number") {
    hirError(
      "保留/丢弃修饰符的计数必须是数字类型",
      node.children.count ? node.children.count[0] : /* v8 ignore next -- @preserve */ node
    )
  }

  const normalizedCount = numberNormalize(count.value)

  return (x: HIRNode) => {
    if (x.kind !== "number" || x.value.kind !== "dicePool") {
      hirError("保留/丢弃修饰符只能用于骰池类型", node)
    }
    if (tokenMatcher(keepDropToken, Kh))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "keepHigh",
            pool: x.value.value,
            count: normalizedCount,
          },
        },
      }
    if (tokenMatcher(keepDropToken, Kl))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "keepLow",
            pool: x.value.value,
            count: normalizedCount,
          },
        },
      }
    if (tokenMatcher(keepDropToken, Dh))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "dropHigh",
            pool: x.value.value,
            count: normalizedCount,
          },
        },
      }
    /* v8 ignore else -- @preserve */
    if (tokenMatcher(keepDropToken, Dl))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "dropLow",
            pool: x.value.value,
            count: normalizedCount,
          },
        },
      }
    /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
  }
}

export function processMinMaxModifier(node: MinMaxModifierCstNode, env: HirEnv): (x: HIRNode) => HIRNode {
  const minMaxToken = node.children.MinMaxModifierOperator[0]
  const value = buildAtomHir(node.children.value[0], env)
  if (value.kind !== "number") hirError("最小/最大修饰符的值必须是数字类型", node.children.value[0])

  return (x: HIRNode) => {
    if (x.kind !== "number" || x.value.kind !== "dicePool") {
      hirError("最小/最大修饰符只能用于骰池类型", node)
    }
    if (tokenMatcher(minMaxToken, Min))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "min",
            pool: x.value.value,
            value: value.value,
          },
        },
      }
    /* v8 ignore else -- @preserve */
    if (tokenMatcher(minMaxToken, Max))
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "max",
            pool: x.value.value,
            value: value.value,
          },
        },
      }
    /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
  }
}

export function rerollModifier(node: RerollModifierCstNode, env: HirEnv): (x: HIRNode) => HIRNode {
  const modParam = processModParam(node.children.modParam[0], env)
  const limit = node.children.limit ? processLimit(node.children.limit[0], env) : undefined

  return (x: HIRNode) => {
    if (x.kind !== "number" || x.value.kind !== "dicePool") {
      hirError("重掷修饰符只能用于骰池类型", node)
    }
    return {
      kind: "number",
      value: {
        kind: "dicePool",
        value: {
          kind: "reroll",
          pool: x.value.value,
          modParam,
          limit,
        },
      },
    }
  }
}

export function processExplodeModifier(node: ExplodeModifierCstNode, env: HirEnv): (x: HIRNode) => HIRNode {
  const modParam = node.children.modParam ? processModParam(node.children.modParam[0], env) : undefined
  const limit = node.children.limit ? processLimit(node.children.limit[0], env) : undefined

  return (x: HIRNode) => {
    if (x.kind !== "number" || x.value.kind !== "dicePool") {
      hirError("爆炸修饰符只能用于骰池类型", node)
    }
    return {
      kind: "number",
      value: {
        kind: "dicePool",
        value: {
          kind: "explode",
          pool: x.value.value,
          modParam,
          limit,
        },
      },
    }
  }
}

export function processSuccessFailureModifier(
  node: SuccessFailureModifierCstNode,
  env: HirEnv
): (x: HIRNode) => HIRNode {
  const successFailureToken = node.children.SuccessFailureModifierOperator[0]
  const modParam = processModParam(node.children.modParam[0], env)

  return (x: HIRNode) => {
    if (tokenMatcher(successFailureToken, Cs)) {
      if (x.kind !== "number" || (x.value.kind !== "dicePool" && x.value.kind !== "successPool"))
        hirError("cs修饰符只能用于骰池或成功池类型", node)
      if (x.value.kind === "successPool")
        return {
          kind: "number",
          value: {
            kind: "successPool",
            value: {
              kind: "countSuccesses",
              pool: x.value.value,
              modParam,
            },
          },
        }
      else
        return {
          kind: "number",
          value: {
            kind: "successPool",
            value: {
              kind: "countSuccessesFromDicePool",
              pool: x.value.value,
              modParam,
            },
          },
        }
    }
    if (tokenMatcher(successFailureToken, Cf)) {
      if (x.kind !== "number" || (x.value.kind !== "dicePool" && x.value.kind !== "successPool"))
        hirError("cf修饰符只能用于骰池或成功池类型", node)
      if (x.value.kind === "successPool")
        return {
          kind: "number",
          value: {
            kind: "successPool",
            value: {
              kind: "cancelFailures",
              pool: x.value.value,
              modParam,
            },
          },
        }
      else
        return {
          kind: "number",
          value: {
            kind: "successPool",
            value: {
              kind: "cancelFailuresFromDicePool",
              pool: x.value.value,
              modParam,
            },
          },
        }
    }
    /* v8 ignore else -- @preserve */
    if (tokenMatcher(successFailureToken, Sf)) {
      if (x.kind !== "number" || x.value.kind !== "dicePool") hirError("sf修饰符只能用于骰池类型", node)
      return {
        kind: "number",
        value: {
          kind: "dicePool",
          value: {
            kind: "subtractFailures",
            pool: x.value.value,
            modParam,
          },
        },
      }
    }
    /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
  }
}

export function processModParam(node: ModParamCstNode, env: HirEnv): ModParamType {
  const op = node.children.CompareOperator ? node.children.CompareOperator[0] : undefined
  const value = buildAtomHir(node.children.atom[0], env)
  if (value.kind !== "number") hirError("修饰参数的值必须是数字类型", node.children.atom[0])

  if (op === undefined || tokenMatcher(op, Equal)) return { kind: "equal", value: value.value }
  if (tokenMatcher(op, NotEqual)) return { kind: "notEqual", value: value.value }
  if (tokenMatcher(op, Less)) return { kind: "lessThan", value: value.value }
  if (tokenMatcher(op, LessEqual)) return { kind: "lessThanOrEqual", value: value.value }
  if (tokenMatcher(op, Greater)) return { kind: "greaterThan", value: value.value }
  /* v8 ignore else -- @preserve */
  if (tokenMatcher(op, GreaterEqual)) return { kind: "greaterThanOrEqual", value: value.value }
  /* v8 ignore next -- @preserve */ hirErrorToken(`未知的比较运算符: ${op.image}`, op)
}

export function processLimit(node: LimitCstNode, env: HirEnv): LimitType {
  if (node.children.timeLimit1 || node.children.countLimit1) {
    const lt = node.children.timeLimit1
      ? buildAtomHir(node.children.timeLimit1[0], env)
      : /* v8 ignore next -- @preserve */ undefined
    if (lt && lt.kind !== "number") hirError("迭代次数的限制必须是数字类型", node.children.timeLimit1![0])
    const lc = node.children.countLimit1 ? buildAtomHir(node.children.countLimit1[0], env) : undefined
    if (lc && lc.kind !== "number") hirError("计数的限制必须是数字类型", node.children.countLimit1![0])
    return {
      countLimit: lc ? numberNormalize(lc.value) : undefined,
      timeLimit: lt ? numberNormalize(lt.value) : /* v8 ignore next -- @preserve */ undefined,
    }
  }
  /* v8 ignore else -- @preserve */
  if (node.children.timeLimit2 || node.children.countLimit2) {
    const lc = node.children.countLimit2
      ? buildAtomHir(node.children.countLimit2[0], env)
      : /* v8 ignore next -- @preserve */ undefined
    if (lc && lc.kind !== "number") hirError("计数的限制必须是数字类型", node.children.countLimit2![0])
    const lt = node.children.timeLimit2 ? buildAtomHir(node.children.timeLimit2[0], env) : undefined
    if (lt && lt.kind !== "number") hirError("迭代次数的限制必须是数字类型", node.children.timeLimit2![0])
    return {
      countLimit: lc ? numberNormalize(lc.value) : /* v8 ignore next -- @preserve */ undefined,
      timeLimit: lt ? numberNormalize(lt.value) : undefined,
    }
  }
  /* v8 ignore next -- @preserve */ throw new Error("Unreachable")
}
