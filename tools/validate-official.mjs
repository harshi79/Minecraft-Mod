// Official Mojang validation via @minecraft/creator-tools (mct).
//
// Runs two suites against a clean copy of the built packs:
//   1. "addon"   — the strict cooperative add-on suite (packaging, structure,
//                  manifest, min-engine, pack-size, strict platform, textures).
//   2. "all"     — every available validator (JSON schemas, format versions,
//                  scripts, UUIDs, file hygiene, ...), excluding UNLINK.
//
// UNLINK is excluded via mct's own exclusion mechanism because mct 0.17.x
// resolves item links only against item *definitions inside the pack*; its
// offline vanilla index contains file paths (textures, geometries, ...) but
// no vanilla item-type identifiers. As a result it warns on every reference
// to vanilla items (minecraft:amethyst_shard, ...) and on block item-forms
// (crystal_void:void_anchor), which are correct and required add-on content.
//
// Both suites must finish with zero errors and zero warnings.
import { spawn } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mctCli = resolve(root, "node_modules/@minecraft/creator-tools/cli/index.mjs");

const FAILURE_TYPES = new Set(["error", "warning", "testFail", "internalProcessingError"]);

async function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);

    const killTimer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs ?? 300_000);
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolvePromise({ code, stdout, stderr });
    });
  });
}

function parseJson(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return undefined;
  }
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function collectProblems(result, label, problems) {
  const items = result?.projects?.flatMap((project) => project.items ?? []) ?? [];
  for (const item of items) {
    if (FAILURE_TYPES.has(item.type)) {
      problems.push(`${label} [${item.generatorId}] ${item.type}: ${item.message}${item.path ? ` (${item.path})` : ""}`);
    }
  }
}

async function validateSuite(suite, exclusions, projectDir, outDir, problems) {
  const args = [
    mctCli,
    "validate",
    suite,
    ...(exclusions ? [exclusions] : []),
    "-i",
    projectDir,
    "-o",
    outDir,
    "-y",
    "--json",
    "--offline",
  ];

  const { code, stdout, stderr } = await run(process.execPath, args, { cwd: root });
  const result = parseJson(stdout);

  if (result === undefined) {
    problems.push(`mct validate ${suite}: could not parse result JSON (exit code ${code})`);
    if (stderr.trim()) problems.push(`mct validate ${suite}: ${stderr.trim().split("\n").slice(-5).join("\n")}`);
    return;
  }

  if (code !== 0) {
    problems.push(`mct validate ${suite}: exited with code ${code}`);
  }
  collectProblems(result, `mct validate ${suite}`, problems);

  const errors = result.errors ?? 0;
  const warnings = result.warnings ?? 0;
  const recommendations = result.recommendations ?? 0;
  console.log(
    `mct validate ${suite}${exclusions ? ` (excluded: ${exclusions})` : ""}: ` +
      `${errors} errors, ${warnings} warnings, ${recommendations} recommendations`,
  );
}

const projectDir = await mkdtemp(join(tmpdir(), "dark-castle-mct-"));
const outDir = join(projectDir, "out");
try {
  // mct treats the input folder as the project root containing the packs.
  await cp(resolve(root, "packs/DarkCastle_BP"), join(projectDir, "DarkCastle_BP"), { recursive: true });
  await cp(resolve(root, "packs/DarkCastle_RP"), join(projectDir, "DarkCastle_RP"), { recursive: true });

  const problems = [];
  await validateSuite("addon", undefined, projectDir, join(outDir, "addon"), problems);
  await validateSuite("all", "UNLINK", projectDir, join(outDir, "all"), problems);

  if (problems.length > 0) {
    console.error("Official validation failed:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("official validation passed with zero errors and zero warnings");
  }
} finally {
  await rm(projectDir, { recursive: true, force: true });
}
