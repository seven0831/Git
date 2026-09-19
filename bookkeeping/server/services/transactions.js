const { db } = require('../db');
const {
  badRequest,
  notFound,
  assertType,
  parsePositiveCents,
  parseDate,
  parseId,
  parseOptionalText,
} = require('../validation');

const SELECT = `
SELECT t.id, t.type, t.amount_cents, t.category_id, c.name AS category_name,
       t.date, t.note, t.recurring_id, t.created_at, t.updated_at
FROM transactions t
JOIN categories c ON c.id = t.category_id
`;

function getById(id) {
  return db.prepare(`${SELECT} WHERE t.id = ?`).get(id);
}

function assertCategoryMatches(categoryId, type) {
  const cat = db.prepare('SELECT id, type FROM categories WHERE id = ?').get(categoryId);
  if (!cat) throw badRequest('分类不存在');
  if (cat.type !== type) throw badRequest('分类类型与收支类型不匹配');
  return cat;
}

function list({ year, month, type, categoryId, keyword, page, pageSize }) {
  const where = [];
  const params = [];

  if (year != null) {
    where.push('CAST(substr(t.date,1,4) AS INTEGER) = ?');
    params.push(year);
  }
  if (month != null) {
    where.push('CAST(substr(t.date,6,2) AS INTEGER) = ?');
    params.push(month);
  }
  if (type) {
    where.push('t.type = ?');
    params.push(type);
  }
  if (categoryId != null) {
    where.push('t.category_id = ?');
    params.push(categoryId);
  }
  if (keyword) {
    where.push('(t.note LIKE ? OR CAST(t.amount_cents AS TEXT) LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db
    .prepare(`SELECT COUNT(*) c FROM transactions t ${whereSql}`)
    .get(...params).c;

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  return { items: rows, page, pageSize, total };
}

function create({ type, amount_cents, category_id, date, note }) {
  const t = assertType(type);
  const amt = parsePositiveCents(amount_cents);
  const cid = parseId(category_id);
  const d = parseDate(date);
  const n = parseOptionalText(note);

  assertCategoryMatches(cid, t);

  const info = db
    .prepare('INSERT INTO transactions (type, amount_cents, category_id, date, note) VALUES (?, ?, ?, ?, ?)')
    .run(t, amt, cid, d, n);
  return getById(info.lastInsertRowid);
}

function update(id, { type, amount_cents, category_id, date, note }) {
  const existing = getById(id);
  if (!existing) throw notFound('收支记录不存在');

  const t = type != null ? assertType(type) : existing.type;
  const amt = amount_cents != null ? parsePositiveCents(amount_cents) : existing.amount_cents;
  const cid = category_id != null ? parseId(category_id) : existing.category_id;
  const d = date != null ? parseDate(date) : existing.date;
  const n = note != null ? parseOptionalText(note) : existing.note;

  assertCategoryMatches(cid, t);

  db.prepare(
    "UPDATE transactions SET type = ?, amount_cents = ?, category_id = ?, date = ?, note = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  ).run(t, amt, cid, d, n, id);
  return getById(id);
}

function remove(id) {
  const existing = getById(id);
  if (!existing) throw notFound('收支记录不存在');
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { getById, list, create, update, remove };
