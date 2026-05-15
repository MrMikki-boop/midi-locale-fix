import {
  CPR_PATCH_FLAG,
  NOTIFICATION_PATCH_FLAG,
  SETTING_KEYS,
  SUPPRESSED_CPR_WARNINGS
} from "./constants.mjs";
import { getSetting, logDebug } from "./settings.mjs";

function pushCandidate(candidates, value) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  candidates.add(trimmed);
}

export function getLookupNameCandidates(name) {
  const candidates = new Set();
  pushCandidate(candidates, name);
  if (typeof name !== "string") return Array.from(candidates);

  for (const part of name.split(/\s*(?:\/|\||\\)\s*/g)) pushCandidate(candidates, part);

  pushCandidate(candidates, name.match(/\(([^()]+)\)\s*$/)?.[1]);
  pushCandidate(candidates, name.match(/\[([^\[\]]+)\]\s*$/)?.[1]);

  return Array.from(candidates);
}

export function normalizeCPRRules(rules) {
  return rules === "modern" || rules === "2024" ? "modern" : "legacy";
}

function getCPRRulesCandidates(key, rules) {
  if (rules) return [normalizeCPRRules(rules)];
  if (typeof key === "string" && key.includes("2024")) return ["modern", "legacy"];
  return ["legacy", "modern"];
}

export function isSuppressedCPRWarning(message) {
  if (typeof message !== "string") return false;
  return Object.entries(SUPPRESSED_CPR_WARNINGS).some(([pack, names]) => {
    if (!message.includes(`${pack}:`)) return false;
    return names.some((name) => message.includes(`${pack}: ${name}`));
  });
}

export function patchNotificationSuppression() {
  if (!getSetting(SETTING_KEYS.suppressCPRWarnings, true)) return false;

  const notifications = globalThis.ui?.notifications;
  if (!notifications?.warn || notifications[NOTIFICATION_PATCH_FLAG]) return Boolean(notifications?.warn);

  const originalWarn = notifications.warn.bind(notifications);
  notifications.warn = function(message, options) {
    if (isSuppressedCPRWarning(message)) {
      logDebug("Suppressed CPR warning", { message });
      return null;
    }
    return originalWarn(message, options);
  };

  notifications[NOTIFICATION_PATCH_FLAG] = true;
  console.log("[midi-locale-fix] CPR warning suppression patch installed");
  return true;
}

export function patchCPRLocaleSearch() {
  if (!getSetting(SETTING_KEYS.fixCPRLookup, true)) return false;

  const cpr = globalThis.chrisPremades;
  if (!cpr?.utils || cpr[CPR_PATCH_FLAG]) return Boolean(cpr?.utils);

  const { genericUtils, compendiumUtils } = cpr.utils;
  if (!genericUtils || !compendiumUtils) return false;

  const originalGetCPRIdentifiers = genericUtils.getCPRIdentifiers?.bind(genericUtils);
  const originalGetCPRIdentifier = genericUtils.getCPRIdentifier?.bind(genericUtils);
  const originalNotify = genericUtils.notify?.bind(genericUtils);
  const originalGetItemFromCompendium = compendiumUtils.getItemFromCompendium?.bind(compendiumUtils);
  if (!originalGetCPRIdentifiers || !originalGetItemFromCompendium) return false;

  function collectIdentifiers(name, rules) {
    const identifiers = new Set();
    const normalizedRules = normalizeCPRRules(rules);
    for (const candidate of getLookupNameCandidates(name)) {
      for (const identifier of originalGetCPRIdentifiers(candidate, normalizedRules) ?? []) {
        pushCandidate(identifiers, identifier);
      }
    }
    return Array.from(identifiers);
  }

  genericUtils.getCPRIdentifiers = function(name, rules = "legacy") {
    return collectIdentifiers(name, rules);
  };

  if (originalGetCPRIdentifier) {
    genericUtils.getCPRIdentifier = function(name, rules = "legacy") {
      return collectIdentifiers(name, rules)[0];
    };
  }

  if (originalNotify) {
    genericUtils.notify = function(message, type = "info", options = {}) {
      if (getSetting(SETTING_KEYS.suppressCPRWarnings, true) && type === "warn" && isSuppressedCPRWarning(message)) {
        logDebug("Suppressed CPR notify warning", { message });
        return null;
      }
      return originalNotify(message, type, options);
    };
  }

  compendiumUtils.getItemFromCompendium = async function(key, name, options = {}) {
    const silentOptions = { ...options, ignoreNotFound: true };
    let found = await originalGetItemFromCompendium(key, name, silentOptions);
    if (found) return found;

    for (const candidate of getLookupNameCandidates(name)) {
      if (candidate === name) continue;
      found = await originalGetItemFromCompendium(key, candidate, silentOptions);
      if (found) {
        logDebug("CPR compendium name fallback", { key, from: name, to: candidate });
        return found;
      }
    }

    if (!options.byIdentifier && !options.bySystemIdentifier) {
      for (const rules of getCPRRulesCandidates(key, options.rules)) {
        for (const candidate of getLookupNameCandidates(name)) {
          for (const identifier of collectIdentifiers(candidate, rules)) {
            found = await originalGetItemFromCompendium(key, identifier, {
              ...silentOptions,
              byIdentifier: true,
              bySystemIdentifier: false
            });
            if (found) {
              logDebug("CPR compendium identifier fallback", { key, from: name, to: identifier, rules });
              return found;
            }
          }
        }
      }
    }

    if (options.ignoreNotFound) return undefined;
    return originalGetItemFromCompendium(key, name, options);
  };

  cpr[CPR_PATCH_FLAG] = true;
  console.log("[midi-locale-fix] CPR locale search patch installed");
  return true;
}
