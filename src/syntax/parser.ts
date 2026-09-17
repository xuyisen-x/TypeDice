import { CstParser, tokenMatcher } from "chevrotain"
import type { IToken, IRecognitionException, TokenType } from "chevrotain"
import { chineseParserErrorMessageProvider } from "../errors.js"
import {
  WhiteSpace,
  Colon,
  Question,
  BinaryOperator,
  UnaryOperator,
  Df,
  Dc,
  D,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NamedExpression,
  LParen,
  RParen,
  Comma,
  LBracket,
  RBracket,
  LCurly,
  RCurly,
  BuiltinFunction,
  Filter,
  RepeatForm,
  CritForm,
  KeepDropModifierOperator,
  MinMaxModifierOperator,
  R,
  X,
  SuccessFailureModifierOperator,
  CompareOperator,
  Lt,
  Lc,
  allTokens,
} from "./lexer.js"
import type { Result } from "../utils.js"
import type { ExpressionEntryCstNode } from "./generated/cst.js"

export class DiceParser extends CstParser {
  public readonly optionalWhitespace = this.RULE("optional_whitespace", () => {
    this.OPTION(() => {
      this.CONSUME(WhiteSpace)
    })
  })

  private nextAfterOptionalWhitespaceIs(tokenType: TokenType): boolean {
    const offset = tokenMatcher(this.LA(1), WhiteSpace) ? 2 : 1
    return tokenMatcher(this.LA(offset), tokenType)
  }

  public readonly expressionEntry = this.RULE("expressionEntry", () => {
    this.SUBRULE(this.optionalWhitespace) // Allow leading whitespace
    this.SUBRULE(this.expression)
    this.SUBRULE2(this.optionalWhitespace) // Allow trailing whitespace
  })

  public readonly expression = this.RULE("expression", () => {
    this.SUBRULE(this.conditionalExpression)
  })

  public readonly conditionalExpression = this.RULE("conditionalExpression", () => {
    this.SUBRULE(this.binaryExpression, { LABEL: "condition" })
    this.OPTION({
      GATE: () => this.nextAfterOptionalWhitespaceIs(Question),
      DEF: () => {
        this.SUBRULE(this.optionalWhitespace) // Allow whitespace before the question mark
        this.CONSUME(Question)
        this.SUBRULE2(this.optionalWhitespace) // Allow whitespace after the question mark
        this.SUBRULE(this.expression, { LABEL: "trueBranch" })
        this.SUBRULE3(this.optionalWhitespace) // Allow whitespace before the colon
        this.CONSUME(Colon)
        this.SUBRULE4(this.optionalWhitespace) // Allow whitespace after the colon
        this.SUBRULE(this.conditionalExpression, { LABEL: "falseBranch" })
      },
    })
  })

  public readonly binaryExpression = this.RULE("binaryExpression", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "lhs" })
    this.MANY({
      GATE: () => this.nextAfterOptionalWhitespaceIs(BinaryOperator),
      DEF: () => {
        this.SUBRULE(this.optionalWhitespace) // Allow whitespace before the binary operator
        this.CONSUME(BinaryOperator, { LABEL: "operator" })
        this.SUBRULE2(this.optionalWhitespace) // Allow whitespace after the binary operator
        this.SUBRULE2(this.unaryExpression, { LABEL: "rhs" })
      },
    })
  })

  public readonly unaryExpression = this.RULE("unaryExpression", () => {
    this.MANY(() => {
      this.CONSUME(UnaryOperator, { LABEL: "operator" })
      this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the unary operator
    })
    this.SUBRULE(this.diceWithModifiers, { LABEL: "operand" })
  })

  public readonly diceWithModifiers = this.RULE("diceWithModifiers", () => {
    this.SUBRULE(this.diceExpression, { LABEL: "base" })
    this.MANY(() => this.SUBRULE(this.modifier, { LABEL: "modifier" }))
  })

  public readonly diceExpression = this.RULE("diceExpression", () => {
    this.OR({
      DEF: [
        {
          ALT: () => {
            this.SUBRULE(this.atom, { LABEL: "count" })
            this.OPTION(() => this.SUBRULE(this.diceTail, { LABEL: "tail" }))
          },
        },
        { ALT: () => this.SUBRULE2(this.diceTail, { LABEL: "pureTail" }) },
      ],
      ERR_MSG: "单独的原子表达式或骰子表达式",
    })
  })

  public readonly diceTail = this.RULE("diceTail", () => {
    this.OR({
      DEF: [
        { ALT: () => this.CONSUME(Df) },
        { ALT: () => this.CONSUME(Dc) },
        {
          ALT: () => {
            this.CONSUME(D)
            this.SUBRULE(this.atom, { LABEL: "sides" })
          },
        },
      ],
      ERR_MSG: "df、dc 或标准骰子表达式",
    })
  })

  public readonly atom = this.RULE("atom", () => {
    this.OR({
      DEF: [
        { ALT: () => this.CONSUME(NumberLiteral) },
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.CONSUME(BooleanLiteral) },
        { ALT: () => this.CONSUME(NamedExpression) },
        { ALT: () => this.SUBRULE(this.listExpression) },
        { ALT: () => this.SUBRULE(this.stringSetExpression) },
        { ALT: () => this.SUBRULE(this.regularFunctionCall) },
        { ALT: () => this.SUBRULE(this.filterCall) },
        { ALT: () => this.SUBRULE(this.repeatForm) },
        { ALT: () => this.SUBRULE(this.critForm) },
        {
          ALT: () => {
            this.CONSUME(LParen)
            this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
            this.SUBRULE(this.expression, { LABEL: "wrappedExpression" })
            this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the closing parenthesis
            this.CONSUME2(RParen)
          },
        },
      ],
      ERR_MSG:
        "数字字面量、字符串字面量、布尔值字面量、列表字面量、字符串集合字面量、命名表达式、函数调用或括号包裹的表达式",
    })
  })

  public readonly listExpression = this.RULE("listExpression", () => {
    this.CONSUME(LBracket)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening bracket
    this.OPTION(() => {
      this.SUBRULE(this.expression, { LABEL: "element" })
      this.MANY({
        GATE: () => this.nextAfterOptionalWhitespaceIs(Comma),
        DEF: () => {
          this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
          this.CONSUME(Comma)
          this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
          this.SUBRULE2(this.expression, { LABEL: "elements" })
        },
      })
    })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing bracket
    this.CONSUME2(RBracket)
  })

  public readonly stringSetExpression = this.RULE("stringSetExpression", () => {
    this.CONSUME(LCurly)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening brace
    this.OPTION(() => {
      this.SUBRULE(this.expression, { LABEL: "element" })
      this.MANY({
        GATE: () => this.nextAfterOptionalWhitespaceIs(Comma),
        DEF: () => {
          this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
          this.CONSUME(Comma)
          this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
          this.SUBRULE2(this.expression, { LABEL: "elements" })
        },
      })
    })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing brace
    this.CONSUME(RCurly)
  })

  public readonly regularFunctionCall = this.RULE("regularFunctionCall", () => {
    this.CONSUME(BuiltinFunction)
    this.CONSUME(LParen)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
    this.SUBRULE(this.expression, { LABEL: "arg" })
    this.MANY({
      GATE: () => this.nextAfterOptionalWhitespaceIs(Comma),
      DEF: () => {
        this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
        this.CONSUME(Comma)
        this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
        this.SUBRULE2(this.expression, { LABEL: "args" })
      },
    })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing parenthesis
    this.CONSUME2(RParen)
  })

  public readonly filterCall = this.RULE("filterCall", () => {
    this.CONSUME(Filter)
    this.SUBRULE(this.modParam)
    this.CONSUME(LParen)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
    this.SUBRULE(this.expression, { LABEL: "arg" })
    this.MANY({
      GATE: () => this.nextAfterOptionalWhitespaceIs(Comma),
      DEF: () => {
        this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
        this.CONSUME(Comma)
        this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
        this.SUBRULE2(this.expression, { LABEL: "args" })
      },
    })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing parenthesis
    this.CONSUME2(RParen)
  })

  public readonly repeatForm = this.RULE("repeatForm", () => {
    this.CONSUME(RepeatForm)
    this.CONSUME(LParen)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
    this.SUBRULE(this.expression)
    this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
    this.CONSUME(Comma)
    this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
    this.SUBRULE2(this.expression, { LABEL: "count" })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing parenthesis
    this.CONSUME2(RParen)
  })

  public readonly critForm = this.RULE("critForm", () => {
    this.CONSUME(CritForm)
    this.CONSUME(LParen)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
    this.SUBRULE(this.expression)
    this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the closing parenthesis
    this.CONSUME2(RParen)
  })

  public readonly modifier = this.RULE("modifier", () => {
    this.OR({
      DEF: [
        { ALT: () => this.SUBRULE(this.keepDropModifier) },
        { ALT: () => this.SUBRULE(this.minMaxModifier) },
        { ALT: () => this.SUBRULE(this.rerollModifier) },
        { ALT: () => this.SUBRULE(this.explodeModifier) },
        { ALT: () => this.SUBRULE(this.successFailureModifier) },
      ],
      ERR_MSG: "keep/drop、min/max、reroll、explode 或 success/failure 修饰符",
    })
  })

  public readonly keepDropModifier = this.RULE("keepDropModifier", () => {
    this.CONSUME(KeepDropModifierOperator)
    this.OPTION(() => this.SUBRULE(this.atom, { LABEL: "count" }))
  })

  public readonly minMaxModifier = this.RULE("minMaxModifier", () => {
    this.CONSUME(MinMaxModifierOperator)
    this.SUBRULE(this.atom, { LABEL: "value" })
  })

  public readonly rerollModifier = this.RULE("rerollModifier", () => {
    this.CONSUME(R)
    this.SUBRULE(this.modParam)
    this.OPTION(() => this.SUBRULE(this.limit))
  })

  public readonly explodeModifier = this.RULE("explodeModifier", () => {
    this.CONSUME(X)
    this.OPTION(() => this.SUBRULE(this.modParam))
    this.OPTION2(() => this.SUBRULE(this.limit))
  })

  public readonly successFailureModifier = this.RULE("successFailureModifier", () => {
    this.CONSUME(SuccessFailureModifierOperator)
    this.SUBRULE(this.modParam)
  })

  public readonly modParam = this.RULE("modParam", () => {
    this.CONSUME(LBracket)
    this.OPTION(() => this.CONSUME(CompareOperator))
    this.SUBRULE(this.atom)
    this.CONSUME(RBracket)
  })

  public readonly limit = this.RULE("limit", () =>
    this.OR({
      DEF: [
        {
          ALT: () => {
            this.CONSUME(Lt)
            this.SUBRULE(this.atom, { LABEL: "timeLimit1" })
            this.OPTION(() => {
              this.CONSUME(Lc)
              this.SUBRULE2(this.atom, { LABEL: "countLimit1" })
            })
          },
        },
        {
          ALT: () => {
            this.CONSUME2(Lc)
            this.SUBRULE3(this.atom, { LABEL: "countLimit2" })
            this.OPTION2(() => {
              this.CONSUME2(Lt)
              this.SUBRULE4(this.atom, { LABEL: "timeLimit2" })
            })
          },
        },
      ],
      ERR_MSG: "时间限制、次数限制或两者",
    })
  )
  constructor() {
    super(allTokens, {
      errorMessageProvider: chineseParserErrorMessageProvider,
      nodeLocationTracking: "full",
    })
    this.performSelfAnalysis()
  }
}

const parser = new DiceParser()

export function parseDiceTokens(tokens: IToken[]): Result<ExpressionEntryCstNode, IRecognitionException[]> {
  parser.input = tokens
  const cst = parser.expressionEntry() as ExpressionEntryCstNode
  if (parser.errors.length > 0) return { ok: false, error: parser.errors }
  return { ok: true, value: cst }
}
