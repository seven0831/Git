const express = require('express');
const svc = require('../services/categories');
const { parseId } = require('../validation');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(svc.list(req.query.type));
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
