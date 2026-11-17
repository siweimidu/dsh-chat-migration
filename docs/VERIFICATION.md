# 验收记录

本文件记录**真实执行过**的命令与输出，不写"应该可以"。时间：2026-11-17，宿主 `@deepseek-ai/dsh@0.2.1-rc.2`。

## 1. 契约检查

```
$ node scripts/check-manifests.mjs
ok   packages/chat-preset
ok   packages/composer-add-menu
ok   packages/conversation-import
ok   packages/ui-plain-chat
```

校验内容：无 `workspace:` 依赖、有 `dsh.bundle.patch`、patch 内 `name: ./…` 不越界且目标文件存在、client 半声明 `platform: web` + `inject` 数组。

## 2. 单元测试

```
$ node --test "tests/**/*.test.mjs" "packages/**/tests/**/*.test.mjs"
ℹ tests 25
ℹ pass 25
ℹ fail 0
```

覆盖：目录结构、manifest 契约（含 5 个反例 fixture）、client bundle 不引用 fork 专属 slot、client bundle 的 `require()` 全部出现在 `dsh.client.inject`、未移植包必须 `private: true`。

## 3. 从 link 安装到临时 profile

```
$ dsh plugin --profile plugintest add link:<repo>/packages/conversation-import
dsh: initialized profile plugintest at C:\Users\35238\.dsh\profiles\plugintest
+ @xiaozhuang-dsh/conversation-import link:...
Done in 687ms
```

`dsh plugin add` **自动**把包写进 `dsh.profile.bundles`：

```json
{ "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@xiaozhuang-dsh/conversation-import"] } } }
```

组合后的宿主配置里出现了插件行（`dsh --profile plugintest --dump-config`）：

```
# == @xiaozhuang-dsh/conversation-import
- id: conversation-import
  name: file:///.../profiles/plugintest/node_modules/@xiaozhuang-dsh/conversation-import/lib/index.js
  disabled: false
```

## 4. Host 半真实加载

```
$ cd %USERPROFILE%\.dsh\profiles\plugintest
$ node --input-type=module -e "await import('file:///.../lib/index.js').then(m => console.log(Object.keys(m), m.inject))"
exports: Config,DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,...,apply,buildDeepSeekImportedSession,...,importDeepSeekHistory,...
inject: ["commands"]
apply is function
```

说明：所有 `@deepseek-ai/*` 外部依赖在**标准 profile** 里都能解析，插件不需要宿主源码。

## 5. 从 tarball 安装（Release 产物路径）

```
$ pnpm pack --pack-destination dist      # 生成 xiaozhuang-dsh-conversation-import-0.3.0.tgz
$ tar -xzf dist/xiaozhuang-dsh-conversation-import-0.3.0.tgz -C $TEMP/tarcheck
cordis.patch.yml  lib/client.js  lib/index.js  LICENSE  package.json  README*
# manifest 内 workspace: 命中数 = 0

$ dsh plugin --profile plugintar add <repo>/dist/xiaozhuang-dsh-conversation-import-0.3.0.tgz
+ @xiaozhuang-dsh/conversation-import file:...tgz
Done in 840ms

$ dsh --profile plugintar --dump-config | grep conversation-import
- id: conversation-import
  name: file:///.../plugintar/node_modules/@xiaozhuang-dsh/conversation-import/lib/index.js
  disabled: false
```

## 6. 兼容矩阵（实测，非推断）

`pnpm compat:matrix` 从 npm 拉取 4 个宿主版本的 `dsh-client-ui-settings-general` / `dsh-client-ui-conversation`
真实 tarball，解包读 `lib/client.js`。结果见 [COMPATIBILITY.md](./COMPATIBILITY.md)：
`settings.section` 与 `conversation.session.header.utilities` 在 **0.1.7-rc.2 / 0.2.0-rc.2 / 0.2.1-rc.2 / 0.2.2-rc.3 全部存在**，
8 个运行时依赖包在 4 个版本里全部可获取。

## 7. 已知未验收项

- **GUI 内视觉验收未做过**：本记录只证明"装得上、配置里出现、host 半能加载"。设置页里长什么样需要在重启后的 DSH 里点一次。
- **client 半在浏览器里的运行**只做了静态校验（模块加载器协议、require 清单、无 fork slot），没有跑真实浏览器会话。
- `composer-add-menu` / `ui-plain-chat` 未移植（见 README「未移植的两个插件」），因此没有验收。
