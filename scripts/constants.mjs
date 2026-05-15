export const MODULE_ID = "midi-locale-fix";
export const MODULE_TITLE = "Midi Locale Key Fix";

export const SETTING_KEYS = {
  debug: "debug",
  verbose: "verbose",
  fixCPRLookup: "fixCPRLookup",
  suppressCPRWarnings: "suppressCPRWarnings"
};

export const CPR_PATCH_FLAG = "__midiLocaleFixCPRPatched";
export const NOTIFICATION_PATCH_FLAG = "__midiLocaleFixNotificationPatched";

export const SUPPRESSED_CPR_WARNINGS = {
  "chris-premades.CPRSpells": ["Fire Shield"]
};

export const ABILITY_MAP = {
  "сил": "str", "сила": "str",
  "лов": "dex", "лвк": "dex", "ловкость": "dex",
  "тел": "con", "телосложение": "con",
  "вын": "con", "выносливость": "con",
  "инт": "int", "интеллект": "int",
  "мдр": "wis", "муд": "wis", "мудрость": "wis",
  "хар": "cha", "харизма": "cha"
};

export const SKILL_MAP = {
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
