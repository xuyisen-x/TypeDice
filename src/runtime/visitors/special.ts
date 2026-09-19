import type { LimitType, ModParamType } from "../../hir/types.js"
import { normalizeNaturalNumber, PRECEDENCE } from "../../utils.js"
import { visitNumber } from "./number.js"
import type { EvaluatedLimit, EvaluatedModParam, EvaluationEnvironment } from "../types.js"
import { comparatorText, compare, maxReadyRound, numberValue } from "../utils.js"

export function visitModParam(env: EvaluationEnvironment, value: ModParamType, active: boolean): EvaluatedModParam {
  const param = visitNumber(env, value.value, active)
  if (param.precedence !== PRECEDENCE.atom) param.parenthesized = true
  const comparator = comparatorText(value.kind)
  if (!active) return { comparator, param, /* v8 ignore next -- @preserve */ predicate: () => false, readyRound: 0 }

  const target = numberValue(param)
  return {
    comparator,
    param,
    predicate: (candidate) => compare(value.kind, candidate, target),
    readyRound: maxReadyRound([param]),
  }
}

export function visitLimit(env: EvaluationEnvironment, value: LimitType | undefined, active: boolean): EvaluatedLimit {
  const timeLimit = value?.timeLimit ? visitNumber(env, value.timeLimit, active) : undefined
  const countLimit = value?.countLimit ? visitNumber(env, value.countLimit, active) : undefined
  if (timeLimit && timeLimit.precedence !== PRECEDENCE.atom) timeLimit.parenthesized = true
  if (countLimit && countLimit.precedence !== PRECEDENCE.atom) countLimit.parenthesized = true
  if (!active) return { timeLimit, countLimit, readyRound: 0 }

  return {
    timeLimit,
    countLimit,
    timeValue: timeLimit ? normalizeNaturalNumber(numberValue(timeLimit)) : undefined,
    countValue: countLimit ? normalizeNaturalNumber(numberValue(countLimit)) : undefined,
    readyRound: maxReadyRound([...(timeLimit ? [timeLimit] : []), ...(countLimit ? [countLimit] : [])]),
  }
}
