import type {
  DicePool,
  EvaluationOptions,
  EvaluationResult,
  HIRNode,
  OutputNode,
  resolveNamedExpressionResult,
  RuntimeValue,
  StandardErrorLocation,
} from "../src/index.js"
import { buildHirFromString, evaluateHir, hirToString } from "../src/index.js"

/* v8 ignore next -- @preserve */
export const emptyEnv = (_name: string): resolveNamedExpressionResult => {
  return { kind: "error", message: `未定义的命名表达式: ${_name}` }
}

export class ParserError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class LexerError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class HIRBuilderError extends Error {
  constructor(
    message: string,
    readonly location: StandardErrorLocation | null
  ) {
    super(message)
  }
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export function buildHirOrThrow(input: string, env = emptyEnv): HIRNode {
  const result = buildHirFromString(input, env)
  if (!result.ok) {
    switch (result.error.kind) {
      case "lexer":
        throw new LexerError(result.error.message, result.error.location)
      case "parser":
        throw new ParserError(result.error.message, result.error.location)
      case "hir":
        throw new HIRBuilderError(result.error.message, result.error.location)
    }
  }
  return result.value
}

export function canonicalize(input: string, env = emptyEnv): string {
  return hirToString(buildHirOrThrow(input, env))
}

export function evaluateHirOrThrow(value: HIRNode, options?: EvaluationOptions): EvaluationResult {
  const result = evaluateHir(value, options)
  if (!result.ok) {
    throw new EvaluationError(result.error)
  }
  return result.value
}

type RandomSource = NonNullable<EvaluationOptions["random"]>
type RandomFace = Parameters<RandomSource>[0]

export function sequenceRandom(...values: number[]): {
  random: RandomSource
  calls: () => RandomFace[]
} {
  let index = 0
  const faces: RandomFace[] = []
  return {
    random: (face) => {
      if (index >= values.length) throw new Error("The deterministic random sequence was exhausted")
      faces.push(face)
      return values[index++]
    },
    calls: () => faces,
  }
}

export function evaluatedValue(node: OutputNode): RuntimeValue {
  if (node.status !== "evaluated") throw new Error("Expected an evaluated node")
  return node.value
}

export function evaluate(input: string, rolls: number[]) {
  const source = sequenceRandom(...rolls)
  return evaluatedValue(evaluateHirOrThrow(buildHirOrThrow(input), { random: source.random }).output)
}

export function dicePool(node: OutputNode): DicePool {
  const value = evaluatedValue(node)
  if (value.kind !== "dicepool") throw new Error("Expected a dice pool")
  return value.value
}

export function numericResult(value: RuntimeValue): number {
  if (value.kind === "number") return value.value
  if (value.kind === "dicepool") return value.value.total
  if (value.kind === "successpool") return value.value.successCount
  throw new Error(`Expected a numeric runtime value, received ${value.kind}`)
}
