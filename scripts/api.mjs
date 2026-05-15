import { fixKey } from "./effect-key-fix.mjs";
import {
  getLookupNameCandidates,
  isSuppressedCPRWarning,
  normalizeCPRRules,
  patchCPRLocaleSearch,
  patchNotificationSuppression
} from "./cpr-locale-patch.mjs";

export function exposeApi() {
  const module = game.modules.get("midi-locale-fix");
  if (!module) return;

  module.api = {
    fixKey,
    getLookupNameCandidates,
    isSuppressedCPRWarning,
    normalizeCPRRules,
    patchCPRLocaleSearch,
    patchNotificationSuppression,
    testCPRName: (name) => ({
      name,
      candidates: getLookupNameCandidates(name)
    })
  };
}
