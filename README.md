# tftasks

基于 Node.js 的命令行任务管理工具。任务存在本地数据目录（默认 `~/.tftasks`），命令以 JSON 入参/出参为主。

技术栈和旁边的项目对齐：TypeScript、Vite、Vitest、Oxlint、Oxfmt。数据库用 Node 自带的 `node:sqlite`。

怎么跑、目录和测试见 [docs/commands.md](docs/commands.md)、[docs/file-structure.md](docs/file-structure.md)、[docs/testing.md](docs/testing.md)。

常用命令：`init`、`task:*`、`repeat-task-config:*`、`backup:create`。完整列表见 `tftasks --help`。
