import { generateCstDts } from "chevrotain"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { DiceParser } from "../src/syntax/parser.js"

const parser = new DiceParser()

const definitions = generateCstDts(parser.getGAstProductions())

const outputDir = resolve("src/syntax/generated")
const outputFile = resolve(outputDir, "cst.d.ts")

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputFile, definitions, "utf8")

console.log(`Generated CST types: ${outputFile}`)
