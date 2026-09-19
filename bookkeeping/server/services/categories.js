const { db } = require('../db');
const { badRequest, notFound, conflict, assertType, parseOptionalText } = require('../validation');

const FIELDS = 'id, name, type, sort';

function getById(id) {
  return db.prepare(`SELECT ${FIELDS} FROM categories WHERE id = ?`).get(id);
}

function list(type) {
  if (type) assertType(type);
  if (type) {
    return db.prepare(`SELECT ${FIELDS} FROM categories WHERE type = ? ORDER BY sort, id`).all(type);
  }
  return db.prepare(`SELECT ${FIELDS} FROM categories ORDER BY type, sort, id`).all();
}

function create({ name, type, sort }) {
  assertType(type);
  const n = parseOptionalText(name, { allowEmpty: false });
  const s = sort == null ? 0 : Number(sort);
  if (!Number.isInteger(s)) throw badRequest('sort 必须为整数');

  const info = db
    .prepare('INSERT INTO categories (name, type, sort) VALUES (?, ?, ?)')
    .run(n, type, s);
  return getById(info.lastInsertRowid);
}

function update(id, { name, sort }) {
  const existing = getById(id);
  if (!existing) throw notFound('分类不存在');

  const n = name != null ? parseOptionalText(name, { allowEmpty: false }) : existing.name;
  const s = sort != null ? (() => {
    const x = Number(sort);
    if (!Number.isInteger(x)) throw badRequest('sort 必须为整数');
    return x;
  })() : existing.sort;

  db.prepare('UPDATE categories SET name = ?, sort = ? WHERE id = ?').run(n, s, id);
  return getById(id);
}

function remove(id) {
  const existing = getById(id);
  if (!existing) throw notFound('分类不存在');

  const ref = db.prepare('SELECT COUNT(*) c FROM transactions WHERE category_id = ?').get(id).c;
  if (ref > 0) throw conflict('该分类下已有收支记录，无法删除');

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { getById, list, create, update, remove };
