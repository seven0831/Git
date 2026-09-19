const path = require('node:path');
const express = require('express');
const { ApiError } = require('./validation');

// 初始化数据库（建表 + 种子分类）
require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/categories', require('./routes/categories'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/recurring', require('./routes/recurring'));

// 启动时生成已到期的周期记录
try {
  const { generate } = require('./services/recurring');
  const n = generate();
  if (n > 0) console.log(`已生成 ${n} 条到期周期记录`);
} catch (e) {
  console.error('周期记录生成失败:', e.message);
}

// 未知 API 路由 → 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
});

// 统一错误处理
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
});

app.listen(PORT, () => {
  console.log(`记账软件已启动: http://localhost:${PORT}`);
});
