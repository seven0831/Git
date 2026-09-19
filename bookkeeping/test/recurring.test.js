'use strict';
process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { db } = require('../server/db');
const recurring = require('../server/services/recurring');

function firstCat(type) {
  return db.prepare('SELECT id FROM categories WHERE type = ? LIMIT 1').get(type).id;
}

test('addFrequency：月末 / 闰年 / 跨年钳制', () => {
  assert.strictEqual(recurring.addFrequency('2026-01-31', 'monthly'), '2026-02-28');
  assert.strictEqual(recurring.addFrequency('2024-01-31', 'monthly'), '2024-02-29');
  assert.strictEqual(recurring.addFrequency('2024-02-29', 'yearly'), '2025-02-28');
  assert.strictEqual(recurring.addFrequency('2026-01-31', 'yearly'), '2027-01-31');
  assert.strictEqual(recurring.addFrequency('2026-09-15', 'weekly'), '2026-09-22');
});

test('generate：生成到期记录且不重复', () => {
  const expense = firstCat('expense');
  recurring.create({ type: 'expense', amount_cents: 10000, category_id: expense, frequency: 'monthly', start_date: '2020-01-01', note: '房租' });
  const n1 = recurring.generate();
  assert.ok(n1 >= 1, '首次生成应大于 0');
  const n2 = recurring.generate();
  assert.strictEqual(n2, 0, '第二次生成应为 0（不重复）');
});

test('generate：end_date 限制生成范围', () => {
  const expense = firstCat('expense');
  const rule = recurring.create({ type: 'expense', amount_cents: 2000, category_id: expense, frequency: 'weekly', start_date: '2026-08-01', end_date: '2026-08-20' });
  recurring.generate();
  const count = db.prepare('SELECT COUNT(*) c FROM transactions WHERE recurring_id = ?').get(rule.id).c;
  assert.strictEqual(count, 3); // 8-01、8-08、8-15
});
