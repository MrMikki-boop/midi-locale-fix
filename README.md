# Midi Locale Key Fix

![Foundry v13–14](https://img.shields.io/badge/Foundry-v13%E2%80%9314-green)
![GitHub downloads](https://img.shields.io/github/downloads/MrMikki-boop/midi-locale-fix/total?label=GitHub%20downloads)
![GitHub downloads latest](https://img.shields.io/github/downloads/MrMikki-boop/midi-locale-fix/latest/total?label=latest%20downloads)
[![Report bugs on GitHub](https://img.shields.io/badge/report%20bugs-GitHub-red)](https://github.com/MrMikki-boop/midi-locale-fix/issues)

Небольшой модуль для Foundry VTT v13–14 + dnd5e, который чинит проблемы совместимости русской локализации с Midi-QoL и Cauldron of Plentiful Resources.

В версии 1.3.3 разрешён запуск на Foundry 14. Проверка в живом мире v14 ещё нужна, поэтому `compatibility.verified` остаётся `13`. Поддержка Foundry 13 сохранена.

## Что чинит

### Midi-QoL Active Effects

При русской локализации некоторые автоматизации создают Active Effect с ключом вида:

```text
flags.midi-qol.disadvantage.check.сил
```

Вместо корректного системного ключа:

```text
flags.midi-qol.disadvantage.check.str
```

Midi-QoL такие ключи не понимает, поэтому эффект может не работать. Модуль перехватывает создание и обновление Active Effects и заменяет русские сокращения характеристик/навыков на системные dnd5e-коды.

Работает на хуках:

- `preCreateActiveEffect`
- `preUpdateActiveEffect`
- `preCreateItem`

### Cauldron of Plentiful Resources

CPR ищет автоматизации по английскому имени или внутреннему identifier. Из-за этого предмет с названием вроде `Сглаз / Hex` может не определяться через Medkit, хотя автоматизация для `Hex` есть.

Модуль добавляет CPR fallback-поиск:

- исходное имя;
- части двуязычного имени через `/`, `|`, `\`;
- текст в конце в круглых или квадратных скобках;
- CPR identifier, если он найден по одному из вариантов имени.

Пример:

```text
Сглаз / Hex
```

будет проверяться как:

```text
Сглаз / Hex
Сглаз
Hex
```

Если CPR установлен и активен, модуль скрывает известное ложное предупреждение CPR:

```text
Предмет в компендиуме не найден! chris-premades.CPRSpells: Fire Shield
```

Скрывается только точный текст этого предупреждения и только когда индекс компендиума содержит Fire Shield, его английский alias или CPR identifier. Если предмет реально отсутствует, индекс недоступен или сообщение относится к другому предмету, предупреждение остаётся.

## Настройки

В настройках Foundry доступны:

- **Active Effects** - внутреннее меню с логированием исправленных и проверенных Active Effect keys.
- **Cauldron of Plentiful Resources** - внутреннее меню с fallback-поиском CPR и скрытием известных ложных предупреждений.
- **Skill Tree** - внутреннее меню синхронизации страниц Skill Tree из первого связанного предмета. Можно отдельно включить синхронизацию названия, изображения и описания.

Для настроек есть английская и русская локализация:

- `languages/en.json`
- `languages/ru.json`

## Диагностика

Модуль экспортирует небольшой API:

```js
const api = game.modules.get("midi-locale-fix").api;
```

Проверить исправление Midi-QoL ключа:

```js
api.fixKey("flags.midi-qol.disadvantage.check.сил");
// "flags.midi-qol.disadvantage.check.str"
```

Проверить варианты поиска CPR:

```js
api.testCPRName("Сглаз / Hex");
// { name: "Сглаз / Hex", candidates: ["Сглаз / Hex", "Сглаз", "Hex"] }
```

Проверить suppression warning:

```js
api.isSuppressedCPRWarning("Предмет в компендиуме не найден! chris-premades.CPRSpells: Fire Shield");
// true только при наличии предмета или его CPR identifier в индексе компендиума
```

## Структура

```text
scripts/main.mjs              Entry point: hooks, settings, API
scripts/constants.mjs         Константы, карты характеристик и навыков
scripts/settings.mjs          Регистрация настроек Foundry
scripts/settings-menus.mjs    Внутренние меню настроек
scripts/effect-key-fix.mjs    Исправление Active Effect keys
scripts/cpr-locale-patch.mjs  CPR fallback lookup и warning suppression
scripts/skill-tree-description-sync.mjs  Синхронизация Skill Tree из связанных предметов
scripts/api.mjs               Диагностический API
```

## Installation

Paste this manifest URL into Foundry VTT's **Install Module** dialog:

```text
https://github.com/MrMikki-boop/midi-locale-fix/releases/latest/download/module.json
```

You can also download a release archive from:

```text
https://github.com/MrMikki-boop/midi-locale-fix/releases
```

## Dependencies

Модуль рассчитан на систему **dnd5e**, без привязки версии dnd5e к поколению Foundry. Обязательных модульных зависимостей нет.

**Midi-QoL**, **Cauldron of Plentiful Resources** и **Skill Tree** — рекомендуемые интеграции. Исправление ключей Active Effects работает самостоятельно; CPR fallback и Skill Tree синхронизация включаются при наличии соответствующих модулей. DAE, socketlib, libWrapper и Times Up устанавливаются по требованиям самих автоматизаций.

Foundry 13 и 14 допускаются независимо от версии dnd5e. Например, сочетание Foundry 14 и dnd5e 5.3.3 не запрещено нашим манифестом. Совместимость самой системы и сторонних автоматизаций с выбранной Foundry определяется их собственными манифестами и API.

## Лицензия

MIT
