const express = require('express');
const svc = require('../services/summary');
const { parseYear, parseMonth } = require('../validation');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(svc.summary({ year: parseYear(req.query.year), month: parseMonth(req.query.month) }));
});

module.exports = router;
