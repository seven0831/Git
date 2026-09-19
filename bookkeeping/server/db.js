const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'bookkeeping.db');

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('income','expense')),
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL CHECK (type IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  date         TEXT    NOT NULL,
  note         TEXT    NOT NULL DEFAULT '',
  recurring_id INTEGER REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (category_id, year, month)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL CHECK (type IN ('income','expense')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  frequency     TEXT    NOT NULL CHECK (frequency IN ('monthly','weekly','yearly')),
  start_date    TEXT    NOT NULL,
  end_date      TEXT,
  next_run_date TEXT    NOT NULL,
  note          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_ym ON budgets(year, month);
`);

// 种子分类（首次启动写入）
const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
if (count === 0) {
  const insert = db.prepare('INSERT INTO categories (name, type, sort) VALUES (?, ?, ?)');
  const seed = [
    ['餐饮', 'expense', 1],
    ['交通', 'expense', 2],
    ['住房', 'expense', 3],
    ['娱乐', 'expense', 4],
    ['学习', 'expense', 5],
    ['工资', 'income', 1],
    ['兼职', 'income', 2],
  ];
  for (const [name, type, sort] of seed) {
    insert.run(name, type, sort);
  }
}

module.exports = { db, DB_PATH };
