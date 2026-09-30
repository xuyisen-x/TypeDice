import type { resolveNamedExpressionResult } from "../hir/types.js"

type OwnedObject = { id: string; name: string; entryId: string }

export type Entry = OwnedObject & {
  kind: "entry"
  children: Map<string, string> // name -> id
  active?: string
  activeCache?: resolveNamedExpressionResult
}

export type ExpressionDefinition = OwnedObject & {
  kind: "definition"
  source: string
  isConstant: boolean
  sourceCache?: resolveNamedExpressionResult
}

export type Resource = OwnedObject & {
  kind: "resource"
  current: number
  nonNegative: boolean
  limit?: string
  limitCache?: resolveNamedExpressionResult
}

export type State = OwnedObject & {
  kind: "state"
  active: boolean
}

export type NumericalObject = ExpressionDefinition | Resource | State
export type NumericalNode = Entry | NumericalObject

export type EntryInfo = Pick<Entry, "name" | "active">
export type ExpressionInfo = Pick<ExpressionDefinition, "name" | "source" | "isConstant">
export type ResourceInfo = Pick<Resource, "name" | "current" | "nonNegative" | "limit">
export type StateInfo = Pick<State, "name" | "active">
