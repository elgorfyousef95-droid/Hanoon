
import "./supabase-client.js";

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    videos: [],
    muted: false,
    activeIndex: -1,
    observer: null,
    playRequest: 0,
    feedType: "for-you",
    followingIds: new Set(),
    likeCounts: new Map(),
    commentCounts: new Map(),
    likedPosts: new Set(),
    busy: false,
    noticeTimer: null,
    dialogAction: null,
    currentCommentPost: null
  };

  const ui = {
    feed: $("shortsFeed"),
    notice: $("shortNotice"),
    upload: $("uploadShortBtn"),
    input: $("shortFileInput"),
    tabs: [...document.querySelectorAll(".feed-tab")],
    commentsSheet: $("commentsSheet"),
    commentsBackdrop: $("commentsBackdrop"),
    commentsList: $("commentsList"),
    commentsTitle: $("commentsTitle"),
    commentForm: $("commentForm"),
    commentInput: $("commentInput"),
    dialog: $("appDialog"),
    dialogTitle: $("dialogTitle"),
    dialogMessage: $("dialogMessage"),
    dialogCancel: $("dialogCancel"),
    dialogConfirm: $("dialogConfirm")
  };

  function notify(message, error = false) {
    ui.notice.textContent = message;
    ui.notice.style.borderColor = error ? "#fe2c55" : "#25f4ee";
    ui.notice.classList.add("show");

    clearTimeout(state.noticeTimer);

    state.noticeTimer = setTimeout(() => {
      ui.notice.classList.remove("show");
    }, 3200);
  }

  function formatCount(value) {
    return new Intl.NumberFormat("ar-EG", {
      notation: value >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 1
    }).format(value || 0);
  }

  function displayName(profile) {
    return profile?.full_name || profile?.username || "عضو هنون";
  }

  function icon(name) {
    const paths = {
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      comment: '<path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8.5 8.5 0 1 1 21 11.5Z"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 9 6.6 4.4"/>',
      volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>',
      muted: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
      play: '<path d="m8 5 12 7-12 7Z"/>',
      pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>'
    };

    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function storageURL(bucket, path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage.from(bucket).getPublicUrl(path).data?.publicUrl || "";
  }

  function videoURL(path) {
    return storageURL("post-media", path);
  }

  function avatarURL(path) {
    return storageURL("avatars", path);
  }

  function stopAllVideos() {
    document.querySelectorAll("#shortsFeed video").forEach(video => {
      video.pause();
    });
  }

  function showDialog({
    title = "هنون",
    message = "",
    confirmText = "حسنًا",
    cancelText = "إلغاء",
    showCancel = true,
    action = null,
    content = null
  } = {}) {
    ui.dialogTitle.textContent = title;
    ui.dialogMessage.replaceChildren();

    if (content) {
      ui.dialogMessage.append(content);
    } else {
      ui.dialogMessage.textContent = message;
    }

    ui.dialogConfirm.textContent = confirmText;
    ui.dialogCancel.textContent = cancelText;
    ui.dialogCancel.hidden = !showCancel;

    state.dialogAction = action;
    ui.dialog.classList.add("open");
  }

  function closeDialog() {
    ui.dialog.classList.remove("open");
    state.dialogAction = null;
  }

  function showEmpty(message, description = "") {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    stopAllVideos();

    const box = document.createElement("div");
    box.className = "empty";

    const mark = document.createElement("div");
    mark.className = "empty-mark";
    mark.innerHTML = icon("play");

    const title = document.createElement("strong");
    title.textContent = message;

    const small = document.createElement("small");
    small.textContent = description;

    box.append(mark, title, small);
    ui.feed.replaceChildren(box);
  }

  async function loadFollowingIds() {
    const { data, error } = await state.db
      .from("follows")
      .select("following_id")
      .eq("follower_id", state.user.id);

    if (error) throw error;

    state.followingIds = new Set(
      (data || []).map(row => row.following_id)
    );
  }

  async function loadVideos() {
    if (state.busy) return;

    state.busy = true;

    try {
      showEmpty("جارٍ تحميل الفيديوهات...", "لحظات ونبدأ المشاهدة");

      if (state.feedType === "following") {
        await loadFollowingIds();

        if (!state.followingIds.size) {
          showEmpty(
            "لا تتابع أي أعضاء بعد",
            "تابع الأعضاء لتظهر فيديوهاتهم هنا."
          );
          return;
        }
      }

      let query = state.db
        .from("posts")
        .select("id,user_id,content,media_path,media_type,created_at")
        .eq("media_type", "video")
        .not("media_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (state.feedType === "following") {
        query = query.in("user_id", [...state.followingIds]);
      }

      const { data, error } = await query;

      if (error) throw error;

      state.videos = data || [];

      if (!state.videos.length) {
        showEmpty(
          "لا توجد فيديوهات حاليًا",
          state.feedType === "following"
            ? "لا توجد فيديوهات من الأعضاء الذين تتابعهم."
            : "كن أول من يشارك فيديو في مجتمع هنون."
        );
        return;
      }

      await renderVideos();

    } catch (error) {
      console.error(error);
      showEmpty("تعذر تحميل الفيديوهات", "حاول مرة أخرى.");
      notify(error.message || "حدث خطأ أثناء تحميل الفيديوهات.", true);

    } finally {
      state.busy = false;
    }
  }

  async function getVideoData() {
    const ids = state.videos.map(video => video.id);
    const users = [...new Set(state.videos.map(video => video.user_id))];

    const result = {
      profiles: new Map(),
      likes: new Map(),
      comments: new Map(),
      myLikes: new Set()
    };

    if (!ids.length) return result;

    const responses = await Promise.all([
      state.db.from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", users),

      state.db.from("post_likes")
        .select("post_id,user_id")
        .in("post_id", ids),

      state.db.from("post_comments")
        .select("post_id")
        .in("post_id", ids),

      state.db.from("post_likes")
        .select("post_id")
        .eq("user_id", state.user.id)
        .in("post_id", ids)
    ]);

    const failed = responses.find(item => item.error);
    if (failed) throw failed.error;

    const [profiles, likes, comments, mine] = responses;

    (profiles.data || []).forEach(profile => {
      result.profiles.set(profile.id, profile);
    });

    (likes.data || []).forEach(item => {
      result.likes.set(
        item.post_id,
        (result.likes.get(item.post_id) || 0) + 1
      );
    });

    (comments.data || []).forEach(item => {
      result.comments.set(
        item.post_id,
        (result.comments.get(item.post_id) || 0) + 1
      );
    });

    (mine.data || []).forEach(item => {
      result.myLikes.add(item.post_id);
    });

    return result;
  }

  function createAction(name, label, count, liked = false) {
    const wrap = document.createElement("div");
    wrap.className = "action-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${liked ? " liked" : ""}`;
    button.innerHTML = icon(name);
    button.setAttribute("aria-label", label);

    const small = document.createElement("small");
    small.textContent = count;

    wrap.append(button, small);

    return { wrap, button, small };
  }

  function createAvatar(profile, className = "avatar") {
    const avatar = document.createElement("div");
    avatar.className = className;

    const url = avatarURL(profile?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(profile);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren(
          document.createTextNode(displayName(profile).charAt(0))
        );
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent = displayName(profile).charAt(0);
    }

    return avatar;
  }

  function createProgress(video) {
    const progress = document.createElement("div");
    progress.className = "video-progress";

    const fill = document.createElement("span");
    progress.appendChild(fill);

    video.addEventListener("timeupdate", () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;

      fill.style.width = `${(video.currentTime / video.duration) * 100}%`;
    });

    return progress;
  }

  function buildVideo(video, data) {
    const profile = data.profiles.get(video.user_id) || {};
    const name = displayName(profile);

    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.videoId = video.id;

    const media = document.createElement("video");
    media.src = videoURL(video.media_path);
    media.playsInline = true;
    media.preload = "none";
    media.loop = true;
    media.muted = state.muted;
    media.controls = false;
    media.setAttribute("playsinline", "");
    media.setAttribute("webkit-playsinline", "");

    media.addEventListener("click", () => {
      if (media.paused) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    });

    const shade = document.createElement("div");
    shade.className = "video-shade";

    const info = document.createElement("div");
    info.className = "video-info";

    const creator = document.createElement("div");
    creator.className = "creator";

    const creatorName = document.createElement("div");
    creatorName.className = "creator-name";
    creatorName.textContent = profile.username
      ? `${name}  @${profile.username}`
      : name;

    creator.append(createAvatar(profile), creatorName);

    const caption = document.createElement("p");
    caption.className = "caption";
    caption.textContent = video.content || "فيديو جديد من هنون";

    info.append(creator, caption);

    const actions = document.createElement("div");
    actions.className = "video-actions";

    const like = createAction(
      "heart",
      "إعجاب",
      formatCount(data.likes.get(video.id) || 0),
      data.myLikes.has(video.id)
    );

    state.likeCounts.set(video.id, data.likes.get(video.id) || 0);

    if (data.myLikes.has(video.id)) {
      state.likedPosts.add(video.id);
    }

    like.button.addEventListener("click", () => {
      toggleLike(video.id, like.button, like.small);
    });

    const comment = createAction(
      "comment",
      "التعليقات",
      formatCount(data.comments.get(video.id) || 0)
    );

    state.commentCounts.set(video.id, data.comments.get(video.id) || 0);

    comment.button.addEventListener("click", () => {
      openComments(video.id, comment.small);
    });

    const share = createAction("share", "مشاركة", "");

    share.button.addEventListener("click", () => {
      shareVideo(video);
    });

    const sound = createAction(
      state.muted ? "muted" : "volume",
      "الصوت",
      ""
    );

    sound.button.addEventListener("click", () => {
      setMuted(!state.muted);
      sound.button.innerHTML = icon(state.muted ? "muted" : "volume");
    });

    const play = createAction("pause", "تشغيل أو إيقاف", "");

    play.button.addEventListener("click", () => {
      if (media.paused) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    });

    media.addEventListener("play", () => {
      play.button.innerHTML = icon("pause");
    });

    media.addEventListener("pause", () => {
      play.button.innerHTML = icon("play");
    });

    actions.append(
      like.wrap,
      comment.wrap,
      share.wrap,
      sound.wrap,
      play.wrap
    );

    card.append(
      media,
      shade,
      info,
      actions,
      createProgress(media)
    );

    return card;
  }

  function getVideos() {
    return [...ui.feed.querySelectorAll(".video-card video")];
  }

  function prepareVideo(index) {
    const videos = getVideos();
    const video = videos[index];

    if (!video) return;

    video.preload = "auto";

    if (video.readyState === 0) {
      video.load();
    }
  }

  function setMuted(muted) {
    state.muted = muted;

    getVideos().forEach(video => {
      video.muted = muted;
    });

    document.querySelectorAll(".video-actions .action").forEach(button => {
      if (button.getAttribute("aria-label") === "الصوت") {
        button.innerHTML = icon(muted ? "muted" : "volume");
      }
    });

    if (!muted) {
      const active = getVideos()[state.activeIndex];
      if (active) active.play().catch(() => {});
    }
  }

  async function activateVideo(index) {
    const videos = getVideos();
    const current = videos[index];

    if (!current) return;

    const request = ++state.playRequest;
    state.activeIndex = index;

    videos.forEach((video, i) => {
      if (i !== index) {
        video.pause();
        video.preload = Math.abs(i - index) === 1 ? "metadata" : "none";
      }
    });

    current.muted = state.muted;

    prepareVideo(index);
    prepareVideo(index + 1);

    try {
      await current.play();

      if (request !== state.playRequest || state.activeIndex !== index) {
        current.pause();
      }

    } catch (error) {
      if (request !== state.playRequest) return;

      /*
       * بعض المتصفحات تمنع التشغيل التلقائي بالصوت.
       * نحاول تشغيل الفيديو صامتًا بدل توقفه تمامًا.
       */
      if (!state.muted) {
        state.muted = true;
        current.muted = true;

        try {
          await current.play();
          notify("اضغط زر الصوت لتشغيل صوت الفيديو.");
        } catch (fallbackError) {
          console.warn("تعذر التشغيل التلقائي:", fallbackError);
        }
      } else if (error.name !== "AbortError") {
        console.warn("تعذر تشغيل الفيديو:", error);
      }
    }
  }

  async function renderVideos() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    stopAllVideos();

    const data = await getVideoData();
    const fragment = document.createDocumentFragment();

    state.likeCounts.clear();
    state.commentCounts.clear();
    state.likedPosts.clear();

    state.videos.forEach(video => {
      fragment.appendChild(buildVideo(video, data));
    });

    ui.feed.replaceChildren(fragment);

    const cards = [...ui.feed.querySelectorAll(".video-card")];

    if (!cards.length) return;

    state.activeIndex = -1;

    if ("IntersectionObserver" in window) {
      state.observer = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const index = cards.indexOf(visible[0].target);

        if (index !== -1 && visible[0].intersectionRatio >= 0.6) {
          activateVideo(index);
        }
      }, {
        root: ui.feed,
        threshold: [0.2, 0.4, 0.6, 0.8, 0.95]
      });

      cards.forEach(card => state.observer.observe(card));
      prepareVideo(0);
      activateVideo(0);

    } else {
      prepareVideo(0);
      activateVideo(0);
    }
  }

  async function toggleLike(postId, button, counter) {
    button.disabled = true;

    const wasLiked = state.likedPosts.has(postId);
    const oldCount = state.likeCounts.get(postId) || 0;

    try {
      if (wasLiked) {
        const { error } = await state.db
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", state.user.id);

        if (error) throw error;

        state.likedPosts.delete(postId);
        state.likeCounts.set(postId, Math.max(0, oldCount - 1));
        button.classList.remove("liked");

      } else {
        const { error } = await state.db
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) throw error;

        state.likedPosts.add(postId);
        state.likeCounts.set(postId, oldCount + 1);
        button.classList.add("liked");
      }

      counter.textContent = formatCount(state.likeCounts.get(postId));

    } catch (error) {
      console.error(error);
      notify(error.message || "تعذر تسجيل الإعجاب.", true);

    } finally {
      button.disabled = false;
    }
  }

  function closeComments() {
    ui.commentsSheet.classList.remove("open");
    ui.commentsBackdrop.classList.remove("open");
    state.currentCommentPost = null;
  }

  async function openComments(postId, counter) {
    state.currentCommentPost = postId;
    ui.commentsTitle.textContent =
      `التعليقات · ${formatCount(state.commentCounts.get(postId) || 0)}`;

    ui.commentsList.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "comment-text";
    loading.textContent = "جارٍ تحميل التعليقات...";
    ui.commentsList.appendChild(loading);

    ui.commentsBackdrop.classList.add("open");
    ui.commentsSheet.classList.add("open");

    try {
      const { data: comments, error } = await state.db
        .from("post_comments")
        .select("id,user_id,body,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      const userIds = [...new Set((comments || []).map(item => item.user_id))];

      let profiles = [];

      if (userIds.length) {
        const result = await state.db
          .from("member_directory")
          .select("id,username,full_name,avatar_path")
          .in("id", userIds);

        if (result.error) throw result.error;
        profiles = result.data || [];
      }

      const profileMap = new Map(profiles.map(item => [item.id, item]));

      ui.commentsList.replaceChildren();

      if (!comments?.length) {
        const empty = document.createElement("div");
        empty.className = "comment-text";
        empty.textContent = "لا توجد تعليقات حتى الآن. كن أول من يعلّق.";
        ui.commentsList.appendChild(empty);
      } else {
        comments.forEach(item => {
          const profile = profileMap.get(item.user_id) || {};

          const row = document.createElement("div");
          row.className = "comment-item";

          const avatar = document.createElement("div");
          avatar.className = "comment-avatar";

          const avatarUrl = avatarURL(profile.avatar_path);

          if (avatarUrl) {
            const image = document.createElement("img");
            image.src = avatarUrl;
            image.alt = displayName(profile);
            avatar.appendChild(image);
          } else {
            avatar.textContent = displayName(profile).charAt(0);
          }

          const body = document.createElement("div");
          body.className = "comment-body";

          const user = document.createElement("div");
          user.className = "comment-user";
          user.textContent = displayName(profile);

          const text = document.createElement("div");
          text.className = "comment-text";
          text.textContent = item.body;

          body.append(user, text);
          row.append(avatar, body);
          ui.commentsList.appendChild(row);
        });
      }

      ui.commentsTitle.textContent =
        `التعليقات · ${formatCount(comments?.length || 0)}`;

      state.commentCounts.set(postId, comments?.length || 0);
      counter.textContent = formatCount(comments?.length || 0);

    } catch (error) {
      console.error(error);
      ui.commentsList.replaceChildren();

      const message = document.createElement("div");
      message.className = "comment-text";
      message.textContent = "تعذر تحميل التعليقات. حاول مرة أخرى.";
      ui.commentsList.appendChild(message);

      notify(error.message || "تعذر تحميل التعليقات.", true);
    }
  }

  async function submitComment(event) {
    event.preventDefault();

    const postId = state.currentCommentPost;
    const body = ui.commentInput.value.trim();

    if (!postId || !body) return;

    const sendButton = ui.commentForm.querySelector("button");
    sendButton.disabled = true;

    try {
      const { error } = await state.db
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: state.user.id,
          body
        });

      if (error) throw error;

      ui.commentInput.value = "";

      const newCount = (state.commentCounts.get(postId) || 0) + 1;
      state.commentCounts.set(postId, newCount);

      const card = ui.feed.querySelector(`[data-video-id="${CSS.escape(postId)}"]`);
      const commentCounter = card?.querySelector(
        '.video-actions .action-wrap:nth-child(2) small'
      );

      if (commentCounter) {
        commentCounter.textContent = formatCount(newCount);
      }

      await openComments(postId, {
        set textContent(value) {
          if (commentCounter) commentCounter.textContent = value;
        }
      });

      notify("تم نشر تعليقك.");

    } catch (error) {
      console.error(error);
      notify(error.message || "تعذر نشر التعليق.", true);

    } finally {
      sendButton.disabled = false;
    }
  }

  async function shareVideo(video) {
    const url = new URL(location.href);
    url.hash = `video-${video.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "فيديو من هنون",
          text: video.content || "شاهد هذا الفيديو على هنون",
          url: url.toString()
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
        notify("تم نسخ رابط الفيديو.");
      } else {
        showDialog({
          title: "مشاركة الفيديو",
          message: url.toString(),
          showCancel: false
        });
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify("تعذرت مشاركة الفيديو.", true);
      }
    }
  }

  function openCaptionDialog(file) {
    const wrapper = document.createElement("div");
    wrapper.style.textAlign = "right";

    const label = document.createElement("label");
    label.textContent = "وصف الفيديو";
    label.style.display = "block";
    label.style.marginBottom = "8px";
    label.style.fontSize = "12px";

    const textarea = document.createElement("textarea");
    textarea.maxLength = 2000;
    textarea.placeholder = "اكتب وصفًا للفيديو...";
    textarea.style.cssText = [
      "width:100%",
      "min-height:100px",
      "resize:vertical",
      "padding:12px",
      "border:1px solid #ffffff25",
      "border-radius:12px",
      "background:#292929",
      "color:white",
      "outline:none",
      "font:inherit",
      "font-size:12px"
    ].join(";");

    wrapper.append(label, textarea);

    showDialog({
      title: "نشر فيديو جديد",
      confirmText: "نشر الفيديو",
      content: wrapper,
      action: async () => {
        const caption = textarea.value.trim();
        closeDialog();
        await uploadVideo(file, caption);
      }
    });

    textarea.focus();
  }

  async function uploadVideo(file, caption = "") {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      notify("اختر ملف فيديو صالحًا.", true);
      return;
    }

    if (!["video/mp4", "video/webm"].includes(file.type)) {
      notify("الصيغ المدعومة حاليًا MP4 وWebM.", true);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      notify("الحد الأقصى لحجم الفيديو 50 ميجابايت.", true);
      return;
    }

    if (state.busy) return;

    state.busy = true;
    ui.upload.disabled = true;
    ui.upload.textContent = "جارٍ الرفع...";

    let uploadedPath = null;

    try {
      const extension = file.type === "video/webm" ? "webm" : "mp4";
      const fileId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const path = `${state.user.id}/${fileId}.${extension}`;

      const { data: uploaded, error: uploadError } = await state.db
        .storage
        .from("post-media")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600"
        });

      if (uploadError) throw uploadError;

      uploadedPath = uploaded.path;

      const { error: insertError } = await state.db
        .from("posts")
        .insert({
          user_id: state.user.id,
          content: caption,
          media_path: uploadedPath,
          media_type: "video"
        });

      if (insertError) throw insertError;

      notify("تم نشر الفيديو بنجاح.");

      state.feedType = "for-you";
      updateTabs();
      await loadVideos();

    } catch (error) {
      console.error(error);

      if (uploadedPath) {
        const { error: removeError } = await state.db.storage
          .from("post-media")
          .remove([uploadedPath]);

        if (removeError) {
          console.error("تعذر حذف الملف بعد فشل النشر:", removeError);
        }
      }

      notify(error.message || "تعذر رفع الفيديو.", true);

    } finally {
      state.busy = false;
      ui.upload.disabled = false;
      ui.upload.textContent = "＋ إضافة فيديو";
      ui.input.value = "";
    }
  }

  function updateTabs() {
    ui.tabs.forEach(tab => {
      tab.classList.toggle(
        "active",
        tab.dataset.feed === state.feedType
      );
    });
  }

  function bindEvents() {
    ui.upload.addEventListener("click", () => ui.input.click());

    const bottomUpload = $("bottomUploadBtn");
    bottomUpload?.addEventListener("click", () => ui.input.click());

    ui.input.addEventListener("change", () => {
      const file = ui.input.files?.[0];
      if (file) openCaptionDialog(file);
    });

    ui.tabs.forEach(tab => {
      tab.addEventListener("click", async () => {
        const type = tab.dataset.feed;

        if (!["for-you", "following"].includes(type)) return;
        if (state.feedType === type) return;

        state.feedType = type;
        updateTabs();
        ui.feed.scrollTop = 0;

        await loadVideos();
      });
    });

    ui.commentForm.addEventListener("submit", submitComment);

    ui.commentsBackdrop.addEventListener("click", closeComments);
    $("closeCommentsBtn")?.addEventListener("click", closeComments);

    ui.dialogCancel.addEventListener("click", closeDialog);

    ui.dialog.addEventListener("click", event => {
      if (event.target === ui.dialog) closeDialog();
    });

    ui.dialogConfirm.addEventListener("click", async () => {
      const action = state.dialogAction;

      if (action) {
        ui.dialogConfirm.disabled = true;

        try {
          await action();
        } finally {
          ui.dialogConfirm.disabled = false;
        }
      } else {
        closeDialog();
      }
    });

    $("shortSearchBtn")?.addEventListener("click", () => {
      location.href = "search.html";
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAllVideos();
      } else if (state.activeIndex >= 0) {
        activateVideo(state.activeIndex);
      }
    });

    /*
     * أول تفاعل من المستخدم يساعد المتصفح على السماح بالصوت.
     */
    document.addEventListener("pointerdown", () => {
      const active = getVideos()[state.activeIndex];

      if (active && state.muted) {
        // لا نفتح الصوت قسرًا؛ المستخدم يختار زر الصوت.
        active.play().catch(() => {});
      }
    }, { once: true });
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
        ui.upload.disabled = true;

        showEmpty(
          "سجل الدخول أولًا",
          "سجل الدخول إلى حسابك لمشاهدة فيديوهات هنون."
        );

        notify("يجب تسجيل الدخول لاستخدام الفيديوهات.", true);
        return;
      }

      state.user = data.user;

      bindEvents();
      updateTabs();

      await loadVideos();

    } catch (error) {
      console.error("HANOON Shorts:", error);

      showEmpty("تعذر تحميل الفيديوهات", "تحقق من اتصالك وحاول مرة أخرى.");
      notify(error.message || "حدث خطأ أثناء تشغيل الصفحة.", true);
    }
  }

  function start() {
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
        notify(
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات.",
          true
        );
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
