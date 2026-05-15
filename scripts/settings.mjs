import { MODULE_ID, SETTING_KEYS } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTING_KEYS.debug, {
    name: "MIDI_LOCALE_FIX.Settings.Debug.Name",
    hint: "MIDI_LOCALE_FIX.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.verbose, {
    name: "MIDI_LOCALE_FIX.Settings.Verbose.Name",
    hint: "MIDI_LOCALE_FIX.Settings.Verbose.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.fixCPRLookup, {
    name: "MIDI_LOCALE_FIX.Settings.FixCPRLookup.Name",
    hint: "MIDI_LOCALE_FIX.Settings.FixCPRLookup.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.suppressCPRWarnings, {
    name: "MIDI_LOCALE_FIX.Settings.SuppressCPRWarnings.Name",
    hint: "MIDI_LOCALE_FIX.Settings.SuppressCPRWarnings.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });
}

export function getSetting(key, fallback = false) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return fallback;
  }
}

export function debugEnabled() {
  return getSetting(SETTING_KEYS.debug) || getSetting(SETTING_KEYS.verbose);
}

export function logDebug(message, data) {
  if (!debugEnabled()) return;
  console.log(`[${MODULE_ID}] ${message}`, data ?? "");
}
