
/* =====================================================
   HANOON — SOCIAL FEED
   Posts / Images / Videos / Likes / Comments
   Supabase integration
===================================================== */

(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    supabase: null,
    user: null,
    profile: null,
    posts: [],
    loading: false,
    channel: null
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  function notify(message, type = "info") {
    let toast = $("#feedToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "feedToast";

      toast.style.cssText = `
        position:fixed;
        bottom:90px;
        left:50%;
        transform:translateX(-50%);
        z-index:100000;
        max-width:90%;
        padding:13px 20px;
        border-radius:14px;
        background:#202943;
        color:#fff;
        border:1px solid rgba(255,255,255,.15);
        box-shadow:0 10px 35px #0007;
        font-family:Cairo,sans-serif;
        font-size:13px;
        text-align:center;
      `;

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.borderColor =
      type === "error" ? "#ff667d" : "#8b72f8";

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function avatarURL(path) {
    if (!path || !state.supabase) {
      return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80";
    }

    return state.supabase.storage
      .from("avatars")
      .getPublicUrl(path).data.publicUrl;
  }

  function mediaURL(path) {
    if (!path) return "";

    return state.supabase.storage
      .from("post-media")
      .getPublicUrl(path).data.publicUrl;
  }

  function timeAgo(value) {
    const date = new Date(value);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (!Number.isFinite(seconds)) return "";

    if (seconds < 60) return "الآن";
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;

    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getPostsContainer() {
    let container = $(".posts");

    if (!container) {
      const center = $(".center") || $("main") || document.body;

      container = document.createElement("section");
      container.className = "posts";
      container.id = "feedPosts";

      center.appendChild(container);
    }

    return container;
  }

  function addFeedStyles() {
    if ($("#feedRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "feedRuntimeStyles";

    style.textContent = `
      .feed-post-card {
        padding:18px;
        margin-bottom:16px;
        overflow:hidden;
      }

      .feed-post-header {
        display:flex;
        align-items:center;
        gap:11px;
        margin-bottom:15px;
      }

      .feed-post-avatar {
        width:46px;
        height:46px;
        border-radius:50%;
        object-fit:cover;
        border:2px solid #9b82ff;
      }

      .feed-post-author {
        flex:1;
        min-width:0;
      }

      .feed-post-author strong {
        display:block;
        font-size:13px;
      }

      .feed-post-author small {
        display:block;
        color:#a5acc4;
        font-size:10px;
      }

      .feed-post-content {
        color:#f2f1fa;
        font-size:14px;
        line-height:2;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        margin-bottom:12px;
      }

      .feed-post-media {
        width:100%;
        max-height:520px;
        object-fit:contain;
        background:#090d19;
        border-radius:15px;
        margin:5px 0 12px;
      }

      .feed-post-stats {
        display:flex;
        justify-content:space-between;
        color:#a5acc4;
        font-size:11px;
        padding:10px 2px;
        border-bottom:1px solid rgba(255,255,255,.08);
      }

      .feed-post-actions {
        display:flex;
        gap:8px;
        padding-top:12px;
      }

      .feed-post-actions button {
        flex:1;
        border:0;
        border-radius:11px;
        padding:10px 4px;
        color:#d9d9e9;
        background:rgba(255,255,255,.055);
        font-family:inherit;
        font-size:12px;
      }

      .feed-post-actions button:hover {
        background:rgba(155,130,255,.18);
      }

      .feed-post-actions button.liked {
        color:#b49cff;
        background:rgba(155,130,255,.15);
      }

      .feed-comments {
        display:none;
        margin-top:13px;
        padding-top:12px;
        border-top:1px solid rgba(255,255,255,.08);
      }

      .feed-comments.open {
        display:block;
      }

      .feed-comment {
        display:flex;
        gap:9px;
        margin:12px 0;
        align-items:flex-start;
      }

      .feed-comment img {
        width:32px;
        height:32px;
        border-radius:50%;
        object-fit:cover;
      }

      .feed-comment-body {
        flex:1;
        min-width:0;
        background:rgba(255,255,255,.06);
        padding:9px 12px;
        border-radius:12px;
        font-size:12px;
        line-height:1.8;
      }

      .feed-comment-body strong {
        display:block;
        color:#e7bd75;
        margin-bottom:3px;
      }

      .feed-comment-form {
        display:flex;
        gap:8px;
        margin-top:12px;
      }

      .feed-comment-form input {
        flex:1;
        min-width:0;
        border:1px solid rgba(255,255,255,.12);
        border-radius:20px;
        padding:10px 13px;
        color:white;
        background:rgba(255,255,255,.06);
        font-family:inherit;
        outline:none;
      }

      .feed-comment-form button {
        border:0;
        border-radius:20px;
        padding:8px 15px;
        color:white;
        background:#7258d5;
        font-family:inherit;
      }

      .feed-empty {
        padding:35px 15px;
        text-align:center;
        color:#a5acc4;
        line-height:2;
      }

      .feed-modal {
        position:fixed;
        inset:0;
        z-index:99990;
        display:none;
        align-items:center;
        justify-content:center;
        padding:15px;
        background:rgba(4,7,18,.86);
        backdrop-filter:blur(12px);
      }

      .feed-modal.open {
        display:flex;
      }

      .feed-modal-card {
        width:100%;
        max-width:520px;
        max-height:90vh;
        overflow-y:auto;
        padding:22px;
        border-radius:22px;
        background:#171e34;
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 20px 70px #0008;
      }

      .feed-modal-card h3 {
        margin-bottom:15px;
        color:#e7bd75;
      }

      .feed-modal-card textarea {
        width:100%;
        min-height:140px;
        resize:vertical;
        padding:14px;
        color:white;
        background:#0d1428;
        border:1px solid rgba(255,255,255,.12);
        border-radius:13px;
        font:inherit;
        outline:none;
      }

      .feed-file-label {
        display:block;
        margin:12px 0;
        padding:12px;
        text-align:center;
        border:1px dashed #8b72f8;
        border-radius:12px;
        color:#c7baff;
        cursor:pointer;
      }

      .feed-modal-buttons {
        display:flex;
        gap:10px;
        margin-top:15px;
      }

      .feed-modal-buttons button {
        flex:1;
        padding:12px;
        border:0;
        border-radius:12px;
        color:white;
        font-family:inherit;
      }

      .feed-publish {
        background:linear-gradient(135deg,#8065ed,#5542b0);
      }

      .feed-cancel {
        background:#303951;
      }

      .feed-loading {
        text-align:center;
        padding:25px;
        color:#a5acc4;
      }
    `;

    document.head.appendChild(style);
  }

  function createComposerModal() {
    if ($("#feedCreateModal")) return;

    const modal = document.createElement("div");

    modal.className = "feed-modal";
    modal.id = "feedCreateModal";

    modal.innerHTML = `
      <div class="feed-modal-card">
        <h3>إنشاء منشور جديد</h3>

        <textarea
          id="feedNewPostText"
          maxlength="10000"
          placeholder="ماذا تريد أن تشارك مع مجتمع هنون؟"
        ></textarea>

        <label class="feed-file-label" for="feedNewPostFile">
          إضافة صورة أو فيديو
        </label>

        <input
          id="feedNewPostFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          hidden
        >

        <div id="feedFilePreview"></div>

        <div class="feed-modal-buttons">
          <button class="feed-publish" id="feedPublishButton">
            نشر المنشور
          </button>

          <button class="feed-cancel" id="feedCancelButton">
            إلغاء
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $("#feedCancelButton").addEventListener("click", closeComposer);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeComposer();
    });

    $("#feedNewPostFile").addEventListener("change", previewPostFile);

    $("#feedPublishButton").addEventListener("click", publishPost);
  }

  function openComposer() {
    if (!state.user) {
      notify("سجّل الدخول أولًا لإنشاء منشور.", "error");
      return;
    }

    createComposerModal();

    $("#feedCreateModal").classList.add("open");
    $("#feedNewPostText").focus();
  }

  function closeComposer() {
    const modal = $("#feedCreateModal");

    if (!modal) return;

    modal.classList.remove("open");
    $("#feedNewPostText").value = "";
    $("#feedNewPostFile").value = "";
    $("#feedFilePreview").innerHTML = "";
  }

  function previewPostFile(event) {
    const file = event.target.files?.[0];
    const preview = $("#feedFilePreview");

    preview.innerHTML = "";

    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ];

    if (!allowed.includes(file.type)) {
      notify("نوع الملف غير مدعوم.", "error");
      event.target.value = "";
      return;
    }

    const isVideo = file.type.startsWith("video/");

    const maxSize = isVideo
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      notify(
        isVideo
          ? "حجم الفيديو يجب ألا يتجاوز 50 ميجابايت."
          : "حجم الصورة يجب ألا يتجاوز 10 ميجابايت.",
        "error"
      );

      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);

    const media = document.createElement(isVideo ? "video" : "img");

    media.src = url;
    media.className = "feed-post-media";

    if (isVideo) media.controls = true;

    preview.appendChild(media);
  }

  async function publishPost() {
    if (!state.user) {
      notify("يجب تسجيل الدخول أولًا.", "error");
      return;
    }

    const button = $("#feedPublishButton");
    const content = $("#feedNewPostText").value.trim();
    const file = $("#feedNewPostFile").files?.[0];

    if (!content && !file) {
      notify("اكتب شيئًا أو أضف صورة أو فيديو.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "جارٍ النشر...";

    try {
      let mediaPath = null;
      let mediaType = null;

      if (file) {
        mediaType = file.type.startsWith("video/")
          ? "video"
          : "image";

        const extension =
          file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") ||
          (mediaType === "video" ? "mp4" : "jpg");

        const fileName =
          `${state.user.id}/${crypto.randomUUID()}.${extension}`;

        const { data, error } = await state.supabase.storage
          .from("post-media")
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600"
          });

        if (error) throw error;

        mediaPath = data.path;
      }

      const { error } = await state.supabase
        .from("posts")
        .insert({
          user_id: state.user.id,
          content,
          media_path: mediaPath,
          media_type: mediaType
        });

      if (error) {
        if (mediaPath) {
          await state.supabase.storage
            .from("post-media")
            .remove([mediaPath]);
        }

        throw error;
      }

      closeComposer();
      notify("تم نشر منشورك بنجاح.");
      await loadPosts();

    } catch (error) {
      console.error("HANOON publish error:", error);
      notify(error.message || "تعذر نشر المنشور.", "error");

    } finally {
      button.disabled = false;
      button.textContent = "نشر المنشور";
    }
  }

  async function loadPosts() {
    if (state.loading) return;

    state.loading = true;

    const container = getPostsContainer();

    if (!state.posts.length) {
      container.innerHTML =
        '<div class="feed-loading">جارٍ تحميل المنشورات...</div>';
    }

    try {
      const { data: posts, error } = await state.supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      state.posts = posts || [];

      await renderPosts();

    } catch (error) {
      console.error("HANOON load posts error:", error);

      container.innerHTML = `
        <div class="feed-empty">
          تعذر تحميل المنشورات الآن.
          <br>
          ${escapeHTML(error.message)}
        </div>
      `;

    } finally {
      state.loading = false;
    }
  }

  async function renderPosts() {
    const container = getPostsContainer();

    if (!state.posts.length) {
      container.innerHTML = `
        <div class="panel feed-empty">
          <h3>أهلًا بك في مجتمع هنون</h3>
          <p>لا توجد منشورات حتى الآن. كن أول من يشارك شيئًا جميلًا.</p>
        </div>
      `;

      return;
    }

    const postIds = state.posts.map(post => post.id);
    const userIds = [...new Set(state.posts.map(post => post.user_id))];

    const [
      { data: members, error: membersError },
      { data: likes, error: likesError },
      { data: comments, error: commentsError },
      { data: myLikes, error: myLikesError }
    ] = await Promise.all([
      state.supabase
        .from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", userIds),

      state.supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds),

      state.supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      state.supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", state.user.id)
        .in("post_id", postIds)
    ]);

    if (membersError) throw membersError;
    if (likesError) throw likesError;
    if (commentsError) throw commentsError;
    if (myLikesError) throw myLikesError;

    const memberMap = new Map(
      (members || []).map(member => [member.id, member])
    );

    const likeCounts = {};
    const commentCounts = {};
    const likedSet = new Set(
      (myLikes || []).map(item => item.post_id)
    );

    (likes || []).forEach(item => {
      likeCounts[item.post_id] = (likeCounts[item.post_id] || 0) + 1;
    });

    (comments || []).forEach(item => {
      commentCounts[item.post_id] =
        (commentCounts[item.post_id] || 0) + 1;
    });

    container.innerHTML = state.posts.map(post => {
      const member = memberMap.get(post.user_id) || {};
      const name = member.full_name || member.username || "عضو هنون";
      const avatar = avatarURL(member.avatar_path);
      const liked = likedSet.has(post.id);

      let mediaHTML = "";

      if (post.media_path) {
        const url = mediaURL(post.media_path);

        mediaHTML = post.media_type === "video"
          ? `<video class="feed-post-media" src="${escapeHTML(url)}" controls playsinline preload="metadata"></video>`
          : `<img class="feed-post-media" src="${escapeHTML(url)}" alt="صورة المنشور" loading="lazy">`;
      }

      return `
        <article class="panel feed-post-card" data-post-id="${escapeHTML(post.id)}">

          <div class="feed-post-header">
            <img
              class="feed-post-avatar"
              src="${escapeHTML(avatar)}"
              alt=""
              loading="lazy"
            >

            <div class="feed-post-author">
              <strong>${escapeHTML(name)}</strong>
              <small>${escapeHTML(timeAgo(post.created_at))}</small>
            </div>
          </div>

          ${post.content
            ? `<div class="feed-post-content">${escapeHTML(post.content)}</div>`
            : ""
          }

          ${mediaHTML}

          <div class="feed-post-stats">
            <span>إعجاب ${likeCounts[post.id] || 0}</span>
            <span>${commentCounts[post.id] || 0} تعليق</span>
          </div>

          <div class="feed-post-actions">
            <button
              type="button"
              class="${liked ? "liked" : ""}"
              data-action="like"
            >
              ${liked ? "أعجبك" : "إعجاب"}
            </button>

            <button type="button" data-action="comments">
              التعليقات
            </button>

            <button type="button" data-action="share">
              مشاركة
            </button>
          </div>

          <div class="feed-comments" id="comments-${escapeHTML(post.id)}">
            <div class="feed-comments-list">
              جارٍ تحميل التعليقات...
            </div>

            <form class="feed-comment-form">
              <input
                type="text"
                maxlength="3000"
                placeholder="اكتب تعليقك..."
                required
              >
              <button type="submit">إرسال</button>
            </form>
          </div>
        </article>
      `;
    }).join("");
  }

  async function toggleLike(postId, button) {
    if (!state.user) {
      notify("سجّل الدخول أولًا.", "error");
      return;
    }

    button.disabled = true;

    try {
      const { data: existing, error: findError } =
        await state.supabase
          .from("post_likes")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", state.user.id)
          .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error } = await state.supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", state.user.id);

        if (error) throw error;

      } else {
        const { error } = await state.supabase
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) throw error;
      }

      await loadPosts();

    } catch (error) {
      console.error("HANOON like error:", error);
      notify("تعذر تحديث الإعجاب.", "error");

    } finally {
      button.disabled = false;
    }
  }

  async function loadComments(postId) {
    const box = $(`#comments-${postId}`);
    if (!box) return;

    const list = $(".feed-comments-list", box);

    list.textContent = "جارٍ تحميل التعليقات...";

    try {
      const { data: comments, error } = await state.supabase
        .from("post_comments")
        .select("id,user_id,body,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      const userIds = [...new Set(
        (comments || []).map(comment => comment.user_id)
      )];

      let members = [];

      if (userIds.length) {
        const result = await state.supabase
          .from("member_directory")
          .select("id,username,full_name,avatar_path")
          .in("id", userIds);

        if (result.error) throw result.error;

        members = result.data || [];
      }

      const memberMap = new Map(
        members.map(member => [member.id, member])
      );

      if (!comments?.length) {
        list.innerHTML =
          '<div class="feed-empty">لا توجد تعليقات بعد.</div>';
        return;
      }

      list.innerHTML = comments.map(comment => {
        const member = memberMap.get(comment.user_id) || {};

        return `
          <div class="feed-comment">
            <img src="${escapeHTML(avatarURL(member.avatar_path))}" alt="">
            <div class="feed-comment-body">
              <strong>${escapeHTML(member.full_name || member.username || "عضو هنون")}</strong>
              ${escapeHTML(comment.body)}
            </div>
          </div>
        `;
      }).join("");

    } catch (error) {
      console.error("HANOON comments error:", error);
      list.textContent = "تعذر تحميل التعليقات.";
    }
  }

  async function addComment(postId, form) {
    const input = $("input", form);
    const body = input.value.trim();

    if (!body) return;

    if (!state.user) {
      notify("سجّل الدخول أولًا.", "error");
      return;
    }

    const button = $("button", form);
    button.disabled = true;

    try {
      const { error } = await state.supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: state.user.id,
          body
        });

      if (error) throw error;

      input.value = "";

      await loadComments(postId);
      await loadPosts();

      const box = $(`#comments-${postId}`);
      box?.classList.add("open");

    } catch (error) {
      console.error("HANOON add comment error:", error);
      notify("تعذر إرسال التعليق.", "error");

    } finally {
      button.disabled = false;
    }
  }

  async function sharePost(postId) {
    const url = new URL(window.location.href);
    url.searchParams.set("post", postId);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "منشور من مجتمع هنون",
          text: "شاهد هذا المنشور على هنون",
          url: url.href
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
        notify("تم نسخ رابط المنشور.");
      } else {
        notify("المشاركة غير مدعومة على هذا المتصفح.", "error");
      }

    } catch (error) {
      if (error.name !== "AbortError") {
        notify("تعذرت مشاركة المنشور.", "error");
      }
    }
  }

  function bindPostActions() {
    const container = getPostsContainer();

    container.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const card = button.closest("[data-post-id]");
      if (!card) return;

      const postId = card.dataset.postId;
      const action = button.dataset.action;

      if (action === "like") {
        await toggleLike(postId, button);
      }

      if (action === "comments") {
        const box = $(`#comments-${postId}`);

        box.classList.toggle("open");

        if (box.classList.contains("open")) {
          await loadComments(postId);
        }
      }

      if (action === "share") {
        await sharePost(postId);
      }
    });

    container.addEventListener("submit", async event => {
      const form = event.target.closest(".feed-comment-form");
      if (!form) return;

      event.preventDefault();

      const card = form.closest("[data-post-id]");
      if (!card) return;

      await addComment(card.dataset.postId, form);
    });
  }

  function bindComposerButtons() {
    document.addEventListener("click", event => {
      const button = event.target.closest(
        ".composer-input, .composer-actions button, [data-feed-create]"
      );

      if (!button) return;

      if (
        button.matches(".composer-input") ||
        button.hasAttribute("data-feed-create") ||
        button.textContent.includes("كتابة") ||
        button.textContent.includes("صورة") ||
        button.textContent.includes("فيديو") ||
        button.textContent.includes("منشور")
      ) {
        event.preventDefault();
        openComposer();
      }
    });
  }

  function subscribeToPosts() {
    if (state.channel) {
      state.supabase.removeChannel(state.channel);
    }

    state.channel = state.supabase
      .channel("hanoon-feed-posts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts"
        },
        () => loadPosts()
      )
      .subscribe();
  }

  async function init() {
    addFeedStyles();

    const container = getPostsContainer();

    container.innerHTML =
      '<div class="feed-loading">جارٍ الاتصال بحسابك...</div>';

    const client = window.HANOON?.supabase;

    if (!client) {
      container.innerHTML = `
        <div class="panel feed-empty">
          تعذر تشغيل الاتصال بقاعدة البيانات.
          <br>
          تأكد من تحميل ملف supabase-client.js قبل feed.js.
        </div>
      `;
      return;
    }

    state.supabase = client;

    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      container.innerHTML = `
        <div class="panel feed-empty">
          سجّل الدخول إلى هنون حتى تتمكن من مشاهدة المنشورات والتفاعل معها.
        </div>
      `;
      return;
    }

    state.user = data.session.user;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id,full_name,username,avatar_path,member_code")
      .eq("id", state.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    state.profile = profile;

    bindPostActions();
    bindComposerButtons();

    await loadPosts();

    subscribeToPosts();

    console.info("HANOON feed is ready.");
  }

  function start() {
    init().catch(error => {
      console.error("HANOON feed initialization error:", error);
      notify(error.message || "تعذر تشغيل الصفحة.", "error");
    });
  }

  if (window.HANOON?.supabase) {
    start();
  } else {
    window.addEventListener("hanoon:supabase-ready", start, {
      once: true
    });
  }

})();
