import type { DicePoolType, SuccessPoolType } from "../../hir/types.js"
import { assertNever, normalizeNaturalNumber, PRECEDENCE } from "../../utils.js"
import { visitNumber } from "./number.js"
import { visitLimit, visitModParam } from "./special.js"
import type { DicePool, DieDetail, EvaluationEnvironment, NodeLayout, OutputNode, SuccessPool } from "../types.js"
import {
  cloneDetails,
  cloneDicePool,
  cloneSuccessPool,
  computeDiceTotal,
  computeSuccessCount,
  dicePoolValue,
  evaluated,
  getRound,
  maxReadyRound,
  numberValue,
  reserveNodeID,
  shortCircuited,
  successPoolValue,
} from "../utils.js"
import { RuntimeException } from "../errors.js"

export function visitDicePool(env: EvaluationEnvironment, value: DicePoolType, active: boolean): OutputNode {
  switch (value.kind) {
    case "standard": {
      const count = visitNumber(env, value.count, active)
      const face = visitNumber(env, value.sides, active)

      if (count.precedence !== PRECEDENCE.atom) count.parenthesized = true
      if (face.precedence !== PRECEDENCE.atom) face.parenthesized = true

      const layout: NodeLayout = { kind: "dice", count, face }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

      const normalizedCount = normalizeNaturalNumber(numberValue(count))
      const normalizedFace = normalizeNaturalNumber(numberValue(face))
      return evaluateBaseDice(env, layout, normalizedCount, normalizedFace, maxReadyRound([count, face]))
    }
    case "fudge":
    case "coin": {
      const count = visitNumber(env, value.count, active)

      if (count.precedence !== PRECEDENCE.atom) count.parenthesized = true
      const face = value.kind
      const layout: NodeLayout = { kind: "dice", count, face }

      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)
      return evaluateBaseDice(env, layout, normalizeNaturalNumber(numberValue(count)), face, maxReadyRound([count]))
    }
    case "keepHigh":
    case "keepLow":
    case "dropHigh":
    case "dropLow": {
      const pool = visitDicePool(env, value.pool, active)
      const argument = visitNumber(env, value.count, active)

      if (argument.precedence !== PRECEDENCE.atom) argument.parenthesized = true
      const modifier = { keepHigh: "kh", keepLow: "kl", dropHigh: "dh", dropLow: "dl" }[value.kind]
      const layout: NodeLayout = { kind: "diceModifier", pool, modifier, argument }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

      const result = cloneDicePool(dicePoolValue(pool))
      const rollRound = maxReadyRound([pool, argument])
      applyKeepDrop(result, value.kind, normalizeNaturalNumber(numberValue(argument)), env, rollRound)
      return evaluated(reserveNodeID(env), layout, PRECEDENCE.dice, { kind: "dicepool", value: result }, rollRound)
    }
    case "min":
    case "max": {
      const pool = visitDicePool(env, value.pool, active)
      const argument = visitNumber(env, value.value, active)

      if (argument.precedence !== PRECEDENCE.atom) argument.parenthesized = true
      const layout: NodeLayout = { kind: "diceModifier", pool, modifier: value.kind, argument }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

      const result = cloneDicePool(dicePoolValue(pool))
      const target = numberValue(argument)
      const rollRound = maxReadyRound([pool, argument])
      for (const detail of result.details) {
        if (!detail.isKept) continue
        if (value.kind === "min" && detail.result < target) {
          detail.result = target
          getRound(env, rollRound).cover.push({ id: detail.rollID, newValue: target })
        }
        if (value.kind === "max" && detail.result > target) {
          detail.result = target
          getRound(env, rollRound).cover.push({ id: detail.rollID, newValue: target })
        }
      }
      result.total = computeDiceTotal(result)
      return evaluated(reserveNodeID(env), layout, PRECEDENCE.dice, { kind: "dicepool", value: result }, rollRound)
    }
    case "subtractFailures": {
      const pool = visitDicePool(env, value.pool, active)
      const modParam = visitModParam(env, value.modParam, active)

      const layout: NodeLayout = {
        kind: "diceModifier",
        pool,
        modifier: "sf",
        modParam: { comparator: modParam.comparator, param: modParam.param },
      }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

      const result = cloneDicePool(dicePoolValue(pool))
      const rollRound = Math.max(maxReadyRound([pool]), modParam.readyRound)
      for (const detail of result.details) {
        if (detail.isKept && modParam.predicate(detail.result)) {
          detail.isKept = false
          getRound(env, rollRound).remove.push({ id: detail.rollID })
        }
      }
      result.total = computeDiceTotal(result)
      return evaluated(reserveNodeID(env), layout, PRECEDENCE.dice, { kind: "dicepool", value: result }, rollRound)
    }
    case "explode":
    case "reroll": {
      const pool = visitDicePool(env, value.pool, active)
      const modParam = value.modParam ? visitModParam(env, value.modParam, active) : undefined
      const limit = visitLimit(env, value.limit, active)

      const layout: NodeLayout = {
        kind: "diceModifier",
        pool,
        modifier: value.kind === "explode" ? "x" : "r",
        modParam: modParam ? { comparator: modParam.comparator, param: modParam.param } : undefined,
        timeLimit: limit.timeLimit,
        countLimit: limit.countLimit,
      }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

      const result = cloneDicePool(dicePoolValue(pool))
      const predicate = modParam?.predicate ?? ((candidate: number) => candidate === maximumFace(result.face))
      const dependencyRound = Math.max(maxReadyRound([pool]), modParam?.readyRound ?? 0, limit.readyRound)
      applyRepeatedRolls(env, result, value.kind, predicate, limit.timeValue, limit.countValue, dependencyRound)
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.dice,
        { kind: "dicepool", value: result },
        Math.max(dependencyRound, ...result.details.map((detail) => detail.rollRound))
      )
    }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

export function visitSuccessPool(env: EvaluationEnvironment, value: SuccessPoolType, active: boolean): OutputNode {
  let pool: OutputNode
  let fromDice: boolean
  let marksFailure: boolean
  switch (value.kind) {
    case "countSuccessesFromDicePool":
      pool = visitDicePool(env, value.pool, active)
      fromDice = true
      marksFailure = false
      break
    case "cancelFailuresFromDicePool":
      pool = visitDicePool(env, value.pool, active)
      fromDice = true
      marksFailure = true
      break
    case "countSuccesses":
      pool = visitSuccessPool(env, value.pool, active)
      fromDice = false
      marksFailure = false
      break
    case "cancelFailures":
      pool = visitSuccessPool(env, value.pool, active)
      fromDice = false
      marksFailure = true
      break
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }

  const modParam = visitModParam(env, value.modParam, active)
  const modifier = marksFailure ? "cf" : "cs"
  const layout: NodeLayout = {
    kind: "diceModifier",
    pool,
    modifier,
    modParam: { comparator: modParam.comparator, param: modParam.param },
  }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.dice)

  const result: SuccessPool = fromDice
    ? (() => {
        const dice = dicePoolValue(pool)
        return {
          successCount: 0,
          face: dice.face,
          groupID: dice.groupID,
          details: cloneDetails(dice.details),
        }
      })()
    : cloneSuccessPool(successPoolValue(pool))

  for (const detail of result.details) {
    if (detail.isKept && modParam.predicate(detail.result)) {
      detail.outcome = marksFailure ? "failure" : "success"
    }
  }
  result.successCount = computeSuccessCount(result)
  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.dice,
    { kind: "successpool", value: result },
    Math.max(maxReadyRound([pool]), modParam.readyRound)
  )
}

function evaluateBaseDice(
  env: EvaluationEnvironment,
  layout: NodeLayout,
  count: number,
  face: number | "fudge" | "coin",
  dependencyRound: number
): OutputNode {
  const groupID = env.nextGroupID++
  const details: DieDetail[] = []
  const validFace = face === "fudge" || face === "coin" || face > 0
  const shouldRoll = validFace && count > 0
  const rollRound = Math.max(dependencyRound, env.rollBarrier) + (shouldRoll ? 1 : 0)

  env.groups.push({ firstRound: rollRound, id: groupID })

  if (shouldRoll) {
    for (let index = 0; index < count; index++) {
      const result = roll(env, face)
      const rollID = env.nextRollID++
      details.push({
        result,
        rolledResult: result,
        rollID: rollID,
        rollRound,
        isKept: true,
        outcome: "none",
        reason: "initial",
      })
      // record the roll in the environment
      env.groupMap.set(rollID, groupID)
      getRound(env, rollRound).roll.push({ id: rollID, value: result, face })
    }
  }
  const pool: DicePool = { total: 0, face: validFace ? face : 0, groupID, details }
  pool.total = computeDiceTotal(pool)
  return evaluated(reserveNodeID(env), layout, PRECEDENCE.dice, { kind: "dicepool", value: pool }, rollRound)
}

function roll(env: EvaluationEnvironment, face: number | "fudge" | "coin"): number {
  const result = env.random(face)
  if (!Number.isInteger(result)) throw new RuntimeException("随机数生成器必须返回整数")

  switch (face) {
    case "fudge":
      if (result < -1 || result > 1) throw new RuntimeException(`随机数生成器为${face}面骰返回了无效结果${result}`)
      return result
    case "coin":
      if (result < 0 || result > 1) throw new RuntimeException(`随机数生成器为${face}面骰返回了无效结果${result}`)
      return result
    default:
      if (result < 1 || result > face) throw new RuntimeException(`随机数生成器为${face}面骰返回了无效结果${result}`)
      return result
  }
}

function applyKeepDrop(
  pool: DicePool,
  kind: "keepHigh" | "keepLow" | "dropHigh" | "dropLow",
  count: number,
  env: EvaluationEnvironment,
  rollRound: number
): void {
  const indices = pool.details
    .map((detail, index) => ({ detail, index }))
    .filter(({ detail }) => detail.isKept)
    .sort((lhs, rhs) => {
      const difference =
        kind === "keepHigh" || kind === "dropHigh"
          ? rhs.detail.result - lhs.detail.result
          : lhs.detail.result - rhs.detail.result
      return Number.isNaN(difference) || difference === 0 ? lhs.index - rhs.index : difference
    })
    .map(({ index }) => index)

  const dropped = kind === "keepHigh" || kind === "keepLow" ? indices.slice(count) : indices.slice(0, count)
  for (const index of dropped) {
    pool.details[index].isKept = false
    getRound(env, rollRound).remove.push({ id: pool.details[index].rollID })
  }
  pool.total = computeDiceTotal(pool)
}

function maximumFace(face: DicePool["face"]): number {
  if (face === "fudge" || face === "coin") return 1
  return face
}

function applyRepeatedRolls(
  env: EvaluationEnvironment,
  pool: DicePool,
  kind: "explode" | "reroll",
  predicate: (value: number) => boolean,
  timeLimit: number | undefined,
  countLimit: number | undefined,
  dependencyRound: number
): void {
  let candidates = pool.details.map((_, index) => index).filter((index) => pool.details[index].isKept)
  let iterations = 0
  let usedCount = 0

  while (candidates.length > 0 && (timeLimit === undefined || iterations < timeLimit)) {
    const triggered: number[] = []
    for (const index of candidates) {
      if (!predicate(pool.details[index].result)) continue
      if (countLimit !== undefined && usedCount >= countLimit) break
      triggered.push(index)
      usedCount++
    }
    if (triggered.length === 0) break

    const nextCandidates: number[] = []
    for (const sourceIndex of triggered) {
      const source = pool.details[sourceIndex]
      if (kind === "reroll") source.isKept = false
      const rolledResult = roll(env, pool.face)
      const rollRound = Math.max(dependencyRound + 1, source.rollRound + 1)
      const rollId = env.nextRollID++
      const detail: DieDetail = {
        result: rolledResult,
        rolledResult,
        rollID: rollId,
        rollRound,
        isKept: true,
        outcome: "none",
        reason: kind === "explode" ? "explosion" : "reroll",
        sourceID: source.rollID,
      }
      pool.details.push(detail)
      nextCandidates.push(pool.details.length - 1)
      // Record the new roll
      getRound(env, rollRound).roll.push({ id: rollId, value: rolledResult, face: pool.face })
      env.groupMap.set(rollId, pool.groupID)
      if (kind === "reroll") {
        getRound(env, rollRound).reroll.push({ oldId: source.rollID, newId: rollId })
      } else {
        getRound(env, rollRound).explosion.push({ sourceId: source.rollID, newId: rollId })
      }
    }

    candidates = nextCandidates
    iterations++
  }
  pool.total = computeDiceTotal(pool)
}
