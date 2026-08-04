import type {
  BooleanBinaryType,
  BooleanCompareType,
  BooleanType,
  DicePoolType,
  HIRNode,
  LimitType,
  ListBinaryType,
  ListFunctionType,
  ListType,
  ModParamType,
  NumberBinaryType,
  NumberFunctionType,
  NumberType,
  SuccessPoolType,
} from "./types.js"
import { assertNever, formatFiniteNumber, PRECEDENCE } from "../utils.js"

type Rendered = {
  text: string
  precedence: number
}

function parenthesize(value: Rendered): string {
  return `(${value.text})`
}

function renderLeftOperand(value: Rendered, precedence: number): string {
  return value.precedence < precedence ? parenthesize(value) : value.text
}

function renderRightOperand(value: Rendered, precedence: number): string {
  return value.precedence <= precedence ? parenthesize(value) : value.text
}

function renderInfix(lhs: Rendered, operator: string, rhs: Rendered, precedence: number): Rendered {
  return {
    text: `${renderLeftOperand(lhs, precedence)} ${operator} ${renderRightOperand(rhs, precedence)}`,
    precedence,
  }
}

function renderPrefix(operator: string, value: Rendered): Rendered {
  const operand = value.precedence <= PRECEDENCE.unary ? parenthesize(value) : value.text
  return { text: `${operator}${operand}`, precedence: PRECEDENCE.unary }
}

function renderTernary(condition: Rendered, trueValue: Rendered, falseValue: Rendered): Rendered {
  const renderedCondition = condition.precedence <= PRECEDENCE.ternary ? parenthesize(condition) : condition.text
  const renderedTrueValue = trueValue.precedence === PRECEDENCE.ternary ? parenthesize(trueValue) : trueValue.text

  return {
    text: `${renderedCondition} ? ${renderedTrueValue} : ${falseValue.text}`,
    precedence: PRECEDENCE.ternary,
  }
}

function renderConstant(value: number): Rendered {
  if (Number.isNaN(value)) {
    // Both literals are valid, and folding the subtraction produces NaN again.
    return { text: "1e309 - 1e309", precedence: PRECEDENCE.additive }
  }

  if (value === Number.POSITIVE_INFINITY) {
    return { text: "1e309", precedence: PRECEDENCE.atom }
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return { text: "-1e309", precedence: PRECEDENCE.unary }
  }

  const text = formatFiniteNumber(value)
  return {
    text,
    precedence: text.startsWith("-") ? PRECEDENCE.unary : PRECEDENCE.atom,
  }
}

function renderNumberAtom(value: NumberType): string {
  const rendered = renderNumber(value)
  return rendered.precedence === PRECEDENCE.atom ? rendered.text : parenthesize(rendered)
}

function renderModParam(value: ModParamType): string {
  const operator = (() => {
    switch (value.kind) {
      case "equal":
        return "="
      case "notEqual":
        return "!="
      case "greaterThan":
        return ">"
      case "greaterThanOrEqual":
        return ">="
      case "lessThan":
        return "<"
      case "lessThanOrEqual":
        return "<="
      /* v8 ignore next -- @preserve */
      default:
        return assertNever(value)
    }
  })()

  return `[${operator}${renderNumberAtom(value.value)}]`
}

function renderLimit(value: LimitType | undefined): string {
  if (!value) return ""

  const timeLimit = value.timeLimit ? `lt${renderNumberAtom(value.timeLimit)}` : ""
  const countLimit = value.countLimit ? `lc${renderNumberAtom(value.countLimit)}` : ""
  return `${timeLimit}${countLimit}`
}

function renderDicePool(value: DicePoolType): Rendered {
  switch (value.kind) {
    case "standard":
      return {
        text: `${renderNumberAtom(value.count)}d${renderNumberAtom(value.sides)}`,
        precedence: PRECEDENCE.dice,
      }
    case "fudge":
      return {
        text: `${renderNumberAtom(value.count)}dF`,
        precedence: PRECEDENCE.dice,
      }
    case "coin":
      return {
        text: `${renderNumberAtom(value.count)}dC`,
        precedence: PRECEDENCE.dice,
      }
    case "keepHigh":
    case "keepLow":
    case "dropHigh":
    case "dropLow": {
      const operator = {
        keepHigh: "kh",
        keepLow: "kl",
        dropHigh: "dh",
        dropLow: "dl",
      }[value.kind]
      const count = value.count.kind === "constant" && value.count.value === 1 ? "" : renderNumberAtom(value.count)
      return {
        text: `${renderDicePool(value.pool).text}${operator}${count}`,
        precedence: PRECEDENCE.dice,
      }
    }
    case "min":
      return {
        text: `${renderDicePool(value.pool).text}min${renderNumberAtom(value.value)}`,
        precedence: PRECEDENCE.dice,
      }
    case "max":
      return {
        text: `${renderDicePool(value.pool).text}max${renderNumberAtom(value.value)}`,
        precedence: PRECEDENCE.dice,
      }
    case "explode":
      return {
        text: `${renderDicePool(value.pool).text}x${
          value.modParam ? renderModParam(value.modParam) : ""
        }${renderLimit(value.limit)}`,
        precedence: PRECEDENCE.dice,
      }
    case "reroll":
      return {
        text: `${renderDicePool(value.pool).text}r${renderModParam(value.modParam)}${renderLimit(value.limit)}`,
        precedence: PRECEDENCE.dice,
      }
    case "subtractFailures":
      return {
        text: `${renderDicePool(value.pool).text}sf${renderModParam(value.modParam)}`,
        precedence: PRECEDENCE.dice,
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderSuccessPool(value: SuccessPoolType): Rendered {
  switch (value.kind) {
    case "countSuccessesFromDicePool":
      return {
        text: `${renderDicePool(value.pool).text}cs${renderModParam(value.modParam)}`,
        precedence: PRECEDENCE.dice,
      }
    case "cancelFailuresFromDicePool":
      return {
        text: `${renderDicePool(value.pool).text}cf${renderModParam(value.modParam)}`,
        precedence: PRECEDENCE.dice,
      }
    case "countSuccesses":
      return {
        text: `${renderSuccessPool(value.pool).text}cs${renderModParam(value.modParam)}`,
        precedence: PRECEDENCE.dice,
      }
    case "cancelFailures":
      return {
        text: `${renderSuccessPool(value.pool).text}cf${renderModParam(value.modParam)}`,
        precedence: PRECEDENCE.dice,
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderAdd(value: Extract<NumberBinaryType, { kind: "add" }>): Rendered {
  let text: string | undefined

  for (const item of value.positive) {
    const rendered = renderNumber(item)
    if (text === undefined) {
      text = renderLeftOperand(rendered, PRECEDENCE.additive)
    } else {
      text += ` + ${renderRightOperand(rendered, PRECEDENCE.additive)}`
    }
  }

  for (const item of value.negative) {
    const rendered = renderNumber(item)
    if (text === undefined) {
      text = renderPrefix("-", rendered).text
    } else {
      text += ` - ${renderRightOperand(rendered, PRECEDENCE.additive)}`
    }
  }

  if (value.constant !== 0 || text === undefined) {
    /* v8 ignore else -- @preserve */
    if (text !== undefined) {
      if (Number.isNaN(value.constant)) {
        text += ` + ${renderRightOperand(renderConstant(value.constant), PRECEDENCE.additive)}`
      } else if (value.constant < 0) {
        text += ` - ${renderRightOperand(renderConstant(-value.constant), PRECEDENCE.additive)}`
      } else {
        text += ` + ${renderRightOperand(renderConstant(value.constant), PRECEDENCE.additive)}`
      }
    } else {
      /* the HIR builder will fold this case into a constant, so this branch is unreachable */
      /* v8 ignore next -- @preserve */
      text = renderConstant(value.constant).text
    }
  }

  return { text, precedence: PRECEDENCE.additive }
}

function renderMultiply(value: Extract<NumberBinaryType, { kind: "multiply" }>): Rendered {
  const factors: Rendered[] = []

  if (value.constant !== 1 || value.factors.length === 0) {
    factors.push(renderConstant(value.constant))
  }
  factors.push(...value.factors.map(renderNumber))

  const [first, ...rest] = factors
  let text = renderLeftOperand(first, PRECEDENCE.multiplicative)
  for (const factor of rest) {
    text += ` * ${renderRightOperand(factor, PRECEDENCE.multiplicative)}`
  }

  return { text, precedence: PRECEDENCE.multiplicative }
}

function renderNumberBinary(value: NumberBinaryType): Rendered {
  switch (value.kind) {
    case "add":
      return renderAdd(value)
    case "multiply":
      return renderMultiply(value)
    case "divide":
      return renderInfix(renderNumber(value.lhs), "/", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "intDivide":
      return renderInfix(renderNumber(value.lhs), "//", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "modulo":
      return renderInfix(renderNumber(value.lhs), "%", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderNumberFunction(value: NumberFunctionType): Rendered {
  switch (value.kind) {
    case "floor":
    case "ceil":
    case "round":
    case "abs":
      return {
        text: `${value.kind}(${renderNumber(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "fmax":
    case "fmin":
    case "sum":
    case "avg":
    case "len":
      return {
        text: `${value.kind}(${renderList(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderNumber(value: NumberType): Rendered {
  switch (value.kind) {
    case "constant":
      return renderConstant(value.value)
    case "dicePool":
      return renderDicePool(value.value)
    case "successPool":
      return renderSuccessPool(value.value)
    case "binary":
      return renderNumberBinary(value.value)
    case "function":
      return renderNumberFunction(value.value)
    case "ternary":
      return renderTernary(
        renderBoolean(value.condition),
        renderNumber(value.trueValue),
        renderNumber(value.falseValue)
      )
    case "negative":
      return renderPrefix("-", renderNumber(value.value))
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderListBinary(value: ListBinaryType): Rendered {
  switch (value.kind) {
    case "concat":
      return renderInfix(renderList(value.lhs), "#", renderList(value.rhs), PRECEDENCE.concat)
    case "add":
      return renderInfix(renderList(value.lhs), "+", renderNumber(value.rhs), PRECEDENCE.additive)
    case "addReverse":
      return renderInfix(renderNumber(value.lhs), "+", renderList(value.rhs), PRECEDENCE.additive)
    case "multiply":
      return renderInfix(renderList(value.lhs), "*", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "multiplyReverse":
      return renderInfix(renderNumber(value.lhs), "*", renderList(value.rhs), PRECEDENCE.multiplicative)
    case "subtract":
      return renderInfix(renderList(value.lhs), "-", renderNumber(value.rhs), PRECEDENCE.additive)
    case "subtractReverse":
      return renderInfix(renderNumber(value.lhs), "-", renderList(value.rhs), PRECEDENCE.additive)
    case "divide":
      return renderInfix(renderList(value.lhs), "/", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "divideReverse":
      return renderInfix(renderNumber(value.lhs), "/", renderList(value.rhs), PRECEDENCE.multiplicative)
    case "intDivide":
      return renderInfix(renderList(value.lhs), "//", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "intDivideReverse":
      return renderInfix(renderNumber(value.lhs), "//", renderList(value.rhs), PRECEDENCE.multiplicative)
    case "modulo":
      return renderInfix(renderList(value.lhs), "%", renderNumber(value.rhs), PRECEDENCE.multiplicative)
    case "moduloReverse":
      return renderInfix(renderNumber(value.lhs), "%", renderList(value.rhs), PRECEDENCE.multiplicative)
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderListFunction(value: ListFunctionType): Rendered {
  switch (value.kind) {
    case "floor":
    case "ceil":
    case "round":
    case "abs":
      return {
        text: `${value.kind}(${renderList(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "fmax":
    case "fmin":
      return {
        text: `${value.kind}(${renderList(value.list).text}, ${renderNumber(value.count).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "sort":
      return {
        text: `sort(${renderList(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "sortdesc":
      return {
        text: `sortd(${renderList(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "tolistFromDice":
      return {
        text: `tolist(${renderDicePool(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "tolistFromSuccess":
      return {
        text: `tolist(${renderSuccessPool(value.value).text})`,
        precedence: PRECEDENCE.atom,
      }
    case "filter":
      return {
        text: `filter${renderModParam(value.modParam)}(${renderList(value.list).text})`,
        precedence: PRECEDENCE.atom,
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderList(value: ListType): Rendered {
  switch (value.kind) {
    case "explicit":
      return {
        text: `[${value.value.map((item) => renderNumber(item).text).join(", ")}]`,
        precedence: PRECEDENCE.atom,
      }
    case "function":
      return renderListFunction(value.value)
    case "binary":
      return renderListBinary(value.value)
    case "ternary":
      return renderTernary(renderBoolean(value.condition), renderList(value.trueValue), renderList(value.falseValue))
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderBooleanCompare(value: BooleanCompareType): Rendered {
  const operator = (() => {
    switch (value.kind) {
      case "equal":
        return "="
      case "notEqual":
        return "!="
      case "greaterThan":
        return ">"
      case "greaterThanOrEqual":
        return ">="
      case "lessThan":
        return "<"
      case "lessThanOrEqual":
        return "<="
      /* v8 ignore next -- @preserve */
      default:
        return assertNever(value)
    }
  })()

  return renderInfix(renderNumber(value.lhs), operator, renderNumber(value.rhs), PRECEDENCE.compare)
}

function renderBooleanBinary(value: BooleanBinaryType): Rendered {
  switch (value.kind) {
    case "and":
      return renderInfix(renderBoolean(value.lhs), "&&", renderBoolean(value.rhs), PRECEDENCE.and)
    case "or":
      return renderInfix(renderBoolean(value.lhs), "||", renderBoolean(value.rhs), PRECEDENCE.or)
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function renderBoolean(value: BooleanType): Rendered {
  switch (value.kind) {
    case "constant":
      return {
        text: value.value ? "true" : "false",
        precedence: PRECEDENCE.atom,
      }
    case "compare":
      return renderBooleanCompare(value.value)
    case "binary":
      return renderBooleanBinary(value.value)
    case "ternary":
      return renderTernary(
        renderBoolean(value.condition),
        renderBoolean(value.trueValue),
        renderBoolean(value.falseValue)
      )
    case "not":
      return renderPrefix("!", renderBoolean(value.value))
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

export function hirToString(value: HIRNode): string {
  switch (value.kind) {
    case "number":
      return renderNumber(value.value).text
    case "list":
      return renderList(value.value).text
    case "boolean":
      return renderBoolean(value.value).text
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}
