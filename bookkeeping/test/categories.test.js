'use strict';
process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const categories = require('../server/services/categories');
const tx = require('../server/services/transactions');

test('种子分类：默认 7 个（5 支出 + 2 收入）', () => {
  const all = categories.list();
  assert.strictEqual(all.length, 7);
  assert.strictEqual(all.filter((c) => c.type === 'expense').length, 5);
  assert.strictEqual(all.filter((c) => c.type === 'income').length, 2);
});

test('新增 / 删除自定义分类', () => {
  const created = categories.create({ name: '水果', type: 'expense' });
  assert.strictEqual(created.name, '水果');
  assert.strictEqual(categories.remove(created.id).deleted, true);
});

test('被交易引用的分类删除返回 409', () => {
  const cat = categories.list('expense')[0];
  tx.create({ type: 'expense', amount_cents: 100, category_id: cat.id, date: '2026-01-01' });
  assert.throws(() => categories.remove(cat.id), /无法删除/);
});

test('分类类型不合法 / 名称为空', () => {
  assert.throws(() => categories.create({ name: 'x', type: 'bad' }), /income 或 expense/);
  assert.throws(() => categories.create({ name: '  ', type: 'expense' }), /字段不能为空/);
});
