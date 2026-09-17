import { buildHirFromString, hirToString, type resolveNamedExpressionResult } from "../src/index.js"
import { buildHir } from "../src/hir/builder.js"
import { lexDice } from "../src/syntax/lexer.js"
import { parseDiceTokens } from "../src/syntax/parser.js"

const complexExpression =
  "(10d6xkh3dh3 + 5d20r[<2]r[>3]) * fmax(floor(3.5), 2 + 2 + 4, fmin([1,2,3] # [1,2,3])) + filter[>3]([1,2,3,4]) + fmax(tolist(1d10))"

type Options = {
  iterations: number
  warmup: number
  breakdown: boolean
}

function positiveInteger(value: string | undefined, option: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer`)
  }
  return parsed
}

function parseOptions(args: string[]): Options {
  const options: Options = { iterations: 500_000, warmup: 5_000, breakdown: false }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--breakdown") {
      options.breakdown = true
    } else if (argument === "--iterations") {
      options.iterations = positiveInteger(args[++index], argument)
    } else if (argument.startsWith("--iterations=")) {
      options.iterations = positiveInteger(argument.slice("--iterations=".length), "--iterations")
    } else if (argument === "--warmup") {
      options.warmup = positiveInteger(args[++index], argument)
    } else if (argument.startsWith("--warmup=")) {
      options.warmup = positiveInteger(argument.slice("--warmup=".length), "--warmup")
    } else if (argument === "--help" || argument === "-h") {
      console.log(`Usage: npm run profile -- [options]

Options:
  --iterations <count>  Timed iterations (default: 500000)
  --warmup <count>      Warmup iterations per benchmark (default: 5000)
  --breakdown           Also benchmark lexer, parser, HIR builder, and stringifier separately
  --help                Show this help`)
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }

  return options
}

const emptyEnv = (_name: string): resolveNamedExpressionResult => {
  return { kind: "error", message: `未定义的命名表达式: ${_name}` }
}

function parseDiceAndShow(input: string): string {
  const result = buildHirFromString(input, emptyEnv)
  if (!result.ok) {
    throw new Error(`${result.error.kind}: ${result.error.message}`)
  }
  return hirToString(result.value)
}

const options = parseOptions(process.argv.slice(2))
let checksum = 0

function benchmark(name: string, iterations: number, operation: () => number): void {
  for (let index = 0; index < options.warmup; index += 1) checksum ^= operation()

  const startedAt = process.hrtime.bigint()
  for (let index = 0; index < iterations; index += 1) {
    checksum = (checksum + operation()) >>> 0
  }
  const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
  const throughput = iterations / elapsedSeconds
  const microseconds = (elapsedSeconds * 1_000_000) / iterations

  console.log(
    `${name.padEnd(28)} ${throughput.toLocaleString("en-US", { maximumFractionDigits: 0 }).padStart(10)}/s` +
      `  ${microseconds.toFixed(2).padStart(7)} us/op  ${elapsedSeconds.toFixed(3).padStart(8)}s`
  )
}

console.log(`Node ${process.version}`)
console.log(`Expression: ${complexExpression.length} characters`)
console.log(
  `Iterations: ${options.iterations.toLocaleString("en-US")}; warmup: ${options.warmup.toLocaleString("en-US")}`
)
console.log("")

if (options.breakdown) {
  const lexed = lexDice(complexExpression)
  if (!lexed.ok) throw new Error(lexed.error[0]?.message ?? "Lexing failed")

  const parsed = parseDiceTokens(lexed.value)
  if (!parsed.ok) throw new Error(parsed.error[0]?.message ?? "Parsing failed")

  const built = buildHir(parsed.value, emptyEnv)
  if (!built.ok) throw new Error(built.error.message)

  benchmark("lexer", options.iterations, () => {
    const result = lexDice(complexExpression)
    if (!result.ok) throw new Error(result.error[0]?.message ?? "Lexing failed")
    return result.value.length
  })
  benchmark("parser (pre-lexed)", options.iterations, () => {
    const result = parseDiceTokens(lexed.value)
    if (!result.ok) throw new Error(result.error[0]?.message ?? "Parsing failed")
    return result.value.name.length
  })
  benchmark("HIR builder (same CST)", options.iterations, () => {
    const result = buildHir(parsed.value, emptyEnv)
    if (!result.ok) throw new Error(result.error.message)
    return result.value.kind.length
  })
  benchmark("stringifier (same HIR)", options.iterations, () => hirToString(built.value).length)
  console.log("")
}

benchmark("full pipeline + stringify", options.iterations, () => parseDiceAndShow(complexExpression).length)
console.log(`Checksum: ${checksum}`)
