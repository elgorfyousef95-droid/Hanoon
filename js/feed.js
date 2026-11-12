
/* ==================================================
   HANOON — FEED SYSTEM
   Supabase: Posts / Likes / Comments / Media
================================================== */

(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    db: null,
    user: null,
    profile: null,
    posts: [],
    busy: false,
    realtime: null
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const publicURL = (bucket, path) => {
    if (!path) return "";

    return state.db.storage
      .from(bucket)
      .getPublicUrl(path).data.publicUrl;
  };

  function notify(message, error = false) {
    let toast = $("#hanoonFeedToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hanoonFeedToast";

      Object.assign(toast.style, {
        position: "fixed",
        bottom: "85px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "999999",
        padding: "12px 19px",
        borderRadius: "14px",
        background: "#202943",
        color: "#fff",
        border: "1px solid rgba(255,255,255,.15)",
        boxShadow: "0 10px 35px #0008",
        fontFamily: "Cairo,sans-serif",
        fontSize: "12px",
        maxWidth: "90%",
        textAlign: "center"
      });

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.borderColor = error ? "#ff7189" : "#9b82ff";

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.remove(), 3200);
  }

  function timeAgo(value) {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 1000)
    );

    if (!Number.isFinite(seconds)) return "";

    if (seconds < 60) return "الآن";
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;

    return new Date(value).toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function avatarURL(path) {
    return path
      ? publicURL("avatars", path)
      : "";
  }

  function getPostsContainer() {
    return $("#postsList") || $(".posts") || $(".center-column");
  }

  function addStyles() {
    if ($("#hanoonFeedStyles")) return;

    const style = document.createElement("style");
    style.id = "hanoonFeedStyles";

    style.textContent = `
      .feed-runtime-post {
        padding:17px;
        margin-bottom:16px;
        overflow:hidden;
      }

      .feed-runtime-head {
        display:flex;
        align-items:center;
        gap:11px;
        margin-bottom:14px;
      }

      .feed-runtime-avatar {
        width:45px;
        height:45px;
        border-radius:50%;
        object-fit:cover;
        border:2px solid #a58bff;
        background:#29264b;
      }

      .feed-runtime-author {
        flex:1;
        min-width:0;
      }

      .feed-runtime-author strong {
        display:block;
        font-size:13px;
      }

      .feed-runtime-author small {
        display:block;
        color:#a7adc2;
        font-size:10px;
      }

      .feed-runtime-text {
        margin:12px 0;
        color:#e4e5ef;
        font-size:13px;
        line-height:2;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }

      .feed-runtime-media {
        display:block;
        width:100%;
        max-height:510px;
        object-fit:contain;
        background:#080b18;
        border-radius:15px;
        margin:10px 0;
      }

      .feed-runtime-stats {
        display:flex;
        justify-content:space-between;
        gap:10px;
        padding:12px 2px;
        color:#a7adc2;
        font-size:11px;
      }

      .feed-runtime-actions {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        border-top:1px solid rgba(255,255,255,.09);
        border-bottom:1px solid rgba(255,255,255,.09);
      }

      .feed-runtime-actions button {
        min-height:43px;
        color:#d7d9e8;
        background:transparent;
        border:0;
        font-family:inherit;
        font-size:11px;
        font-weight:800;
      }

      .feed-runtime-actions button:hover {
        background:rgba(255,255,255,.05);
      }

      .feed-runtime-actions button.liked {
        color:#ff7189;
      }

      .feed-runtime-comments {
        display:none;
        padding-top:12px;
      }

      .feed-runtime-comments.open {
        display:block;
      }

      .feed-runtime-comment {
        display:flex;
        align-items:flex-start;
        gap:9px;
        margin:10px 0;
      }

      .feed-runtime-comment img {
        width:32px;
        height:32px;
        border-radius:50%;
        object-fit:cover;
      }

      .feed-runtime-comment-body {
        flex:1;
        padding:9px 12px;
        border-radius:12px;
        background:rgba(255,255,255,.06);
        color:#e5e5f0;
        font-size:11px;
        line-height:1.9;
        overflow-wrap:anywhere;
      }

      .feed-runtime-comment-body strong {
        display:block;
        color:#e5c27d;
      }

      .feed-runtime-comment-form {
        display:flex;
        gap:8px;
        margin-top:12px;
      }

      .feed-runtime-comment-form input {
        flex:1;
        min-width:0;
        padding:10px 13px;
        color:white;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.12);
        border-radius:20px;
        font-family:inherit;
        outline:none;
      }

      .feed-runtime-comment-form button {
        padding:8px 14px;
        color:white;
        background:#7258d5;
        border:0;
        border-radius:20px;
        font-family:inherit;
      }

      .feed-runtime-empty {
        padding:30px 15px;
        color:#a7adc2;
        text-align:center;
        line-height:2;
      }

      .feed-runtime-modal {
        position:fixed;
        inset:0;
        z-index:99990;
        display:none;
        align-items:center;
        justify-content:center;
        padding:14px;
        background:rgba(4,7,18,.88);
        backdrop-filter:blur(12px);
      }

      .feed-runtime-modal.open {
        display:flex;
      }

      .feed-runtime-modal-card {
        width:100%;
        max-width:520px;
        max-height:90vh;
        overflow:auto;
        padding:20px;
        border-radius:21px;
        background:#171e34;
        border:1px solid rgba(255,255,255,.12);
      }

      .feed-runtime-modal-card h3 {
        margin:0 0 14px;
        color:#e5c27d;
      }

      .feed-runtime-modal-card textarea {
        width:100%;
        min-height:135px;
        padding:13px;
        color:white;
        background:#0d1428;
        border:1px solid rgba(255,255,255,.12);
        border-radius:13px;
        font-family:inherit;
        resize:vertical;
        outline:none;
      }

      .feed-runtime-file {
        display:block;
        margin:12px 0;
        padding:12px;
        text-align:center;
        color:#c7baff;
        border:1px dashed #8b72ff;
        border-radius:12px;
        cursor:pointer;
      }

      .feed-runtime-modal-buttons {
        display:flex;
        gap:10px;
        margin-top:14px;
      }

      .feed-runtime-modal-buttons button {
        flex:1;
        padding:11px;
        border:0;
        border-radius:12px;
        color:white;
        font-family:inherit;
      }

      .feed-runtime-publish {
        background:linear-gradient(135deg,#8065ed,#5542b0);
      }

      .feed-runtime-cancel {
        background:#303951;
      }
    `;

    document.head.appendChild(style);
  }

  function createModal() {
    if ($("#feedCreateModal")) return;

    const modal = document.createElement("div");
    modal.id = "feedCreateModal";
    modal.className = "feed-runtime-modal";

    modal.innerHTML = `
      <div class="feed-runtime-modal-card">
        <h3>إنشاء منشور جديد</h3>

        <textarea
          id="feedNewPostText"
          maxlength="10000"
          placeholder="بماذا تفكر اليوم؟ شارك مجتمع هنون..."
        ></textarea>

        <label class="feed-runtime-file" for="feedNewPostFile">
          إضافة صورة أو فيديو
        </label>

        <input
          id="feedNewPostFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          hidden
        >

        <div id="feedFilePreview"></div>

        <div class="feed-runtime-modal-buttons">
          <button class="feed-runtime-publish" id="feedPublishButton">
            نشر المنشور
          </button>

          <button class="feed-runtime-cancel" id="feedCancelButton">
            إلغاء
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $("#feedCancelButton").addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
    });

    $("#feedNewPostFile").addEventListener("change", previewFile);
    $("#feedPublishButton").addEventListener("click", publishPost);
  }

  function openModal(mode = "text") {
    if (!state.user) {
      notify("سجّل الدخول أولًا لإنشاء منشور.", true);
      return;
    }

    createModal();

    const modal = $("#feedCreateModal");
    modal.classList.add("open");

    if (mode === "image") {
      $("#feedNewPostFile").setAttribute(
        "accept",
        "image/jpeg,image/png,image/webp,image/gif"
      );
      $("#feedNewPostFile").click();
    } else if (mode === "video") {
      $("#feedNewPostFile").setAttribute(
        "accept",
        "video/mp4,video/webm,video/quicktime"
      );
      $("#feedNewPostFile").click();
    } else {
      $("#feedNewPostFile").setAttribute(
        "accept",
        "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
      );
      $("#feedNewPostText").focus();
    }
  }

  function closeModal() {
    const modal = $("#feedCreateModal");
    if (!modal) return;

    modal.classList.remove("open");
    $("#feedNewPostText").value = "";
    $("#feedNewPostFile").value = "";
    $("#feedFilePreview").innerHTML = "";
  }

  function previewFile(event) {
    const file = event.target.files?.[0];
    const preview = $("#feedFilePreview");

    preview.innerHTML = "";
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      notify("نوع الملف غير مدعوم.", true);
      event.target.value = "";
      return;
    }

    const maxSize = isVideo
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      notify(
        isVideo
          ? "حجم الفيديو أكبر من الحد المسموح."
          : "حجم الصورة أكبر من الحد المسموح.",
        true
      );
      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    const element = document.createElement(isVideo ? "video" : "img");

    element.src = url;
    element.className = "feed-runtime-media";

    if (isVideo) element.controls = true;

    preview.appendChild(element);
  }

  async function publishPost() {
    const button = $("#feedPublishButton");
    const content = $("#feedNewPostText").value.trim();
    const file = $("#feedNewPostFile").files?.[0];

    if (!content && !file) {
      notify("اكتب منشورًا أو أضف صورة أو فيديو.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "جارٍ النشر...";

    let uploadedPath = null;

    try {
      let mediaType = null;

      if (file) {
        mediaType = file.type.startsWith("video/")
          ? "video"
          : "image";

        const extension =
          file.name.split(".").pop().toLowerCase()
            .replace(/[^a-z0-9]/g, "") ||
          (mediaType === "video" ? "mp4" : "jpg");

        const uniqueName =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const filePath =
          `${state.user.id}/${uniqueName}.${extension}`;

        const { data, error } = await state.db.storage
          .from("post-media")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600"
          });

        if (error) throw error;

        uploadedPath = data.path;
      }

      const { error } = await state.db
        .from("posts")
        .insert({
          user_id: state.user.id,
          content: content || "",
          media_path: uploadedPath,
          media_type: mediaType
        });

      if (error) throw error;

      closeModal();
      notify("تم نشر منشورك بنجاح.");
      await loadPosts();

    } catch (error) {
      console.error("HANOON publish:", error);

      if (uploadedPath) {
        await state.db.storage
          .from("post-media")
          .remove([uploadedPath]);
      }

      notify(error.message || "تعذر نشر المنشور.", true);

    } finally {
      button.disabled = false;
      button.textContent = "نشر المنشور";
    }
  }

  async function loadPosts() {
    if (state.busy) return;

    state.busy = true;

    const container = getPostsContainer();

    try {
      const { data, error } = await state.db
        .from("posts")
        .select("id,user_id,content,media_path,media_type,created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      state.posts = data || [];
      await renderPosts();

    } catch (error) {
      console.error("HANOON load posts:", error);

      container.innerHTML = `
        <div class="glass feed-runtime-empty">
          تعذر تحميل المنشورات.
          <br>
          ${escapeHTML(error.message)}
        </div>
      `;

    } finally {
      state.busy = false;
    }
  }

  async function renderPosts() {
    const container = getPostsContainer();

    if (!state.posts.length) {
      container.innerHTML = `
        <div class="glass feed-runtime-empty">
          <h3>أهلًا بك في مجتمع هنون</h3>
          <p>لا توجد منشورات حتى الآن. كن أول من يشارك.</p>
        </div>
      `;
      return;
    }

    const postIds = state.posts.map(post => post.id);
    const userIds = [...new Set(state.posts.map(post => post.user_id))];

    const results = await Promise.all([
      state.db.from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", userIds),

      state.db.from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds),

      state.db.from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      state.db.from("post_likes")
        .select("post_id")
        .eq("user_id", state.user.id)
        .in("post_id", postIds)
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    const [membersResult, likesResult, commentsResult, myLikesResult] = results;

    const members = new Map(
      (membersResult.data || []).map(member => [member.id, member])
    );

    const likeCounts = {};
    const commentCounts = {};

    (likesResult.data || []).forEach(item => {
      likeCounts[item.post_id] = (likeCounts[item.post_id] || 0) + 1;
    });

    (commentsResult.data || []).forEach(item => {
      commentCounts[item.post_id] =
        (commentCounts[item.post_id] || 0) + 1;
    });

    const myLikes = new Set(
      (myLikesResult.data || []).map(item => item.post_id)
    );

    container.innerHTML = state.posts.map(post => {
      const member = members.get(post.user_id) || {};
      const name = member.full_name || member.username || "عضو هنون";
      const avatar = avatarURL(member.avatar_path);
      const liked = myLikes.has(post.id);

      let mediaHTML = "";

      if (post.media_path) {
        const url = publicURL("post-media", post.media_path);

        mediaHTML = post.media_type === "video"
          ? `<video class="post-media feed-runtime-media" src="${escapeHTML(url)}" controls playsinline preload="metadata"></video>`
          : `<img class="post-media feed-runtime-media" src="${escapeHTML(url)}" alt="صورة المنشور" loading="lazy">`;
      }

      return `
        <article class="glass post-card feed-runtime-post"
          data-post-id="${escapeHTML(post.id)}">

          <div class="post-author feed-runtime-head">
            <img class="avatar feed-runtime-avatar"
              src="${escapeHTML(avatar || "https://placehold.co/90x90/242b45/ffffff?text=H")}"
              alt="">

            <div class="post-author-info feed-runtime-author">
              <strong>${escapeHTML(name)}</strong>
              <small>${escapeHTML(timeAgo(post.created_at))}</small>
            </div>
          </div>

          ${post.content
            ? `<div class="post-text feed-runtime-text">${escapeHTML(post.content)}</div>`
            : ""
          }

          ${mediaHTML}

          <div class="post-stats feed-runtime-stats">
            <span>${likeCounts[post.id] || 0} إعجاب</span>
            <span>${commentCounts[post.id] || 0} تعليق</span>
          </div>

          <div class="post-actions feed-runtime-actions">
            <button type="button"
              data-action="like"
              class="post-action ${liked ? "liked" : ""}">
              ${liked ? "أعجبك" : "إعجاب"}
            </button>

            <button type="button"
              data-action="comments"
              class="post-action">
              تعليق
            </button>

            <button type="button"
              data-action="share"
              class="post-action">
              مشاركة
            </button>
          </div>

          <div class="feed-runtime-comments"
            id="comments-${escapeHTML(post.id)}">

            <div class="feed-runtime-comments-list">
              جارٍ تحميل التعليقات...
            </div>

            <form class="feed-runtime-comment-form">
              <input type="text" maxlength="3000"
                placeholder="اكتب تعليقك..." required>
              <button type="submit">إرسال</button>
            </form>
          </div>
        </article>
      `;
    }).join("");
  }

  async function toggleLike(postId, button) {
    button.disabled = true;

    try {
      const { data: existing, error: findError } = await state.db
        .from("post_likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", state.user.id)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error } = await state.db
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", state.user.id);

        if (error) throw error;

      } else {
        const { error } = await state.db
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) throw error;
      }

      await loadPosts();

    } catch (error) {
      console.error("HANOON like:", error);
      notify("تعذر تحديث الإعجاب.", true);

    } finally {
      button.disabled = false;
    }
  }

  async function loadComments(postId) {
    const box = $(`#comments-${postId}`);
    if (!box) return;

    const list = $(".feed-runtime-comments-list", box);
    list.textContent = "جارٍ تحميل التعليقات...";

    try {
      const { data: comments, error } = await state.db
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
        const result = await state.db
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
          '<div class="feed-runtime-empty">لا توجد تعليقات بعد.</div>';
        return;
      }

      list.innerHTML = comments.map(comment => {
        const member = memberMap.get(comment.user_id) || {};

        return `
          <div class="feed-runtime-comment">
            <img src="${escapeHTML(
              avatarURL(member.avatar_path) ||
              "https://placehold.co/70x70/242b45/ffffff?text=H"
            )}" alt="">

            <div class="feed-runtime-comment-body">
              <strong>${escapeHTML(member.full_name || member.username || "عضو هنون")}</strong>
              ${escapeHTML(comment.body)}
            </div>
          </div>
        `;
      }).join("");

    } catch (error) {
      console.error("HANOON comments:", error);
      list.textContent = "تعذر تحميل التعليقات.";
    }
  }

  async function addComment(postId, form) {
    const input = $("input", form);
    const button = $("button", form);
    const body = input.value.trim();

    if (!body) return;

    button.disabled = true;

    try {
      const { error } = await state.db
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

      $(`#comments-${postId}`)?.classList.add("open");

    } catch (error) {
      console.error("HANOON add comment:", error);
      notify("تعذر إرسال التعليق.", true);

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
      } else {
        await navigator.clipboard.writeText(url.href);
        notify("تم نسخ رابط المنشور.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify("تعذرت المشاركة.", true);
      }
    }
  }

  function bindPosts() {
    const container = getPostsContainer();

    container.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const card = button.closest("[data-post-id]");
      if (!card) return;

      const postId = card.dataset.postId;

      if (button.dataset.action === "like") {
        await toggleLike(postId, button);
      }

      if (button.dataset.action === "comments") {
        const box = $(`#comments-${postId}`);

        box.classList.toggle("open");

        if (box.classList.contains("open")) {
          await loadComments(postId);
        }
      }

      if (button.dataset.action === "share") {
        await sharePost(postId);
      }
    });

    container.addEventListener("submit", async event => {
      const form = event.target.closest(".feed-runtime-comment-form");
      if (!form) return;

      event.preventDefault();

      const card = form.closest("[data-post-id]");
      if (!card) return;

      await addComment(card.dataset.postId, form);
    });
  }

  function bindComposer() {
    $("#openComposer")?.addEventListener("click", () => openModal("text"));
    $("#writePostButton")?.addEventListener("click", () => openModal("text"));
    $("#addPhotoButton")?.addEventListener("click", () => openModal("image"));
    $("#addVideoButton")?.addEventListener("click", () => openModal("video"));
  }

  function updateProfileUI() {
    const profile = state.profile || {};
    const name = profile.full_name || profile.username || "عضو هنون";
    const avatar = avatarURL(profile.avatar_path);

    $("#sideProfileName") && (
      $("#sideProfileName").textContent = name
    );

    $("#sideProfileUsername") && (
      $("#sideProfileUsername").textContent =
        profile.username ? `@${profile.username}` : "@hanoon_member"
    );

    const initial = name.trim().charAt(0) || "هـ";

    const composerAvatar = $("#composerAvatar");
    const sideAvatar = $("#sideProfileAvatar");
    const topInitial = $("#topProfileInitial");
    const topImage = $("#topProfileImage");

    if (composerAvatar) {
      composerAvatar.innerHTML = avatar
        ? `<img src="${escapeHTML(avatar)}" alt="">`
        : escapeHTML(initial);
    }

    if (sideAvatar) {
      sideAvatar.innerHTML = avatar
        ? `<img src="${escapeHTML(avatar)}" alt="">`
        : escapeHTML(initial);
    }

    if (topInitial) topInitial.textContent = initial;

    if (topImage && avatar) {
      topImage.src = avatar;
      topImage.hidden = false;
      if (topInitial) topInitial.hidden = true;
    }
  }

  function subscribeToPosts() {
    if (state.realtime) {
      state.db.removeChannel(state.realtime);
    }

    state.realtime = state.db
      .channel("hanoon-feed-live")
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
    addStyles();

    const container = getPostsContainer();

    container.innerHTML =
      '<div class="glass loading-state">جارٍ الاتصال بحسابك...</div>';

    const client = window.HANOON?.supabase;

    if (!client) {
      container.innerHTML = `
        <div class="glass feed-runtime-empty">
          تعذر الاتصال بقاعدة البيانات.
          <br>
          تأكد من تحميل supabase-client.js.
        </div>
      `;
      return;
    }

    state.db = client;

    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      container.innerHTML = `
        <div class="glass feed-runtime-empty">
          سجّل الدخول إلى هنون لمشاهدة المنشورات والتفاعل معها.
        </div>
      `;
      return;
    }

    state.user = data.session.user;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id,member_code,full_name,username,avatar_path")
      .eq("id", state.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    state.profile = profile;

    updateProfileUI();
    bindPosts();
    bindComposer();

    await loadPosts();
    subscribeToPosts();

    console.info("HANOON feed is ready.");
  }

  function start() {
    init().catch(error => {
      console.error("HANOON feed startup:", error);
      notify(error.message || "تعذر تشغيل صفحة المنشورات.", true);
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
