# 测试

| 层 | 工具 | 位置 | 命名 |
| --- | --- | --- | --- |
| 单元 | Vitest | 和被测模块同一目录 | `*.test.ts`（也认 `*.spec.ts`） |
| 覆盖率 | `@vitest/coverage-v8` | `coverage/`（不入库） | `npm run test:coverage` |

`vitest.config.ts` 用 Node 环境，收录 `src/**/*.{test,spec}.ts`。现在的测试在 `src/cli.test.ts`，直接调用 `run`，不断言进程本身。

新行为加在对应模块旁边的 `*.test.ts`。命令的输入输出通过 `run` 的返回值断言：`exitCode`、`stdout`、`stderr`。不要在测试里起子进程，除非要覆盖的就是 `src/main.ts` 写进程这一层。

Vitest 不检查类型。类型要另外过：`npm run type-check`，或者会先跑 `tsc -b` 的 `npm run build`。

跑法见 [commands.md](commands.md)。放文件的规则见 [file-structure.md](file-structure.md)。
