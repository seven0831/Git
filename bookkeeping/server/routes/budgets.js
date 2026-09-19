const express = require('express');
const svc = require('../services/budgets');
const { parseId, parseYear, parseMonth } = require('../validation');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(svc.list({ year: parseYear(req.query.year), month: parseMonth(req.query.month) }));
});

router.put('/', (req, res) => {
  res.json(svc.upsert(req.body || {}));
});

router.delete('/:id', (req, res) => {
  res.json(svc.remove(parseId(req.params.id)));
});

module.exports = router;
