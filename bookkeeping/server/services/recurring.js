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

const FREQUENCIES = ['monthly', 'weekly', 'yearly'];

const SELECT = `
SELECT r.id, r.type, r.amount_cents, r.category_id, c.name AS category_name,
       r.frequency, r.start_date, r.end_date, r.next_run_date, r.note, r.created_at, r.updated_at
FROM recurring_rules r
JOIN categories c ON c.id = r.category_id
`;

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function assertFrequency(f) {
  if (!FREQUENCIES.includes(f)) {
    throw badRequest('frequency 必须为 monthly/weekly/yearly');
  }
  return f;
}

function assertCategoryMatches(categoryId, type) {
  const cat = db.prepare('SELECT id, type FROM categories WHERE id = ?').get(categoryId);
  if (!cat) throw badRequest('分类不存在');
  if (cat.type !== type) throw badRequest('分类类型与收支类型不匹配');
  return cat;
}

// 在给定日期基础上按频率递增；clamp 到目标月最后一天
function addFrequency(dateStr, freq) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (freq === 'weekly') {
    return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  }
  const delta = freq === 'monthly' ? 1 : 12; // yearly
  const total = (m - 1) + delta;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function getById(id) {
  return db.prepare(`${SELECT} WHERE r.id = ?`).get(id);
}

function list() {
  return db.prepare(`${SELECT} ORDER BY r.next_run_date, r.id`).all();
}

function create({ type, amount_cents, category_id, frequency, start_date, end_date, note }) {
  const t = assertType(type);
  const amt = parsePositiveCents(amount_cents);
  const cid = parseId(category_id);
  const freq = assertFrequency(frequency);
  const start = parseDate(start_date);
  const end = end_date != null ? parseDate(end_date) : null;
  const n = parseOptionalText(note);

  assertCategoryMatches(cid, t);
  if (end != null && end < start) throw badRequest('end_date 不能早于 start_date');

  const info = db.prepare(`
    INSERT INTO recurring_rules (type, amount_cents, category_id, frequency, start_date, end_date, next_run_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t, amt, cid, freq, start, end, start, n);

  return getById(info.lastInsertRowid);
}

function update(id, { type, amount_cents, category_id, frequency, start_date, end_date, note }) {
  const existing = getById(id);
  if (!existing) throw notFound('周期规则不存在');

  const t = type != null ? assertType(type) : existing.type;
  const amt = amount_cents != null ? parsePositiveCents(amount_cents) : existing.amount_cents;
  const cid = category_id != null ? parseId(category_id) : existing.category_id;
  const freq = frequency != null ? assertFrequency(frequency) : existing.frequency;
  const start = start_date != null ? parseDate(start_date) : existing.start_date;
  let end = end_date != null ? parseDate(end_date) : existing.end_date;
  const n = note != null ? parseOptionalText(note) : existing.note;

  assertCategoryMatches(cid, t);
  if (end != null && end < start) throw badRequest('end_date 不能早于 start_date');

  // 若开始日期被修改，则重置 next_run_date；否则保持原值
  const nextRun = start_date != null ? start : existing.next_run_date;

  db.prepare(`
    UPDATE recurring_rules
    SET type = ?, amount_cents = ?, category_id = ?, frequency = ?, start_date = ?, end_date = ?, next_run_date = ?, note = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(t, amt, cid, freq, start, end, nextRun, n, id);

  return getById(id);
}

function remove(id) {
  const existing = getById(id);
  if (!existing) throw notFound('周期规则不存在');
  db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(id);
  return { deleted: true };
}

// 生成所有到期记录，返回生成条数
function generate() {
  const today = todayLocal();
  const rules = db.prepare('SELECT * FROM recurring_rules WHERE next_run_date <= ?').all(today);

  let generated = 0;
  const insertTx = db.prepare(
    'INSERT INTO transactions (type, amount_cents, category_id, date, note, recurring_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateNext = db.prepare(
    "UPDATE recurring_rules SET next_run_date = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  );

  for (const rule of rules) {
    let next = rule.next_run_date;
    while (next <= today && (rule.end_date == null || next <= rule.end_date)) {
      insertTx.run(rule.type, rule.amount_cents, rule.category_id, next, rule.note, rule.id);
      generated += 1;
      next = addFrequency(next, rule.frequency);
    }
    updateNext.run(next, rule.id);
  }

  return generated;
}

module.exports = { getById, list, create, update, remove, generate, todayLocal, addFrequency };
