# Midi Locale Key Fix

![Foundry v13](https://img.shields.io/badge/Foundry-v13-green)
![GitHub downloads](https://img.shields.io/github/downloads/MrMikki-boop/midi-locale-fix/total?label=GitHub%20downloads)
![GitHub downloads latest](https://img.shields.io/github/downloads/MrMikki-boop/midi-locale-fix/latest/total?label=latest%20downloads)
[![Report bugs on GitHub](https://img.shields.io/badge/report%20bugs-GitHub-red)](https://github.com/MrMikki-boop/midi-locale-fix/issues)

Небольшой модуль для Foundry VTT v13 + dnd5e 5.x, который чинит проблемы совместимости русской локализации с Midi-QoL и Cauldron of Plentiful Resources.

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

Также модуль скрывает известное ложное предупреждение CPR:

```text
Предмет в компендиуме не найден! chris-premades.CPRSpells: Fire Shield
```

Это предупреждение приходит из CPR tour lookup и не означает, что предмет реально отсутствует или используется.

## Настройки

В настройках Foundry доступны:

- **Log fixed Active Effect keys** - логирует исправленные ключи Active Effect.
- **Verbose logging** - логирует все проверенные ключи Active Effect.
- **Fix CPR localized item lookup** - включает fallback-поиск CPR для локализованных и двуязычных названий.
- **Suppress known CPR false warnings** - скрывает известные ложные предупреждения CPR.

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
// true
```

## Структура

```text
scripts/main.mjs              Entry point: hooks, settings, API
scripts/constants.mjs         Константы, карты характеристик и навыков
scripts/settings.mjs          Регистрация настроек Foundry
scripts/effect-key-fix.mjs    Исправление Active Effect keys
scripts/cpr-locale-patch.mjs  CPR fallback lookup и warning suppression
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

## Разработка

Быстрая проверка синтаксиса:

```powershell
node --check scripts/main.mjs
node --check scripts/constants.mjs
node --check scripts/settings.mjs
node --check scripts/effect-key-fix.mjs
node --check scripts/cpr-locale-patch.mjs
node --check scripts/api.mjs
```

Проверка JSON:

```powershell
node -e "const fs=require('fs'); for (const p of ['module.json','languages/en.json','languages/ru.json']) JSON.parse(fs.readFileSync(p,'utf8')); console.log('json ok')"
```

## Лицензия

MIT
