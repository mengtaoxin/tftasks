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
│   ├── cli.test.ts           cli 的测试，和被测文件放在一起
│   └── commands/
│       ├── types.ts          Command、CommandContext、CommandResult
│       └── registry.ts       任务命令登记处，目前是空数组
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

## 放文件

一条新的任务命令实现 `Command`，源文件放在 `src/commands/`，再加进 `registry.ts` 的 `commands`。帮助文本会把它列出来。

测试和被测模块放在同一目录，命名 `*.test.ts`（`*.spec.ts` 同样会被 Vitest 收进去）。配置文件留在仓库根目录，并列入 `tsconfig.node.json` 的 `include`。
