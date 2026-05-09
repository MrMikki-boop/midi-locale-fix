/**
 * Midi Locale Key Fix v1.0
 *
 * Перехватывает создание Active Effects и нормализует русские аббревиатуры
 * характеристик/навыков обратно в английские системные коды (str, dex, acr...).
 * Контекстно: если в пути ключа есть "skill" - маппит как навык,
 * если "check"/"save"/"attack" - как характеристику.
 */

const MODULE_ID = "midi-locale-fix";
const CPR_PATCH_FLAG = "__midiLocaleFixCPRPatched";
const NOTIFICATION_PATCH_FLAG = "__midiLocaleFixNotificationPatched";
const SUPPRESSED_CPR_WARNINGS = [
  "chris-premades.CPRSpells: Fire Shield"
];

// === Характеристики ===
// Несколько вариантов сокращений из разных переводов
const ABILITY_MAP = {
  "сил": "str", "сила": "str",
  "лов": "dex", "лвк": "dex", "ловкость": "dex",
  "тел": "con", "телосложение": "con",
  "вын": "con", "выносливость": "con",
  "инт": "int", "интеллект": "int",
  "мдр": "wis", "муд": "wis", "мудрость": "wis",
  "хар": "cha", "харизма": "cha"
};

// === Навыки ===
// Контекстная проверка по пути разруливает: skill → SKILL_MAP, check/save → ABILITY_MAP
const SKILL_MAP = {
  "акр": "acr", "акробатика": "acr",
  "ужх": "ani", "ужз": "ani", "уход": "ani",
  "мгз": "arc", "магия": "arc", "аркана": "arc",
  "атл": "ath", "атлетика": "ath",
  "обм": "dec", "обман": "dec",
  "ист": "his", "история": "his",
  "прн": "ins", "проницательность": "ins",
  "зап": "itm", "запугивание": "itm",
  "рсл": "inv", "расследование": "inv",
  "мед": "med", "медицина": "med",
  "прр": "nat", "природа": "nat",
  "вним": "prc", "вмн": "prc", "внимательность": "prc",
  "выс": "prf", "выступление": "prf",
  "убж": "per", "убеждение": "per",
  "рел": "rel", "религия": "rel",
  "лвк": "slt", "лвр": "slt",
  "скр": "ste", "скрытность": "ste",
  "вжв": "sur", "выживание": "sur"
};

/**
 * Возвращает исправленный ключ, или исходный если правки не нужны.
 * Контекстно определяет тип по пути ключа.
 */
function fixKey(key) {
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
  if (isSkill) {
    replacement = SKILL_MAP[last];
  } else if (isAbility) {
    replacement = ABILITY_MAP[last];
  } else {
    replacement = ABILITY_MAP[last] || SKILL_MAP[last];
  }

  if (!replacement) return key;
  parts[parts.length - 1] = replacement;
  return parts.join(".");
}

function fixChanges(changes, source = "unknown") {
  if (!Array.isArray(changes)) return false;
  let modified = false;
  const debug = game.settings.get(MODULE_ID, "debug");
  const verbose = game.settings.get(MODULE_ID, "verbose");

  for (let i = 0; i < changes.length; i++) {
    const oldKey = changes[i].key;
    const newKey = fixKey(oldKey);

    if (newKey !== oldKey) {
      changes[i].key = newKey;
      modified = true;
      if (debug || verbose) {
        console.log(`[${MODULE_ID}] FIXED`, { source, from: oldKey, to: newKey });
      }
    } else if (verbose) {
      console.log(`[${MODULE_ID}] PASSED`, { source, key: oldKey });
    }
  }
  return modified;
}

function settingEnabled(key) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return false;
  }
}

function logDebug(message, data) {
  if (!settingEnabled("debug") && !settingEnabled("verbose")) return;
  console.log(`[${MODULE_ID}] ${message}`, data ?? "");
}

function isSuppressedCPRWarning(message) {
  if (typeof message !== "string") return false;
  return SUPPRESSED_CPR_WARNINGS.some((warning) => message.includes(warning));
}

function patchNotificationSuppression() {
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
  console.log(`[${MODULE_ID}] CPR warning suppression patch installed`);
  return true;
}

function pushCandidate(candidates, value) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  candidates.add(trimmed);
}

function getLookupNameCandidates(name) {
  const candidates = new Set();
  pushCandidate(candidates, name);
  if (typeof name !== "string") return Array.from(candidates);

  for (const part of name.split(/\s*(?:\/|\||\\)\s*/g)) {
    pushCandidate(candidates, part);
  }

  const parenthetical = name.match(/\(([^()]+)\)\s*$/)?.[1];
  pushCandidate(candidates, parenthetical);

  const bracketed = name.match(/\[([^\[\]]+)\]\s*$/)?.[1];
  pushCandidate(candidates, bracketed);

  return Array.from(candidates);
}

function getCPRRulesCandidates(key, rules) {
  if (rules) return [normalizeCPRRules(rules)];
  if (typeof key === "string" && key.includes("2024")) return ["modern", "legacy"];
  return ["legacy", "modern"];
}

function normalizeCPRRules(rules) {
  return rules === "modern" || rules === "2024" ? "modern" : "legacy";
}

function patchCPRLocaleSearch() {
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
      if (type === "warn" && isSuppressedCPRWarning(message)) {
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
  console.log(`[${MODULE_ID}] CPR locale search patch installed`);
  return true;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "debug", {
    name: "Логирование исправлений",
    hint: "Печатает в консоль каждый исправленный ключ.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "verbose", {
    name: "Подробное логирование (verbose)",
    hint: "Логирует ВСЕ ключи Active Effects, проходящие через хук - включая те, которые не были исправлены. Помогает найти пропуски в маппинге.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  console.log(`[${MODULE_ID}] Module initialized`);

  patchCPRLocaleSearch();
  patchNotificationSuppression();
});

Hooks.once("cprInitComplete", patchCPRLocaleSearch);
Hooks.once("ready", () => {
  patchCPRLocaleSearch();
  patchNotificationSuppression();
});

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
  for (const eff of data.effects) {
    if (Array.isArray(eff.changes) && fixChanges(eff.changes, "preCreateItem")) touched = true;
  }
  if (touched) {
    item.updateSource({ effects: data.effects });
  }
});
