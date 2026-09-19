# 任务分解与依赖关系

> 任务严格按依赖关系排序：只有前置任务完成后才能开始后续任务。每个任务的"验收"是该任务完成的判定标准。

## 依赖图（概述）

```
T0 脚手架 ──► T1 数据库层 ──► T2 分类API ──┐
                    │                       ├──► T4 预算API ──► T8 预算前端
                    └──────► T3 收支API ────┼──► T5 周期API ──► T9 周期前端
                                             └──► T6/T7 前端(记账) ──► T10 测试与验收
```

## 任务清单

| # | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| T0 | 项目脚手架 | — | `package.json`、`.gitignore` 就绪，`npm install express` 成功，`npm start` 能启动一个返回 `Hello` 的 Express 服务 |
| T1 | 数据库层 | T0 | `db.js` 完成建表 + 种子分类；可运行一次性初始化脚本并验证 8 个支出分类 + 4 个收入分类 |
| T2 | 分类 API | T1 | `GET/POST/PUT/DELETE /api/categories` 按规范工作；删除被引用分类返回 409 |
| T3 | 收支记录 API | T1 | `GET/POST/PUT/DELETE /api/transactions` 按规范工作，支持筛选/搜索/分页，校验分类类型匹配 |
| T4 | 汇总 + 预算 API | T3 | `GET /api/summary` 正确统计月收支；`GET/PUT/DELETE /api/budgets` 正确计算 spent/remaining/over |
| T5 | 周期规则 API + 生成逻辑 | T3 | `POST /api/recurring` 等 CRUD；`POST /api/recurring/generate` 正确生成到期记录且不重复 |
| T6 | 前端骨架 | T0 | `index.html` + `styles.css` + `app.js` 载入，3 个视图导航可切换，封装 `api()` 请求工具 |
| T7 | 前端：记账页 | T3, T6 | 可新增/编辑/删除/筛选/搜索收支，汇总卡片正确 |
| T8 | 前端：预算页 | T4, T6 | 按月按分类设置预算，进度条与超预算高亮正确 |
| T9 | 前端：周期记账页 | T5, T6 | 规则的增删改查 + "立即生成"按钮可用 |
| T10 | 测试与整体验收 | T7,T8,T9 | `npm test` 通过；按 SPEC §11 逐条走查验收 |

## 执行约定

- 每个任务完成后，先运行一次冒烟验证（`node` 直接调用 / `curl` 打接口）再进入下一个任务。
- 发现与 SPEC 冲突的地方，回到 SPEC 修订，再继续。
- 最终交付：可运行的应用 + 通过测试 + 文档一致。
