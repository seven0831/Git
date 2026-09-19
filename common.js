'use strict';

/* ============ 数据层：localStorage 读写、截止时间解析、状态判定、收藏 ============ */

const db = (() => {
  const K_ACTIVITIES = 'eventActivities';
  const K_FAVORITES = 'eventFavorites';
  const K_SEQ = 'eventSeq';
  const K_SIGNUPS = 'eventSignups';

  const CATEGORIES = ['竞赛', '讲座分享', '学习小组', '招募', '学生自发', '通知'];

  // ---------- 基础读写 ----------
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const val = JSON.parse(raw);
      return val === null || val === undefined ? fallback : val;
    } catch (e) {
      return fallback; // JSON 容错：解析失败回退
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function assert(cond, message) {
    if (!cond) throw new Error(message);
  }

  // ---------- HTML 转义 ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- 初始化 ----------
  function ensureSeq(list) {
    if (read(K_SEQ, null) !== null) return;
    let max = 0;
    list.forEach((a) => {
      if (typeof a.id === 'number' && a.id > max) max = a.id;
    });
    write(K_SEQ, max);
  }

  async function init() {
    // localStorage 有数据直接使用
    const cached = read(K_ACTIVITIES, null);
    if (Array.isArray(cached) && cached.length > 0) {
      ensureSeq(cached);
      return cached;
    }
    // 为空则从 activities.json 初始化
    let jsonList = null;
    try {
      const resp = await fetch('activities.json');
      if (resp.ok) jsonList = await resp.json();
    } catch (e) {
      jsonList = null; // 读取失败降级为空库
    }
    if (Array.isArray(jsonList) && jsonList.length > 0) {
      write(K_ACTIVITIES, jsonList);
      ensureSeq(jsonList);
      return jsonList;
    }
    return [];
  }

  // ---------- 活动读写 ----------
  function getActivities() {
    return read(K_ACTIVITIES, []);
  }

  function getActivity(id) {
    return getActivities().find((a) => a.id === Number(id)) || null;
  }

  function nextId() {
    const seq = read(K_SEQ, 0) + 1;
    write(K_SEQ, seq);
    return seq;
  }

  function addActivity(data) {
    data = data || {};
    const name = String(data.name || '').trim();
    assert(name.length >= 1 && name.length <= 50, '活动名称需为 1–50 字');
    const category = String(data.category || '');
    assert(CATEGORIES.indexOf(category) >= 0, '请选择有效的活动分类');
    const holdTime = String(data.holdTime || '').trim();
    assert(holdTime.length >= 1, '请填写举办时间');
    const deadline = String(data.deadline || '').trim();
    assert(deadline.length >= 1, '请填写报名截止日期');
    const audience = String(data.audience || '').trim();
    assert(audience.length >= 1, '请填写面向人群');
    const place = String(data.place || '').trim() || '未注明';
    const remark = String(data.remark || '').trim();
    assert(remark.length >= 1 && remark.length <= 500, '活动简介需为 1–500 字');

    const activity = { id: nextId(), name, category, holdTime, deadline, audience, place, remark };
    const list = getActivities();
    list.push(activity);
    write(K_ACTIVITIES, list);
    return activity;
  }

  // ---------- 截止时间解析 ----------
  // 兼容 ‑(U+2011)/–(U+2013)，取第一个日期时间节点，缺时间补 23:59，无法解析返回 null
  function parseDeadline(str) {
    if (typeof str !== 'string') return null;
    const s = str.replace(/[‑–—]/g, '-');
    const m = s.match(/20\d{2}-\d{1,2}-\d{1,2}(?:[ T]\d{1,2}:\d{2})?/);
    if (!m) return null;
    let t = m[0].replace(' ', 'T');
    if (!/\d{1,2}:\d{2}$/.test(t)) t += 'T23:59';
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }

  // ---------- 状态判定 ----------
  // 'expired' 已结束 | 'urgent' 3 天内截止 | 'open' 报名中 | 'unknown' 无明确截止时间
  function statusOf(activity) {
    const d = parseDeadline(activity.deadline);
    if (!d) return 'unknown';
    const now = new Date();
    if (d < now) return 'expired';
    if (d - now <= 3 * 86400000) return 'urgent';
    return 'open';
  }

  function getUrgent() {
    return getActivities()
      .filter((a) => statusOf(a) === 'urgent')
      .sort((a, b) => parseDeadline(a.deadline) - parseDeadline(b.deadline));
  }

  function sortByDeadline(list) {
    return list.slice().sort((a, b) => {
      const da = parseDeadline(a.deadline);
      const db = parseDeadline(b.deadline);
      if (da === null && db === null) return a.id - b.id;
      if (da === null) return 1; // 无明确截止时间排最后
      if (db === null) return -1;
      return da - db;
    });
  }

  function remainText(activity) {
    const d = parseDeadline(activity.deadline);
    if (!d) return '截止时间待定';
    const ms = d - new Date();
    if (ms < 0) return '已截止';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return '剩余 ' + days + ' 天' + (hours > 0 ? ' ' + hours + ' 小时' : '');
    return '剩余 ' + hours + ' 小时';
  }

  // ---------- 收藏 ----------
  function getFavoriteIds() {
    const favs = read(K_FAVORITES, []);
    return Array.isArray(favs) ? favs : [];
  }

  function isFavorite(id) {
    return getFavoriteIds().indexOf(Number(id)) >= 0;
  }

  function toggleFavorite(id) {
    const favs = getFavoriteIds();
    const nid = Number(id);
    const idx = favs.indexOf(nid);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(nid);
    }
    write(K_FAVORITES, favs);
    return { faved: idx < 0, ids: favs };
  }

  // ---------- 报名 ----------
  // eventSignups: { 活动id: [姓名, ...] }
  function getSignups(id) {
    const all = read(K_SIGNUPS, {});
    const list = all[String(Number(id))];
    return Array.isArray(list) ? list : [];
  }

  function getSignupCount(id) {
    return getSignups(id).length;
  }

  function signup(id, name) {
    const n = String(name || '').trim();
    assert(n.length >= 1 && n.length <= 20, '请输入 1–20 字的姓名');
    const all = read(K_SIGNUPS, {});
    const key = String(Number(id));
    const list = Array.isArray(all[key]) ? all[key] : [];
    assert(list.indexOf(n) < 0, '「' + n + '」已报名，请勿重复报名');
    list.push(n);
    all[key] = list;
    write(K_SIGNUPS, all);
    return { count: list.length, names: list };
  }

  return {
    CATEGORIES,
    init,
    getActivities,
    getActivity,
    addActivity,
    parseDeadline,
    statusOf,
    getUrgent,
    sortByDeadline,
    remainText,
    getFavoriteIds,
    isFavorite,
    toggleFavorite,
    getSignups,
    getSignupCount,
    signup,
    escapeHtml,
  };
})();
