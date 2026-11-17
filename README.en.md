# dsh-chat-migration

DeepSeek conversation-history import and DSH session export, packaged as **standard DeepSeek Harness plugins**: install with one `dsh plugin add`, no host patches, no fork required.

[中文](./README.md) | English

## What you get

| Package | Status | Capability |
| --- | --- | --- |
| `@xiaozhuang-dsh/conversation-import` | ✅ installable | Import DeepSeek conversation history (preview → select → import as local sessions), export DSH sessions as a downloadable archive, "Import conversations" settings section |
| `@xiaozhuang-dsh/chat-preset` | ✅ installable | Registers the removable `chat` plain-chat agent preset |
| `@xiaozhuang-dsh/composer-add-menu` | ⛔ not ported | Composer "+" menu (commands / plugins / skills / attachments) |
| `@xiaozhuang-dsh/ui-plain-chat` | ⛔ not ported | Sidebar chat entry + plain-chat presentation layer |

## Install

```bash
dsh plugin --profile desktop add @xiaozhuang-dsh/conversation-import
dsh plugin --profile desktop add @xiaozhuang-dsh/chat-preset
```

`dsh plugin add` registers the package in that profile's `dsh.profile.bundles` automatically; restart DSH to load it.

Release tarball instead of npm:

```bash
dsh plugin --profile desktop add https://github.com/siweimidu/dsh-chat-migration/releases/download/v0.3.0/xiaozhuang-dsh-conversation-import-0.3.0.tgz
```

Local checkout:

```bash
dsh plugin --profile desktop add link:/absolute/path/to/dsh-chat-migration/packages/conversation-import
```

Remove:

```bash
dsh plugin --profile desktop remove @xiaozhuang-dsh/conversation-import
```

## Compatibility

`engines.dsh >= 0.1.7`. Measured (not asserted) results in [docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md): both slots these plugins register into exist in `0.1.7-rc.2`, `0.2.0-rc.2`, `0.2.1-rc.2` and `0.2.2-rc.3`, and all eight runtime host packages are available in all four. Regenerate with `pnpm compat:matrix`.

Real command output is recorded in [docs/VERIFICATION.md](./docs/VERIFICATION.md).

## Why two packages are not ported

`composer-add-menu` and `ui-plain-chat` depend on private contracts of the upstream fork that stock DSH does not expose:

- `composer-add-menu` needs the `conversation.input.add` slot, whose owner supplies ~18 composer props (command/skill/plugin catalogs, attachment callbacks, `focusInput`, `onInsertSlashItem`). Stock renders `conversation.input.left` with `{}`. Porting means rewiring to the public `commandUi` / `inputTriggers` / `fileUpload` client services **and** rebuilding `lib/client.js` with a CSS-Modules-capable pipeline.
- `ui-plain-chat` needs `sidebar.primary.action`, the `conversationPresentation` service and `uiWorkspace.registerSessionGroup`. None exist on stock (`uiWorkspace.openSession/startSession/newSession` do). Its closest surface today is `sidebar.footer.action`, which only passes `{ wide }`.

Both stay `private: true`, and a test enforces that so they cannot be installed into a host where they would render nothing.

Known build gap: `lib/client.js` files are upstream toolchain artifacts. The tsdown config in this repo rebuilds the host half; the client half still needs CSS Modules support (rolldown currently compiles the class map to an empty object). Until that is fixed, client-side changes are "edit source + sync the artifact + lock it with tests".

## Layout

```
packages/<id>/          four self-contained, installable packages
scripts/check-manifests.mjs   install-contract checker
scripts/compat-matrix.mjs     measured host slot/package availability
legacy/                 upstream fork export (old payload/, core patches) — reference only
docs/                   design, compatibility matrix, verification log
```

`legacy/payload/shared/*.patch` patched the DSH core itself. This repo no longer needs or supports that: a standard plugin must not modify the host.

## Development

```bash
pnpm install
pnpm check:manifests
pnpm test
pnpm typecheck
pnpm compat:matrix
```

## License

MIT — see [LICENSE](./LICENSE). Sources derive from a one-way export of Xiaozhuang DSH (kept in [legacy/](./legacy/)).
