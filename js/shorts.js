
import "./supabase-client.js";

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    profile: null,
    videos: [],
    muted: true,
    activeIndex: -1,
    observer: null,
    playRequest: 0,
    feedType: "for-you",
    busy: false,
    loading: false,
    followingIds: new Set()
  };

  const ui = {
    feed: $("shortsFeed"),
    notice: $("shortNotice"),
    upload: $("uploadShortBtn"),
    input: $("shortFileInput"),
    tabs: [...document.querySelectorAll(".feed-tab")]
  };

  function notify(message, error = false) {
    ui.notice.textContent = message;
    ui.notice.style.display = "block";
    ui.notice.style.borderColor = error ? "#ff7898" : "#8c72f5";

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      ui.notice.style.display = "none";
    }, 3500);
  }

  function empty(message) {
    if (state.observer) state.observer.disconnect();

    stopAllVideos();

    const box = document.createElement("div");
    box.className = "empty";

    const title = document.createElement("strong");
    title.textContent = message;

    const description = document.createElement("small");
    description.textContent = state.feedType === "following"
      ? "تابع الأعضاء لتظهر فيديوهاتهم هنا."
      : "كن أول من يشارك فيديو في مجتمع هنون.";

    box.append(title, description);
    ui.feed.replaceChildren(box);
  }

  function displayName(profile) {
    return profile?.full_name ||
      profile?.username ||
      "عضو هنون";
  }

  function storageURL(bucket, path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage
      .from(bucket)
      .getPublicUrl(path).data?.publicUrl || "";
  }

  function videoURL(path) {
    return storageURL("post-media", path);
  }

  function avatarURL(path) {
    return storageURL("avatars", path);
  }

  function formatCount(value) {
    return new Intl.NumberFormat("ar-EG", {
      notation: value >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 1
    }).format(value || 0);
  }

  function icon(name) {
    const paths = {
      heart:
        '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      comment:
        '<path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8.5 8.5 0 1 1 21 11.5Z"/>',
      share:
        '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 9 6.6 4.4"/>',
      volume:
        '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>',
      muted:
        '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
      play:
        '<path d="m8 5 12 7-12 7Z"/>',
      pause:
        '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>'
    };

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        ${paths[name] || ""}
      </svg>
    `;
  }

  function stopAllVideos() {
    document.querySelectorAll("#shortsFeed video").forEach(video => {
      video.pause();
    });
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
      full_name: state.user.user_metadata?.full_name ||
        state.user.email?.split("@")[0] ||
        "عضو هنون"
    };
  }

  async function loadFollowingIds() {
    const { data, error } = await state.db
      .from("follows")
      .select("following_id")
      .eq("follower_id", state.user.id);

    if (error) throw error;

    state.followingIds = new Set(
      (data || []).map(item => item.following_id)
    );
  }

  async function loadVideos() {
    if (state.loading) return;
    state.loading = true;

    try {
      empty("جارٍ تحميل الفيديوهات...");

      if (state.feedType === "following") {
        await loadFollowingIds();

        if (!state.followingIds.size) {
          empty("لم تتابع أي أعضاء بعد");
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
        query = query.in(
          "user_id",
          [...state.followingIds]
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      state.videos = data || [];

      if (!state.videos.length) {
        empty(
          state.feedType === "following"
            ? "لا توجد فيديوهات جديدة من الأعضاء الذين تتابعهم"
            : "لا توجد فيديوهات قصيرة حتى الآن"
        );
        return;
      }

      await renderVideos();

    } finally {
      state.loading = false;
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

  function createAvatar(profile) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const url = avatarURL(profile?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(profile);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.textContent = displayName(profile).charAt(0);
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent = displayName(profile).charAt(0);
    }

    return avatar;
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

    like.button.addEventListener("click", () => {
      toggleLike(video.id, like.button, like.small);
    });

    const comment = createAction(
      "comment",
      "تعليق",
      formatCount(data.comments.get(video.id) || 0)
    );

    comment.button.addEventListener("click", () => {
      addComment(video.id, comment.small);
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
      state.muted = !state.muted;

      document.querySelectorAll("#shortsFeed video").forEach(item => {
        item.muted = state.muted;
      });

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

    card.append(media, shade, info, actions);

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

    if (video.readyState === 0) video.load();
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
        video.preload = Math.abs(i - index) === 1
          ? "metadata"
          : "none";
      }
    });

    current.muted = state.muted;

    prepareVideo(index);
    prepareVideo(index + 1);

    try {
      await current.play();

      if (
        request !== state.playRequest ||
        state.activeIndex !== index
      ) {
        current.pause();
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.warn("HANOON autoplay:", error);
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

        button.classList.remove("liked");
        counter.textContent = formatCount(
          Math.max(0, Number(counter.textContent.replace(/[^\d]/g, "")) - 1)
        );

      } else {
        const { error } = await state.db
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) throw error;

        button.classList.add("liked");
        counter.textContent = "تم";
      }

    } catch (error) {
      console.error(error);
      notify(error.message || "تعذر تسجيل الإعجاب.", true);
    } finally {
      button.disabled = false;
    }
  }

  async function addComment(postId, counter) {
    const body = prompt("اكتب تعليقك على الفيديو:");

    if (body === null) return;

    const content = body.trim();

    if (!content) {
      notify("اكتب التعليق أولاً.", true);
      return;
    }

    try {
      const { error } = await state.db
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: state.user.id,
          body: content
        });

      if (error) throw error;

      const current = Number(
        counter.textContent.replace(/[^\d]/g, "")
      );

      counter.textContent = formatCount(current + 1);
      notify("تم نشر تعليقك.");

    } catch (error) {
      console.error(error);
      notify(error.message || "تعذر إضافة التعليق.", true);
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
      } else {
        await navigator.clipboard.writeText(url.toString());
        notify("تم نسخ رابط الفيديو.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify("تعذرت مشاركة الفيديو.", true);
      }
    }
  }

  async function uploadVideo(file) {
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

      const caption = prompt("اكتب وصف الفيديو (اختياري):") || "";

      const { error: insertError } = await state.db
        .from("posts")
        .insert({
          user_id: state.user.id,
          content: caption.trim(),
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
        await state.db.storage
          .from("post-media")
          .remove([uploadedPath]);
      }

      notify(error.message || "تعذر رفع الفيديو.", true);

    } finally {
      state.busy = false;
      ui.upload.disabled = false;
      ui.upload.textContent = "إضافة فيديو";
      ui.input.value = "";
    }
  }

  function updateTabs() {
    ui.tabs.forEach(tab => {
      tab.classList.toggle(
        "active",
        (tab.dataset.feed === "following") ===
          (state.feedType === "following")
      );
    });
  }

  function bindEvents() {
    ui.upload.addEventListener("click", () => ui.input.click());

    ui.input.addEventListener("change", () => {
      uploadVideo(ui.input.files?.[0]);
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

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAllVideos();
      } else if (state.activeIndex >= 0) {
        activateVideo(state.activeIndex);
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
        ui.upload.disabled = true;
        empty("سجل الدخول أولاً لمشاهدة الفيديوهات");
        notify("يجب تسجيل الدخول لاستخدام الفيديوهات.", true);
        return;
      }

      state.user = data.user;

      await loadProfile();
      bindEvents();
      updateTabs();

      await loadVideos();

    } catch (error) {
      console.error("HANOON Shorts:", error);
      empty("تعذر تحميل الفيديوهات");
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
