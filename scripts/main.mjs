import { MODULE_ID } from "./constants.mjs";
import { exposeApi } from "./api.mjs";
import { patchCATLocaleSearch } from "./cat-locale-patch.mjs";
import { patchCPRLocaleSearch, patchNotificationSuppression } from "./cpr-locale-patch.mjs";
import { registerEffectKeyFixHooks } from "./effect-key-fix.mjs";
import { registerSettings } from "./settings.mjs";
import { registerSkillTreeDescriptionSyncHooks } from "./skill-tree-description-sync.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerEffectKeyFixHooks();
  registerSkillTreeDescriptionSyncHooks();
  exposeApi();

  console.log(`[${MODULE_ID}] Module initialized`);

  patchCPRLocaleSearch();
  patchCATLocaleSearch();
  patchNotificationSuppression();
});

Hooks.once("cprInitComplete", patchCPRLocaleSearch);
Hooks.once("catInit", patchCATLocaleSearch);
Hooks.once("catReady", patchCATLocaleSearch);

Hooks.once("ready", () => {
  exposeApi();
  patchCPRLocaleSearch();
  patchCATLocaleSearch();
  patchNotificationSuppression();
});
