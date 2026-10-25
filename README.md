# tftasks

基于 Node.js 的命令行任务管理工具。当前仓库只有工程架子，任务命令还没有实现。

技术栈和旁边的项目对齐：TypeScript、Vite、Vitest、Oxlint、Oxfmt。

## 要求

- Node.js 22.18 或更新版本
- 旁边的 `oxc-config` 仓库。Oxlint / Oxfmt 配置通过 `file:../oxc-config` 引用它。

## 脚本

```bash
npm install
npm run dev -- help
npm test
npm run lint
npm run build
./dist/tftasks.js --version
```

`npm run dev` 直接用 Node 跑 TypeScript。`npm run build` 先做类型检查，再用 Vite 打出 `dist/tftasks.js`。

## 加一条命令

实现 `Command`（见 `src/commands/types.ts`），放进 `src/commands/registry.ts`。`tftasks help` 会把它列出来。
