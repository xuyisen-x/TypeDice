import { buildHirFromString, hirToString } from "../src/index.js"

const complexExpression =
  "(10d6xkh3dh3 + 5d20r[<2]r[>3]) * fmax(floor(3.5), 2 + 2 + 4, fmin([1,2,3] # [1,2,3])) + filter[>3]([1,2,3,4]) + fmax(tolist(1d10))"

function parseDiceAndShow(input: string): string {
  const result = buildHirFromString(input, () => undefined)
  if (!result.ok) {
    throw new Error(`${result.error.kind}: ${result.error.message}`)
  }
  return hirToString(result.value)
}

console.log(`Starting profile loop ...`)

const startedAt = process.hrtime.bigint()

// Keeping an observable checksum prevents the results from becoming dead values.
let checksum = 0
for (let index = 0; index < 500000; index += 1) {
  const output = parseDiceAndShow(complexExpression)
  checksum = (checksum + output.length) >>> 0
}

const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000

console.log(`Done in ${elapsedSeconds.toFixed(3)}s. Checksum: ${checksum}`)
