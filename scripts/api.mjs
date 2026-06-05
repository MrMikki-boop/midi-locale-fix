import {
  CPR_PATCH_FLAG,
  MODULE_ID,
  NOTIFICATION_PATCH_FLAG,
  SETTING_KEYS
} from "./constants.mjs";
import { fixKey } from "./effect-key-fix.mjs";
import {
  getLookupNameCandidates,
  isSuppressedCPRWarning,
  normalizeCPRRules,
  patchCPRLocaleSearch,
  patchNotificationSuppression
} from "./cpr-locale-patch.mjs";
import { getSetting } from "./settings.mjs";

const SAMPLE_CPR_NAME = "Сглаз / Hex";
const SAMPLE_MIDI_KEY = "flags.midi-qol.disadvantage.check.сил";
const SAMPLE_CPR_WARNING = "Предмет в компендиуме не найден! chris-premades.CPRSpells: Fire Shield";

function readSetting(key, fallback) {
  try {
    return getSetting(key, fallback);
  } catch {
    return fallback;
  }
}

export function runDiagnostics() {
  const module = game.modules.get(MODULE_ID);
  const cpr = globalThis.chrisPremades;
  const notifications = globalThis.ui?.notifications;

  return {
    module: {
      id: MODULE_ID,
      active: Boolean(module?.active),
      version: module?.version ?? module?.manifest?.version ?? null
    },
    settings: {
      debug: readSetting(SETTING_KEYS.debug, false),
      verbose: readSetting(SETTING_KEYS.verbose, false),
      fixCPRLookup: readSetting(SETTING_KEYS.fixCPRLookup, true),
      suppressCPRWarnings: readSetting(SETTING_KEYS.suppressCPRWarnings, true)
    },
    patches: {
      cprInstalled: Boolean(cpr),
      cprUtilsAvailable: Boolean(cpr?.utils?.genericUtils && cpr?.utils?.compendiumUtils),
      cprLocaleSearchPatched: Boolean(cpr?.[CPR_PATCH_FLAG]),
      notificationSuppressionPatched: Boolean(notifications?.[NOTIFICATION_PATCH_FLAG])
    },
    samples: {
      midiKey: {
        input: SAMPLE_MIDI_KEY,
        output: fixKey(SAMPLE_MIDI_KEY)
      },
      cprLookup: {
        input: SAMPLE_CPR_NAME,
        candidates: getLookupNameCandidates(SAMPLE_CPR_NAME)
      },
      cprWarning: {
        input: SAMPLE_CPR_WARNING,
        suppressed: isSuppressedCPRWarning(SAMPLE_CPR_WARNING)
      }
    }
  };
}

export function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  module.api = {
    fixKey,
    getLookupNameCandidates,
    isSuppressedCPRWarning,
    normalizeCPRRules,
    patchCPRLocaleSearch,
    patchNotificationSuppression,
    runDiagnostics,
    testCPRName: (name) => ({
      name,
      candidates: getLookupNameCandidates(name)
    })
  };
}
