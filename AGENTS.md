# tftasks

基于 Node.js 的命令行任务管理工具。仓库目前是工程架子，任务命令还没有实现。

## 什么时候读

- 安装依赖、跑脚本 → [docs/commands.md](docs/commands.md)
- 加文件或挪文件 → [docs/file-structure.md](docs/file-structure.md)
- 测试放哪、怎么跑 → [docs/testing.md](docs/testing.md)

## 约定

- 日常操作走 `package.json` 里的脚本，不另加 shell 包装。
- 新命令实现 `Command`（`src/commands/types.ts`），放在 `src/commands/`，并登记进 `src/commands/registry.ts`。`tftasks --help` 列出登记过的命令。
- `src/cli.ts` 的 `run` 只返回 `{ exitCode, stdout, stderr }`，不写进程、也不退出。进程入口是 `src/main.ts`。
- `src/` 里的 import 带 `.ts` 后缀。
- 需要 Node.js 22.18 或更新版本。Oxlint / Oxfmt 的配置来自旁边的 `oxc-config`（`file:../oxc-config`）。
