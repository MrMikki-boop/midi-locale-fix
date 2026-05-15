import { MODULE_ID } from "./constants.mjs";
import { exposeApi } from "./api.mjs";
import { patchCPRLocaleSearch, patchNotificationSuppression } from "./cpr-locale-patch.mjs";
import { registerEffectKeyFixHooks } from "./effect-key-fix.mjs";
import { registerSettings } from "./settings.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerEffectKeyFixHooks();
  exposeApi();

  console.log(`[${MODULE_ID}] Module initialized`);

  patchCPRLocaleSearch();
  patchNotificationSuppression();
});

Hooks.once("cprInitComplete", patchCPRLocaleSearch);

Hooks.once("ready", () => {
  exposeApi();
  patchCPRLocaleSearch();
  patchNotificationSuppression();
});
