import { EOF, tokenLabel } from "chevrotain"
import type {
  ILexerErrorMessageProvider,
  ILexingError,
  IParserErrorMessageProvider,
  IRecognitionException,
  IToken,
  TokenType,
} from "chevrotain"
import type { HirBuildError } from "./hir/errors.js"

export type StandardErrorKind = "lexer" | "parser" | "hir"

/**
 * Offsets are zero-based and inclusive. Lines and columns are one-based.
 */
export interface StandardErrorLocation {
  startOffset: number
  endOffset?: number
  startLine?: number
  endLine?: number
  startColumn?: number
  endColumn?: number
}

export interface StandardError {
  kind: StandardErrorKind
  location: StandardErrorLocation | null
  message: string
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}

function tokenToLocation(token: IToken): StandardErrorLocation | null {
  if (!isFiniteNumber(token.startOffset)) return null

  return {
    startOffset: token.startOffset,
    endOffset: isFiniteNumber(token.endOffset)
      ? token.endOffset
      : token.startOffset + Math.max(0, token.image.length - 1),
    startLine: isFiniteNumber(token.startLine) ? token.startLine : undefined,
    endLine: isFiniteNumber(token.endLine) ? token.endLine : undefined,
    startColumn: isFiniteNumber(token.startColumn) ? token.startColumn : undefined,
    endColumn: isFiniteNumber(token.endColumn) ? token.endColumn : undefined,
  }
}

function parserErrorToLocation(error: IRecognitionException): StandardErrorLocation {
  const tokenLocation = tokenToLocation(error.token)
  if (tokenLocation) return tokenLocation

  const previousToken = (
    error as IRecognitionException & {
      previousToken?: IToken
    }
  ).previousToken
  const previousLocation = previousToken ? tokenToLocation(previousToken) : null

  if (!previousLocation) {
    return {
      startOffset: 0,
      endOffset: 0,
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 1,
    }
  }

  const offset = (previousLocation.endOffset ?? previousLocation.startOffset) + 1
  const line = previousLocation.endLine ?? previousLocation.startLine
  const column =
    previousLocation.endColumn !== undefined ? previousLocation.endColumn + 1 : previousLocation.startColumn

  return {
    startOffset: offset,
    endOffset: offset,
    startLine: line,
    endLine: line,
    startColumn: column,
    endColumn: column,
  }
}

function hirErrorToLocation(error: HirBuildError): StandardErrorLocation | null {
  const location = error.location
  if (!location || !isFiniteNumber(location.startOffset)) return null

  return {
    startOffset: location.startOffset,
    endOffset: isFiniteNumber(location.endOffset) ? location.endOffset : undefined,
    startLine: isFiniteNumber(location.startLine) ? location.startLine : undefined,
    endLine: isFiniteNumber(location.endLine) ? location.endLine : undefined,
    startColumn: isFiniteNumber(location.startColumn) ? location.startColumn : undefined,
    endColumn: isFiniteNumber(location.endColumn) ? location.endColumn : undefined,
  }
}

export function recognitionExceptionToStandardError(error: IRecognitionException): StandardError {
  return {
    kind: "parser",
    location: parserErrorToLocation(error),
    message: error.message,
  }
}

export function lexingErrorToStandardError(error: ILexingError): StandardError {
  return {
    kind: "lexer",
    location: {
      startOffset: error.offset,
      endOffset: error.offset + Math.max(0, error.length - 1),
      startLine: error.line,
      endLine: error.line,
      startColumn: error.column,
    },
    message: error.message,
  }
}

export function hirBuildErrorToStandardError(error: HirBuildError): StandardError {
  return {
    kind: "hir",
    location: hirErrorToLocation(error),
    message: error.message,
  }
}

// Helper functions for generating Chinese error messages

function describeTokenType(tokenType: TokenType): string {
  return tokenType === EOF ? "输入结束" : `“${tokenLabel(tokenType)}”`
}

function describeToken(token: IToken): string {
  if (token.tokenType === EOF || token.tokenTypeIdx === EOF.tokenTypeIdx) return "输入结束"
  return token.image.length > 0 ? `“${token.image}”` : describeTokenType(token.tokenType)
}

function describeExpectedSequences(paths: TokenType[][]): string {
  const sequences = paths.map((path) => path.map(describeTokenType).join(" ")).filter((path) => path.length > 0)
  const uniqueSequences = [...new Set(sequences)]
  return uniqueSequences.length > 0 ? uniqueSequences.join("、") : "合法的表达式"
}

export const chineseLexerErrorMessageProvider: ILexerErrorMessageProvider = {
  buildUnexpectedCharactersMessage(fullText, startOffset, length) {
    const unexpectedText = fullText.slice(startOffset, startOffset + length)
    return `无法识别字符 ${JSON.stringify(unexpectedText)}`
  },

  buildUnableToPopLexerModeMessage(token) {
    return `遇到 ${describeToken(token)} 后无法退出词法模式：模式栈已经为空`
  },
}

export const chineseParserErrorMessageProvider: IParserErrorMessageProvider = {
  buildMismatchTokenMessage({ expected, actual }) {
    return `期望 ${describeTokenType(expected)}，但遇到 ${describeToken(actual)}`
  },

  buildNotAllInputParsedMessage({ firstRedundant }) {
    return `存在无法解析的多余输入 ${describeToken(firstRedundant)}`
  },

  buildNoViableAltMessage({ expectedPathsPerAlt, actual, previous, customUserDescription }) {
    const expected = customUserDescription
      ? customUserDescription
      : describeExpectedSequences(expectedPathsPerAlt.flat())
    const encountered = actual[0] ?? previous
    return `此处期望 ${expected}，但遇到 ${describeToken(encountered)}`
  },

  buildEarlyExitMessage({ expectedIterationPaths, actual, previous, customUserDescription }) {
    const expected = customUserDescription ? customUserDescription : describeExpectedSequences(expectedIterationPaths)
    const encountered = actual[0] ?? previous
    return `此处至少需要一个以 ${expected} 开始的项目，但遇到 ${describeToken(encountered)}`
  },
}
