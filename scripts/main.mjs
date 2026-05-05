/**
 * Midi Locale Key Fix v1.0
 *
 * Перехватывает создание Active Effects и нормализует русские аббревиатуры
 * характеристик/навыков обратно в английские системные коды (str, dex, acr...).
 * Контекстно: если в пути ключа есть "skill" - маппит как навык,
 * если "check"/"save"/"attack" - как характеристику.
 */

const MODULE_ID = "midi-locale-fix";

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
