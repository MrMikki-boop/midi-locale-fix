import { MODULE_ID, SETTING_KEYS, SETTING_MENU_KEYS } from "./constants.mjs";
import {
  ActiveEffectsSettingsMenu,
  CPRSettingsMenu,
  SkillTreeSettingsMenu
} from "./settings-menus.mjs";

export function registerSettings() {
  game.settings.registerMenu(MODULE_ID, SETTING_MENU_KEYS.activeEffects, {
    name: "MIDI_LOCALE_FIX.Menus.ActiveEffects.Name",
    label: "MIDI_LOCALE_FIX.Menus.ActiveEffects.Label",
    hint: "MIDI_LOCALE_FIX.Menus.ActiveEffects.Hint",
    icon: "fas fa-bolt",
    type: ActiveEffectsSettingsMenu,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, SETTING_MENU_KEYS.cpr, {
    name: "MIDI_LOCALE_FIX.Menus.CPR.Name",
    label: "MIDI_LOCALE_FIX.Menus.CPR.Label",
    hint: "MIDI_LOCALE_FIX.Menus.CPR.Hint",
    icon: "fas fa-mortar-pestle",
    type: CPRSettingsMenu,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, SETTING_MENU_KEYS.skillTree, {
    name: "MIDI_LOCALE_FIX.Menus.SkillTree.Name",
    label: "MIDI_LOCALE_FIX.Menus.SkillTree.Label",
    hint: "MIDI_LOCALE_FIX.Menus.SkillTree.Hint",
    icon: "fas fa-code-branch",
    type: SkillTreeSettingsMenu,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.debug, {
    name: "MIDI_LOCALE_FIX.Settings.Debug.Name",
    hint: "MIDI_LOCALE_FIX.Settings.Debug.Hint",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.verbose, {
    name: "MIDI_LOCALE_FIX.Settings.Verbose.Name",
    hint: "MIDI_LOCALE_FIX.Settings.Verbose.Hint",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.fixCPRLookup, {
    name: "MIDI_LOCALE_FIX.Settings.FixCPRLookup.Name",
    hint: "MIDI_LOCALE_FIX.Settings.FixCPRLookup.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.suppressCPRWarnings, {
    name: "MIDI_LOCALE_FIX.Settings.SuppressCPRWarnings.Name",
    hint: "MIDI_LOCALE_FIX.Settings.SuppressCPRWarnings.Hint",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.skillTreeSyncName, {
    name: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncName.Name",
    hint: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncName.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.skillTreeSyncImage, {
    name: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncImage.Name",
    hint: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncImage.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTING_KEYS.skillTreeSyncDescription, {
    name: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncDescription.Name",
    hint: "MIDI_LOCALE_FIX.Settings.SkillTreeSyncDescription.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
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
