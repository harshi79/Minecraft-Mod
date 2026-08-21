import { readFile, readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const behaviorRoot = resolve(root, "packs/DarkCastle_BP");
const resourceRoot = resolve(root, "packs/DarkCastle_RP");
const errors = [];
async function walk(path) { const result = []; for (const entry of await readdir(path, { withFileTypes: true })) { const full = resolve(path, entry.name); entry.isDirectory() ? result.push(...await walk(full)) : result.push(full); } return result; }
async function json(path) { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { errors.push(`${path}: invalid JSON (${error.message})`); } }
async function required(path) { try { if (!(await stat(path)).isFile() || (await stat(path)).size === 0) errors.push(`${path}: missing or empty`); } catch { errors.push(`${path}: missing`); } }
function manifestChecks(manifest, label) {
  if (!manifest) return [];
  if (manifest.format_version !== 2) errors.push(`${label}: format_version must be 2`);
  if (JSON.stringify(manifest.header?.min_engine_version) !== "[1,26,40]") errors.push(`${label}: min_engine_version must be [1,26,40]`);
  const uuids = [manifest.header?.uuid, ...(manifest.modules ?? []).map((module) => module.uuid)];
  for (const uuid of uuids) if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid ?? "")) errors.push(`${label}: invalid UUID ${uuid}`);
  return uuids;
}
const files = [...await walk(behaviorRoot), ...await walk(resourceRoot)];
for (const file of files.filter((path) => extname(path) === ".json")) await json(file);
const bp = await json(resolve(behaviorRoot, "manifest.json"));
const rp = await json(resolve(resourceRoot, "manifest.json"));
const uuids = [...manifestChecks(bp, "behavior manifest"), ...manifestChecks(rp, "resource manifest")];
if (new Set(uuids).size !== uuids.length) errors.push("all pack and module UUIDs must be unique");
const pkg = await json(resolve(root, "package.json"));
const version = String(pkg?.version ?? "").split(".").map(Number);
for (const [label, value] of [["behavior header", bp?.header?.version], ["resource header", rp?.header?.version], ...(bp?.modules ?? []).map((m) => [`behavior ${m.type} module`, m.version]), ...(rp?.modules ?? []).map((m) => [`resource ${m.type} module`, m.version])]) if (JSON.stringify(value) !== JSON.stringify(version)) errors.push(`${label}: version must match package.json`);
if (!bp?.dependencies?.some((d) => d.uuid === rp?.header?.uuid)) errors.push("behavior pack must depend on resource pack");
if (!rp?.dependencies?.some((d) => d.uuid === bp?.header?.uuid)) errors.push("resource pack must depend on behavior pack");
if (bp?.dependencies?.find((d) => d.module_name === "@minecraft/server")?.version !== "2.9.0") errors.push("@minecraft/server dependency must be 2.9.0");
const block = await json(resolve(behaviorRoot, "blocks/ddx56.json"));
if (block?.["minecraft:block"]?.description?.identifier !== "dark_castle:ddx56") errors.push("DDX56 block identifier is incorrect");
for (const path of ["packs/DarkCastle_BP/scripts/main.js", "packs/DarkCastle_BP/pack_icon.png", "packs/DarkCastle_RP/pack_icon.png", "packs/DarkCastle_RP/textures/dark_castle/dark_castle/ddx56_top.png", "packs/DarkCastle_RP/textures/dark_castle/dark_castle/ddx56_side.png"]) await required(resolve(root, path));
for (const path of files.filter((file) => extname(file) === ".png")) { const bytes = await readFile(path); if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) errors.push(`${path}: invalid PNG`); }
const script = await readFile(resolve(behaviorRoot, "scripts/main.js"), "utf8").catch(() => "");
for (const text of ["dark_castle:ddx56", "minecraft:lever", "buildRoyalCastle", "beforeEvents.playerInteractWithBlock", "tickingAreaManager", "rooftop dragon"]) if (!script.includes(text)) errors.push(`compiled script is missing ${text}`);
const packageTool = await readFile(resolve(root, "tools/package.mjs"), "utf8");
if (!packageTool.includes(`DarkMedievalCastle-v${pkg?.version}.mcaddon`)) errors.push("package filename does not match project version");
if (errors.length) { console.error("Validation failed:"); for (const error of errors) console.error(`- ${error}`); process.exitCode = 1; } else console.log(`validated ${files.length} pack files successfully`);
