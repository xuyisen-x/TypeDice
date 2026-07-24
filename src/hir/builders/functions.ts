// =======================================
// Helper functions for building HIR for regular function calls
// =======================================

import type { IToken } from "chevrotain"
import type { HirEnv, HIRNode, ListType, NumberType } from "../types.js"
import { isConstantList } from "../../utils.js"
import { hirErrorToken } from "../errors.js"
import { numberPlusNumber } from "../operations/number.js"
import type { FilterCallCstNode, RegularFunctionCallCstNode } from "../../syntax/generated/cst.js"
import { buildExpressionHir } from "./core.js"
import { processModParam } from "./modifiers.js"

type ElementwiseFunctionName = "floor" | "ceil" | "round" | "abs"
type AggregateFunctionName = "fmax" | "fmin" | "sum" | "avg" | "len"
type ListSelectionFunctionName = "fmax" | "fmin"
type SortFunctionName = "sort" | "sortd"

function applyElementwiseFunction(name: ElementwiseFunctionName, value: number): number {
  if (name === "floor") return Math.floor(value)
  else if (name === "ceil") return Math.ceil(value)
  else if (name === "round") return Math.round(value)
  else return Math.abs(value)
}

function buildNumberElementwiseFunction(name: ElementwiseFunctionName, value: NumberType): HIRNode {
  if (value.kind === "constant") {
    return { kind: "number", value: { kind: "constant", value: applyElementwiseFunction(name, value.value) } }
  }

  if (name === "floor") return { kind: "number", value: { kind: "function", value: { kind: "floor", value } } }
  else if (name === "ceil") return { kind: "number", value: { kind: "function", value: { kind: "ceil", value } } }
  else if (name === "round") return { kind: "number", value: { kind: "function", value: { kind: "round", value } } }
  else return { kind: "number", value: { kind: "function", value: { kind: "abs", value } } }
}

function buildListElementwiseFunction(name: ElementwiseFunctionName, value: ListType): HIRNode {
  if (isConstantList(value)) {
    return {
      kind: "list",
      value: {
        kind: "explicit",
        value: value.value.map((item) => ({
          kind: "constant",
          value: applyElementwiseFunction(name, item.value),
        })),
      },
    }
  }

  if (name === "floor") return { kind: "list", value: { kind: "function", value: { kind: "floor", value } } }
  else if (name === "ceil") return { kind: "list", value: { kind: "function", value: { kind: "ceil", value } } }
  else if (name === "round") return { kind: "list", value: { kind: "function", value: { kind: "round", value } } }
  else return { kind: "list", value: { kind: "function", value: { kind: "abs", value } } }
}

function functionArgumentsAsList(args: HIRNode[], functionToken: IToken): ListType {
  if (args.length === 1 && args[0].kind === "list") return args[0].value

  const values: NumberType[] = []
  for (const arg of args) {
    if (arg.kind !== "number") {
      hirErrorToken(`函数${functionToken.image}的参数必须是数字，或仅传入一个列表`, functionToken)
    }
    values.push(arg.value)
  }
  return { kind: "explicit", value: values }
}

function buildElementwiseFunction(name: ElementwiseFunctionName, args: HIRNode[], functionToken: IToken): HIRNode {
  if (args.length === 1 && args[0].kind === "number") {
    return buildNumberElementwiseFunction(name, args[0].value)
  }
  return buildListElementwiseFunction(name, functionArgumentsAsList(args, functionToken))
}

function buildAggregateFunction(name: AggregateFunctionName, list: ListType, functionToken: IToken): HIRNode {
  switch (name) {
    case "len": {
      if (list.kind === "explicit") {
        return { kind: "number", value: { kind: "constant", value: list.value.length } }
      }
      return { kind: "number", value: { kind: "function", value: { kind: "len", value: list } } }
    }
    case "sum": {
      if (list.kind === "explicit") {
        const sum = list.value.reduce((accumulator, item) => numberPlusNumber(accumulator, item), {
          kind: "constant",
          value: 0,
        })
        return { kind: "number", value: sum }
      }
      return { kind: "number", value: { kind: "function", value: { kind: "sum", value: list } } }
    }
    case "avg": {
      if (list.kind === "explicit" && isConstantList(list)) {
        const sum = list.value.reduce((accumulator, item) => accumulator + item.value, 0)
        const avg = list.value.length === 0 ? 0 : sum / list.value.length
        return { kind: "number", value: { kind: "constant", value: avg } }
      }
      return { kind: "number", value: { kind: "function", value: { kind: "avg", value: list } } }
    }
    case "fmax":
    case "fmin": {
      if (list.kind === "explicit") {
        if (list.value.length === 0) hirErrorToken(`函数${name}不能用于空列表`, functionToken)
        if (list.value.length === 1) return { kind: "number", value: list.value[0] }
        if (isConstantList(list)) {
          const values = list.value.map((item) => item.value)
          const result = values
            .slice(1)
            .reduce((current, item) => (name === "fmax" ? Math.max(current, item) : Math.min(current, item)), values[0])
          return { kind: "number", value: { kind: "constant", value: result } }
        }
        return { kind: "number", value: { kind: "function", value: { kind: name, value: list } } }
      }
      return { kind: "number", value: { kind: "function", value: { kind: name, value: list } } }
    }
  }
}

function buildListSelectionFunction(name: ListSelectionFunctionName, list: ListType, count: NumberType): HIRNode {
  if (isConstantList(list) && count.kind === "constant") {
    function normalizeListSelectionCount(value: number): number {
      const normalized = Math.max(0, Math.floor(value))
      return isNaN(normalized) || !isFinite(normalized) ? 0 : normalized
    }

    const normalizedCount = normalizeListSelectionCount(count.value)
    if (normalizedCount === 0) return { kind: "list", value: { kind: "explicit", value: [] } }
    if (normalizedCount >= list.value.length) return { kind: "list", value: list }

    const selected = list.value
      .map((item, index) => ({ item, index }))
      .sort((lhs, rhs) => {
        const difference = name === "fmax" ? rhs.item.value - lhs.item.value : lhs.item.value - rhs.item.value
        return Number.isNaN(difference) || difference === 0 ? lhs.index - rhs.index : difference
      })
      .slice(0, normalizedCount)
      .sort((lhs, rhs) => lhs.index - rhs.index)
      .map(({ item }) => item)

    return { kind: "list", value: { kind: "explicit", value: selected } }
  }

  return { kind: "list", value: { kind: "function", value: { kind: name, list, count } } }
}

function buildSortFunction(name: SortFunctionName, list: ListType): HIRNode {
  if (isConstantList(list)) {
    const sorted = [...list.value].sort((lhs, rhs) => (name === "sort" ? lhs.value - rhs.value : rhs.value - lhs.value))
    return { kind: "list", value: { kind: "explicit", value: sorted } }
  }

  if (name === "sort") {
    return { kind: "list", value: { kind: "function", value: { kind: "sort", value: list } } }
  }
  return { kind: "list", value: { kind: "function", value: { kind: "sortdesc", value: list } } }
}

export function buildRegularFunctionCall(node: RegularFunctionCallCstNode, env: HirEnv): HIRNode {
  const functionNameToken = node.children.BuiltinFunction[0]
  const functionName = functionNameToken.image.toLowerCase()
  const firstArg = buildExpressionHir(node.children.arg[0], env)
  const restArgs = node.children.args?.map((argNode) => buildExpressionHir(argNode, env)) ?? []
  const args = [firstArg, ...restArgs]

  switch (functionName) {
    case "floor":
    case "ceil":
    case "round":
    case "abs":
      return buildElementwiseFunction(functionName, args, functionNameToken)

    case "fmax":
    case "fmin":
      if (args.length === 2 && args[0].kind === "list" && args[1].kind === "number") {
        return buildListSelectionFunction(functionName, args[0].value, args[1].value)
      }
      return buildAggregateFunction(functionName, functionArgumentsAsList(args, functionNameToken), functionNameToken)

    case "sum":
    case "avg":
    case "len":
      return buildAggregateFunction(functionName, functionArgumentsAsList(args, functionNameToken), functionNameToken)

    case "sort":
    case "sortd":
      return buildSortFunction(functionName, functionArgumentsAsList(args, functionNameToken))

    case "tolist": {
      if (
        args.length !== 1 ||
        args[0].kind !== "number" ||
        (args[0].value.kind !== "dicePool" && args[0].value.kind !== "successPool")
      ) {
        hirErrorToken("函数tolist只能接收一个骰池或成功池", functionNameToken)
      }

      const value = args[0].value
      if (value.kind === "dicePool") {
        return {
          kind: "list",
          value: { kind: "function", value: { kind: "tolistFromDice", value: value.value } },
        }
      } else if (value.kind === "successPool") {
        return {
          kind: "list",
          value: { kind: "function", value: { kind: "tolistFromSuccess", value: value.value } },
        }
      }
    }

    default:
      hirErrorToken(`未知的内置函数: ${functionNameToken.image}`, functionNameToken)
  }
}

export function buildFilterCall(node: FilterCallCstNode, env: HirEnv): HIRNode {
  const filterNameToken = node.children.Filter[0]

  const modParam = processModParam(node.children.modParam[0], env)

  const firstArg = buildExpressionHir(node.children.arg[0], env)
  const restArgs = node.children.args?.map((argNode) => buildExpressionHir(argNode, env)) ?? []
  const args = [firstArg, ...restArgs]

  const list = functionArgumentsAsList(args, filterNameToken)

  if (isConstantList(list) && modParam.value.kind === "constant") {
    const modParamValue = modParam.value.value
    const filteredList = list.value.filter((item) => {
      switch (modParam.kind) {
        case "equal":
          return item.value === modParamValue
        case "notEqual":
          return item.value !== modParamValue
        case "lessThan":
          return item.value < modParamValue
        case "lessThanOrEqual":
          return item.value <= modParamValue
        case "greaterThan":
          return item.value > modParamValue
        case "greaterThanOrEqual":
          return item.value >= modParamValue
      }
    })
    return { kind: "list", value: { kind: "explicit", value: filteredList } }
  }

  return {
    kind: "list",
    value: { kind: "function", value: { kind: "filter", list, modParam } },
  }
}
