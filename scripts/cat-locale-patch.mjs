import { CAT_PATCH_FLAG, SETTING_KEYS } from "./constants.mjs";
import { getSetting, logDebug } from "./settings.mjs";

function formatIdentifier(name) {
  if (typeof name !== "string" || typeof name.slugify !== "function") return "";
  // Match dnd5e.utils.formatIdentifier, including names without spaces around '/'.
  return name.replaceAll(/(\w+)([\\|/])(\w+)/g, "$1-$3").slugify({ strict: true });
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

function resolveItemIdentifier(item, identifier) {
  const result = { identifier, resolved: identifier, reason: "native", candidates: [] };
  // Index entries are used during CAT registration; never remap those or source documents.
  if (item?.documentName !== "Item" || typeof item.toObject !== "function" || item.inCompendium) return result;
  const names = [
    ...getLocalizedNameCandidates(item.name),
    item.flags?.babele?.originalName,
    item.originalName
  ];
  const candidates = new Set();
  for (const name of names) {
    if (typeof name !== "string" || !/[a-z]/i.test(name) || /[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/u.test(name)) continue;
    const value = formatIdentifier(name);
    if (value && value !== identifier) candidates.add(value);
  }
  // Ordinary English items and canonical ids take the cheap path in CAT's hot loops.
  if (!candidates.size) return result;
  result.candidates = Array.from(candidates);
  if (identifier && identifier !== formatIdentifier(item.name)) return { ...result, reason: "customIdentifier" };
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

export function patchCATLocaleSearch() {
  if (!getSetting(SETTING_KEYS.fixCPRLookup, true)) return false;
  const cat = globalThis.cat;
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
