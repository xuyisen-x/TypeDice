import { createToken, Lexer } from "chevrotain"
import type { ILexingError, IToken, TokenType } from "chevrotain"
import type { Result } from "../utils.js"
import { chineseLexerErrorMessageProvider } from "../errors.js"

// ============================================================
// 1. Abstract token categories
// ============================================================

const category = (name: string, label: string): TokenType => createToken({ name, pattern: Lexer.NA, label })

export const BinaryOperator = category("BinaryOperator", "二元运算符") // 所有普通二元运算符：|| && < <= > >= = != # in | ^ & + - * / // %
export const UnaryOperator = category("UnaryOperator", "一元运算符") // 前缀运算符：+ - !
export const CompareOperator = category("CompareOperator", "比较运算符") // 比较运算符：< <= > >= = !=
export const KeepDropModifierOperator = category("KeepDropModifierOperator", "保留/移除修饰符") // kh kl dh dl
export const MinMaxModifierOperator = category("MinMaxModifierOperator", "最大/最小限制修饰符") // min max
export const SuccessFailureModifierOperator = category("SuccessFailureModifierOperator", "成功/失败修饰符") // cs cf sf
export const BuiltinFunction = category("BuiltinFunction", "函数名") // floor ceil round ...
export const BooleanLiteral = category("BooleanLiteral", "布尔值字面量") // true / false

// ============================================================
// 2. Helpers
// ============================================================

function keyword(name: string, image: string, categories: TokenType[] = []): TokenType {
  const pattern = new RegExp(image, "i")
  const label = image
  return createToken({ name, pattern, label, categories })
}

// ============================================================
// 3. Whitespace
// ============================================================

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  line_breaks: true,
  label: "空白",
})

// ============================================================
// 4. Named expression
//
// ${力量}
// ${attack-bonus}
// ${character.strength}
// ${123}
//
// Everything between ${ and } is treated as the name itself.
// Whitespace and } are not allowed.
// ============================================================

export const NamedExpression = createToken({
  name: "NamedExpression",
  pattern: /\$\{[^\s}]+\}/, // At least one non-whitespace / non-"}" character.
  label: "命名表达式",
})

// ============================================================
// 5. Special forms
//
// These are deliberately NOT normal function identifiers.
// ============================================================

export const RepeatForm = createToken({
  name: "RepeatForm",
  pattern: /@repeat/i,
  label: "@repeat",
})
export const CritForm = createToken({
  name: "CritForm",
  pattern: /@crit/i,
  label: "@crit",
})

// ============================================================
// 6. Multi-character symbolic operators
//
// Longer operators MUST appear before their shorter prefixes.
// ============================================================

export const SlashSlash = createToken({
  name: "SlashSlash",
  pattern: /\/\//,
  label: "//",
  categories: [BinaryOperator],
})
export const LogicalAnd = createToken({
  name: "LogicalAnd",
  pattern: /&&/,
  label: "&&",
  categories: [BinaryOperator],
})
export const LogicalOr = createToken({
  name: "LogicalOr",
  pattern: /\|\|/,
  label: "||",
  categories: [BinaryOperator],
})
export const NotEqual = createToken({
  name: "NotEqual",
  pattern: /!=/,
  label: "!=",
  categories: [BinaryOperator, CompareOperator],
})
export const GreaterEqual = createToken({
  name: "GreaterEqual",
  pattern: />=/,
  label: ">=",
  categories: [BinaryOperator, CompareOperator],
})
export const LessEqual = createToken({
  name: "LessEqual",
  pattern: /<=/,
  label: "<=",
  categories: [BinaryOperator, CompareOperator],
})

export const In = createToken({
  name: "In",
  pattern: /in/i,
  label: "in",
  categories: [BinaryOperator],
})

// ============================================================
// 7. Normal function keywords
//
// Longer keyword prefixes should be placed first.
// ============================================================

export const ToList = keyword("ToList", "tolist", [BuiltinFunction])
export const Filter = keyword("Filter", "filter")
export const Floor = keyword("Floor", "floor", [BuiltinFunction])
export const FMin = keyword("FMin", "fmin", [BuiltinFunction])
export const FMax = keyword("FMax", "fmax", [BuiltinFunction])
export const Round = keyword("Round", "round", [BuiltinFunction])
export const Sortd = keyword("Sortd", "sortd", [BuiltinFunction])
export const Ceil = keyword("Ceil", "ceil", [BuiltinFunction])
export const Sort = keyword("Sort", "sort", [BuiltinFunction])
export const Sum = keyword("Sum", "sum", [BuiltinFunction])
export const Avg = keyword("Avg", "avg", [BuiltinFunction])
export const Len = keyword("Len", "len", [BuiltinFunction])
export const Abs = keyword("Abs", "abs", [BuiltinFunction])

// ============================================================
// 8. Boolean literals
// ============================================================

export const True = keyword("True", "true", [BooleanLiteral])
export const False = keyword("False", "false", [BooleanLiteral])

// ============================================================
// 9. Dice modifier keywords
// ============================================================

// ------------------------------------------------------------
// Keep / Drop
// ------------------------------------------------------------

export const Kh = keyword("Kh", "kh", [KeepDropModifierOperator])
export const Kl = keyword("Kl", "kl", [KeepDropModifierOperator])
export const Dh = keyword("Dh", "dh", [KeepDropModifierOperator])
export const Dl = keyword("Dl", "dl", [KeepDropModifierOperator])

// ------------------------------------------------------------
// Min / Max
//
// These are dice modifiers. The corresponding function names are fmin/fmax.
// ------------------------------------------------------------

export const Min = keyword("Min", "min", [MinMaxModifierOperator])
export const Max = keyword("Max", "max", [MinMaxModifierOperator])

// ------------------------------------------------------------
// Success / Failure modifiers
// ------------------------------------------------------------

export const Cs = keyword("Cs", "cs", [SuccessFailureModifierOperator])
export const Cf = keyword("Cf", "cf", [SuccessFailureModifierOperator])
export const Sf = keyword("Sf", "sf", [SuccessFailureModifierOperator])

// df is reserved for Fudge dice.
export const Df = keyword("Df", "df")

// ------------------------------------------------------------
// Dice operators
//
// Longer d-prefixed tokens MUST precede D.
// ------------------------------------------------------------

export const Dc = keyword("Dc", "dc")
export const D = keyword("D", "d")

// ------------------------------------------------------------
// Reroll / Explode
// ------------------------------------------------------------

export const R = keyword("R", "r")
export const X = keyword("X", "x")

// ------------------------------------------------------------
// Limit
// ------------------------------------------------------------

export const Lt = keyword("Lt", "lt")
export const Lc = keyword("Lc", "lc")

// ============================================================
// 10. String literal
// ============================================================

// Uses JSON-compatible escaping, including escaped quotes, backslashes,
// control characters, and Unicode code units.
export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001F])*"/,
  label: "字符串字面量",
})

// ============================================================
// 11. Number literal
// ============================================================

// Supports:
// 1
// 1.
// 1.5
// .5
// 1e3
// 1.5e-3
// .5E+2
// NaN
// Inf
export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /(?:NaN|Inf|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)/i,
  label: "数字字面量",
})

// ============================================================
// 12. Delimiters
// ============================================================

export const LParen = createToken({ name: "LParen", pattern: /\(/, label: "(" })
export const RParen = createToken({ name: "RParen", pattern: /\)/, label: ")" })
export const LBracket = createToken({ name: "LBracket", pattern: /\[/, label: "[" })
export const RBracket = createToken({ name: "RBracket", pattern: /\]/, label: "]" })
export const LCurly = createToken({ name: "LCurly", pattern: /\{/, label: "{" })
export const RCurly = createToken({ name: "RCurly", pattern: /\}/, label: "}" })
export const Comma = createToken({ name: "Comma", pattern: /,/, label: "," })

// ============================================================
// 13. Ternary operator
// ============================================================

export const Question = createToken({ name: "Question", pattern: /\?/, label: "?" })
export const Colon = createToken({ name: "Colon", pattern: /:/, label: ":" })

// ============================================================
// 14. Single-character binary / unary operators
// ============================================================

// + is both binary and unary.
export const Plus = createToken({
  name: "Plus",
  pattern: /\+/,
  label: "+",
  categories: [BinaryOperator, UnaryOperator],
})
// - is both binary and unary.
export const Minus = createToken({
  name: "Minus",
  pattern: /-/,
  label: "-",
  categories: [BinaryOperator, UnaryOperator],
})
export const Star = createToken({ name: "Star", pattern: /\*/, label: "*", categories: [BinaryOperator] })
export const Slash = createToken({ name: "Slash", pattern: /\//, label: "/", categories: [BinaryOperator] })
export const Percent = createToken({ name: "Percent", pattern: /%/, label: "%", categories: [BinaryOperator] })
// List concatenation
export const Hash = createToken({ name: "Hash", pattern: /#/, label: "#", categories: [BinaryOperator] })
// String set operations. Logical && and || must appear before their single-character prefixes.
export const Ampersand = createToken({ name: "Ampersand", pattern: /&/, label: "&", categories: [BinaryOperator] })
export const Caret = createToken({ name: "Caret", pattern: /\^/, label: "^", categories: [BinaryOperator] })
export const Pipe = createToken({ name: "Pipe", pattern: /\|/, label: "|", categories: [BinaryOperator] })

// ! is ONLY logical NOT now.
// != has already been defined before this token.
export const LogicalNot = createToken({ name: "LogicalNot", pattern: /!/, label: "!", categories: [UnaryOperator] })
export const Greater = createToken({
  name: "Greater",
  pattern: />/,
  label: ">",
  categories: [BinaryOperator, CompareOperator],
})
export const Less = createToken({
  name: "Less",
  pattern: /</,
  label: "<",
  categories: [BinaryOperator, CompareOperator],
})
export const Equal = createToken({
  name: "Equal",
  pattern: /=/,
  label: "=",
  categories: [BinaryOperator, CompareOperator],
})

// ============================================================
// 15. Token vocabulary
// ============================================================

export const allTokens: TokenType[] = [
  // Abstract categories
  BinaryOperator,
  UnaryOperator,
  CompareOperator,
  KeepDropModifierOperator,
  MinMaxModifierOperator,
  SuccessFailureModifierOperator,
  BuiltinFunction,
  BooleanLiteral,
  // Whitespace
  WhiteSpace,
  // Named expression
  NamedExpression,
  // Special forms
  RepeatForm,
  CritForm,
  // Multi-character symbolic operators
  // MUST precede single-character prefixes.
  SlashSlash,
  LogicalAnd,
  LogicalOr,
  NotEqual,
  GreaterEqual,
  LessEqual,
  // Functions
  ToList,
  Filter,
  Floor,
  FMin,
  FMax,
  Round,
  Sortd, // sortd must be before sort.
  Ceil,
  Sort,
  Sum,
  Avg,
  Len,
  Abs,
  // Boolean literals
  True,
  False,
  // Dice modifiers / dice operators
  Kh,
  Kl,
  // Dh/Dl/Df/Dc must precede D.
  Dh,
  Dl,
  Min,
  Max,
  Cs,
  Cf,
  Sf,
  Df,
  Dc,
  Lt,
  Lc,
  D,
  R,
  X,
  // Literals
  StringLiteral,
  NumberLiteral,
  // In should appear after Inf, otherwise Inf will be split into "In" + "f"
  In,
  // Delimiters
  LParen,
  RParen,
  LBracket,
  RBracket,
  LCurly,
  RCurly,
  Comma,
  // Ternary operator
  Question,
  Colon,
  // Single-character operators
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Hash,
  Ampersand,
  Caret,
  Pipe,
  LogicalNot, // != must appear before !
  Greater, // >= and <= must appear before > and <
  Less,
  Equal,
]

// ============================================================
// 16. Lexer singleton
// ============================================================

export const diceLexer = new Lexer(allTokens, {
  ensureOptimizations: true,
  positionTracking: "full",
  errorMessageProvider: chineseLexerErrorMessageProvider,
})

// ============================================================
// 17. Public lexer API
// ============================================================

export function lexDice(input: string): Result<IToken[], ILexingError[]> {
  const result = diceLexer.tokenize(input)
  if (result.errors.length > 0) return { ok: false, error: result.errors }
  return { ok: true, value: result.tokens }
}
