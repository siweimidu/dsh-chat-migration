# dsh-chat-migration

把 DeepSeek 对话历史导入 DSH、把会话导出成可迁移文件——做成**标准 DSH 插件**，`dsh plugin add` 一条命令装进任意 profile，不需要改宿主源码、不需要打补丁、不需要 fork。

[English](./README.en.md) | 中文

## 装什么

| 包 | 状态 | 能力 |
| --- | --- | --- |
| `@xiaozhuang-dsh/conversation-import` | ✅ 可安装 | DeepSeek 对话历史导入（预览 + 选择 + 导入成本地会话）、DSH 会话导出下载、设置页「导入对话」 |
| `@xiaozhuang-dsh/chat-preset` | ✅ 可安装 | 注册可移除的纯聊天 agent preset（`chat`） |
| `@xiaozhuang-dsh/composer-add-menu` | ⛔ 未移植 | 输入框加号菜单（命令/插件/技能/附件） |
| `@xiaozhuang-dsh/ui-plain-chat` | ⛔ 未移植 | 侧栏「聊天」入口 + 纯聊天表现层 |

后两个包为什么没移植、缺什么、怎么补：见 [未移植的两个插件](#未移植的两个插件)。

## 安装（任何电脑，一条命令）

装完重启 DSH 生效。`dsh plugin add` 会自动把包登记进该 profile 的 `dsh.profile.bundles`。

**首选：公网 URL，不需要 npm 账号、不需要建 Release**

```bash
dsh plugin --profile desktop add https://raw.githubusercontent.com/niushuanan/dsh-chat-migration/master/dist/xiaozhuang-dsh-conversation-import-0.3.0.tgz
dsh plugin --profile desktop add https://raw.githubusercontent.com/niushuanan/dsh-chat-migration/master/dist/xiaozhuang-dsh-chat-preset-0.3.0.tgz
```

**正式版本：GitHub Release 资产**（打 tag 后 CI 自动产出，不依赖 npm）

```bash
dsh plugin --profile desktop add https://github.com/niushuanan/dsh-chat-migration/releases/download/v0.3.0/xiaozhuang-dsh-conversation-import-0.3.0.tgz
```

**已发布到 npm 时**

```bash
dsh plugin --profile desktop add @xiaozhuang-dsh/conversation-import
```

**本地仓库（开发/试用）**

```bash
dsh plugin --profile desktop add link:/absolute/path/to/dsh-chat-migration/packages/conversation-import
```

`desktop` profile 由 Electron 独占，命令行装不了；那种情况在 DSH 里用 **设置 → 插件 → 从本地目录安装**，或用别的 profile 名。

**卸载**

```bash
dsh plugin --profile desktop remove @xiaozhuang-dsh/conversation-import
```

四种安装源各自验证到哪一步、以及发布者收尾命令，见 [docs/INSTALL-ANYWHERE.md](./docs/INSTALL-ANYWHERE.md)。

## 兼容性

宿主版本区间：`engines.dsh >= 0.1.7`。**实测**（不是声明）结果见 [docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md)：

- 插件注册的两个 slot（`settings.section`、`conversation.session.header.utilities`）在 `0.1.7-rc.2`、`0.2.0-rc.2`、`0.2.1-rc.2`、`0.2.2-rc.3` 全部存在；
- 8 个运行时依赖包在这 4 个版本里全部可获取；
- 矩阵由 `pnpm compat:matrix` 现场从 npm 拉包解包核对，可重跑。

验收过程与真实命令输出见 [docs/VERIFICATION.md](./docs/VERIFICATION.md)。

## 未移植的两个插件

`composer-add-menu` 与 `ui-plain-chat` 依赖的是**上游 fork 私有契约**，标准宿主没有对应扩展点，硬装上去只会渲染出空壳。它们现在 `private: true`，测试会强制这一点，避免误装。

具体缺什么：

| 插件 | 依赖的私有契约 | 标准宿主现状 | 移植要做什么 |
| --- | --- | --- | --- |
| `composer-add-menu` | slot `conversation.input.add`，owner 侧注入约 18 个 props（命令表、插件表、技能表、附件回调、`focusInput`、`onInsertSlashItem`…） | 没有该 slot；`conversation.input.left` 只给 `{}` | 改成从公开 client service 取数据（`commandUi`、`inputTriggers`、`fileUpload`），重写组件与样式，**并用能处理 CSS Modules 的构建链重建 `lib/client.js`** |
| `ui-plain-chat` | slot `sidebar.primary.action`；service `conversationPresentation`（隐藏 hero 配置/输入框模式/辅助面板）；`uiWorkspace.registerSessionGroup` | 三个都不存在（`uiWorkspace.openSession/startSession/newSession` 有，`registerSessionGroup` 没有） | 入口改挂 `sidebar.footer.action`（props 只有 `{ wide }`），丢掉表现层与分组的等价能力，或找到新的公开替代表达 |

已知的构建缺口：仓库里的 `lib/client.js` 是上游工具链产物；本仓库的 tsdown 配置能重建 **host 半**，client 半还缺 CSS Modules 支持（rolldown 那条链路目前把 class map 编译成空对象）。因此现阶段对 client 半的改动是"改源码 + 同步产物 + 测试锁死"，不是"改源码就能出包"。这一条在移植前必须补上。

## 仓库结构

```
packages/<id>/          四个插件包（每个都是自包含可安装包）
  src/                  源码（TypeScript / React）
  lib/                  已构建产物（host: ESM，client: __ModuleLoader__ 工厂）
  cordis.patch.yml      声明插入宿主的行
  tests/                包级契约测试
scripts/check-manifests.mjs   安装契约校验器（无 workspace: / patch 可解析 / client 声明完整）
scripts/compat-matrix.mjs     实测宿主 slot 与依赖包可用性
legacy/                 上游 fork 导出物：旧 payload/、manifest.json、INSTALL.md、四个核心补丁（仅作参考）
docs/                   设计、兼容矩阵、验收记录
```

`legacy/payload/shared/*.patch` 是给 DSH 本体打补丁的旧方案——**本仓库不再需要、也不再支持**。标准插件不允许修改宿主。

## 开发

```bash
pnpm install
pnpm check:manifests     # 安装契约
pnpm test                # 26 个测试
pnpm typecheck           # 对已发布宿主类型做类型检查（两个可安装包）
pnpm typecheck:all       # 含未移植包；在移植完成前必然是红的
pnpm compat:matrix       # 重新测量 4 个宿主版本
```

`pnpm typecheck:all` 现在报的错就是移植清单本身：`conversation.input.add` / `sidebar.primary.action` 不在宿主 slot 联合类型里，`ctx.conversationPresentation` 不存在——编译器的报错就是「缺什么」的权威答案。

## 许可

MIT，见 [LICENSE](./LICENSE)。源码派生自 Xiaozhuang DSH 的单向导出（见 [legacy/](./legacy/)）。
