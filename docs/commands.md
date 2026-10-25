# 命令

日常操作以 `package.json` 的脚本为准。

| 脚本                                | 作用                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `npm install`                       | 安装依赖                                                     |
| `npm run dev -- help`               | 用 Node 直接跑 `src/main.ts`，`--` 后面是传给 tftasks 的参数 |
| `npm start -- help`                 | 跑构建产物 `dist/tftasks.js`，要先 `npm run build`           |
| `npm run build`                     | `tsc -b` 类型检查，再用 Vite 打出 `dist/tftasks.js`          |
| `npm run type-check`                | 只做 `tsc -b`                                                |
| `npm test`                          | Vitest 跑一遍                                                |
| `npm run test:watch`                | Vitest 监视模式                                              |
| `npm run test:coverage`             | Vitest + V8 覆盖率                                           |
| `npm run lint` / `npm run lint:fix` | Oxlint 检查 / 就地修好能修的                                 |
| `npm run fmt` / `npm run fmt:check` | Oxfmt 写回 / 只检查                                          |

## 安装

需要 Node.js 22.18 或更新版本（`package.json` 的 `engines`）。

`@mengtaoxin/oxc-config` 用 `file:../oxc-config` 引用旁边的仓库，`npm install` 时那个目录要在。`.npmrc` 把 `@mengtaoxin` 指到 GitHub Packages，并从 `NODE_AUTH_TOKEN` 读 token；依赖真的从那个 registry 拉的时候才需要这个变量。

## 构建产物

`npm run build` 的入口是 `src/main.ts`，目标是 Node 22。产物是 `dist/tftasks.js`：带 `#!/usr/bin/env node`，构建结束时标成可执行，并写出 sourcemap。`package.json` 的 `bin.tftasks` 指向这个文件。

没有参数、`help`、单独的 `-h` 或 `--help` 都打印总览。命令后面只跟一个 `-h` 或 `--help` 时，只打印该命令的帮助，不执行命令。`-v` 和 `--version` 打印 `package.json` 的版本；后面再跟参数会失败。未知命令或未知选项以状态码 1 退出，并提示运行 `tftasks help`。
