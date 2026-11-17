# 把 dsh-chat-migration 改造成标准 DSH 插件 Implementation Plan

> **执行结果（2026-11-17）**：Task 1–7、11 完成并有真实证据（见 `docs/VERIFICATION.md`、`docs/COMPATIBILITY.md`）。
> Task 8 完成（chat-preset 可安装）。**Task 9 / 10 未执行**：`composer-add-menu` 与 `ui-plain-chat` 依赖 fork 私有契约，
> 编译器在 stock 类型上明确报错（`conversation.input.add` / `sidebar.primary.action` 不在 slot 联合类型里，
> `ctx.conversationPresentation` 不存在，owner props 全线缺失），且本仓库尚无 CSS Modules 构建链——两包已标 `private: true`，
> 测试强制其不可安装，README 写明移植所需工作。Task 12 的 desktop profile 安装被宿主拒绝（`desktop` profile 由 Electron 独占），
> 改由插件面板的本地目录安装完成，步骤见 `docs/VERIFICATION.md` 第 7 节。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库里的两份 fork 导出物改造成可 `dsh plugin add` 直接安装、零核心补丁的四个标准 DSH 插件包，并发布到 npm + GitHub Release tarball。

**Architecture:** 仓库从「fork 导出镜像」变成 pnpm monorepo：`packages/<id>/` 每个都是自包含 npm 包（`dsh.bundle.patch` + `dsh.client`），依赖用普通 semver peerDeps（开发期 `workspace:*`，由 pnpm 发布时重写）；fork 专属扩展点按「stock 等价 slot → 运行时降级」策略移植；旧的 `payload/` 与四个核心补丁移入 `legacy/` 仅作参考，不参与安装。

**Tech Stack:** TypeScript / React 18 / tsdown / pnpm workspace / Node 24；宿主 DSH `0.2.1-rc.2`（本机实测），peerDeps 面向 `^0.1.7 || ^0.2.0`。

**Spec:** `docs/PLUGIN-DESIGN.md`

## Global Constraints

- 宿主版本范围：`engines.dsh: ">=0.1.7"`；`@deepseek-ai/*` peerDeps 一律用 semver 区间，**禁止** `workspace:*` 出现在已发布的 manifest 里。
- 每个包必须有 `dsh.bundle.patch` 指向包内 `cordis.patch.yml`；client 包另需 `dsh.client.platform: "web"` 与 `dsh.client.inject`。
- **禁止**任何安装步骤修改 DSH 本体（不写 app.asar、不改宿主源码、不发 .patch）。
- 任何 slot 注册必须可缺失容忍：宿主没有该 slot 时插件其余部分照常工作，不抛错、不让宿主启动失败。
- 包名沿用 `@xiaozhuang-dsh/*` 命名空间，版本从 `0.3.0` 起。
- 产物 `lib/` 必须入库（历史安装方式依赖它，且便于无构建安装）。
- 不支持的能力必须写进 README 的「已知差异」，不得静默丢弃。

## Review Focus

- **宿主缺 slot**: 老版本 DSH 上 `ctx.slots.inject('conversation.input.left')` 永不触发时，插件不能崩、不能让整个 client runner 报错。
- **`workspace:` 泄漏**: 打包/发布产物里残留 `workspace:` 会让 `dsh plugin add` 直接失败 —— 这是最容易被忽略的回归。
- **可选依赖缺失**: `@deepseek-ai/dsh-session-log-export` 在旧版可能不存在，host 半必须能降级运行。
- **重复注册**: 与 fork 版同时存在时（用户从旧装法迁移），不能出现两条设置项或双份下载按钮。
- **包内相对路径**: `cordis.patch.yml` 里的 `./lib/index.js` 必须相对包根，`pnpm pack` 后仍可解析。

---

### Task 1: 仓库骨架与 legacy 归档

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `.npmrc`
- Move: `payload/` → `legacy/payload/`；`manifest.json`、`INSTALL.md` → `legacy/`
- Test: `tests/repo-layout.test.mjs`

**Interfaces:**
- Produces: workspace globs `packages/*`；根脚本 `build` / `typecheck` / `test` / `check:manifests`。

- [ ] **Step 1: 写失败测试** `tests/repo-layout.test.mjs` 断言：`packages` 目录存在且含四个包；`legacy/payload` 存在；根 `package.json` 的 `private` 为 true 且 `workspaces` 不出现（用 pnpm-workspace.yaml）。
- [ ] **Step 2: 运行** `node --test tests/repo-layout.test.mjs`，预期 FAIL（目录不存在）。
- [ ] **Step 3: 建骨架并 git mv** 旧文件到 `legacy/`，写 `pnpm-workspace.yaml`（`packages: ['packages/*']`）。
- [ ] **Step 4: 重跑测试**，预期 PASS。
- [ ] **Step 5: Commit** `chore: restructure repo into pnpm workspace with legacy archive`。

### Task 2: manifest 契约校验器

**Files:**
- Create: `scripts/check-manifests.mjs`（导出 `checkManifest(pkgDir) -> string[]`）
- Test: `tests/check-manifests.test.mjs`（含 fixture：合法包、含 `workspace:` 的包、缺 `dsh.bundle.patch` 的包、`cordis.patch.yml` 里路径越界的包）

**Interfaces:**
- Produces: `checkManifest(dir: string): string[]`（返回错误列表，空数组=通过）；CLI 入口对 `packages/*` 逐个跑并在有错误时 exit 1。

- [ ] **Step 1: 写失败测试** 四个用例，断言各自返回的错误文案片段（`workspace:` / `missing dsh.bundle.patch` / `patch entry escapes package` / 合法返回 `[]`）。
- [ ] **Step 2: 运行** `node --test tests/check-manifests.test.mjs`，预期 FAIL（模块不存在）。
- [ ] **Step 3: 实现** `checkManifest`：读 `package.json`，校验 name/version/main/files、peer+dev+deps 内不得有 `workspace:`、`dsh.bundle.patch` 存在且文件真实存在、`cordis.patch.yml` 内每个 `name: ./...` 解析后必须落在包目录内且目标文件存在。
- [ ] **Step 4: 重跑**，预期 4 PASS。
- [ ] **Step 5: Commit** `feat: add standard-plugin manifest contract checker`。

### Task 3: slot 降级助手

**Files:**
- Create: `packages/shared/slot-probe.ts`（`pickSlot`）、`packages/shared/slot-probe.test.ts`
- Test 命令: `node --test packages/shared/slot-probe.test.mjs`（先用 tsdown 出 js）

**Interfaces:**
- Produces: `pickSlot(available: readonly string[], candidates: readonly string[]): string | undefined` —— 返回 candidates 中第一个在 available 里的；都没有返回 undefined。

- [ ] **Step 1: 写失败测试** 三个用例：命中第一个候选、跳过缺失候选命中的第二个、全缺失返回 undefined。
- [ ] **Step 2: 运行**，预期 FAIL（符号不存在）。
- [ ] **Step 3: 实现** 用 `available.includes` 顺序查找。
- [ ] **Step 4: 重跑**，预期 3 PASS。
- [ ] **Step 5: Commit** `feat: add graceful slot fallback helper`。

### Task 4: conversation-import 包标准化（批次一）

**Files:**
- Create: `packages/conversation-import/**`（由 `legacy/payload/conversation-import/product/plugins/conversation-import` 移入）
- Modify: `src/client/index.ts:135-137`（删除 `settings.section.icon` 注册）
- Modify: `package.json`（name=`@xiaozhuang-dsh/conversation-import`、version `0.3.0`、peerDeps semver、`files`、`keywords`、`engines.dsh: ">=0.1.7"`）
- Modify: `src/index.ts`（`dsh-session-log-export` 改可选加载，缺失时降级）
- Test: `packages/conversation-import/tests/manifest.test.mjs`

**Interfaces:**
- Consumes: `checkManifest`（Task 2）
- Produces: 可安装包 `@xiaozhuang-dsh/conversation-import@0.3.0`；`cordis.patch.yml` 仍声明 `session-log-download`（disabled）+ `conversation-import` 行。

- [ ] **Step 1: 写失败测试** 断言该包 `checkManifest` 返回 `[]`，且 `package.json.dsh.client.platform === 'web'`。
- [ ] **Step 2: 运行**，预期 FAIL（workspace 依赖未清）。
- [ ] **Step 3: 移包 + 改 manifest + 删 icon 注册 + 可选加载**。
- [ ] **Step 4: 重跑**，预期 PASS。
- [ ] **Step 5: Commit** `feat(conversation-import): ship as standard installable plugin`。

### Task 5: 构建与类型检查（真实编译）

**Files:** Modify: `packages/conversation-import/tsdown.config.ts`（去掉 monorepo 相对 import）

- [ ] **Step 1:** `pnpm install` 后 `pnpm --filter @xiaozhuang-dsh/conversation-import build`，预期在包内生成 `lib/index.js` + `lib/client.js`。
- [ ] **Step 2:** `pnpm --filter @xiaozhuang-dsh/conversation-import typecheck`（tsc 对 0.2.1-rc.2 的 published 类型），预期 0 error。
- [ ] **Step 3:** 用 `checkManifest` 复验 `lib/*` 存在。
- [ ] **Step 4: Commit** `build(conversation-import): standalone tsdown build`。

### Task 6: 临时 profile 真装验收

- [ ] **Step 1:** `dsh plugin --profile plugintest add link:<abs>/packages/conversation-import`，预期 pnpm 成功、`dsh.profile.bundles` 出现该包。
- [ ] **Step 2:** `dsh --profile plugintest dump-config`（或等价命令）输出里出现 `conversation-import` 行且无报错。
- [ ] **Step 3:** 记录输出片段到 `docs/VERIFICATION.md`，Commit `test: verify install through throwaway profile`。

### Task 7: 兼容矩阵脚本 + README 表

**Files:** Create: `scripts/compat-matrix.mjs`；Modify: `README.md`

- [ ] **Step 1:** 脚本对给定 DSH 版本列表（`0.1.7-rc.2 0.2.0-rc.2 0.2.1-rc.2 0.2.2-rc.3`）从 npm 拉 `@deepseek-ai/dsh-client-ui-*` 各包 tarball，抽出 `lib/client.js`，收集 `renderSlot("…")` 全集。
- [ ] **Step 2:** 输出 markdown 表：4 版本 × 各插件目标 slot 是否存在。写入 `docs/COMPATIBILITY.md` 并在 README 引用。
- [ ] **Step 3:** Commit `docs: publish measured slot compatibility matrix`。

### Task 8: 批次二 —— chat-preset

**Files:** Create: `packages/chat-preset/**`（移入 + manifest 标准化 + `presets/chat/*` 随包）

- [ ] **Step 1:** 写失败测试：`checkManifest` 通过 + `presets/chat/agent.cordis.yml` 在 `files` 列表里。
- [ ] **Step 2:** 实现，重跑 PASS。
- [ ] **Step 3:** build + typecheck。
- [ ] **Step 4:** Commit。

### Task 9: 批次二 —— composer-add-menu 移植到 `conversation.input.left`

**Files:** Modify: `packages/composer-add-menu/src/client/index.ts`（slot 名 + `pickSlot` 降级）、`ComposerAddMenu.tsx`（改用 `PropsRuntime<'conversation.input.left'>`，去掉 fork props 假设）

- [ ] **Step 1:** 写失败测试：`apply` 在只有 `conversation.input.left` 的假 ctx 上注册成功；在空 slot 集合上不抛错。
- [ ] **Step 2:** 实现，重跑 PASS。
- [ ] **Step 3:** build + typecheck + 装临时 profile 冒烟。
- [ ] **Step 4:** Commit。

### Task 10: 批次二 —— ui-plain-chat 移植到 `sidebar.footer.action`

**Files:** Modify: `packages/ui-plain-chat/src/client/index.ts`；Create: `packages/ui-plain-chat/src/client/DEGRADED.md`?（改为 README「已知差异」）

- [ ] **Step 1:** 写失败测试：`apply` 在缺 `conversationPresentation` / `uiWorkspace.registerSessionGroup` 服务时跳过对应注册且不抛错。
- [ ] **Step 2:** 实现（launcher 注册到 `sidebar.footer.action`，props 用 `{ wide }`）。
- [ ] **Step 3:** build + typecheck + 冒烟。
- [ ] **Step 4:** Commit。

### Task 11: 发布流水线

**Files:** Create: `.github/workflows/release.yml`（tag → pnpm build → `pnpm -r publish --access public` + 打包 tgz 附加到 Release）

- [ ] **Step 1:** 本地 `pnpm -r pack` 验证产物内无 `workspace:`、含 `lib/`、含 `cordis.patch.yml`。
- [ ] **Step 2:** 用 tarball 在临时 profile 里 `add <tgz>` 验证可装。
- [ ] **Step 3:** 写 workflow 并 Commit。

### Task 12: 真机安装与收尾

- [ ] **Step 1:** 装进 desktop profile（`dsh plugin --profile desktop add link:…`），启动 DSH，设置页出现「导入对话」。
- [ ] **Step 2:** 真跑一次 DeepSeek 导出 JSON 导入，记录结果截图/日志到 `docs/VERIFICATION.md`。
- [ ] **Step 3:** 更新 `README.md` / `README.en.md`（安装命令、兼容矩阵、已知差异），删除过时 fork 安装说明。
- [ ] **Step 4:** Commit。
