const express = require('express');
const svc = require('../services/transactions');
const { parseId, parseYear, parseMonth, assertType, parsePage, parsePageSize } = require('../validation');

const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query;
  const year = q.year != null ? parseYear(q.year) : null;
  const month = q.month != null ? parseMonth(q.month) : null;
  const type = q.type != null ? assertType(q.type) : null;
  const categoryId = q.category_id != null ? parseId(q.category_id) : null;
  const keyword = q.keyword != null ? String(q.keyword).trim() : null;
  const page = parsePage(q.page);
  const pageSize = parsePageSize(q.pageSize);

  res.json(svc.list({ year, month, type, categoryId, keyword: keyword || null, page, pageSize }));
});

router.post('/', (req, res) => {
  res.status(201).json(svc.create(req.body || {}));
});

router.put('/:id', (req, res) => {
  res.json(svc.update(parseId(req.params.id), req.body || {}));
});

router.delete('/:id', (req, res) => {
  res.json(svc.remove(parseId(req.params.id)));
});

module.exports = router;
