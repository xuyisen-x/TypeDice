import { CstParser, EOF } from "chevrotain"
import type { CstNode, IToken, IRecognitionException } from "chevrotain"
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
  BooleanLiteral,
  NamedExpression,
  LParen,
  RParen,
  Comma,
  LBracket,
  RBracket,
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

export class DiceParser extends CstParser {
  public readonly optionalWhitespace = this.RULE("optional_whitespace", () => {
    this.OPTION(() => {
      this.CONSUME(WhiteSpace)
    })
  })

  public readonly expressionEntry = this.RULE("expressionEntry", () => {
    this.SUBRULE(this.optionalWhitespace) // Allow leading whitespace
    this.SUBRULE(this.expression)
    this.SUBRULE2(this.optionalWhitespace) // Allow trailing whitespace
    this.CONSUME(EOF)
  })

  public readonly expression = this.RULE("expression", () => {
    this.SUBRULE(this.conditionalExpression)
  })

  public readonly conditionalExpression = this.RULE("conditionalExpression", () => {
    this.SUBRULE(this.binaryExpression, { LABEL: "condition" })
    this.OPTION(() => {
      this.SUBRULE(this.optionalWhitespace) // Allow whitespace before the question mark
      this.CONSUME(Question)
      this.SUBRULE2(this.optionalWhitespace) // Allow whitespace after the question mark
      this.SUBRULE(this.expression, { LABEL: "trueBranch" })
      this.SUBRULE3(this.optionalWhitespace) // Allow whitespace before the colon
      this.CONSUME(Colon)
      this.SUBRULE4(this.optionalWhitespace) // Allow whitespace after the colon
      this.SUBRULE(this.conditionalExpression, { LABEL: "falseBranch" })
    })
  })

  public readonly binaryExpression = this.RULE("binaryExpression", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "lhs" })
    this.MANY(() => {
      this.SUBRULE(this.optionalWhitespace) // Allow whitespace before the binary operator
      this.CONSUME(BinaryOperator, { LABEL: "operator" })
      this.SUBRULE2(this.optionalWhitespace) // Allow whitespace after the binary operator
      this.SUBRULE2(this.unaryExpression, { LABEL: "rhs" })
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
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.atom, { LABEL: "count" })
          this.OPTION(() => this.SUBRULE(this.diceTail, { LABEL: "tail" }))
        },
      },
      { ALT: () => this.SUBRULE2(this.diceTail, { LABEL: "pureTail" }) },
    ])
  })

  public readonly diceTail = this.RULE("diceTail", () => {
    this.OR([
      { ALT: () => this.CONSUME(Df) },
      { ALT: () => this.CONSUME(Dc) },
      {
        ALT: () => {
          this.CONSUME(D)
          this.SUBRULE(this.atom, { LABEL: "sides" })
        },
      },
    ])
  })

  public readonly atom = this.RULE("atom", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NamedExpression) },
      { ALT: () => this.SUBRULE(this.listExpression) },
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
    ])
  })

  public readonly listExpression = this.RULE("listExpression", () => {
    this.CONSUME(LBracket)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening bracket
    this.OPTION(() => {
      this.SUBRULE(this.expression, { LABEL: "element" })
      this.MANY(() => {
        this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
        this.CONSUME(Comma)
        this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
        this.SUBRULE2(this.expression, { LABEL: "elements" })
      })
    })
    this.SUBRULE4(this.optionalWhitespace) // Allow whitespace before the closing bracket
    this.CONSUME2(RBracket)
  })

  public readonly regularFunctionCall = this.RULE("regularFunctionCall", () => {
    this.CONSUME(BuiltinFunction)
    this.CONSUME(LParen)
    this.SUBRULE(this.optionalWhitespace) // Allow whitespace after the opening parenthesis
    this.SUBRULE(this.expression, { LABEL: "arg" })
    this.MANY(() => {
      this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
      this.CONSUME(Comma)
      this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
      this.SUBRULE2(this.expression, { LABEL: "args" })
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
    this.MANY(() => {
      this.SUBRULE2(this.optionalWhitespace) // Allow whitespace before the comma
      this.CONSUME(Comma)
      this.SUBRULE3(this.optionalWhitespace) // Allow whitespace after the comma
      this.SUBRULE2(this.expression, { LABEL: "args" })
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
    this.OR([
      { ALT: () => this.SUBRULE(this.keepDropModifier) },
      { ALT: () => this.SUBRULE(this.minMaxModifier) },
      { ALT: () => this.SUBRULE(this.rerollModifier) },
      { ALT: () => this.SUBRULE(this.explodeModifier) },
      { ALT: () => this.SUBRULE(this.successFailureModifier) },
    ])
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
    this.OR([
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
    ])
  )
  constructor() {
    super(allTokens)
    this.performSelfAnalysis()
  }
}

const parser = new DiceParser()

export function parseDiceTokens(tokens: IToken[]): Result<CstNode, IRecognitionException[]> {
  parser.input = tokens
  const cst = parser.expressionEntry()
  if (parser.errors.length > 0) return { ok: false, error: parser.errors }
  return { ok: true, value: cst }
}
