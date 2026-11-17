# 仓库规则（给 AI 与维护者）

本仓库产出**标准 DSH 插件**：装得上、不碰宿主、可卸载。

1. **不许打补丁**：不修改 DSH 本体（app.asar、宿主源码）、不发布 `.patch`、不要求用户替换文件。`legacy/payload/shared/*.patch` 只是历史参考。
2. **只用 stock 扩展点**：slot 必须出现在宿主 `renderSlot` 集合里；service 必须出现在宿主 client service 列表里。拿不准就先跑 `node scripts/compat-matrix.mjs` 和 `pnpm typecheck:all`，编译器报错就是答案。
3. **每个包必须过 `pnpm check:manifests`**：不得有 `workspace:` 依赖、必须有 `dsh.bundle.patch`、patch 里的 `./lib/*` 必须落在包内且真实存在。
4. **不允许静默降级**：宿主缺能力时，要么运行时探测并跳过（并留可读警告），要么把包标 `private: true` 并在 README 写明缺什么。
5. **改 client 半必须同步产物**：`lib/client.js` 是上游工具链产物，本仓库暂无 CSS Modules 构建链。改源码后要么重建并 diff，要么做可验证的最小同步，然后加测试锁死（见 `packages/conversation-import/tests/manifest.test.mjs`）。
6. **验收要留证据**：新的"能装"结论必须附真实命令输出，写进 `docs/VERIFICATION.md`。
7. 发布走 `.github/workflows/release.yml`（tag → npm + Release tarball），不要手工拷目录。
