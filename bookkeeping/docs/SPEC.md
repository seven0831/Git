# 记账软件规范文档（Spec-Driven Development）

> 本文档是项目的唯一事实来源（Source of Truth）。所有代码实现必须与本文档保持一致；当需求变更时，先修改本文档，再修改代码。

## 1. 项目概述

一个**单用户、无需登录**的中文记账 Web 应用，帮助用户记录日常收支、管理收支分类、按分类设定月度预算、管理周期性固定收支。数据持久化在本机 SQLite 数据库中。

- 运行形态：Web 网页应用（浏览器访问）
- 界面语言：中文
- 货币：人民币（¥）

## 2. 目标与非目标

### 2.1 目标（本版本范围）

1. **收支记账**：新增 / 查看 / 编辑 / 删除收支记录，支持按月筛选、按分类筛选、关键词搜索、分页。
2. **预算管理**：按月、按分类设定预算，查看各分类的已用额度与剩余额度，超额提醒。
3. **周期性记账**：定义"每月/每周/每年"重复的固定收支，系统自动生成到期的收支记录。
4. **分类管理**：内置默认分类，支持自定义新增 / 删除分类，记账时下拉选择分类。

### 2.2 非目标（本版本不实现）

- 多账户管理（现金/银行卡/支付宝/微信等账户）。
- 统计报表与图表（折线图、饼图等）。
- 数据导入/导出（CSV/Excel）。
- 多用户、注册登录、权限。
- 多币种与汇率。
- 移动端 App / 桌面客户端。

> 以上非目标可作为后续版本迭代项，但当前版本不纳入实现与验收。

## 3. 术语与领域模型

| 术语 | 英文标识 | 说明 |
| --- | --- | --- |
| 收支记录 | Transaction | 一笔收入或支出，含金额、类型、分类、日期、备注 |
| 类型 | type | `income`（收入）或 `expense`（支出） |
| 分类 | Category | 收支所属类别，归属于某个类型（收入/支出） |
| 预算 | Budget | 某年某月、某分类（或全部）的计划支出上限 |
| 周期规则 | Recurring Rule | 描述一笔周期性重复的固定收支及其频率 |

**分类是收支、预算与周期记账的公共基础**：收支记录必须选择分类，预算按分类设定，周期记账归属某分类。

## 4. 功能需求

### 4.1 收支记账

- 新增：录入类型（收入/支出）、金额、分类、日期、备注（可选）。
- 列表：默认按日期倒序；支持按"年-月"、类型、分类、关键词（备注/金额）筛选；分页。
- 编辑：修改任意字段。
- 删除：删除后立即生效（含从预算统计中移除）。
- 汇总：展示当月的总收入、总支出、结余。

**业务规则：**
- 金额必须为大于 0 的正数，单位为"分"（整数）。
- 分类必须存在，且分类的类型必须与收支记录的类型一致（收入只能选收入分类，支出只能选支出分类）。
- 日期格式为 `YYYY-MM-DD`。

### 4.2 预算管理

- 按"年-月 + 分类"设定月度支出预算金额（分类可为"全部支出"，即总预算）。
- 查看指定月份的：各分类预算金额、已支出金额、剩余额度、使用比例。
- 当某分类（或总支出）当月已支出 ≥ 预算时，标记为"超预算"并高亮提醒。

**业务规则：**
- 预算仅针对支出（`expense`）统计。
- 已支出金额 = 该月该分类（或全部）所有支出记录金额之和。
- 预算金额可为 0 或正整数；删除预算即取消该分类预算。

### 4.3 周期性记账

- 定义周期规则：类型、金额、分类、频率（每月/每周/每年）、开始日期、结束日期（可选）、备注。
- 系统根据规则自动生成"已到期"的收支记录（日期 = 规则的下一次执行日）。
- 支持手动触发一次"生成到期记录"操作。

**业务规则：**
- 频率 `frequency` 取值：`monthly`（每月）、`weekly`（每周）、`yearly`（每年）。
- 生成逻辑：从 `next_run_date` 开始，若 `next_run_date <= 今天` 且未超过 `end_date`，则生成一条对应收支记录（日期为 `next_run_date`），随后 `next_run_date` 按频率递增，重复直到 `next_run_date > 今天`。
- 结束日期 `end_date` 为空表示长期有效。
- 由周期规则生成出的收支记录，记录其来源 `recurring_id`（便于追溯；删除周期规则不影响已生成记录）。

### 4.4 分类管理

- 内置默认分类（首次启动写入）：收入「工资、兼职」，支出「餐饮、交通、住房、娱乐、学习」。
- 支持自定义新增分类（需指定类型：收入/支出）。
- 支持删除分类。
- 新增/编辑收支记录时，通过下拉框选择分类（收入只显示收入分类，支出只显示支出分类）。

**业务规则：**
- 分类名称不能为空；分类归属于某个类型（收入/支出）。
- 被收支记录引用的分类不可删除（返回 `409`）；相关预算随分类级联删除。
- 分类类型不可修改（如需调整请删除后重建）。

## 5. 数据模型（SQLite Schema）

> 金额统一使用整数"分"存储（`*_cents` 字段），避免浮点误差。

```sql
CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('income','expense')),
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL CHECK (type IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  date         TEXT    NOT NULL,             -- YYYY-MM-DD
  note         TEXT    NOT NULL DEFAULT '',
  recurring_id INTEGER REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE budgets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES categories(id) ON DELETE CASCADE, -- NULL 表示总预算
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL,             -- 1..12
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (category_id, year, month)
);

CREATE TABLE recurring_rules (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL CHECK (type IN ('income','expense')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  frequency     TEXT    NOT NULL CHECK (frequency IN ('monthly','weekly','yearly')),
  start_date    TEXT    NOT NULL,            -- YYYY-MM-DD
  end_date      TEXT,                        -- YYYY-MM-DD，可空
  next_run_date TEXT    NOT NULL,            -- YYYY-MM-DD
  note          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_budgets_ym ON budgets(year, month);
```

**种子分类（首次启动自动写入）：**

收入：工资、兼职
支出：餐饮、交通、住房、娱乐、学习

## 6. API 接口规范

- 前缀：`/api`
- 请求/响应体：JSON（`Content-Type: application/json`）
- 金额字段：整数"分"（`*_cents`）
- 统一错误格式：`{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
- 列表分页：`{ "items": [...], "page": 1, "pageSize": 20, "total": 123 }`

### 6.1 分类

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/categories?type=income\|expense` | 分类列表（`type` 可选） |
| POST | `/api/categories` | 新建分类 `{name, type, sort?}` |
| PUT | `/api/categories/:id` | 更新 `{name?, sort?}`（不可改 type） |
| DELETE | `/api/categories/:id` | 删除（若被交易引用则返回 `409`；相关预算随分类级联删除） |

### 6.2 收支记录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/transactions?year=&month=&type=&category_id=&keyword=&page=&pageSize=` | 列表（`year`+`month` 可只传其一） |
| POST | `/api/transactions` | 新建 `{type, amount_cents, category_id, date, note?}` |
| PUT | `/api/transactions/:id` | 更新（同上字段） |
| DELETE | `/api/transactions/:id` | 删除 |

### 6.3 汇总

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/summary?year=&month=` | `{year, month, income_cents, expense_cents, balance_cents, by_category:[{category_id, name, type, amount_cents}]}` |

### 6.4 预算

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/budgets?year=&month=` | `{year, month, total_spent_cents, overall_budget_cents, overall_budget_id, items:[{id, category_id, category_name, amount_cents, spent_cents, remaining_cents, ratio, over}]}`（`overall_budget_cents` 为总预算金额，未设置为 `null`） |
| PUT | `/api/budgets` | 设置/更新预算 `{category_id|null, year, month, amount_cents}`（upsert） |
| DELETE | `/api/budgets/:id` | 删除预算 |

### 6.5 周期规则

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/recurring` | 列表 |
| POST | `/api/recurring` | 新建 `{type, amount_cents, category_id, frequency, start_date, end_date?, note?}` |
| PUT | `/api/recurring/:id` | 更新 |
| DELETE | `/api/recurring/:id` | 删除 |
| POST | `/api/recurring/generate` | 手动生成到期记录，返回生成条数 `{generated: n}` |

## 7. 前端页面与交互

单页应用，共 4 个视图（顶部导航切换）：

1. **记账（默认）**
   - 顶部：当月汇总卡片（总收入 / 总支出 / 结余）。
   - 工具栏：月份切换、类型筛选、分类筛选、关键词搜索、"记一笔"按钮。
   - 列表：日期、分类、备注、金额（支出红色 `-¥`，收入绿色 `+¥`），行内编辑/删除。
   - 弹窗表单：新增/编辑收支记录。

2. **预算**
   - 月份切换。
   - 总预算卡片 + 各分类预算条目（进度条 + 已用/剩余 + 超预算高亮）。
   - 新增/编辑/删除分类预算；支持设置"总预算"。

3. **周期记账**
   - 规则列表（频率、类型、金额、分类、下次执行日、备注、状态）。
   - 新增/编辑/删除规则。
   - "立即生成到期记录"按钮。

4. **分类管理**
   - 按类型分组展示（收入 / 支出）。
   - 新增分类（名称 + 类型）、删除分类（被引用时提示无法删除）。

通用：金额统一格式化为 `¥1,234.56`；日期选择用日期控件；所有写操作成功后刷新相关列表。

## 8. 非功能需求

1. **金额精度**：全程整数"分"，禁止使用浮点运算。
2. **数据持久化**：SQLite 文件 `data/bookkeeping.db`（加入 `.gitignore`）。
3. **校验与容错**：所有写接口做服务端校验；前端做友好错误提示。
4. **一致性**：删除分类前检查引用；更新交易时校验分类类型匹配。
5. **可维护性**：分层（路由层 routes → 服务层 services → 数据访问 db），便于测试与扩展。

## 9. 技术架构与目录结构

- 运行时：Node.js ≥ 22（本项目用 Node 24，内置 `node:sqlite`）
- 后端：Express + `node:sqlite`（同步 API，无原生编译依赖）
- 前端：原生 HTML / CSS / JavaScript（无构建步骤），由 Express 静态托管
- 测试：Node 内置 `node:test`

```
bookkeeping/
├── package.json
├── .gitignore
├── server/
│   ├── index.js              # 入口：Express 应用、静态托管、路由挂载、周期自动生成
│   ├── db.js                 # SQLite 初始化、建表、种子分类、数据库访问函数
│   ├── validation.js         # 通用校验工具
│   └── routes/
│       ├── categories.js
│       ├── transactions.js
│       ├── summary.js
│       ├── budgets.js
│       └── recurring.js
│   └── services/
│       ├── transactionService.js
│       ├── budgetService.js
│       └── recurringService.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                     # SQLite 数据文件（gitignore）
├── test/                     # node:test 用例
└── docs/
    ├── SPEC.md
    └── TASKS.md
```

## 10. 假设、决策与待确认项

| # | 决策/假设 | 说明 |
| --- | --- | --- |
| 1 | 分类管理为独立功能 | 分类是收支/预算/周期的公共基础；提供独立"分类管理"页：预设默认分类 + 自定义新增/删除；被交易引用的分类删除受限（409）。 |
| 2 | 单账户 | 不区分现金/银行卡等账户，所有收支在一个总账中。 |
| 3 | 前端零构建 | 使用原生 HTML/CSS/JS，避免前端构建链，便于直接运行与逐步交付。 |
| 4 | 周期生成时机 | 服务启动时 + 每次查询交易列表时惰性生成 + 手动触发；MVP 不做常驻定时器。 |
| 5 | 预算范围 | 按月、按分类（支出）预算，另支持"总预算"（`category_id` 为空）。 |

> 若上述任何假设与你的预期不符，请在开始实现前指出，我会先修正规范文档。

## 11. 验收标准

1. 启动 `npm start` 后浏览器可访问应用，首次运行自动建库并写入种子分类。
2. 可新增/编辑/删除/筛选/搜索收支记录，当月汇总金额正确。
3. 可按月按分类设置预算，正确显示已用/剩余/使用比例，超预算时高亮。
4. 可创建周期规则，到期记录能被正确自动生成且不重复生成。
5. 分类管理页可查看内置默认分类、自定义新增/删除分类；被收支记录引用的分类删除时给出提示；记账时分类下拉框按类型正确过滤。
6. `npm test` 通过（覆盖金额、预算统计、周期生成、分类等核心逻辑）。
