import { MODULE_ID, SETTING_KEYS } from "./constants.mjs";
import { getSetting, logDebug } from "./settings.mjs";

const SKILL_TREE_MODULE_ID = "skill-tree";
const ITEM_UUIDS_FLAG = "itemUuids";
const PAGE_CONTENT_PATH = "text.content";
const ITEM_DESCRIPTION_PATH = "system.description.value";

export function registerSkillTreeDescriptionSyncHooks() {
  Hooks.on("updateItem", (item, changes) => {
    void syncSkillPagesFromUpdatedItem(item, changes).catch((error) => {
      console.error(`[${MODULE_ID}] Failed to sync Skill Tree page fields from updated item`, error);
    });
  });

  Hooks.on("updateJournalEntryPage", (page, changes) => {
    void syncSkillPageFromLinkedItemChange(page, changes).catch((error) => {
      console.error(`[${MODULE_ID}] Failed to sync Skill Tree page fields from linked item`, error);
    });
  });
}

async function syncSkillPagesFromUpdatedItem(item, changes) {
  if (!canSyncSkillTreeFields()) return;
  if (!isItemDocument(item)) return;

  const fields = getChangedSyncFields(changes);
  if (!fields.length) return;

  const pages = findSkillPagesLinkedFirstToItem(item.uuid);
  for (const page of pages) {
    await syncSkillPageFields(page, item, fields);
  }

  logDebug("Skill Tree page fields synced from updated item", {
    itemUuid: item.uuid,
    fields,
    updated: pages.length
  });
}

async function syncSkillPageFromLinkedItemChange(page, changes) {
  if (!canSyncSkillTreeFields()) return;
  if (!isSkillTreePage(page)) return;
  if (!hasChangedPath(changes, `flags.${SKILL_TREE_MODULE_ID}.${ITEM_UUIDS_FLAG}`)) return;

  const itemUuid = getFirstLinkedItemUuid(page);
  if (!itemUuid) return;

  const item = await fromUuid(itemUuid);
  if (!isItemDocument(item)) return;

  await syncSkillPageFields(page, item, getEnabledSyncFields());
}

function canSyncSkillTreeFields() {
  return Boolean(game.modules.get(SKILL_TREE_MODULE_ID)?.active)
    && isResponsibleGM();
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;

  const activeGMs = game.users
    .filter((user) => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id));

  return activeGMs[0]?.id === game.user.id;
}

function isItemDocument(document) {
  return document?.documentName === "Item";
}

function isSkillTreePage(page) {
  return page?.documentName === "JournalEntryPage"
    && page.parent?.getFlag(SKILL_TREE_MODULE_ID, "isSkillTree");
}

function getItemDescription(item) {
  const description = item.system?.description?.value;
  return typeof description === "string" ? description : "";
}

function getEnabledSyncFields() {
  const fields = [];
  if (getSetting(SETTING_KEYS.skillTreeSyncName, true)) fields.push("name");
  if (getSetting(SETTING_KEYS.skillTreeSyncImage, true)) fields.push("image");
  if (getSetting(SETTING_KEYS.skillTreeSyncDescription, true)) fields.push("description");
  return fields;
}

function getChangedSyncFields(changes) {
  return getEnabledSyncFields().filter((field) => {
    if (field === "name") return hasChangedPath(changes, "name");
    if (field === "image") return hasChangedPath(changes, "img");
    if (field === "description") return hasChangedPath(changes, ITEM_DESCRIPTION_PATH);
    return false;
  });
}

function hasChangedPath(changes, path) {
  return Object.hasOwn(changes ?? {}, path) || foundry.utils.hasProperty(changes ?? {}, path);
}

function findSkillPagesLinkedFirstToItem(itemUuid) {
  const skillTrees = game.journal.filter((journal) => journal.getFlag(SKILL_TREE_MODULE_ID, "isSkillTree"));
  const pages = [];

  for (const skillTree of skillTrees) {
    for (const page of skillTree.pages) {
      if (getFirstLinkedItemUuid(page) === itemUuid) pages.push(page);
    }
  }

  return pages;
}

function getFirstLinkedItemUuid(page) {
  const itemUuids = page.getFlag(SKILL_TREE_MODULE_ID, ITEM_UUIDS_FLAG);
  if (!Array.isArray(itemUuids)) return null;
  return itemUuids.find((uuid) => typeof uuid === "string" && uuid.length > 0) ?? null;
}

async function syncSkillPageFields(page, item, fields) {
  const update = {};
  if (fields.includes("name")) update.name = item.name;
  if (fields.includes("image")) update.src = item.img || page.src;
  if (fields.includes("description")) update[PAGE_CONTENT_PATH] = getItemDescription(item);

  if (!Object.keys(update).length) return;

  await page.update(update);
  logDebug("Synced Skill Tree page fields from linked item", {
    pageUuid: page.uuid,
    itemUuid: item.uuid,
    fields
  });
}
