'use strict';

/* ============ 数据层：localStorage 读写、校验、统计 ============ */

const BOARDS = [
  { id: 1, name: '综合论坛' },
  { id: 2, name: '约球' },
  { id: 3, name: '学习交流' },
  { id: 4, name: '项目组队' },
  { id: 5, name: '兴趣活动' },
];

const PAGE_SIZE = 20;
const MAX_IMAGES = 9;
const MAX_IMAGE_URL_LEN = 500;
// 允许标记"适合大一新生"的板块：3=学习交流，4=项目组队
const FRESHMAN_BOARD_IDS = [3, 4];

const store = (() => {
  const K_USER = 'campus.user';
  const K_SEQ = 'campus.seq';
  const K_POSTS = 'campus.posts';
  const K_COMMENTS = 'campus.comments';

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

  function getPosts() { return read(K_POSTS, []); }
  function setPosts(posts) { write(K_POSTS, posts); }
  function getComments() { return read(K_COMMENTS, []); }
  function setComments(comments) { write(K_COMMENTS, comments); }

  function nextId() {
    const seq = read(K_SEQ, 0) + 1;
    write(K_SEQ, seq);
    return seq;
  }

  // ---------- 初始化 ----------
  function init() {
    if (!Array.isArray(read(K_POSTS, null))) write(K_POSTS, []);
    if (!Array.isArray(read(K_COMMENTS, null))) write(K_COMMENTS, []);
    return { user: getUser() };
  }

  // ---------- 校验 ----------
  function assert(cond, message) {
    if (!cond) throw new Error(message);
  }

  function validateNickname(name) {
    assert(typeof name === 'string', '昵称必须是字符串');
    const v = name.trim();
    assert(v.length >= 1 && v.length <= 20, '昵称长度需为 1–20 字符');
    return v;
  }

  function validateTitle(title) {
    assert(typeof title === 'string', '标题必须是字符串');
    const v = title.trim();
    assert(v.length >= 1 && v.length <= 50, '标题长度需为 1–50 字');
    return v;
  }

  function validateContent(content) {
    assert(typeof content === 'string', '正文必须是字符串');
    const v = content.trim();
    assert(v.length >= 1 && v.length <= 5000, '正文长度需为 1–5000 字');
    return v;
  }

  function validateComment(content) {
    assert(typeof content === 'string', '评论必须是字符串');
    const v = content.trim();
    assert(v.length >= 1 && v.length <= 500, '评论长度需为 1–500 字');
    return v;
  }

  function validateImages(images) {
    if (images === undefined || images === null) return [];
    assert(Array.isArray(images), '图片必须是数组');
    assert(images.length <= MAX_IMAGES, `最多上传 ${MAX_IMAGES} 张图片`);
    return images.map((url) => {
      assert(typeof url === 'string', '图片链接必须是字符串');
      const v = url.trim();
      assert(v.length > 0 && v.length <= MAX_IMAGE_URL_LEN, '图片链接需为 1–500 字符的 URL');
      assert(/^https?:\/\//i.test(v), '图片链接必须以 http:// 或 https:// 开头');
      return v;
    });
  }

  function requireUser() {
    const user = getUser();
    assert(user, '请先设置昵称');
    return user;
  }

  function isMine(item) {
    const user = getUser();
    return user !== null && item.author_id === user.id;
  }

  // ---------- 用户 ----------
  function getUser() {
    return read(K_USER, null);
  }

  function setNickname(name) {
    const nickname = validateNickname(name);
    let user = getUser();
    if (user === null) {
      user = { id: 'campus-' + Math.random().toString(36).slice(2, 10), nickname };
    } else {
      user = Object.assign({}, user, { nickname });
    }
    write(K_USER, user);
    return { user };
  }

  // ---------- 帖子 ----------
  function decoratePost(post, meId) {
    const commentCount = getComments().filter((c) => c.post_id === post.id).length;
    const likeCount = (post.like_user_ids || []).length;
    return Object.assign({}, post, {
      excerpt: post.content.slice(0, 100),
      comment_count: commentCount,
      like_count: likeCount,
      liked: meId !== null && (post.like_user_ids || []).indexOf(meId) >= 0,
      freshman_friendly: post.freshman_friendly === true, // 历史数据无此字段，默认 false
    });
  }

  function listPosts(opts) {
    opts = opts || {};
    const me = getUser();
    const meId = me ? me.id : null;
    const page = opts.page || 1;
    const pageSize = opts.pageSize || PAGE_SIZE;

    let posts = getPosts().slice();
    if (opts.boardId) {
      const bid = Number(opts.boardId);
      posts = posts.filter((p) => p.board_id === bid);
    }
    if (opts.keyword) {
      const kw = String(opts.keyword).trim().toLowerCase();
      if (kw) {
        posts = posts.filter((p) =>
          (p.title + '\n' + p.content).toLowerCase().indexOf(kw) >= 0
        );
      }
    }
    if (opts.freshmanOnly) {
      posts = posts.filter((p) => p.freshman_friendly === true);
    }

    const items = posts.map((p) => decoratePost(p, meId));
    items.sort((a, b) => {
      if (opts.sort === 'hot') {
        const ha = a.like_count + a.comment_count;
        const hb = b.like_count + b.comment_count;
        if (hb !== ha) return hb - ha;
      }
      return b.created_at.localeCompare(a.created_at);
    });

    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
    };
  }

  function getPost(id) {
    const me = getUser();
    const meId = me ? me.id : null;
    const post = getPosts().find((p) => p.id === Number(id));
    return post ? decoratePost(post, meId) : null;
  }

  function createPost(data) {
    data = data || {};
    const me = requireUser();
    const boardId = Number(data.boardId);
    assert(BOARDS.some((b) => b.id === boardId), '请选择有效的板块');
    const title = validateTitle(data.title);
    const content = validateContent(data.content);
    const images = validateImages(data.images);
    // 仅学习交流/项目组队板块允许标记新生推荐，其余强制 false
    const freshmanFriendly =
      FRESHMAN_BOARD_IDS.indexOf(boardId) >= 0 && data.freshmanFriendly === true;

    const now = new Date().toISOString();
    const post = {
      id: nextId(),
      board_id: boardId,
      author_id: me.id,
      author_name: me.nickname,
      title,
      content,
      images,
      freshman_friendly: freshmanFriendly,
      created_at: now,
      updated_at: now,
      like_user_ids: [],
    };
    setPosts([post].concat(getPosts()));
    return post;
  }

  function updatePost(id, data) {
    data = data || {};
    const posts = getPosts();
    const post = posts.find((p) => p.id === Number(id));
    assert(post, '帖子不存在');
    assert(isMine(post), '只能编辑自己的帖子');
    if (data.boardId !== undefined) {
      const boardId = Number(data.boardId);
      assert(BOARDS.some((b) => b.id === boardId), '请选择有效的板块');
      post.board_id = boardId;
      if (FRESHMAN_BOARD_IDS.indexOf(boardId) < 0) {
        post.freshman_friendly = false; // 切换到非支持板块自动清除标记
      }
    }
    if (data.title !== undefined) post.title = validateTitle(data.title);
    if (data.content !== undefined) post.content = validateContent(data.content);
    if (data.images !== undefined) post.images = validateImages(data.images);
    if (data.freshmanFriendly !== undefined) {
      post.freshman_friendly =
        FRESHMAN_BOARD_IDS.indexOf(post.board_id) >= 0 && data.freshmanFriendly === true;
    }
    post.updated_at = new Date().toISOString();
    setPosts(posts);
    return post;
  }

  function deletePost(id) {
    const posts = getPosts();
    const post = posts.find((p) => p.id === Number(id));
    assert(post, '帖子不存在');
    assert(isMine(post), '只能删除自己的帖子');
    setPosts(posts.filter((p) => p.id !== post.id));
    // 级联删除该帖子的评论（含其点赞）
    setComments(getComments().filter((c) => c.post_id !== post.id));
  }

  // ---------- 评论 ----------
  function decorateComment(c, meId) {
    const likeCount = (c.like_user_ids || []).length;
    return Object.assign({}, c, {
      like_count: likeCount,
      liked: meId !== null && (c.like_user_ids || []).indexOf(meId) >= 0,
    });
  }

  function listComments(postId) {
    const me = getUser();
    const meId = me ? me.id : null;
    return getComments()
      .filter((c) => c.post_id === Number(postId))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => decorateComment(c, meId));
  }

  function addComment(postId, content, parentId) {
    const me = requireUser();
    assert(getPosts().some((p) => p.id === Number(postId)), '帖子不存在');
    const vContent = validateComment(content);
    if (parentId !== undefined && parentId !== null) {
      const parent = getComments().find((c) => c.id === Number(parentId));
      assert(parent, '被回复的评论不存在');
      assert(parent.post_id === Number(postId), '只能回复同一帖子下的评论');
      parentId = parent.id;
    } else {
      parentId = null;
    }
    const comment = {
      id: nextId(),
      post_id: Number(postId),
      author_id: me.id,
      author_name: me.nickname,
      parent_id: parentId,
      content: vContent,
      created_at: new Date().toISOString(),
      like_user_ids: [],
    };
    setComments(getComments().concat([comment]));
    return comment;
  }

  function deleteComment(id) {
    const comments = getComments();
    const comment = comments.find((c) => c.id === Number(id));
    assert(comment, '评论不存在');
    assert(isMine(comment), '只能删除自己的评论');
    // 级联删除引用它的回复（回复的回复可能多级，用集合循环清理）
    const removed = new Set([comment.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of comments) {
        if (!removed.has(c.id) && c.parent_id !== null && removed.has(c.parent_id)) {
          removed.add(c.id);
          changed = true;
        }
      }
    }
    setComments(comments.filter((c) => !removed.has(c.id)));
  }

  // ---------- 点赞 ----------
  function toggleLike(targetType, targetId) {
    const me = requireUser();
    assert(targetType === 'post' || targetType === 'comment', '无效的点赞目标类型');
    const id = Number(targetId);

    if (targetType === 'post') {
      const posts = getPosts();
      const post = posts.find((p) => p.id === id);
      assert(post, '帖子不存在');
      const arr = post.like_user_ids || [];
      const idx = arr.indexOf(me.id);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(me.id);
      }
      post.like_user_ids = arr;
      setPosts(posts);
      return { liked: idx < 0, like_count: arr.length };
    }

    const comments = getComments();
    const comment = comments.find((c) => c.id === id);
    assert(comment, '评论不存在');
    const arr = comment.like_user_ids || [];
    const idx = arr.indexOf(me.id);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(me.id);
    }
    comment.like_user_ids = arr;
    setComments(comments);
    return { liked: idx < 0, like_count: arr.length };
  }

  return {
    BOARDS,
    FRESHMAN_BOARD_IDS,
    PAGE_SIZE,
    MAX_IMAGES,
    init,
    getUser,
    setNickname,
    listPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    listComments,
    addComment,
    deleteComment,
    toggleLike,
  };
})();
