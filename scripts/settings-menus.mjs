import { MODULE_ID, SETTING_KEYS } from "./constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MidiLocaleSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static SETTINGS = [];
  static TITLE = "";

  static get DEFAULT_OPTIONS() {
    return {
      id: `${MODULE_ID}-${this.name.replace(/SettingsMenu$/, "").toLowerCase()}-settings`,
      classes: [MODULE_ID, "settings-menu"],
      tag: "form",
      window: {
        title: this.TITLE,
        icon: "fas fa-cog",
        minimizable: true,
        resizable: false
      },
      position: {
        width: 520,
        height: "auto"
      }
    };
  }

  static get PARTS() {
    return {
      content: {
        template: `modules/${MODULE_ID}/templates/settings-menu.hbs`
      }
    };
  }

  async _prepareContext(options) {
    return {
      settings: this.constructor.SETTINGS.map((key) => {
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        return {
          key,
          name: setting?.name ?? key,
          hint: setting?.hint ?? "",
          value: Boolean(readSetting(key, setting?.default ?? false))
        };
      })
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element.addEventListener("submit", this.#onSubmit.bind(this));
  }

  async #onSubmit(event) {
    event.preventDefault();

    const reloadSettings = [];
    for (const key of this.constructor.SETTINGS) {
      const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
      const input = this.element.elements[key];
      const currentValue = Boolean(readSetting(key, setting?.default ?? false));
      const newValue = Boolean(input?.checked);

      if (newValue === currentValue) continue;

      await game.settings.set(MODULE_ID, key, newValue);
      if (setting?.requiresReload) reloadSettings.push(setting);
    }

    this.close();

    if (reloadSettings.length) await promptReload(reloadSettings);
  }
}

export class ActiveEffectsSettingsMenu extends MidiLocaleSettingsMenu {
  static SETTINGS = [
    SETTING_KEYS.debug,
    SETTING_KEYS.verbose
  ];

  static TITLE = "MIDI_LOCALE_FIX.Menus.ActiveEffects.Name";
}

export class CPRSettingsMenu extends MidiLocaleSettingsMenu {
  static SETTINGS = [
    SETTING_KEYS.fixCPRLookup,
    SETTING_KEYS.suppressCPRWarnings
  ];

  static TITLE = "MIDI_LOCALE_FIX.Menus.CPR.Name";
}

export class SkillTreeSettingsMenu extends MidiLocaleSettingsMenu {
  static SETTINGS = [
    SETTING_KEYS.skillTreeSyncName,
    SETTING_KEYS.skillTreeSyncImage,
    SETTING_KEYS.skillTreeSyncDescription
  ];

  static TITLE = "MIDI_LOCALE_FIX.Menus.SkillTree.Name";
}

function readSetting(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return fallback;
  }
}

async function promptReload(settings) {
  const requiresWorldReload = settings.some((setting) => setting.scope === "world");
  const SettingsConfig = foundry.applications.settings?.SettingsConfig
    ?? foundry.applications.apps?.SettingsConfig
    ?? globalThis.SettingsConfig;

  if (SettingsConfig?.reloadConfirm) {
    await SettingsConfig.reloadConfirm({ world: requiresWorldReload });
    return;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: game.i18n.localize("SETTINGS.ReloadPromptTitle")
    },
    content: `<p>${game.i18n.localize("SETTINGS.ReloadPromptBody")}</p>`
  });
  if (confirmed) foundry.utils.debouncedReload();
}
