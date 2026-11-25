import { CAT_COMPENDIUM_NAME_PATCH_FLAG, CAT_COMPENDIUM_PATCH_FLAG, CAT_PATCH_FLAG, SETTING_KEYS } from "./constants.mjs";
import { getSetting, logDebug } from "./settings.mjs";

function formatIdentifier(name) {
  if (typeof name !== "string" || typeof name.slugify !== "function") return "";
  // Match dnd5e.utils.formatIdentifier, including names without spaces around '/'.
  return name.replaceAll(/(\w+)([\\|/])(\w+)/g, "$1-$3").slugify({ strict: true });
}

function getCopyNameVariants(name) {
  if (typeof name !== "string") return [];
  const variants = [name];
  let current = name;
  while (true) {
    const stripped = current.replace(/\s*\((?:копия|copy)(?:\s+\d+)?\)\s*$/iu, "");
    if (stripped === current || !stripped.trim()) return variants;
    const base = stripped.trimEnd();
    variants.push(base);
    current = base;
  }
}

function getLocalizedNameCandidates(name) {
  if (typeof name !== "string" || !/\p{Script=Cyrillic}/u.test(name)) return [];
  const candidates = name.split(/\s*(?:\/|\||\\)\s*/g);
  const suffix = name.match(/^(.*?)(?:\(([^()]+)\)|\[([^\[\]]+)\])\s*$/);
  // A suffix is an English translation only when its prefix has no English name.
  // E.g. "Сглаз (Hex)", but never "Custom Curse (Hex)" or "Сглаз / Custom Curse (Hex)".
  if (suffix && !/[a-z]/i.test(suffix[1])) candidates.push(suffix[2] ?? suffix[3]);
  return candidates;
}

function getEnglishNameCandidates(document, nameVariants) {
  const name = nameVariants?.at(-1) ?? document.name;
  return [
    ...getLocalizedNameCandidates(name),
    // A copied English item needs its complete base name, not arbitrary parenthetical parts.
    ...(nameVariants?.length > 1 ? [name] : []),
    document.flags?.babele?.originalName,
    document.originalName
  ].filter(name => typeof name === "string" && /[a-z]/i.test(name)
    && !/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/u.test(name));
}

function getCompendiumNameCandidates(document) {
  const names = [document.flags?.babele?.originalName, document.originalName];
  const name = document.name;
  if (typeof name === "string" && /\p{Script=Cyrillic}/u.test(name) && /[a-z]/i.test(name)) {
    names.push(...name.split(/\s*(?:\/|\||\\)\s*/g));
    const suffix = name.match(/^(.*?)(?:\(([^()]+)\)|\[([^\[\]]+)\])\s*$/);
    const english = suffix?.[2] ?? suffix?.[3];
    if (suffix && !/[a-z]/i.test(suffix[1]) && /[a-z]/i.test(english)
      && !/\p{Script=Cyrillic}/u.test(english)) names.push(suffix[1], english);
  }
  return names.filter(name => typeof name === "string" && name.trim()).map(name => name.trim());
}

function resolveItemIdentifier(item, identifier) {
  const result = { identifier, resolved: identifier, reason: "native", candidates: [] };
  // Index entries are used during CAT registration; never remap those or source documents.
  if (item?.documentName !== "Item" || typeof item.toObject !== "function" || item.inCompendium) return result;
  const nameVariants = getCopyNameVariants(item.name);
  const candidates = new Set();
  for (const name of getEnglishNameCandidates(item, nameVariants)) {
    const value = formatIdentifier(name);
    if (value && value !== identifier) candidates.add(value);
  }
  // Ordinary English items and canonical ids take the cheap path in CAT's hot loops.
  if (!candidates.size) return result;
  result.candidates = Array.from(candidates);
  // Duplication may keep the source id or generate one after any copy suffix was added.
  if (identifier && !nameVariants.some(name => identifier === formatIdentifier(name))) return { ...result, reason: "customIdentifier" };
  const cat = globalThis.cat;
  const registry = cat?.lib?.constants?.automations;
  if (typeof registry?.getAutomationByIdentifier !== "function"
    || typeof cat?.utils?.itemUtils?.getAdvancementSourceKey !== "function"
    || typeof cat?.utils?.documentUtils?.getMonsterIdentifier !== "function") return { ...result, reason: "registryUnavailable" };
  if (identifier && registry.getAutomationByIdentifier(identifier)) return result;
  const options = {
    multiple: true,
    type: item.type,
    featType: item.system?.type?.value,
    sourceType: cat.utils.itemUtils.getAdvancementSourceKey(item),
    monsterIdentifier: cat.utils.documentUtils.getMonsterIdentifier(item)
  };
  const matches = new Set();
  for (const candidate of candidates) {
    for (const automation of registry.getAutomationByIdentifier(candidate, options)) matches.add(automation.identifier);
  }
  // Rules, source selection and exclusions remain CAT's responsibility at the call site.
  // Resolve across editions so the Medkit rules toggle can use the same identifier.
  if (matches.size !== 1) return { ...result, reason: matches.size ? "ambiguous" : "notFound" };
  return { ...result, resolved: matches.values().next().value, reason: "nameFallback" };
}

export function testCATItem(item) {
  return resolveItemIdentifier(item, item?.system?.identifier);
}

function addUniqueEntry(map, key, entry) {
  if (!map.has(key)) map.set(key, entry);
  else if (map.get(key)?.uuid !== entry.uuid) map.set(key, null);
}

function buildNameLookup(index, bySlug, rules, queries, preferLaaru = false) {
  const exact = new Map();
  const aliases = new Map();
  const requested = new Set(queries);
  const key = name => bySlug ? name.slugify() : name;
  for (const entry of index) {
    if (typeof entry.name !== "string") continue;
    if (rules && (entry.system?.source?.rules || "2014") !== rules) continue;
    if (preferLaaru && entry.system?.details?.type?.value !== "beast") continue;
    const nativeKey = key(entry.name);
    if (requested.has(nativeKey)) {
      if (preferLaaru) addUniqueEntry(aliases, nativeKey, entry);
      else if (!exact.has(nativeKey)) exact.set(nativeKey, entry);
    }
    const candidates = bySlug ? getEnglishNameCandidates(entry) : getCompendiumNameCandidates(entry);
    for (const name of candidates) {
      const alias = key(name);
      if (requested.has(alias)) addUniqueEntry(aliases, alias, entry);
    }
  }
  if (preferLaaru) return aliases;
  // An exact native match keeps its priority and duplicate-selection behavior.
  for (const [key, entry] of aliases) if (!exact.has(key)) exact.set(key, entry);
  return exact;
}

function findNamedEntry(index, name, rules) {
  let translated;
  let ambiguous = false;
  for (const entry of index) {
    if (rules && (entry.system?.source?.rules || "2014") !== rules) continue;
    // The common exact-match path stops immediately, as in native CAT.
    if (entry.name === name) return entry;
    if (!getCompendiumNameCandidates(entry).includes(name)) continue;
    if (translated && translated.uuid !== entry.uuid) ambiguous = true;
    else translated = entry;
  }
  return ambiguous ? undefined : translated;
}

async function getLaaruNameLookup(packId, bySlug, rules, queries) {
  // Default SRD creature lookups, regardless of the calling spell or feature.
  // Explicit folders, custom sources and edition filters remain authoritative.
  if (packId !== "dnd5e.monsters") return new Map();
  const module = game.modules.get("laaru-dnd5-hw");
  if (!module?.active) return new Map();
  const packs = Array.from(module.packs ?? []).filter(data => data.type === "Actor");
  const indices = await Promise.all(packs.map(async data => {
    const id = data.id ?? `laaru-dnd5-hw.${data.name}`;
    const pack = game.packs.get(id);
    if (!pack) return [];
    try {
      const fields = ["system.details.type.value", "flags.babele.originalName"];
      if (rules) fields.push("system.source");
      return Array.from(await pack.getIndex({ fields }));
    } catch (error) {
      logDebug("Laaru summon index unavailable", { packId: id, error });
      return [];
    }
  }));
  return buildNameLookup(indices.flat(), bySlug, rules, queries, true);
}

async function getLocalizedCompendiumDocuments(packId, queries, { bySlug, rules }) {
  const preferred = await getLaaruNameLookup(packId, bySlug, rules, queries);
  // Scope all memoization to this request: no stale misses after translations or edits.
  const documents = new Map();
  const loadDocument = entry => {
    if (!entry) return undefined;
    if (!documents.has(entry.uuid)) documents.set(entry.uuid, Promise.resolve().then(() => fromUuid(entry.uuid)));
    return documents.get(entry.uuid);
  };
  let sourceLookup;
  const getSourceLookup = () => sourceLookup ??= (async () => {
    const pack = game.packs.get(packId);
    if (!pack) return new Map();
    const fields = ["flags.babele.originalName"];
    if (rules) fields.push("system.source");
    const index = await pack.getIndex({ fields });
    if (!bySlug) return new Map([[queries[0], findNamedEntry(index, queries[0], rules)]]);
    return buildNameLookup(index, bySlug, rules, queries);
  })();
  const results = await Promise.all(queries.map(async query => {
    const entry = preferred.get(query);
    if (entry) {
      try {
        const document = await loadDocument(entry);
        if (document) {
          logDebug("Laaru summon actor selected", { query, uuid: document.uuid });
          return document;
        }
      } catch (error) {
        logDebug("Laaru summon actor unavailable", { query, error });
      }
    }
    const source = (await getSourceLookup()).get(query);
    return loadDocument(source);
  }));
  return results.filter(Boolean);
}

function patchCATCompendiumSearch(compendiumUtils) {
  if (!compendiumUtils) return;
  if (!compendiumUtils[CAT_COMPENDIUM_PATCH_FLAG] && typeof compendiumUtils.getDocumentsBySlug === "function") {
    const original = compendiumUtils.getDocumentsBySlug;
    compendiumUtils.getDocumentsBySlug = async function(packId, slugs) {
      if (!getSetting(SETTING_KEYS.fixCPRLookup, true) || !Array.isArray(slugs) || !slugs.length) return original.call(this, packId, slugs);
      return getLocalizedCompendiumDocuments(packId, slugs, { bySlug: true });
    };
    compendiumUtils[CAT_COMPENDIUM_PATCH_FLAG] = true;
  }
  if (!compendiumUtils[CAT_COMPENDIUM_NAME_PATCH_FLAG] && typeof compendiumUtils.getDocumentByName === "function") {
    const original = compendiumUtils.getDocumentByName;
    compendiumUtils.getDocumentByName = async function(packId, name, options = {}) {
      if (!getSetting(SETTING_KEYS.fixCPRLookup, true) || typeof name !== "string") return original.call(this, packId, name, options);
      return (await getLocalizedCompendiumDocuments(packId, [name], { bySlug: false, rules: options.rules }))[0];
    };
    compendiumUtils[CAT_COMPENDIUM_NAME_PATCH_FLAG] = true;
  }
}

export function patchCATLocaleSearch() {
  if (!getSetting(SETTING_KEYS.fixCPRLookup, true)) return false;
  const cat = globalThis.cat;
  patchCATCompendiumSearch(cat?.utils?.compendiumUtils);
  const documentUtils = cat?.utils?.documentUtils;
  if (documentUtils?.[CAT_PATCH_FLAG]) return true;
  if (typeof documentUtils?.getIdentifier !== "function"
    || typeof documentUtils.getMonsterIdentifier !== "function"
    || typeof cat?.utils?.itemUtils?.getAdvancementSourceKey !== "function"
    || typeof cat?.lib?.constants?.automations?.getAutomationByIdentifier !== "function") return false;

  const original = documentUtils.getIdentifier;
  documentUtils.getIdentifier = function(document, options = {}) {
    const identifier = original.call(this, document, options);
    if (!getSetting(SETTING_KEYS.fixCPRLookup, true) || (options.documentType ?? document?.documentName) !== "Item") return identifier;
    const result = resolveItemIdentifier(document, identifier);
    if (result.resolved !== identifier) logDebug("CAT identifier fallback", { uuid: document.uuid, ...result });
    return result.resolved;
  };
  documentUtils[CAT_PATCH_FLAG] = true;
  logDebug("CAT locale search patch installed");
  return true;
}
