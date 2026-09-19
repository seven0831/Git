'use strict';
const test = require('node:test');
const assert = require('node:assert');
const v = require('../server/validation');

test('parseDate：合法日期与非法日期', () => {
  assert.strictEqual(v.parseDate('2026-01-31'), '2026-01-31');
  assert.strictEqual(v.parseDate('2024-02-29'), '2024-02-29'); // 闰年
  assert.throws(() => v.parseDate('2026-02-30'), /不是有效日期/);
  assert.throws(() => v.parseDate('2023-02-29'), /不是有效日期/); // 非闰年
  assert.throws(() => v.parseDate('2026/01/01'), /格式必须/);
  assert.throws(() => v.parseDate('abc'), /格式必须/);
});

test('金额校验', () => {
  assert.strictEqual(v.parsePositiveCents(100), 100);
  assert.strictEqual(v.parsePositiveCents('100'), 100); // 数字字符串会被转换
  assert.throws(() => v.parsePositiveCents(0), /正整数/);
  assert.throws(() => v.parsePositiveCents(-1), /正整数/);
  assert.throws(() => v.parsePositiveCents(1.5), /正整数/);
  assert.throws(() => v.parsePositiveCents('abc'), /正整数/);
  assert.strictEqual(v.parseNonNegativeCents(0), 0);
});

test('type / month / page 校验', () => {
  assert.strictEqual(v.assertType('income'), 'income');
  assert.throws(() => v.assertType('other'), /income 或 expense/);
  assert.strictEqual(v.parseMonth('12'), 12);
  assert.throws(() => v.parseMonth('13'), /month 无效/);
  assert.strictEqual(v.parsePage(undefined), 1);
  assert.strictEqual(v.parsePageSize('9999'), 20);
});
