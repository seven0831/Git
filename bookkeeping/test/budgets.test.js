'use strict';
process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { db } = require('../server/db');
const tx = require('../server/services/transactions');
const budgets = require('../server/services/budgets');

function firstCat(type) {
  return db.prepare('SELECT id FROM categories WHERE type = ? LIMIT 1').get(type).id;
}

test('预算统计：spent / remaining / over', () => {
  const expense = firstCat('expense');
  tx.create({ type: 'expense', amount_cents: 12000, category_id: expense, date: '2026-05-10' });
  budgets.upsert({ category_id: expense, year: 2026, month: 5, amount_cents: 10000 });

  const data = budgets.list({ year: 2026, month: 5 });
  assert.strictEqual(data.total_spent_cents, 12000);
  const item = data.items.find((i) => i.category_id === expense);
  assert.strictEqual(item.spent_cents, 12000);
  assert.strictEqual(item.remaining_cents, -2000);
  assert.strictEqual(item.over, true);
  assert.strictEqual(item.ratio, 1.2);
});

test('总预算 upsert 幂等（NULL 分类不产生重复）', () => {
  budgets.upsert({ category_id: null, year: 2026, month: 6, amount_cents: 10000 });
  budgets.upsert({ category_id: null, year: 2026, month: 6, amount_cents: 20000 });
  const data = budgets.list({ year: 2026, month: 6 });
  assert.strictEqual(data.overall_budget_cents, 20000);
  const n = db.prepare('SELECT COUNT(*) c FROM budgets WHERE category_id IS NULL AND year = 2026 AND month = 6').get().c;
  assert.strictEqual(n, 1);
});

test('收入分类不能设置预算', () => {
  const income = firstCat('income');
  assert.throws(() => budgets.upsert({ category_id: income, year: 2026, month: 7, amount_cents: 1000 }), /预算仅支持支出分类/);
});
