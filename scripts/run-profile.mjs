import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, "..")
const nodeModules = join(projectRoot, "node_modules")
const tsc = join(nodeModules, "typescript", "bin", "tsc")
const temporaryPrefix = join(tmpdir(), "typedice-profile-")

if (!existsSync(tsc)) {
  throw new Error("TypeScript is not installed. Run npm install before profiling.")
}

const temporaryRoot = mkdtempSync(temporaryPrefix)
let exitCode = 1

try {
  writeFileSync(join(temporaryRoot, "package.json"), '{"type":"module"}\n')
  symlinkSync(nodeModules, join(temporaryRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir")

  console.log("Compiling current sources for an uninstrumented benchmark ...")
  const compilation = spawnSync(
    process.execPath,
    [tsc, "--project", join(scriptDirectory, "tsconfig.profile.json"), "--outDir", temporaryRoot],
    { cwd: projectRoot, stdio: "inherit" }
  )

  if (compilation.error) throw compilation.error
  if (compilation.status !== 0) {
    exitCode = compilation.status ?? 1
  } else {
    const benchmark = spawnSync(
      process.execPath,
      [join(temporaryRoot, "scripts", "profile-me.js"), ...process.argv.slice(2)],
      { cwd: projectRoot, stdio: "inherit" }
    )
    if (benchmark.error) throw benchmark.error
    exitCode = benchmark.status ?? 1
  }
} finally {
  if (temporaryRoot.startsWith(temporaryPrefix)) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

process.exitCode = exitCode
