import { readFile, readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const behaviorRoot = resolve(root, "packs/CrystalVoid_BP");
const resourceRoot = resolve(root, "packs/CrystalVoid_RP");
const errors = [];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const fullPath = resolve(path, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(fullPath)));
    else paths.push(fullPath);
  }
  return paths;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: invalid JSON (${error.message})`);
    return undefined;
  }
}

async function requireFile(path) {
  try {
    const details = await stat(path);
    if (!details.isFile() || details.size === 0) errors.push(`${path}: missing or empty`);
  } catch {
    errors.push(`${path}: missing`);
  }
}

function checkManifest(manifest, label) {
  if (!manifest) return [];
  if (manifest.format_version !== 2) errors.push(`${label}: manifest format_version must be 2`);
  if (JSON.stringify(manifest.header?.min_engine_version) !== JSON.stringify([1, 26, 40])) {
    errors.push(`${label}: min_engine_version must target 1.26.40`);
  }

  const uuids = [manifest.header?.uuid, ...(manifest.modules ?? []).map((module) => module.uuid)];
  for (const uuid of uuids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid ?? "")) {
      errors.push(`${label}: invalid UUID ${String(uuid)}`);
    }
  }
  return uuids;
}

const allFiles = [...(await walk(behaviorRoot)), ...(await walk(resourceRoot))];
for (const path of allFiles.filter((file) => extname(file) === ".json")) await readJson(path);

const behaviorManifest = await readJson(resolve(behaviorRoot, "manifest.json"));
const resourceManifest = await readJson(resolve(resourceRoot, "manifest.json"));
const allUuids = [
  ...checkManifest(behaviorManifest, "behavior manifest"),
  ...checkManifest(resourceManifest, "resource manifest"),
];
if (new Set(allUuids).size !== allUuids.length) errors.push("manifest UUIDs must all be unique");

// Every pack/module/cross-pack version must match the project version in
// package.json, so Minecraft treats a rebuilt release as a newer pack.
const packageJson = await readJson(resolve(root, "package.json"));
const expectedVersion = String(packageJson?.version ?? "").split(".").map((part) => Number(part));
if (expectedVersion.length !== 3 || expectedVersion.some((part) => !Number.isInteger(part))) {
  errors.push("package.json version must be a three-part version like 1.0.1");
}

function checkVersionArray(value, label) {
  if (JSON.stringify(value) !== JSON.stringify(expectedVersion)) {
    errors.push(
      `${label}: version must be [${expectedVersion.join(", ")}] to match package.json version ${packageJson?.version}`,
    );
  }
}

if (behaviorManifest) {
  checkVersionArray(behaviorManifest.header?.version, "behavior manifest header");
  for (const module of behaviorManifest.modules ?? []) {
    checkVersionArray(module.version, `behavior module "${module.type}"`);
  }
  for (const dependency of behaviorManifest.dependencies ?? []) {
    if (dependency.uuid) checkVersionArray(dependency.version, "behavior manifest pack dependency");
  }
}

if (resourceManifest) {
  checkVersionArray(resourceManifest.header?.version, "resource manifest header");
  for (const module of resourceManifest.modules ?? []) {
    checkVersionArray(module.version, `resource module "${module.type}"`);
  }
  for (const dependency of resourceManifest.dependencies ?? []) {
    if (dependency.uuid) checkVersionArray(dependency.version, "resource manifest pack dependency");
  }
}

const packageTool = await readFile(resolve(root, "tools/package.mjs"), "utf8").catch(() => "");
if (!packageTool.includes(`CrystalVoid-v${packageJson?.version}.mcaddon`)) {
  errors.push(`tools/package.mjs must create release/CrystalVoid-v${packageJson?.version}.mcaddon`);
}

const serverDependency = behaviorManifest?.dependencies?.find((dependency) => dependency.module_name === "@minecraft/server");
if (serverDependency?.version !== "2.9.0") errors.push("behavior manifest must depend on @minecraft/server 2.9.0");

const resourceDependency = behaviorManifest?.dependencies?.find(
  (dependency) => dependency.uuid === resourceManifest?.header?.uuid,
);
if (!resourceDependency) errors.push("behavior manifest must depend on the resource pack");

const behaviorDependency = resourceManifest?.dependencies?.find(
  (dependency) => dependency.uuid === behaviorManifest?.header?.uuid,
);
if (!behaviorDependency) errors.push("resource manifest must depend on the behavior pack");
if (resourceManifest?.header?.pack_scope !== "world") {
  errors.push("resource manifest pack_scope must be world");
}

const item = await readJson(resolve(behaviorRoot, "items/dimension_crystal.json"));
if (item?.["minecraft:item"]?.description?.identifier !== "crystal_void:dimension_crystal") {
  errors.push("Dimension Crystal identifier does not match the script");
}

// The mobile interact button shows on touch controls when the crystal is
// aimed at a block, and its label resolves through the resource pack texts.
if (item?.["minecraft:item"]?.components?.["minecraft:interact_button"] !== "action.interact.crystal_void:open") {
  errors.push("Dimension Crystal must define minecraft:interact_button action.interact.crystal_void:open");
}

const enUsLang = await readFile(resolve(resourceRoot, "texts/en_US.lang"), "utf8").catch(() => "");
if (!enUsLang.includes("action.interact.crystal_void:open=Open Crystal Void")) {
  errors.push("en_US.lang is missing the interact button translation (action.interact.crystal_void:open)");
}

for (const blockName of ["void_anchor", "voidstone"]) {
  const block = await readJson(resolve(behaviorRoot, `blocks/${blockName}.json`));
  if (block?.["minecraft:block"]?.description?.identifier !== `crystal_void:${blockName}`) {
    errors.push(`${blockName} identifier is incorrect`);
  }
}

for (const path of [
  "packs/CrystalVoid_BP/scripts/main.js",
  "packs/CrystalVoid_BP/pack_icon.png",
  "packs/CrystalVoid_RP/pack_icon.png",
  "packs/CrystalVoid_RP/textures/crystal_void/crystal_void/dimension_crystal.png",
  "packs/CrystalVoid_RP/textures/crystal_void/crystal_void/voidstone.png",
  "packs/CrystalVoid_RP/textures/crystal_void/crystal_void/void_anchor_top.png",
  "packs/CrystalVoid_RP/textures/crystal_void/crystal_void/void_anchor_side.png",
]) {
  await requireFile(resolve(root, path));
}

for (const path of allFiles.filter((file) => extname(file) === ".png")) {
  const bytes = await readFile(path);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    errors.push(`${path}: invalid PNG signature`);
  }
}

const compiledScript = await readFile(resolve(behaviorRoot, "scripts/main.js"), "utf8").catch(() => "");
for (const expectedText of [
  "registerCustomDimension(REALM_ID)",
  "crystal_void:dimension_crystal",
  "crystal_void:void_anchor",
  "beforeEvents.playerInteractWithBlock",
  "isFirstEvent",
  "cancel = true",
]) {
  if (!compiledScript.includes(expectedText)) errors.push(`compiled script is missing ${expectedText}`);
}
if (compiledScript.includes("afterEvents.playerInteractWithBlock")) {
  errors.push("compiled script must use the before-event, not the after-event, for Crystal + Anchor interaction");
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`validated ${allFiles.length} pack files successfully`);
}
