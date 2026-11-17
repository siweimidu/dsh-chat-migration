# 任何电脑上一条命令安装

目标：一台装了 DeepSeek Harness（`>= 0.1.7`）的电脑，不需要 clone 仓库、不需要 npm 账号、不需要改宿主，一条命令装好。

## 首选：raw URL（不需要 npm，不需要建 Release）

只要本仓库推送过，任何电脑都能直接装：

```powershell
dsh plugin --profile desktop add https://raw.githubusercontent.com/siweimidu/dsh-chat-migration/master/dist/siweimidu-conversation-import-0.3.0.tgz
dsh plugin --profile desktop add https://raw.githubusercontent.com/siweimidu/dsh-chat-migration/master/dist/siweimidu-chat-preset-0.3.0.tgz
```

**为什么这条能用（已实测）**：`dsh plugin add` 把参数透传给 pnpm；pnpm 对任意 URL 都按 gzip tarball 解包，**与服务器返回的 Content-Type 无关**。我用本地静态服务器把 `.tgz` 以 `text/plain; charset=utf-8` 返回（这正是 `raw.githubusercontent.com` 的行为）再安装，profile 里依赖、`dsh.profile.bundles`、`--dump-config` 的插件行全部正确。

## 次选：GitHub Release 资产（推荐用于正式版本）

打 tag 后 CI 自动建 Release 并挂上 tarball（无 `NPM_TOKEN` 也照常产出）：

```powershell
dsh plugin --profile desktop add https://github.com/siweimidu/dsh-chat-migration/releases/download/v0.3.0/siweimidu-conversation-import-0.3.0.tgz
```

## 备选：npm（需先发布）

```powershell
dsh plugin --profile desktop add @siweimidu/conversation-import
dsh plugin --profile desktop add @siweimidu/chat-preset
```

前置：`@xiaozhuang-dsh` scope 归你（组织成员或改成你自己的 scope），且配了 `NPM_TOKEN`。注意 npm 已公告：绕过 2FA 的 token 将在 2026-08 起受限、直接发布在 2027-01 起受限，所以不要把 npm 当作唯一路径。

## 备选：插件市场「发现」标签页

宿主自带 `@deepseek-ai/dsh-experimental-plugin-market-bundle`：Host 的 `pluginMarket` 服务读取**用户添加的市场索引**。也就是说市场不是集中收录，需要每台电脑加一次索引源，之后点一下安装——比上面两条多一步，收益有限，暂不作为主路径。

## 装完怎么确认

```powershell
# 1. 依赖与 bundle 都登记了
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"

# 2. 组合配置里出现插件行（应看到 id: conversation-import，disabled: false）
dsh --profile desktop --dump-config | Select-String conversation-import
```

`desktop` profile 由 Electron 独占，命令行装不了（会返回 `profile "desktop" is managed exclusively by the Electron application`）。两种做法：

- 用别的 profile 名（`--profile <名字>`），或者
- 在 DSH 里 **设置 → 插件 → 从本地目录安装**，指向解包后的目录。

## 卸载

```powershell
dsh plugin --profile <profile> remove @siweimidu/conversation-import
```

## 已验证 / 未验证

| 路径 | 状态 |
| --- | --- |
| `link:<本地目录>` | ✅ 实测安装 + 组合配置出现插件行 |
| `<本地 .tgz 绝对路径>` | ✅ 实测 |
| `http://…/*.tgz`（`application/octet-stream`） | ✅ 实测 |
| `http://…/*.tgz`（`text/plain`，模拟 raw） | ✅ 实测 |
| **`https://raw.githubusercontent.com/siweimidu/dsh-chat-migration/master/dist/*.tgz`** | ✅ **公网实测**：HTTP 200 / 29199 字节；装进空 profile 后 `dsh.profile.bundles` 自动登记、`--dump-config` 出现 `id: conversation-import` 与 `id: chat-preset`、host 半 `import` 成功（`apply` 是函数，`inject: ["commands"]`）|
| GitHub Release 资产 | ✅ **已产出并实测**：`v0.3.0` 两个资产（chat-preset 2489B / conversation-import 29275B），下载 sha256 `2af6c92e…` 与 GitHub 记录一致；从 Release URL 装进空 profile 成功 |
| npm 包名 | ⛔ 未发布：`@xiaozhuang-dsh` scope 不归当前账号（`npm publish` → 404）。CI 已不自动发布，需要时本地手动跑 |

## 发布者收尾 → 已完成

已完成并验证：

- 仓库 `siweimidu/dsh-chat-migration`（public），`master` 已推送，CI 全绿；
- `v0.3.0` tag 指向最新提交，CI 自动产出 Release 与两个 tarball 资产；
- raw URL 与 Release 资产都实测下载/安装成功。

后续每次改代码：

```powershell
cd dsh-chat-migration
pnpm pack:all                      # 重打 dist/；忘打包会被 tests/dist.test.mjs 抓住
git add -A && git commit -m "..."
git push mine master               # raw URL 立刻跟上
git tag -f v0.3.0 && git push -f mine v0.3.0   # 需要新 Release 资产时才打 tag
```

CI 只产出 Release 资产（`.github/workflows/release.yml`）。npm 发布不自动化：需要 `@xiaozhuang-dsh` scope 的凭据，届时本地执行 `pnpm --filter "@xiaozhuang-dsh/*" publish --access public`，或把包名改成你账号名下的 scope。
