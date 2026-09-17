export type EvaluatedOutputNode = {
  id: number
  parenthesized: boolean
  layout: NodeLayout
  precedence: number
  status: "evaluated"
  value: RuntimeValue
  readyRound: number
}

export type ShortCircuitedOutputNode = {
  id: number
  parenthesized: boolean
  layout: NodeLayout
  precedence: number
  status: "short-circuited"
  value?: never
  readyRound?: never
}

export type OutputNode = EvaluatedOutputNode | ShortCircuitedOutputNode

export type EvaluatedModParam = {
  comparator: string
  param: OutputNode
  predicate: (value: number) => boolean
  readyRound: number
}

export type EvaluatedLimit = {
  timeLimit?: OutputNode
  countLimit?: OutputNode
  timeValue?: number
  countValue?: number
  readyRound: number
}

export type RuntimeValue =
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "list"; value: number[] }
  | { kind: "string"; value: string }
  | { kind: "stringSet"; value: Set<string> }
  | { kind: "dicepool"; value: DicePool }
  | { kind: "successpool"; value: SuccessPool }

export type DicePool = {
  total: number
  face: number | "fudge" | "coin"
  groupID: number
  details: DieDetail[]
}

export type SuccessPool = {
  successCount: number
  face: number | "fudge" | "coin"
  groupID: number
  details: DieDetail[]
}

export type DieDetail = {
  result: number
  rolledResult: number

  rollID: number
  rollRound: number
  isKept: boolean

  outcome: "none" | "success" | "failure"
} & (
  | {
      reason: "initial"
      sourceID?: never
    }
  | {
      reason: "reroll" | "explosion"
      sourceID: number
    }
)

export type NodeLayout =
  | { kind: "atom"; text: string }
  | { kind: "list"; children: OutputNode[] }
  | { kind: "stringSet"; children: OutputNode[] }
  | { kind: "unary"; operator: string; operand: OutputNode }
  | { kind: "binary"; operators: string[]; operands: OutputNode[] }
  | { kind: "ternary"; condition: OutputNode; trueBranch: OutputNode; falseBranch: OutputNode }
  | {
      kind: "function"
      name: string
      modParam?: {
        comparator: string
        param: OutputNode
      }
      args: OutputNode[]
    }
  | { kind: "dice"; count: OutputNode; face: OutputNode | "fudge" | "coin" }
  | {
      kind: "diceModifier"
      pool: OutputNode
      modifier: string
      argument?: OutputNode
      modParam?: {
        comparator: string
        param: OutputNode
      }
      timeLimit?: OutputNode
      countLimit?: OutputNode
    }

export type EvaluationOptions = {
  random?: (face: number | "fudge" | "coin") => number
}

export type RollInfo = {
  roll: { id: number; value: number; face: number | "fudge" | "coin" }[]
  reroll: { oldId: number; newId: number }[] // rerolling dice, maybe needed to be removed from the table
  explosion: { sourceId: number; newId: number }[]
  cover: { id: number; newValue: number }[]
  remove: { id: number }[]
}

export type EvaluationEnvironment = {
  random: (face: number | "fudge" | "coin") => number
  nextNodeID: number
  nextRollID: number
  nextGroupID: number
  groups: { firstRound: number; id: number }[]
  groupMap: Map<number, number> // rollID -> groupID
  rollMap: Map<number, RollInfo> // roundID -> RollInfo
  rollBarrier: number
}

export type EvaluationResult = {
  output: OutputNode
  groups: { firstRound: number; id: number }[]
  groupMap: Map<number, number> // rollID -> groupID
  roundInfo: RollInfo[]
}
