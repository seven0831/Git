'use strict';
process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { db } = require('../server/db');
const tx = require('../server/services/transactions');

function firstCat(type) {
  return db.prepare('SELECT id FROM categories WHERE type = ? LIMIT 1').get(type).id;
}

test('创建收支记录 + 分类类型匹配校验', () => {
  const expense = firstCat('expense');
  const income = firstCat('income');
  const t = tx.create({ type: 'expense', amount_cents: 100, category_id: expense, date: '2026-01-01', note: '测试' });
  assert.strictEqual(t.category_id, expense);
  assert.strictEqual(t.category_name, db.prepare('SELECT name FROM categories WHERE id = ?').get(expense).name);
  assert.throws(() => tx.create({ type: 'income', amount_cents: 100, category_id: expense, date: '2026-01-01' }), /不匹配/);
  assert.throws(() => tx.create({ type: 'expense', amount_cents: 100, category_id: income, date: '2026-01-01' }), /不匹配/);
});

test('列表筛选与关键词搜索', () => {
  const expense = firstCat('expense');
  tx.create({ type: 'expense', amount_cents: 2500, category_id: expense, date: '2026-02-05', note: '午饭' });
  tx.create({ type: 'expense', amount_cents: 800, category_id: expense, date: '2026-03-01', note: '公交' });

  const feb = tx.list({ year: 2026, month: 2, page: 1, pageSize: 20 });
  assert.strictEqual(feb.total, 1);
  assert.strictEqual(feb.items[0].note, '午饭');

  const kw = tx.list({ year: 2026, keyword: '午饭', page: 1, pageSize: 20 });
  assert.strictEqual(kw.total, 1);

  const none = tx.list({ year: 2026, keyword: '不存在', page: 1, pageSize: 20 });
  assert.strictEqual(none.total, 0);
});
