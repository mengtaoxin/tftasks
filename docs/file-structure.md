# 目录

```text
.
├── AGENTS.md                 给代理的入口
├── README.md                 简短介绍
├── docs/                     命令、目录、测试
├── src/
│   ├── main.ts               进程入口：调用 run，写出 stdout / stderr，设置 exitCode
│   ├── cli.ts                解析 argv，分发命令，返回 CommandResult
│   ├── help.ts               内置 help 命令和帮助文本
│   ├── data-dir.ts           解析数据目录（TFTASKS_HOME 或 ~/.tftasks）
│   ├── params.ts             --params / --params-file
│   ├── json-result.ts        JSON 成功/失败结果
│   ├── log.ts                命令日志
│   ├── errors.ts             AppError
│   ├── listing.ts            列表分页与排序
│   ├── backup/
│   │   └── zip.ts            用 fflate 打 zip
│   ├── db/
│   │   ├── migrations.ts     迁移 SQL
│   │   ├── migrate.ts        checksum 迁移器
│   │   └── open.ts           打开/创建数据库
│   ├── files/
│   │   └── attachments.ts    任务与重复配置详情文件
│   ├── tasks/                任务仓库、规则、列表、入参
│   ├── repeat/               重复配置仓库、周期、入参
│   └── commands/
│       ├── types.ts          Command、CommandContext、CommandResult
│       ├── registry.ts       命令登记处
│       ├── init.ts
│       ├── backup.ts
│       ├── tasks.ts
│       ├── repeat-task-configs.ts
│       └── run-json.ts       命令共用的 JSON 参数与 AppError 处理
├── package.json              脚本、bin、engines
├── tsconfig.json             项目引用，本身不包含源文件
├── tsconfig.app.json         检查 src/
├── tsconfig.node.json        检查根目录的配置文件
├── vite.config.ts            打出 dist/tftasks.js，加上 shebang 并标成可执行
├── vitest.config.ts
├── oxlint.config.ts          继承 @mengtaoxin/oxc-config/node
├── oxfmt.config.ts           继承 @mengtaoxin/oxc-config/fmt，另外忽略 coverage/
└── .npmrc                    @mengtaoxin 指向 GitHub Packages
```

`node_modules/`、`dist/`、`coverage/` 不入库。

`src/main.ts` 只负责碰到进程。参数解析和命令分发在 `src/cli.ts`，方便测试直接调用 `run`。`help` 是内置命令，写在 `src/help.ts`，不进 `registry.ts`。`-h` / `--help` 和 `-v` / `--version` 也在 `cli.ts` 里处理。

本地数据目录默认 `~/.tftasks`（测试用 `TFTASKS_HOME` 覆盖），经 `init` 后包含 `tftasks.db`、`settings.json`、`logs/`、`backups/`、`files/`。

## 放文件

一条新的任务命令实现 `Command`，源文件放在 `src/commands/`，再加进 `registry.ts` 的 `commands`。帮助文本会把它列出来。

测试和被测模块放在同一目录，命名 `*.test.ts`（`*.spec.ts` 同样会被 Vitest 收进去）。配置文件留在仓库根目录，并列入 `tsconfig.node.json` 的 `include`。
