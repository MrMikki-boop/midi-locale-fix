import { ABILITY_MAP, MODULE_ID, SETTING_KEYS, SKILL_MAP } from "./constants.mjs";
import { getSetting } from "./settings.mjs";

export function fixKey(key) {
  if (typeof key !== "string") return key;
  const parts = key.split(".");
  if (parts.length < 2) return key;
  if (!key.startsWith("flags.midi-qol.") && !/^system\.(?:abilities|skills|bonuses)\./.test(key)) return key;

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
  if (isSkill) {
    const skill = SKILL_MAP[last];
    const ability = ABILITY_MAP[last];
    // Midi's skill flags accept both skill and ability ids. "лвк" is ambiguous.
    if (pathLower.startsWith("flags.midi-qol.") && skill && ability && skill !== ability) return key;
    replacement = skill || (pathLower.startsWith("flags.midi-qol.") ? ability : null);
  }
  else if (isAbility) replacement = ABILITY_MAP[last];
  else replacement = ABILITY_MAP[last] || SKILL_MAP[last];

  if (!replacement) return key;
  parts[parts.length - 1] = replacement;
  return parts.join(".");
}

export function fixChanges(changes, source = "unknown", inlineRolls) {
  if (!Array.isArray(changes)) return false;
  let modified = false;
  const debug = getSetting(SETTING_KEYS.debug);
  const verbose = getSetting(SETTING_KEYS.verbose);

  for (const change of changes) {
    if (!change || typeof change !== "object") continue;
    const oldKey = change.key;
    const newKey = fixKey(oldKey);

    if (newKey !== oldKey) {
      change.key = newKey;
      // DAE identifies stored transfer rolls by the exact key + formula pair.
      if (Array.isArray(inlineRolls)) {
        for (const record of inlineRolls) {
          if (record?.key === oldKey && record.value === change.value) record.key = newKey;
        }
      }
      modified = true;
      if (debug || verbose) console.log(`[${MODULE_ID}] FIXED`, { source, from: oldKey, to: newKey });
    } else if (verbose) {
      console.log(`[${MODULE_ID}] PASSED`, { source, key: oldKey });
    }
  }
  return modified;
}

function getEffectChanges(data) {
  const modern = unwrap(data?.system?.changes ?? data?.["system.changes"]);
  if (Array.isArray(modern)) return ["system.changes", modern];
  return ["changes", unwrap(data?.changes)];
}

function getInlineRolls(data, existingFlags, options) {
  if (!Array.isArray(existingFlags?.dae?.inlineRolls)) return { records: data?.["flags.dae.inlineRolls"] ?? data?.flags?.dae?.inlineRolls };
  // Use core merge semantics for partial flags, explicit replacement and deletion.
  const flags = Object.fromEntries(Object.entries(data).filter(([key]) => key === "flags" || key.startsWith("flags.") || key === "-=flags"));
  const merged = foundry.utils.mergeObject({ flags: existingFlags }, flags, {
    inplace: false,
    recursive: options.recursive !== false,
    ...(Number(game.release?.generation) >= 14 ? { applyOperators: true } : { performDeletions: true })
  });
  return { records: merged.flags?.dae?.inlineRolls, flags: merged.flags };
}

function fixEffectData(data, source, existingFlags, options = {}) {
  const updates = {};
  const [path, changes] = getEffectChanges(data);
  if (!Array.isArray(changes)) return updates;
  const effective = getInlineRolls(data, existingFlags, options);
  const previous = effective.records;
  // Existing live flags must not be mutated while preparing an update delta.
  const records = Array.isArray(previous) ? previous.map(record => record && typeof record === "object" ? { ...record } : record) : undefined;
  if (!fixChanges(changes, source, records)) return updates;
  updates[path] = changes;
  if (records?.some((record, i) => record?.key !== previous[i]?.key)) {
    if (Object.hasOwn(data, "flags.dae.inlineRolls")) data["flags.dae.inlineRolls"] = records;
    else {
      // With a non-recursive root update, adding flags replaces the whole field.
      // If flags were previously untouched, preserve their effective source in full.
      if (options.recursive === false && !Object.keys(data).some(key => key === "flags" || key.startsWith("flags."))) data.flags = effective.flags;
      data.flags ??= {};
      data.flags.dae ??= {};
      data.flags.dae.inlineRolls = records;
    }
    updates["flags.dae.inlineRolls"] = records;
  }
  return updates;
}

function isDataOperator(value) {
  const Operator = globalThis.foundry?.data?.operators?.DataFieldOperator;
  return typeof Operator === "function" && value instanceof Operator;
}

function unwrap(value) {
  return isDataOperator(value) ? foundry.data.operators.DataFieldOperator.get(value) : value;
}

function fixEffects(effects, source, existingEffects, options = {}) {
  if (options.recursive === false || isDataOperator(effects)) existingEffects = undefined;
  effects = unwrap(effects);
  if (!Array.isArray(effects)) return false;
  let touched = false;
  for (const effect of effects) {
    const existing = isDataOperator(effect) ? undefined : existingEffects?.get(effect?._id);
    if (Object.keys(fixEffectData(effect, source, existing?.flags, options)).length) touched = true;
  }
  return touched;
}

function fixActorItems(items, source, existingItems, options = {}) {
  if (options.recursive === false || isDataOperator(items)) existingItems = undefined;
  items = unwrap(items);
  if (!Array.isArray(items)) return false;
  let touched = false;
  for (const item of items) {
    const existing = isDataOperator(item) ? undefined : existingItems?.get(item?._id);
    if (fixEffects(item?.effects, source, existing?.effects, options)) touched = true;
  }
  return touched;
}

export function registerEffectKeyFixHooks() {
  Hooks.on("preCreateActiveEffect", (effect) => {
    // _preCreate (including DAE) has already modified the pending document.
    const updates = fixEffectData(effect.toObject(), "preCreateActiveEffect");
    if (Object.keys(updates).length) effect.updateSource(updates);
  });

  Hooks.on("preUpdateActiveEffect", (effect, changes, options) => {
    fixEffectData(changes, "preUpdateActiveEffect", effect.flags, options);
  });

  Hooks.on("preCreateItem", (item) => {
    const { effects } = item.toObject();
    if (fixEffects(effects, "preCreateItem")) item.updateSource({ effects });
  });

  Hooks.on("preUpdateItem", (item, changes, options) => {
    // CAT Apply/Update replaces effects through the parent Item, without child hooks.
    fixEffects(changes.effects, "preUpdateItem", item.effects, options);
  });

  Hooks.on("preCreateActor", (actor) => {
    const { effects, items } = actor.toObject();
    const updates = {};
    if (fixEffects(effects, "preCreateActor")) updates.effects = effects;
    if (fixActorItems(items, "preCreateActor")) updates.items = items;
    if (Object.keys(updates).length) actor.updateSource(updates);
  });

  Hooks.on("preUpdateActor", (actor, changes, options) => {
    fixEffects(changes.effects, "preUpdateActor", actor.effects, options);
    fixActorItems(changes.items, "preUpdateActor", actor.items, options);
  });
}
