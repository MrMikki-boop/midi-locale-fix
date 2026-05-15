import { ABILITY_MAP, MODULE_ID, SETTING_KEYS, SKILL_MAP } from "./constants.mjs";
import { getSetting } from "./settings.mjs";

export function fixKey(key) {
  if (typeof key !== "string") return key;
  const parts = key.split(".");
  if (parts.length < 2) return key;

  const last = parts[parts.length - 1].toLowerCase();
  const pathLower = key.toLowerCase();

  const isSkill = pathLower.includes("skill");
  const isAbility = !isSkill && (
    pathLower.includes("check") ||
    pathLower.includes("save") ||
    pathLower.includes("attack") ||
    pathLower.includes("ability") ||
    pathLower.includes("abilities")
  );

  let replacement = null;
  if (isSkill) replacement = SKILL_MAP[last];
  else if (isAbility) replacement = ABILITY_MAP[last];
  else replacement = ABILITY_MAP[last] || SKILL_MAP[last];

  if (!replacement) return key;
  parts[parts.length - 1] = replacement;
  return parts.join(".");
}

export function fixChanges(changes, source = "unknown") {
  if (!Array.isArray(changes)) return false;
  let modified = false;
  const debug = getSetting(SETTING_KEYS.debug);
  const verbose = getSetting(SETTING_KEYS.verbose);

  for (const change of changes) {
    const oldKey = change.key;
    const newKey = fixKey(oldKey);

    if (newKey !== oldKey) {
      change.key = newKey;
      modified = true;
      if (debug || verbose) console.log(`[${MODULE_ID}] FIXED`, { source, from: oldKey, to: newKey });
    } else if (verbose) {
      console.log(`[${MODULE_ID}] PASSED`, { source, key: oldKey });
    }
  }
  return modified;
}

export function registerEffectKeyFixHooks() {
  Hooks.on("preCreateActiveEffect", (effect, data) => {
    if (!data?.changes) return;
    if (fixChanges(data.changes, "preCreateActiveEffect")) {
      effect.updateSource({ changes: data.changes });
    }
  });

  Hooks.on("preUpdateActiveEffect", (effect, changes) => {
    if (!changes?.changes) return;
    fixChanges(changes.changes, "preUpdateActiveEffect");
  });

  Hooks.on("preCreateItem", (item, data) => {
    if (!Array.isArray(data?.effects)) return;
    let touched = false;
    for (const effectData of data.effects) {
      if (Array.isArray(effectData.changes) && fixChanges(effectData.changes, "preCreateItem")) touched = true;
    }
    if (touched) item.updateSource({ effects: data.effects });
  });
}
