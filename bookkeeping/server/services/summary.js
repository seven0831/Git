const { db } = require('../db');
const { parseYear, parseMonth } = require('../validation');

function summary({ year, month }) {
  const y = parseYear(year);
  const m = parseMonth(month);

  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_cents ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense
    FROM transactions
    WHERE CAST(substr(date,1,4) AS INTEGER) = ? AND CAST(substr(date,6,2) AS INTEGER) = ?
  `).get(y, m);

  const byCat = db.prepare(`
    SELECT t.category_id, c.name, t.type, SUM(t.amount_cents) AS amount_cents
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE CAST(substr(t.date,1,4) AS INTEGER) = ? AND CAST(substr(t.date,6,2) AS INTEGER) = ?
    GROUP BY t.category_id, t.type
    ORDER BY amount_cents DESC
  `).all(y, m);

  return {
    year: y,
    month: m,
    income_cents: agg.income,
    expense_cents: agg.expense,
    balance_cents: agg.income - agg.expense,
    by_category: byCat.map((r) => ({
      category_id: r.category_id,
      name: r.name,
      type: r.type,
      amount_cents: r.amount_cents,
    })),
  };
}

module.exports = { summary };
