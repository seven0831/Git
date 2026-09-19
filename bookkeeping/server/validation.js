// 通用校验与错误工具

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function badRequest(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}
function notFound(message) {
  return new ApiError(404, 'NOT_FOUND', message);
}
function conflict(message) {
  return new ApiError(409, 'CONFLICT', message);
}

// 校验并规范化 type
function assertType(type) {
  if (type !== 'income' && type !== 'expense') {
    throw badRequest('type 必须为 income 或 expense');
  }
  return type;
}

// 金额（分）：正整数
function parsePositiveCents(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest('amount_cents 必须为正整数（单位：分）');
  }
  return n;
}

// 金额（分）：非负整数（用于预算）
function parseNonNegativeCents(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw badRequest('amount_cents 必须为非负整数（单位：分）');
  }
  return n;
}

// 日期：YYYY-MM-DD 且为真实日期
function parseDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw badRequest('date 格式必须为 YYYY-MM-DD');
  }
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw badRequest('date 不是有效日期');
  }
  return v;
}

function parseId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest('id 无效');
  }
  return n;
}

function parseYear(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) {
    throw badRequest('year 无效');
  }
  return n;
}

function parseMonth(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    throw badRequest('month 无效');
  }
  return n;
}

function parsePage(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function parsePageSize(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 20;
}

// 可选文本：返回 trim 后字符串或默认值
function parseOptionalText(v, { allowEmpty = true } = {}) {
  if (v == null) return '';
  if (typeof v !== 'string') throw badRequest('字段必须为字符串');
  const t = v.trim();
  if (!allowEmpty && t === '') throw badRequest('字段不能为空');
  return t;
}

module.exports = {
  ApiError,
  badRequest,
  notFound,
  conflict,
  assertType,
  parsePositiveCents,
  parseNonNegativeCents,
  parseDate,
  parseId,
  parseYear,
  parseMonth,
  parsePage,
  parsePageSize,
  parseOptionalText,
};
