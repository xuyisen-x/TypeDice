import type { HIRNode } from "../hir/types.js"
import { assertNever, type Result } from "../utils.js"
import { visitBoolean } from "./visitors/boolean.js"
import { visitList } from "./visitors/list.js"
import { visitNumber } from "./visitors/number.js"
import type { OutputNode, EvaluationEnvironment, EvaluationOptions, EvaluationResult } from "./types.js"
import { defaultRandom } from "./utils.js"
import { RuntimeException } from "./errors.js"

export function evaluateHir(value: HIRNode, options?: EvaluationOptions): Result<EvaluationResult, string> {
  const env: EvaluationEnvironment = {
    random: options?.random ?? defaultRandom,
    nextNodeID: 0,
    nextRollID: 0,
    nextGroupID: 0,
    groups: [],
    groupMap: new Map(),
    rollMap: new Map(),
    rollBarrier: 0,
  }
  try {
    const outputNode = evaluateNode(env, value)
    return {
      ok: true,
      value: {
        output: outputNode,
        groups: env.groups,
        groupMap: env.groupMap,
        roundInfo: [...env.rollMap.entries()].sort(([keyA], [keyB]) => keyA - keyB).map(([, value]) => value),
      },
    }
  } catch (e) {
    if (e instanceof RuntimeException) {
      return { ok: false, error: e.message }
    }
    throw e
  }
}

function evaluateNode(env: EvaluationEnvironment, value: HIRNode): OutputNode {
  switch (value.kind) {
    case "number":
      return visitNumber(env, value.value, true)
    case "list":
      return visitList(env, value.value, true)
    case "boolean":
      return visitBoolean(env, value.value, true)
    default:
      return assertNever(value)
  }
}
