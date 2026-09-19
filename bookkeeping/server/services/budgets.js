const { db } = require('../db');
const {
  badRequest,
  notFound,
  parseId,
  parseYear,
  parseMonth,
  parseNonNegativeCents,
} = require('../validation');

function buildEntry(r, spent) {
  const amount = r.amount_cents;
  const remaining = amount - spent;
  const ratio = amount > 0 ? spent / amount : 0;
  const over = amount > 0 && spent >= amount;
  return {
    id: r.id,
    category_id: r.category_id,
    category_name: r.category_name,
    amount_cents: amount,
    spent_cents: spent,
    remaining_cents: remaining,
    ratio: Math.round(ratio * 10000) / 10000,
    over,
  };
}

function list({ year, month }) {
  const y = parseYear(year);
  const m = parseMonth(month);

  const totalSpent = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS s
    FROM transactions
    WHERE type = 'expense'
      AND CAST(substr(date,1,4) AS INTEGER) = ?
      AND CAST(substr(date,6,2) AS INTEGER) = ?
  `).get(y, m).s;

  const byCatRows = db.prepare(`
    SELECT category_id, SUM(amount_cents) AS s
    FROM transactions
    WHERE type = 'expense'
      AND CAST(substr(date,1,4) AS INTEGER) = ?
      AND CAST(substr(date,6,2) AS INTEGER) = ?
    GROUP BY category_id
  `).all(y, m);
  const spentMap = new Map(byCatRows.map((r) => [r.category_id, r.s]));

  const rows = db.prepare(`
    SELECT b.id, b.category_id, c.name AS category_name, b.amount_cents
    FROM budgets b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.year = ? AND b.month = ?
    ORDER BY b.id
  `).all(y, m);

  let overallBudget = null;
  let overallBudgetId = null;
  const items = [];
  for (const r of rows) {
    const spent = r.category_id == null ? totalSpent : spentMap.get(r.category_id) || 0;
    if (r.category_id == null) {
      overallBudget = r.amount_cents;
      overallBudgetId = r.id;
    } else {
      items.push(buildEntry(r, spent));
    }
  }

  return {
    year: y,
    month: m,
    total_spent_cents: totalSpent,
    overall_budget_cents: overallBudget,
    overall_budget_id: overallBudgetId,
    items,
  };
}

function findRow(cid, y, m) {
  return cid == null
    ? db.prepare('SELECT id, category_id, year, month, amount_cents FROM budgets WHERE category_id IS NULL AND year = ? AND month = ?').get(y, m)
    : db.prepare('SELECT id, category_id, year, month, amount_cents FROM budgets WHERE category_id = ? AND year = ? AND month = ?').get(cid, y, m);
}

function upsert({ category_id, year, month, amount_cents }) {
  const y = parseYear(year);
  const m = parseMonth(month);
  const amt = parseNonNegativeCents(amount_cents);

  let cid = null;
  if (category_id != null && category_id !== '') {
    cid = parseId(category_id);
    const cat = db.prepare('SELECT id, type FROM categories WHERE id = ?').get(cid);
    if (!cat) throw badRequest('分类不存在');
    if (cat.type !== 'expense') throw badRequest('预算仅支持支出分类');
  }

  const existing = findRow(cid, y, m);
  if (existing) {
    db.prepare("UPDATE budgets SET amount_cents = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(amt, existing.id);
  } else {
    db.prepare('INSERT INTO budgets (category_id, year, month, amount_cents) VALUES (?, ?, ?, ?)')
      .run(cid, y, m, amt);
  }
  return findRow(cid, y, m);
}

function remove(id) {
  const existing = db.prepare('SELECT id FROM budgets WHERE id = ?').get(id);
  if (!existing) throw notFound('预算不存在');
  db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { list, upsert, remove };
