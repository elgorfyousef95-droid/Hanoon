
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    profile: null,
    posts: [],
    selectedFile: null,
    previewURL: null,
    busy: false
  };

  const ui = {
    app: $("postsApp"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    form: $("postForm"),
    text: $("postText"),
    image: $("postImage"),
    video: $("postVideo"),
    preview: $("mediaPreview"),
    publish: $("publishPostBtn"),
    refresh: $("refreshPostsBtn"),
    list: $("postsList"),
    avatar: $("composerAvatar"),
    name: $("composerName")
  };

  function notify(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice visible ${type}`;

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      ui.notice.className = "notice";
    }, 4500);
  }

  function showEmpty(message) {
    const element = document.createElement("div");
    element.className = "empty-state";
    element.textContent = message;
    ui.list.replaceChildren(element);
  }

  function displayName(profile) {
    return profile?.full_name ||
      profile?.username ||
      "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage
      .from("avatars")
      .getPublicUrl(path).data.publicUrl;
  }

  function mediaURL(path) {
    if (!path) return "";

    return state.db.storage
      .from("post-media")
      .getPublicUrl(path).data.publicUrl;
  }

  function setAvatar(container, profile) {
    container.replaceChildren();

    const url = avatarURL(profile?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(profile);
      image.loading = "lazy";

      image.onerror = () => {
        container.replaceChildren();
        container.textContent =
          displayName(profile).charAt(0) || "هـ";
      };

      container.appendChild(image);
    } else {
      container.textContent =
        displayName(profile).charAt(0) || "هـ";
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function timeAgo(value) {
    const date = new Date(value);
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000)
    );

    if (!Number.isFinite(seconds)) return "";

    if (seconds < 60) return "الآن";
    if (seconds < 3600) {
      return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    }

    if (seconds < 86400) {
      return `منذ ${Math.floor(seconds / 3600)} ساعة`;
    }

    return formatDate(value);
  }

  function safeFileExtension(file) {
    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    return extension ||
      (file.type.startsWith("video/") ? "mp4" : "jpg");
  }

  function clearPreview() {
    if (state.previewURL) {
      URL.revokeObjectURL(state.previewURL);
      state.previewURL = null;
    }

    state.selectedFile = null;
    ui.image.value = "";
    ui.video.value = "";
    ui.preview.replaceChildren();
    ui.preview.classList.remove("visible");
  }

  function showPreview(file) {
    clearPreview();

    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      notify("نوع الملف غير مدعوم.", "error");
      return;
    }

    const maxSize = isVideo
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      notify(
        isVideo
          ? "حجم الفيديو أكبر من 50 ميجابايت."
          : "حجم الصورة أكبر من 10 ميجابايت.",
        "error"
      );

      return;
    }

    state.selectedFile = file;
    state.previewURL = URL.createObjectURL(file);

    const media = document.createElement(
      isVideo ? "video" : "img"
    );

    media.src = state.previewURL;

    if (isVideo) {
      media.controls = true;
      media.playsInline = true;
    } else {
      media.alt = "معاينة الصورة";
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "media-button";
    removeButton.textContent = "إزالة الملف";
    removeButton.addEventListener("click", clearPreview);

    ui.preview.append(media, removeButton);
    ui.preview.classList.add("visible");
  }

  async function loadProfile() {
    const { data, error } = await state.db
      .from("member_directory")
      .select("id,username,full_name,avatar_path")
      .eq("id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    state.profile = data || {
      id: state.user.id,
      full_name:
        state.user.user_metadata?.full_name ||
        state.user.email?.split("@")[0] ||
        "عضو هنون"
    };

    ui.name.textContent = displayName(state.profile);
    setAvatar(ui.avatar, state.profile);
  }

  async function uploadMedia(file) {
    const extension = safeFileExtension(file);

    const uniqueName =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path =
      `${state.user.id}/${uniqueName}.${extension}`;

    const { data, error } = await state.db.storage
      .from("post-media")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600"
      });

    if (error) throw error;

    return data.path;
  }

  async function publishPost(event) {
    event.preventDefault();

    if (state.busy) return;

    const content = ui.text.value.trim();
    const file = state.selectedFile;

    if (!content && !file) {
      notify("اكتب شيئًا أو أضف صورة أو فيديو أولاً.", "error");
      return;
    }

    state.busy = true;
    ui.publish.disabled = true;
    ui.publish.textContent = "جارٍ النشر...";

    let uploadedPath = null;

    try {
      let mediaType = null;

      if (file) {
        mediaType = file.type.startsWith("video/")
          ? "video"
          : "image";

        uploadedPath = await uploadMedia(file);
      }

      const { data, error } = await state.db
        .from("posts")
        .insert({
          user_id: state.user.id,
          content,
          media_path: uploadedPath,
          media_type: mediaType
        })
        .select("id,user_id,content,media_path,media_type,created_at")
        .single();

      if (error) throw error;

      ui.text.value = "";
      clearPreview();

      notify("تم نشر منشورك بنجاح.", "success");

      await loadPosts();

      window.dispatchEvent(
        new CustomEvent("hanoon:post-created", {
          detail: { post: data }
        })
      );

    } catch (error) {
      console.error("HANOON publish post:", error);

      if (uploadedPath) {
        const { error: removeError } = await state.db.storage
          .from("post-media")
          .remove([uploadedPath]);

        if (removeError) {
          console.warn("Uploaded file cleanup failed:", removeError);
        }
      }

      notify(
        error.message || "تعذر نشر المنشور. حاول مرة أخرى.",
        "error"
      );

    } finally {
      state.busy = false;
      ui.publish.disabled = false;
      ui.publish.textContent = "نشر المنشور";
    }
  }

  async function loadPosts() {
    if (state.busy && !state.posts.length) return;

    showEmpty("جارٍ تحميل المنشورات...");

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

      showEmpty(
        error.message || "تعذر تحميل المنشورات."
      );
    }
  }

  async function getPostData() {
    const postIds = state.posts.map(post => post.id);
    const userIds = [...new Set(
      state.posts.map(post => post.user_id)
    )];

    if (!postIds.length) {
      return {
        profiles: new Map(),
        likes: new Map(),
        comments: new Map(),
        myLikes: new Set()
      };
    }

    const results = await Promise.all([
      state.db
        .from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", userIds),

      state.db
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds),

      state.db
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      state.db
        .from("post_likes")
        .select("post_id")
        .eq("user_id", state.user.id)
        .in("post_id", postIds)
    ]);

    const failed = results.find(result => result.error);
    if (failed) throw failed.error;

    const [profilesResult, likesResult, commentsResult, myLikesResult] =
      results;

    const profiles = new Map(
      (profilesResult.data || []).map(item => [item.id, item])
    );

    const likes = new Map();
    const comments = new Map();

    (likesResult.data || []).forEach(item => {
      likes.set(
        item.post_id,
        (likes.get(item.post_id) || 0) + 1
      );
    });

    (commentsResult.data || []).forEach(item => {
      comments.set(
        item.post_id,
        (comments.get(item.post_id) || 0) + 1
      );
    });

    const myLikes = new Set(
      (myLikesResult.data || []).map(item => item.post_id)
    );

    return { profiles, likes, comments, myLikes };
  }

  async function renderPosts() {
    if (!state.posts.length) {
      showEmpty(
        "لا توجد منشورات حتى الآن. كن أول من يشارك شيئًا مع أصدقائك."
      );
      return;
    }

    const data = await getPostData();
    const fragment = document.createDocumentFragment();

    state.posts.forEach(post => {
      fragment.appendChild(
        buildPostCard(post, data)
      );
    });

    ui.list.replaceChildren(fragment);
  }

  function buildPostCard(post, data) {
    const profile = data.profiles.get(post.user_id) || {};
    const name = displayName(profile);
    const liked = data.myLikes.has(post.id);

    const card = document.createElement("article");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const header = document.createElement("div");
    header.className = "post-header";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    setAvatar(avatar, profile);

    const author = document.createElement("div");
    author.className = "post-author";

    const authorName = document.createElement("div");
    authorName.className = "author-name";
    authorName.textContent = name;

    const date = document.createElement("div");
    date.className = "post-date";
    date.textContent = timeAgo(post.created_at);

    author.append(authorName, date);
    header.append(avatar, author);
    card.appendChild(header);

    if (post.content) {
      const content = document.createElement("div");
      content.className = "post-content";
      content.textContent = post.content;
      card.appendChild(content);
    }

    if (post.media_path) {
      const url = mediaURL(post.media_path);

      if (post.media_type === "video") {
        const video = document.createElement("video");
        video.className = "post-media";
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        card.appendChild(video);
      } else {
        const image = document.createElement("img");
        image.className = "post-media";
        image.src = url;
        image.alt = "صورة المنشور";
        image.loading = "lazy";
        card.appendChild(image);
      }
    }

    const stats = document.createElement("div");
    stats.className = "post-stats";

    const likeCount = document.createElement("span");
    likeCount.className = "like-count";
    likeCount.textContent =
      `${data.likes.get(post.id) || 0} إعجاب`;

    const commentCount = document.createElement("span");
    commentCount.className = "comment-count";
    commentCount.textContent =
      `${data.comments.get(post.id) || 0} تعليق`;

    stats.append(likeCount, commentCount);
    card.appendChild(stats);

    const actions = document.createElement("div");
    actions.className = "post-actions";

    const likeButton = createActionButton(
      liked ? "أعجبك" : "إعجاب",
      "like",
      liked
    );

    const commentButton = createActionButton(
      "تعليق",
      "comment"
    );

    const shareButton = createActionButton(
      "مشاركة",
      "share"
    );

    actions.append(
      likeButton,
      commentButton,
      shareButton
    );

    card.appendChild(actions);

    const commentsPanel = document.createElement("div");
    commentsPanel.className = "comments-panel";

    const commentsList = document.createElement("div");
    commentsList.className = "comments-list";

    const commentForm = document.createElement("form");
    commentForm.className = "comment-form";

    const commentInput = document.createElement("input");
    commentInput.className = "comment-input";
    commentInput.type = "text";
    commentInput.maxLength = 3000;
    commentInput.placeholder = "اكتب تعليقك...";
    commentInput.required = true;

    const commentSubmit = document.createElement("button");
    commentSubmit.className = "comment-submit";
    commentSubmit.type = "submit";
    commentSubmit.textContent = "إرسال";

    commentForm.append(commentInput, commentSubmit);
    commentsPanel.append(commentsList, commentForm);
    card.appendChild(commentsPanel);

    likeButton.addEventListener("click", async () => {
      await toggleLike(
        post.id,
        likeButton,
        likeCount
      );
    });

    commentButton.addEventListener("click", async () => {
      const opening = !commentsPanel.classList.contains("open");

      commentsPanel.classList.toggle("open", opening);

      if (opening && !commentsPanel.dataset.loaded) {
        await loadComments(post.id, commentsList);
        commentsPanel.dataset.loaded = "true";
      }

      if (opening) commentInput.focus();
    });

    commentForm.addEventListener("submit", async event => {
      event.preventDefault();

      const body = commentInput.value.trim();
      if (!body) return;

      commentSubmit.disabled = true;

      try {
        const { error } = await state.db
          .from("post_comments")
          .insert({
            post_id: post.id,
            user_id: state.user.id,
            body
          });

        if (error) throw error;

        commentInput.value = "";

        await loadComments(post.id, commentsList);
        commentsPanel.dataset.loaded = "true";

        const count = Number(
          commentCount.textContent.match(/\d+/)?.[0] || 0
        );

        commentCount.textContent = `${count + 1} تعليق`;

        notify("تم إضافة تعليقك.", "success");

      } catch (error) {
        console.error("HANOON comment:", error);
        notify(error.message || "تعذر إرسال التعليق.", "error");

      } finally {
        commentSubmit.disabled = false;
      }
    });

    shareButton.addEventListener("click", async () => {
      await sharePost(post);
    });

    return card;
  }

  function createActionButton(label, action, active = false) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "post-action";
    button.dataset.action = action;
    button.textContent = label;

    if (active) button.classList.add("liked");

    return button;
  }

  async function toggleLike(postId, button, counter) {
    button.disabled = true;

    try {
      const { data: existing, error: findError } =
        await state.db
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

        button.classList.remove("liked");
        button.textContent = "إعجاب";

        const count = Math.max(
          0,
          Number(counter.textContent.match(/\d+/)?.[0] || 0) - 1
        );

        counter.textContent = `${count} إعجاب`;

      } else {
        const { error } = await state.db
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) throw error;

        button.classList.add("liked");
        button.textContent = "أعجبك";

        const count =
          Number(counter.textContent.match(/\d+/)?.[0] || 0) + 1;

        counter.textContent = `${count} إعجاب`;
      }

    } catch (error) {
      console.error("HANOON like:", error);
      notify(error.message || "تعذر تحديث الإعجاب.", "error");

    } finally {
      button.disabled = false;
    }
  }

  async function loadComments(postId, container) {
    container.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "جارٍ تحميل التعليقات...";
    container.appendChild(loading);

    try {
      const { data: comments, error } = await state.db
        .from("post_comments")
        .select("id,post_id,user_id,body,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      if (!comments?.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "لا توجد تعليقات حتى الآن.";
        container.replaceChildren(empty);
        return;
      }

      const userIds = [...new Set(
        comments.map(comment => comment.user_id)
      )];

      const { data: profiles, error: profilesError } =
        await state.db
          .from("member_directory")
          .select("id,username,full_name")
          .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profiles || []).map(profile => [profile.id, profile])
      );

      const fragment = document.createDocumentFragment();

      comments.forEach(comment => {
        const row = document.createElement("div");
        row.className = "comment-item";

        const author = document.createElement("div");
        author.className = "comment-author";
        author.textContent = displayName(
          profileMap.get(comment.user_id)
        );

        const body = document.createElement("div");
        body.textContent = comment.body;

        const date = document.createElement("div");
        date.className = "post-date";
        date.textContent = timeAgo(comment.created_at);

        row.append(author, body, date);
        fragment.appendChild(row);
      });

      container.replaceChildren(fragment);

    } catch (error) {
      console.error("HANOON comments:", error);

      const message = document.createElement("div");
      message.className = "empty-state";
      message.textContent = "تعذر تحميل التعليقات.";

      container.replaceChildren(message);
    }
  }

  async function sharePost(post) {
    const url = new URL(window.location.href);
    url.hash = `post-${post.id}`;

    const shareData = {
      title: "منشور من هنون",
      text: post.content || "شاهد هذا المنشور على هنون",
      url: url.toString()
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        notify("تم نسخ رابط المنشور.", "success");
      } else {
        notify("المتصفح لا يدعم مشاركة الرابط أو نسخه.", "error");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("HANOON share:", error);
        notify("تعذرت مشاركة المنشور.", "error");
      }
    }
  }

  function bindEvents() {
    ui.form.addEventListener("submit", publishPost);

    ui.image.addEventListener("change", () => {
      const file = ui.image.files?.[0];
      if (file) {
        ui.video.value = "";
        showPreview(file);
      }
    });

    ui.video.addEventListener("change", () => {
      const file = ui.video.files?.[0];
      if (file) {
        ui.image.value = "";
        showPreview(file);
      }
    });

    ui.refresh.addEventListener("click", async () => {
      ui.refresh.disabled = true;

      try {
        await loadPosts();
        notify("تم تحديث المنشورات.", "success");
      } finally {
        ui.refresh.disabled = false;
      }
    });

    window.addEventListener("beforeunload", () => {
      if (state.previewURL) {
        URL.revokeObjectURL(state.previewURL);
      }
    });
  }

  async function initialize() {
    try {
      state.db = window.HANOON?.supabase;

      if (!state.db) {
        throw new Error("اتصال قاعدة البيانات غير جاهز.");
      }

      const { data, error } = await state.db.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        ui.auth.classList.remove("hidden");
        ui.app.classList.add("hidden");
        return;
      }

      state.user = data.user;

      await loadProfile();

      ui.auth.classList.add("hidden");
      ui.app.classList.remove("hidden");

      bindEvents();

      await loadPosts();

    } catch (error) {
      console.error("HANOON posts:", error);

      ui.app.classList.add("hidden");
      ui.auth.classList.remove("hidden");

      ui.auth.textContent =
        error.message || "تعذر تشغيل صفحة المنشورات.";
    }
  }

  function startWhenReady() {
    if (window.HANOON?.supabase) {
      initialize();
      return;
    }

    window.addEventListener(
      "hanoon:supabase-ready",
      initialize,
      { once: true }
    );

    window.addEventListener(
      "hanoon:supabase-error",
      event => {
        ui.auth.classList.remove("hidden");
        ui.auth.textContent =
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات.";
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady, {
      once: true
    });
  } else {
    startWhenReady();
  }

})();
