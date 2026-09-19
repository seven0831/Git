'use strict';

/* ============ UI 层：hash 路由、视图渲染、事件绑定 ============ */

(() => {
  const appEl = document.getElementById('app');

  /* ---------- 通用工具 ---------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
    );
  }

  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function currentUser() { return store.getUser(); }

  // 展示昵称：本机身份实时读昵称；外来数据用发布时快照
  function displayName(item) {
    const user = currentUser();
    return user && item.author_id === user.id ? user.nickname : item.author_name;
  }

  function isMine(item) {
    const user = currentUser();
    return user !== null && item.author_id === user.id;
  }

  function boardName(id) {
    const b = store.BOARDS.find((x) => x.id === Number(id));
    return b ? b.name : '未知板块';
  }

  /* ---------- 昵称设置层 ---------- */
  let nicknameMode = 'first'; // first（不可跳过） | edit（可取消）

  const nicknameModal = document.getElementById('nickname-modal');
  const nicknameTitle = document.getElementById('nickname-title');
  const nicknameTip = document.getElementById('nickname-tip');
  const nicknameInput = document.getElementById('nickname-input');
  const nicknameSave = document.getElementById('nickname-save');
  const nicknameCancel = document.getElementById('nickname-cancel');
  const nicknameError = document.getElementById('nickname-error');

  function openNicknameModal(mode) {
    nicknameMode = mode || 'first';
    nicknameTitle.textContent = mode === 'edit' ? '修改昵称' : '设置昵称';
    nicknameTip.textContent =
      mode === 'edit' ? '输入新的昵称（1–20 字符）' : '首次使用，请设置你的昵称（1–20 字符）';
    nicknameCancel.classList.toggle('hidden', mode === 'first');
    nicknameError.classList.add('hidden');
    const user = store.getUser();
    nicknameInput.value = user ? user.nickname : '';
    nicknameModal.classList.remove('hidden');
    nicknameInput.focus();
  }

  function closeNicknameModal() {
    if (nicknameMode === 'first') return; // 首次使用不可跳过
    nicknameModal.classList.add('hidden');
  }

  nicknameSave.addEventListener('click', () => {
    try {
      store.setNickname(nicknameInput.value);
      nicknameModal.classList.add('hidden');
      renderTopbar();
      route();
    } catch (e) {
      showError(nicknameError, e.message);
    }
  });

  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nicknameSave.click();
  });

  nicknameCancel.addEventListener('click', closeNicknameModal);

  nicknameModal.addEventListener('click', (e) => {
    if (e.target === nicknameModal) closeNicknameModal();
  });

  /* ---------- 顶部导航 ---------- */
  function renderTopbar() {
    const nicknameBtn = document.getElementById('nickname-btn');
    const user = store.getUser();
    nicknameBtn.textContent = user ? user.nickname : '';
    nicknameBtn.classList.toggle('hidden', !user);
  }

  document.getElementById('nickname-btn').addEventListener('click', () => openNicknameModal('edit'));

  /* ---------- 发帖/编辑弹窗 ---------- */
  let editingPostId = null;

  const postModal = document.getElementById('post-modal');
  const postModalTitle = document.getElementById('post-modal-title');
  const postBoard = document.getElementById('post-board');
  const postTitle = document.getElementById('post-title');
  const postContent = document.getElementById('post-content');
  const postImages = document.getElementById('post-images');
  const postAddImage = document.getElementById('post-add-image');
  const postSave = document.getElementById('post-save');
  const postCancel = document.getElementById('post-cancel');
  const postError = document.getElementById('post-error');
  const postFreshmanRow = document.getElementById('post-freshman-row');
  const postFreshman = document.getElementById('post-freshman');

  // 勾选"适合大一新生"仅在学习交流/项目组队板块可见
  function updateFreshmanRow() {
    const eligible = store.FRESHMAN_BOARD_IDS.indexOf(Number(postBoard.value)) >= 0;
    postFreshmanRow.classList.toggle('hidden', !eligible);
    if (!eligible) postFreshman.checked = false;
  }

  postBoard.addEventListener('change', updateFreshmanRow);

  function addImageRow(value) {
    if (postImages.children.length >= store.MAX_IMAGES) {
      toast('最多 ' + store.MAX_IMAGES + ' 张图片');
      return;
    }
    const row = document.createElement('div');
    row.className = 'image-url-row';
    row.innerHTML =
      '<input type="text" placeholder="https:// 图片链接" maxlength="500" />' +
      '<button type="button" title="移除">✕</button>';
    row.querySelector('input').value = value || '';
    row.querySelector('button').addEventListener('click', () => row.remove());
    postImages.appendChild(row);
  }

  function openPostModal(post) {
    editingPostId = post ? post.id : null;
    postModalTitle.textContent = post ? '编辑帖子' : '发帖';
    postSave.textContent = post ? '保存' : '发布';
    postError.classList.add('hidden');
    postBoard.innerHTML = store.BOARDS.map(
      (b) => '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>'
    ).join('');
    postBoard.value = post ? post.board_id : store.BOARDS[0].id;
    postTitle.value = post ? post.title : '';
    postContent.value = post ? post.content : '';
    postFreshman.checked = post ? post.freshman_friendly === true : false;
    updateFreshmanRow();
    postImages.innerHTML = '';
    const images = post && post.images.length ? post.images : [''];
    images.forEach(addImageRow);
    postModal.classList.remove('hidden');
    postTitle.focus();
  }

  function closePostModal() {
    postModal.classList.add('hidden');
  }

  function collectImages() {
    const urls = [];
    postImages.querySelectorAll('input').forEach((input) => {
      const v = input.value.trim();
      if (v) urls.push(v);
    });
    return urls;
  }

  postSave.addEventListener('click', () => {
    const data = {
      boardId: postBoard.value,
      title: postTitle.value,
      content: postContent.value,
      images: collectImages(),
      freshmanFriendly: postFreshman.checked,
    };
    try {
      if (editingPostId === null) {
        store.createPost(data);
        toast('发布成功');
        closePostModal();
        renderList();
      } else {
        store.updatePost(editingPostId, data);
        toast('保存成功');
        closePostModal();
        if (parseRoute().name === 'post') {
          renderPostDetail(editingPostId);
        } else {
          renderList();
        }
      }
    } catch (e) {
      showError(postError, e.message);
    }
  });

  postCancel.addEventListener('click', closePostModal);

  postModal.addEventListener('click', (e) => {
    if (e.target === postModal) closePostModal();
  });

  postAddImage.addEventListener('click', () => addImageRow(''));

  /* ---------- 帖子列表视图 ---------- */
  const listState = { boardId: null, keyword: '', sort: 'latest', page: 1, freshmanOnly: false };

  function renderPostCard(p) {
    const imgs = p.images
      .slice(0, 3)
      .map(
        (u) =>
          '<img src="' + escapeHtml(u) + '" alt="图片" loading="lazy" referrerpolicy="no-referrer" />'
      )
      .join('');
    return (
      '<article class="post-card">' +
      '<a class="post-title-link" href="#/post/' + p.id + '">' + escapeHtml(p.title) + '</a>' +
      '<div class="post-meta">' +
      '<span class="board-badge">' + escapeHtml(boardName(p.board_id)) + '</span>' +
      (p.freshman_friendly ? '<span class="freshman-badge">🎓 新生推荐</span>' : '') +
      '<span>' + escapeHtml(displayName(p)) + '</span>' +
      '<span>' + formatDate(p.created_at) + '</span>' +
      '</div>' +
      '<p class="post-excerpt">' + escapeHtml(p.excerpt) + '</p>' +
      (imgs ? '<div class="post-images">' + imgs + '</div>' : '') +
      '<div class="post-actions">' +
      '<button class="like-btn' + (p.liked ? ' liked' : '') + '" data-action="like" data-id="' + p.id + '">' +
      (p.liked ? '♥' : '♡') + ' ' + p.like_count + '</button>' +
      '<span class="stat">💬 ' + p.comment_count + '</span>' +
      (isMine(p) ? '<button class="btn-danger" data-action="delete" data-id="' + p.id + '">删除</button>' : '') +
      '</div>' +
      '</article>'
    );
  }

  function renderList() {
    let r = store.listPosts({
      boardId: listState.boardId,
      keyword: listState.keyword,
      sort: listState.sort,
      page: listState.page,
    });
    const totalPages = Math.max(1, Math.ceil(r.total / r.pageSize));
    if (listState.page > totalPages) {
      listState.page = totalPages;
      r = store.listPosts({
        boardId: listState.boardId,
        keyword: listState.keyword,
        sort: listState.sort,
        page: listState.page,
      });
    }

    const tabs = [{ id: null, name: '全部' }]
      .concat(store.BOARDS)
      .map(
        (b) =>
          '<button class="board-tab' + (listState.boardId === b.id ? ' active' : '') +
          '" data-board="' + (b.id === null ? '' : b.id) + '">' + escapeHtml(b.name) + '</button>'
      )
      .join('');

    appEl.innerHTML =
      '<section class="toolbar">' +
      '<div class="board-tabs">' + tabs + '</div>' +
      '<div class="search-row">' +
      '<input id="search-input" class="search-input" type="text" placeholder="搜索帖子标题或内容，回车确认" value="' +
      escapeHtml(listState.keyword) + '" />' +
      '<div class="sort-toggle">' +
      '<button data-sort="latest" class="' + (listState.sort === 'latest' ? 'active' : '') + '">最新</button>' +
      '<button data-sort="hot" class="' + (listState.sort === 'hot' ? 'active' : '') + '">最热</button>' +
      '</div>' +
      '<button id="btn-new-post" class="btn btn-primary">发帖</button>' +
      '</div>' +
      '</section>' +
      '<section id="post-list"></section>';

    const listEl = document.getElementById('post-list');
    if (r.items.length === 0) {
      listEl.innerHTML = '<p class="empty">暂无帖子，快来发第一帖吧～</p>';
    } else {
      listEl.innerHTML = r.items.map(renderPostCard).join('');
    }
    if (r.total > 0) {
      listEl.insertAdjacentHTML(
        'beforeend',
        '<nav class="pagination">' +
        '<button id="page-prev" class="btn btn-ghost btn-sm"' + (listState.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span>第 ' + listState.page + ' / ' + totalPages + ' 页 · 共 ' + r.total + ' 条</span>' +
        '<button id="page-next" class="btn btn-ghost btn-sm"' + (listState.page >= totalPages ? ' disabled' : '') + '>下一页</button>' +
        '</nav>'
      );
    }
  }

  /* ---------- 帖子详情视图 ---------- */
  let replyTo = null; // 正在回复的评论 id

  function parentCommentName(postId, parentId) {
    const comments = store.listComments(postId);
    const parent = comments.find((c) => c.id === Number(parentId));
    return parent ? displayName(parent) : '';
  }

  function renderCommentItem(c, postId) {
    const parentName = c.parent_id !== null ? parentCommentName(postId, c.parent_id) : '';
    return (
      '<div class="comment-item">' +
      '<div class="comment-head">' +
      '<span class="avatar">' + escapeHtml(displayName(c).charAt(0)) + '</span>' +
      '<span class="comment-author">' + escapeHtml(displayName(c)) + '</span>' +
      (c.parent_id !== null ? '<span class="reply-tag">回复 @' + escapeHtml(parentName) + '</span>' : '') +
      '<span>' + formatDate(c.created_at) + '</span>' +
      '</div>' +
      '<div class="comment-content">' + escapeHtml(c.content) + '</div>' +
      '<div class="comment-actions">' +
      '<button data-action="reply" data-id="' + c.id + '" data-name="' + escapeHtml(displayName(c)) + '">回复</button>' +
      '<button class="like-btn' + (c.liked ? ' liked' : '') + '" data-action="like-comment" data-id="' + c.id + '">' +
      (c.liked ? '♥' : '♡') + ' ' + c.like_count + '</button>' +
      (isMine(c) ? '<button class="btn-danger" data-action="delete-comment" data-id="' + c.id + '">删除</button>' : '') +
      '</div>' +
      '</div>'
    );
  }

  function renderPostDetail(id) {
    const post = store.getPost(id);
    if (!post) {
      appEl.innerHTML =
        '<p class="empty">帖子不存在或已被删除</p>' +
        '<p class="empty"><a href="#/">← 返回列表</a></p>';
      return;
    }
    const comments = store.listComments(id);
    const imgs = post.images
      .map(
        (u) =>
          '<img src="' + escapeHtml(u) + '" alt="图片" referrerpolicy="no-referrer" />'
      )
      .join('');
    const edited =
      post.updated_at !== post.created_at
        ? '<span>（编辑于 ' + formatDate(post.updated_at) + '）</span>'
        : '';

    const replyingTag = replyTo
      ? '<div class="replying-tag">回复 @' + escapeHtml(parentCommentName(id, replyTo)) +
        '<button data-action="cancel-reply" title="取消回复">✕</button></div>'
      : '<div class="replying-tag hidden"></div>';

    appEl.innerHTML =
      '<p><a href="#/" class="btn btn-ghost btn-sm">← 返回列表</a></p>' +
      '<div class="detail-card">' +
      '<div class="post-meta">' +
      '<span class="board-badge">' + escapeHtml(boardName(post.board_id)) + '</span>' +
      '<span>' + escapeHtml(displayName(post)) + '</span>' +
      '<span>' + formatDate(post.created_at) + '</span>' +
      edited +
      '</div>' +
      '<h1>' + escapeHtml(post.title) + '</h1>' +
      '<p class="detail-content">' + escapeHtml(post.content) + '</p>' +
      (imgs ? '<div class="detail-images">' + imgs + '</div>' : '') +
      '<div class="detail-actions">' +
      '<button class="like-btn' + (post.liked ? ' liked' : '') + '" data-action="like" data-id="' + post.id + '">' +
      (post.liked ? '♥' : '♡') + ' 点赞 ' + post.like_count + '</button>' +
      '<span class="stat">💬 ' + post.comment_count + ' 条评论</span>' +
      (isMine(post)
        ? '<button class="btn btn-ghost btn-sm" data-action="edit" data-id="' + post.id + '">编辑</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="delete-detail" data-id="' + post.id + '">删除</button>'
        : '') +
      '</div>' +
      '</div>' +
      '<div class="comment-section">' +
      '<h2>评论（' + comments.length + '）</h2>' +
      (comments.length === 0
        ? '<p class="empty" style="padding:20px 0">还没有评论，来抢沙发～</p>'
        : comments.map((c) => renderCommentItem(c, id)).join('')) +
      '<div class="comment-form">' +
      replyingTag +
      '<textarea id="comment-input" maxlength="500" placeholder="写下你的评论（1–500 字）"></textarea>' +
      '<div class="comment-form-row">' +
      '<button id="btn-comment" class="btn btn-primary">发表评论</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function refreshDetail() {
    const r = parseRoute();
    if (r.name === 'post') renderPostDetail(r.id);
    else renderList();
  }

  function submitComment() {
    const r = parseRoute();
    if (r.name !== 'post') return;
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) {
      toast('评论内容不能为空');
      input.focus();
      return;
    }
    try {
      store.addComment(r.id, content, replyTo);
      replyTo = null;
      toast('评论成功');
      renderPostDetail(r.id);
    } catch (e) {
      toast(e.message);
    }
  }

  /* ---------- 全局事件（事件委托） ---------- */
  appEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.board-tab');
    if (tab) {
      listState.boardId = tab.dataset.board ? Number(tab.dataset.board) : null;
      listState.page = 1;
      renderList();
      return;
    }
    if (e.target.closest('#btn-new-post')) {
      openPostModal(null);
      return;
    }
    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn) {
      listState.sort = sortBtn.dataset.sort;
      listState.page = 1;
      renderList();
      return;
    }
    if (e.target.closest('#page-prev') && listState.page > 1) {
      listState.page -= 1;
      renderList();
      window.scrollTo({ top: 0 });
      return;
    }
    if (e.target.closest('#page-next')) {
      listState.page += 1;
      renderList();
      window.scrollTo({ top: 0 });
      return;
    }
    const likeBtn = e.target.closest('[data-action="like"]');
    if (likeBtn) {
      try {
        store.toggleLike('post', likeBtn.dataset.id);
        refreshDetail();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    const likeCommentBtn = e.target.closest('[data-action="like-comment"]');
    if (likeCommentBtn) {
      try {
        store.toggleLike('comment', likeCommentBtn.dataset.id);
        refreshDetail();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      const post = store.getPost(editBtn.dataset.id);
      if (post) openPostModal(post);
      return;
    }
    const delDetailBtn = e.target.closest('[data-action="delete-detail"]');
    if (delDetailBtn) {
      if (confirm('确定删除这条帖子吗？其下评论与点赞将一并移除。')) {
        try {
          store.deletePost(delDetailBtn.dataset.id);
          toast('已删除');
          location.hash = '#/';
          renderList();
        } catch (err) {
          toast(err.message);
        }
      }
      return;
    }
    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      if (confirm('确定删除这条帖子吗？其下评论与点赞将一并移除。')) {
        try {
          store.deletePost(delBtn.dataset.id);
          toast('已删除');
          renderList();
        } catch (err) {
          toast(err.message);
        }
      }
      return;
    }
    const delCommentBtn = e.target.closest('[data-action="delete-comment"]');
    if (delCommentBtn) {
      if (confirm('确定删除这条评论吗？引用它的回复将一并移除。')) {
        try {
          store.deleteComment(delCommentBtn.dataset.id);
          toast('已删除');
          refreshDetail();
        } catch (err) {
          toast(err.message);
        }
      }
      return;
    }
    const replyBtn = e.target.closest('[data-action="reply"]');
    if (replyBtn) {
      replyTo = Number(replyBtn.dataset.id);
      refreshDetail();
      const input = document.getElementById('comment-input');
      if (input) input.focus();
      return;
    }
    if (e.target.closest('[data-action="cancel-reply"]')) {
      replyTo = null;
      refreshDetail();
      return;
    }
    if (e.target.closest('#btn-comment')) {
      submitComment();
      return;
    }
  });

  // 外链图片加载失败时显示占位（error 不冒泡，用捕获阶段监听）
  appEl.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG') {
        const placeholder = document.createElement('div');
        placeholder.className = 'img-placeholder';
        placeholder.textContent = '图片加载失败';
        img.replaceWith(placeholder);
      }
    },
    true
  );

  appEl.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'search-input' && e.key === 'Enter') {
      listState.keyword = e.target.value.trim();
      listState.page = 1;
      renderList();
    }
    if (e.target && e.target.id === 'comment-input' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitComment();
    }
  });

  /* ---------- 路由 ---------- */
  function parseRoute() {
    const hash = location.hash || '#/';
    const m = hash.match(/^#\/post\/(\d+)$/);
    if (m) return { name: 'post', id: Number(m[1]) };
    return { name: 'list' };
  }

  function route() {
    const user = store.getUser();
    if (!user) {
      openNicknameModal('first');
      appEl.innerHTML = '<p class="empty">请先设置昵称</p>';
      return;
    }
    const r = parseRoute();
    if (r.name === 'post') {
      renderPostDetail(r.id);
    } else {
      renderList();
    }
  }

  window.addEventListener('hashchange', route);

  /* ---------- 启动 ---------- */
  store.init();
  renderTopbar();
  route();
})();
