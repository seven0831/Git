'use strict';

/* ===================== 基础工具 ===================== */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtCents(cents) {
  const n = Math.round(Number(cents) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const yuan = Math.floor(abs / 100);
  const fen = String(abs % 100).padStart(2, '0');
  return sign + '¥' + String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fen;
}

function fmtSignedForType(type, cents) {
  const n = Math.abs(Math.round(Number(cents) || 0));
  return (type === 'expense' ? '-' : '+') + fmtCents(n);
}

async function api(path, options = {}) {
  const opts = { headers: { 'Content-Type': 'application/json' }, ...options };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch('/api' + path, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { /* ignore */ }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ('请求失败 (' + res.status + ')');
    throw new Error(msg);
  }
  return data;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function currentMonth() {
  return todayStr().slice(0, 7);
}

function monthToYM(v) {
  const [y, m] = String(v).split('-').map(Number);
  return { year: y, month: m };
}

function yuanToCents(v) {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('请输入有效金额（最多两位小数）');
  const n = Number(s);
  if (!(n > 0)) throw new Error('金额必须大于 0');
  return Math.round(n * 100);
}

function yuanToCentsAllowZero(v) {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('请输入有效金额（最多两位小数）');
  const n = Number(s);
  if (n < 0) throw new Error('金额不能为负');
  return Math.round(n * 100);
}

/* ===================== 状态与分类 ===================== */

const state = {
  ledger: { page: 1, lastItems: [] },
};

let categoriesCache = [];

async function loadCategories() {
  categoriesCache = await api('/categories');
}

function categoryOptions(type, selectedId) {
  return categoriesCache
    .filter((c) => c.type === type)
    .map((c) => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
}

function renderCategorySelect(sel, type, selectedId) {
  const list = type ? categoriesCache.filter((c) => c.type === type) : categoriesCache;
  sel.innerHTML = '<option value="">全部分类</option>' +
    list.map((c) => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}

/* ===================== 弹窗 ===================== */

function openModal(title, bodyHtml, onSubmit) {
  const dlg = document.getElementById('modal');
  dlg.innerHTML = `
    <form class="modal-box">
      <h2>${esc(title)}</h2>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions">
        <button type="button" data-close>取消</button>
        <button type="submit" class="primary">保存</button>
      </div>
    </form>`;
  dlg.showModal();
  const form = dlg.querySelector('form');
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await onSubmit(dlg);
      dlg.close();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  });
  return dlg;
}

function readVal(dlg, name) {
  const el = dlg.querySelector(`[name="${name}"]`);
  return el ? el.value : undefined;
}

function bindTypeRadio(dlg) {
  const sel = dlg.querySelector('select[name="category_id"]');
  if (!sel) return;
  dlg.querySelectorAll('input[name="type"]').forEach((r) => {
    r.addEventListener('change', () => {
      sel.innerHTML = categoryOptions(dlg.querySelector('input[name="type"]:checked').value, null);
    });
  });
}

/* ===================== 视图切换 ===================== */

function switchView(v) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'ledger') loadLedger();
  else if (v === 'budget') loadBudget();
  else if (v === 'recurring') loadRecurring();
  else if (v === 'categories') loadCategoriesPage();
}

/* ===================== 记账页 ===================== */

async function loadLedger() {
  const { year, month } = monthToYM(document.getElementById('ledger-month').value);
  const type = document.getElementById('ledger-type').value;
  const categoryId = document.getElementById('ledger-category').value;
  const keyword = document.getElementById('ledger-keyword').value.trim();
  const page = state.ledger.page || 1;

  try {
    const summary = await api(`/summary?year=${year}&month=${month}`);
    document.getElementById('ledger-summary').innerHTML = `
      <div class="summary-card income"><div class="label">本月收入</div><div class="value">${fmtCents(summary.income_cents)}</div></div>
      <div class="summary-card expense"><div class="label">本月支出</div><div class="value">${fmtCents(summary.expense_cents)}</div></div>
      <div class="summary-card"><div class="label">本月结余</div><div class="value">${fmtCents(summary.balance_cents)}</div></div>`;
  } catch (_) {
    document.getElementById('ledger-summary').innerHTML = '';
  }

  const params = new URLSearchParams({ year: String(year), month: String(month), page: String(page) });
  if (type) params.set('type', type);
  if (categoryId) params.set('category_id', categoryId);
  if (keyword) params.set('keyword', keyword);

  const data = await api('/transactions?' + params.toString());
  state.ledger.lastItems = data.items;
  renderLedgerList(data);
}

function renderLedgerList(data) {
  const box = document.getElementById('ledger-list');
  if (!data.items.length) {
    box.innerHTML = '<div class="empty">暂无记录，点击「记一笔」开始记账</div>';
  } else {
    box.innerHTML = data.items.map((t) => `
      <div class="row">
        <div class="grow">
          <div class="title">${esc(t.note || t.category_name)}</div>
          <div class="sub">${esc(t.date)} · ${esc(t.category_name)}</div>
        </div>
        <div class="amount ${t.type}">${fmtSignedForType(t.type, t.amount_cents)}</div>
        <div class="actions">
          <button data-ledger-edit="${t.id}">编辑</button>
          <button class="danger" data-ledger-delete="${t.id}">删除</button>
        </div>
      </div>`).join('');
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  document.getElementById('ledger-pager').innerHTML = `
    <button data-page-prev ${data.page <= 1 ? 'disabled' : ''}>上一页</button>
    <span>第 ${data.page} / ${totalPages} 页（共 ${data.total} 条）</span>
    <button data-page-next ${data.page >= totalPages ? 'disabled' : ''}>下一页</button>`;
}

function openLedgerForm(tx) {
  const type = tx ? tx.type : 'expense';
  const amountYuan = tx ? (tx.amount_cents / 100) : '';
  const body = `
    <div class="field">
      <label>类型</label>
      <div class="radio-group">
        <label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}> 支出</label>
        <label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}> 收入</label>
      </div>
    </div>
    <div class="field"><label>金额（元）</label><input type="text" name="amount" inputmode="decimal" placeholder="0.00" value="${amountYuan}" /></div>
    <div class="field"><label>分类</label><select name="category_id">${categoryOptions(type, tx ? tx.category_id : null)}</select></div>
    <div class="field"><label>日期</label><input type="date" name="date" value="${tx ? tx.date : todayStr()}" /></div>
    <div class="field"><label>备注</label><input type="text" name="note" placeholder="可选" value="${esc(tx ? tx.note : '')}" /></div>`;

  const dlg = openModal(tx ? '编辑记录' : '记一笔', body, async (d) => {
    const payload = {
      type: d.querySelector('input[name="type"]:checked').value,
      amount_cents: yuanToCents(readVal(d, 'amount')),
      category_id: Number(readVal(d, 'category_id')),
      date: readVal(d, 'date'),
      note: readVal(d, 'note').trim(),
    };
    if (tx) await api('/transactions/' + tx.id, { method: 'PUT', body: payload });
    else await api('/transactions', { method: 'POST', body: payload });
    loadLedger();
  });
  bindTypeRadio(dlg);
}

/* ===================== 预算页 ===================== */

async function loadBudget() {
  const { year, month } = monthToYM(document.getElementById('budget-month').value);
  const data = await api(`/budgets?year=${year}&month=${month}`);
  state.budgetData = data;
  renderBudget(data);
}

function renderBudget(data) {
  const overall = document.getElementById('budget-overall');
  if (data.overall_budget_cents == null) {
    overall.innerHTML = `
      <div class="budget-head">
        <span class="name">总预算</span>
        <span class="nums">本月已支出 ${fmtCents(data.total_spent_cents)} · 未设置预算</span>
      </div>
      <button data-budget-overall>设置总预算</button>`;
  } else {
    const spent = data.total_spent_cents;
    const amt = data.overall_budget_cents;
    const ratio = amt > 0 ? spent / amt : 0;
    const over = amt > 0 && spent >= amt;
    overall.innerHTML = `
      <div class="budget-head">
        <span class="name">总预算 ${over ? '<span class="badge-over">超预算</span>' : ''}</span>
        <span class="nums">已用 ${fmtCents(spent)} / 预算 ${fmtCents(amt)} · 剩余 ${fmtCents(amt - spent)}</span>
      </div>
      <div class="progress"><div class="bar ${over ? 'over' : ''}" style="width:${Math.min(100, Math.round(ratio * 100))}%"></div></div>
      <div style="margin-top:10px">
        <button data-budget-overall>修改总预算</button>
        <button class="danger" data-budget-overall-delete>删除总预算</button>
      </div>`;
  }

  const box = document.getElementById('budget-list');
  if (!data.items.length) {
    box.innerHTML = '<div class="empty">暂无分类预算，点击「新增预算」添加</div>';
  } else {
    box.innerHTML = data.items.map((b) => `
      <div class="row">
        <div class="grow">
          <div class="title">${esc(b.category_name)} ${b.over ? '<span class="badge-over">超预算</span>' : ''}</div>
          <div class="sub">已用 ${fmtCents(b.spent_cents)} / 预算 ${fmtCents(b.amount_cents)} · 剩余 ${fmtCents(b.remaining_cents)}</div>
          <div class="progress" style="margin-top:6px"><div class="bar ${b.over ? 'over' : ''}" style="width:${Math.min(100, Math.round(b.ratio * 100))}%"></div></div>
        </div>
        <div class="actions">
          <button data-budget-edit="${b.id}">编辑</button>
          <button class="danger" data-budget-delete="${b.id}">删除</button>
        </div>
      </div>`).join('');
  }
}

function openBudgetForm(item) {
  const expenseCats = categoriesCache.filter((c) => c.type === 'expense');
  const amountYuan = item ? (item.amount_cents / 100) : '';
  const body = `
    <div class="field"><label>分类</label>
      <select name="category_id">${expenseCats.map((c) => `<option value="${c.id}" ${item && item.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>预算金额（元）</label><input type="text" name="amount" inputmode="decimal" placeholder="0.00" value="${amountYuan}" /></div>`;

  openModal(item ? '编辑分类预算' : '新增分类预算', body, async (d) => {
    const { year, month } = monthToYM(document.getElementById('budget-month').value);
    await api('/budgets', {
      method: 'PUT',
      body: { category_id: Number(readVal(d, 'category_id')), year, month, amount_cents: yuanToCentsAllowZero(readVal(d, 'amount')) },
    });
    loadBudget();
  });
}

function openOverallBudgetForm(current) {
  const amountYuan = current != null ? (current / 100) : '';
  const body = `<div class="field"><label>总预算金额（元）</label><input type="text" name="amount" inputmode="decimal" placeholder="0.00" value="${amountYuan}" /></div>`;
  openModal('设置总预算', body, async (d) => {
    const { year, month } = monthToYM(document.getElementById('budget-month').value);
    await api('/budgets', {
      method: 'PUT',
      body: { category_id: null, year, month, amount_cents: yuanToCentsAllowZero(readVal(d, 'amount')) },
    });
    loadBudget();
  });
}

/* ===================== 周期记账页 ===================== */

const FREQ_LABELS = { monthly: '每月', weekly: '每周', yearly: '每年' };

async function loadRecurring() {
  const rules = await api('/recurring');
  const box = document.getElementById('recurring-list');
  if (!rules.length) {
    box.innerHTML = '<div class="empty">暂无周期规则，点击「新增规则」添加</div>';
  } else {
    box.innerHTML = rules.map((r) => `
      <div class="row">
        <div class="grow">
          <div class="title">${esc(r.note || r.category_name)}</div>
          <div class="sub">${FREQ_LABELS[r.frequency]} · ${r.type === 'income' ? '收入' : '支出'} · ${esc(r.category_name)} · 下次执行 ${esc(r.next_run_date)}${r.end_date ? ' · 至 ' + esc(r.end_date) : ''}</div>
        </div>
        <div class="amount ${r.type}">${fmtSignedForType(r.type, r.amount_cents)}</div>
        <div class="actions">
          <button data-recurring-edit="${r.id}">编辑</button>
          <button class="danger" data-recurring-delete="${r.id}">删除</button>
        </div>
      </div>`).join('');
  }
}

function openRecurringForm(rule) {
  const type = rule ? rule.type : 'expense';
  const freq = rule ? rule.frequency : 'monthly';
  const body = `
    <div class="field">
      <label>类型</label>
      <div class="radio-group">
        <label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}> 支出</label>
        <label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}> 收入</label>
      </div>
    </div>
    <div class="field"><label>金额（元）</label><input type="text" name="amount" inputmode="decimal" placeholder="0.00" value="${rule ? rule.amount_cents / 100 : ''}" /></div>
    <div class="field"><label>分类</label><select name="category_id">${categoryOptions(type, rule ? rule.category_id : null)}</select></div>
    <div class="field"><label>频率</label>
      <select name="frequency">
        <option value="monthly" ${freq === 'monthly' ? 'selected' : ''}>每月</option>
        <option value="weekly" ${freq === 'weekly' ? 'selected' : ''}>每周</option>
        <option value="yearly" ${freq === 'yearly' ? 'selected' : ''}>每年</option>
      </select></div>
    <div class="field"><label>开始日期</label><input type="date" name="start_date" value="${rule ? rule.start_date : todayStr()}" /></div>
    <div class="field"><label>结束日期（可选）</label><input type="date" name="end_date" value="${rule && rule.end_date ? rule.end_date : ''}" /></div>
    <div class="field"><label>备注</label><input type="text" name="note" placeholder="可选" value="${esc(rule ? rule.note : '')}" /></div>`;

  const dlg = openModal(rule ? '编辑周期规则' : '新增周期规则', body, async (d) => {
    const payload = {
      type: d.querySelector('input[name="type"]:checked').value,
      amount_cents: yuanToCents(readVal(d, 'amount')),
      category_id: Number(readVal(d, 'category_id')),
      frequency: readVal(d, 'frequency'),
      start_date: readVal(d, 'start_date'),
      end_date: readVal(d, 'end_date') || null,
      note: readVal(d, 'note').trim(),
    };
    if (rule) await api('/recurring/' + rule.id, { method: 'PUT', body: payload });
    else await api('/recurring', { method: 'POST', body: payload });
    loadRecurring();
  });
  bindTypeRadio(dlg);
}

/* ===================== 分类管理页 ===================== */

async function loadCategoriesPage() {
  const cats = await api('/categories');
  state.categories = cats;
  const box = document.getElementById('category-list');
  const income = cats.filter((c) => c.type === 'income');
  const expense = cats.filter((c) => c.type === 'expense');
  const group = (title, list) => `
    <div class="cat-group-title">${title}（${list.length}）</div>
    ${list.length
      ? list.map((c) => `
        <div class="row">
          <div class="grow"><span class="title">${esc(c.name)}</span></div>
          <div class="actions"><button class="danger" data-category-delete="${c.id}">删除</button></div>
        </div>`).join('')
      : '<div class="empty">暂无分类</div>'}`;
  box.innerHTML = group('支出', expense) + group('收入', income);
}

function openCategoryForm() {
  const body = `
    <div class="field">
      <label>类型</label>
      <div class="radio-group">
        <label><input type="radio" name="type" value="expense" checked> 支出</label>
        <label><input type="radio" name="type" value="income"> 收入</label>
      </div>
    </div>
    <div class="field"><label>分类名称</label><input type="text" name="name" placeholder="例如：水果" /></div>`;
  openModal('新增分类', body, async (d) => {
    const name = readVal(d, 'name').trim();
    await api('/categories', { method: 'POST', body: { name, type: d.querySelector('input[name="type"]:checked').value } });
    await refreshAfterCategoryChange();
  });
}

async function refreshAfterCategoryChange() {
  await loadCategories(); // 刷新全局分类缓存
  loadCategoriesPage(); // 刷新分类管理页
  const sel = document.getElementById('ledger-category');
  renderCategorySelect(sel, document.getElementById('ledger-type').value, sel.value); // 同步记账页筛选下拉
}

/* ===================== 事件绑定 ===================== */

function bindEvents() {
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

  // 记账工具栏
  document.getElementById('ledger-month').addEventListener('change', () => { state.ledger.page = 1; loadLedger(); });
  document.getElementById('ledger-type').addEventListener('change', () => {
    renderCategorySelect(document.getElementById('ledger-category'), document.getElementById('ledger-type').value, null);
    state.ledger.page = 1; loadLedger();
  });
  document.getElementById('ledger-category').addEventListener('change', () => { state.ledger.page = 1; loadLedger(); });
  document.getElementById('ledger-keyword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { state.ledger.page = 1; loadLedger(); }
  });
  document.getElementById('ledger-add').addEventListener('click', () => openLedgerForm(null));

  // 记账列表 + 分页
  document.getElementById('ledger-list').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-ledger-edit]');
    const delBtn = e.target.closest('[data-ledger-delete]');
    if (editBtn) {
      const tx = state.ledger.lastItems.find((t) => t.id === Number(editBtn.dataset.ledgerEdit));
      if (tx) openLedgerForm(tx);
    } else if (delBtn) {
      if (!confirm('确定删除这笔记录？')) return;
      await api('/transactions/' + delBtn.dataset.ledgerDelete, { method: 'DELETE' });
      loadLedger();
    }
  });
  document.getElementById('ledger-pager').addEventListener('click', (e) => {
    if (e.target.closest('[data-page-prev]')) { state.ledger.page = Math.max(1, state.ledger.page - 1); loadLedger(); }
    if (e.target.closest('[data-page-next]')) { state.ledger.page += 1; loadLedger(); }
  });

  // 预算
  document.getElementById('budget-month').addEventListener('change', loadBudget);
  document.getElementById('budget-add').addEventListener('click', () => openBudgetForm(null));
  document.getElementById('budget-overall').addEventListener('click', async (e) => {
    if (e.target.closest('[data-budget-overall-delete]')) {
      if (!confirm('确定删除总预算？')) return;
      const data = state.budgetData;
      if (data && data.overall_budget_id != null) {
        await api('/budgets/' + data.overall_budget_id, { method: 'DELETE' });
        loadBudget();
      }
    } else if (e.target.closest('[data-budget-overall]')) {
      const data = state.budgetData;
      openOverallBudgetForm(data ? data.overall_budget_cents : null);
    }
  });
  document.getElementById('budget-list').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-budget-edit]');
    const delBtn = e.target.closest('[data-budget-delete]');
    if (editBtn) {
      const item = (state.budgetData && state.budgetData.items || []).find((b) => b.id === Number(editBtn.dataset.budgetEdit));
      if (item) openBudgetForm(item);
    } else if (delBtn) {
      if (!confirm('确定删除该预算？')) return;
      await api('/budgets/' + delBtn.dataset.budgetDelete, { method: 'DELETE' });
      loadBudget();
    }
  });

  // 周期记账
  document.getElementById('recurring-add').addEventListener('click', () => openRecurringForm(null));
  document.getElementById('recurring-generate').addEventListener('click', async () => {
    const r = await api('/recurring/generate', { method: 'POST' });
    alert('已生成 ' + r.generated + ' 条记录');
    loadRecurring();
  });
  document.getElementById('recurring-list').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-recurring-edit]');
    const delBtn = e.target.closest('[data-recurring-delete]');
    if (editBtn) {
      const rules = await api('/recurring');
      const rule = rules.find((r) => r.id === Number(editBtn.dataset.recurringEdit));
      if (rule) openRecurringForm(rule);
    } else if (delBtn) {
      if (!confirm('确定删除该规则？（已生成记录不受影响）')) return;
      await api('/recurring/' + delBtn.dataset.recurringDelete, { method: 'DELETE' });
      loadRecurring();
    }
  });

  // 分类管理
  document.getElementById('category-add').addEventListener('click', () => openCategoryForm());
  document.getElementById('category-list').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-category-delete]');
    if (!del) return;
    const id = Number(del.dataset.categoryDelete);
    const cat = (state.categories || []).find((c) => c.id === id);
    if (!confirm('确定删除分类「' + (cat ? cat.name : '') + '」？')) return;
    try {
      await api('/categories/' + id, { method: 'DELETE' });
      await refreshAfterCategoryChange();
    } catch (err) {
      alert(err.message);
    }
  });
}

/* ===================== 启动 ===================== */

async function init() {
  await loadCategories();
  document.getElementById('ledger-month').value = currentMonth();
  document.getElementById('budget-month').value = currentMonth();
  renderCategorySelect(document.getElementById('ledger-category'), '', null);
  bindEvents();
  loadLedger();
}

init().catch((e) => alert('初始化失败：' + e.message));
