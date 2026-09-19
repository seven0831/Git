# 记账本（Bookkeeping）

一个单用户、无需登录的中文记账 Web 应用，支持**收支记账**、**预算管理**、**周期性记账**。

- 技术栈：Node.js（内置 `node:sqlite`）+ Express + 原生 HTML/CSS/JS（无构建步骤）
- 金额全程以整数"分"存储，避免浮点误差

## 快速开始

需要 Node.js ≥ 22。

```bash
npm install
npm start
```

打开浏览器访问 http://localhost:3000

首次启动会自动创建数据库 `data/bookkeeping.db` 并写入种子分类（4 个收入分类 + 8 个支出分类）。

## 测试

```bash
npm test
```

## 文档

- [规范文档](docs/SPEC.md) —— Spec-Driven Development 的唯一事实来源
- [任务分解](docs/TASKS.md) —— 按依赖关系排序的任务清单

## 目录结构

```
bookkeeping/
├── server/          # Express 后端（routes / services / db）
├── public/          # 前端（index.html / styles.css / app.js）
├── test/            # node:test 单元测试
├── docs/            # 规范与任务文档
└── data/            # SQLite 数据文件（gitignore）
```
