
import "./supabase-client.js";

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    profile: null,
    videos: [],
    busy: false
  };

  const ui = {
    feed: $("shortsFeed"),
    empty: $("shortsEmpty"),
    notice: $("shortNotice"),
    upload: $("uploadShortBtn"),
    input: $("shortFileInput")
  };

  function notify(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.style.display = "block";
    ui.notice.style.borderColor =
      type === "error" ? "#ff7898" : "#8c72f5";

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      ui.notice.style.display = "none";
    }, 4500);
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

  function videoURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage
      .from("post-media")
      .getPublicUrl(path).data.publicUrl;
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short"
    });
  }

  function icon(name) {
    const paths = {
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      comment: '<path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8.5 8.5 0 1 1 21 11.5Z"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 9 6.6 4.4"/>',
      volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>',
      play: '<path d="m8 5 12 7-12 7Z"/>'
    };

    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function showEmpty(message) {
    const box = document.createElement("div");
    box.className = "empty";
    box.textContent = message;
    ui.feed.replaceChildren(box);
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
  }

  async function loadVideos() {
    showEmpty("جارٍ تحميل الفيديوهات...");

    const { data, error } = await state.db
      .from("posts")
      .select("id,user_id,content,media_path,media_type,created_at")
      .eq("media_type", "video")
      .not("media_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw error;

    state.videos = data || [];

    if (!state.videos.length) {
      showEmpty("لا توجد فيديوهات قصيرة حتى الآن. كن أول من يشارك فيديو في هنون.");
      return;
    }

    await renderVideos();
  }

  async function getInteractions() {
    const ids = state.videos.map(video => video.id);
    const users = [...new Set(
      state.videos.map(video => video.user_id)
    )];

    if (!ids.length) {
      return {
        profiles: new Map(),
        likes: new Map(),
        myLikes: new Set()
      };
    }

    const results = await Promise.all([
      state.db
        .from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", users),

      state.db
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", ids),

      state.db
        .from("post_likes")
        .select("post_id")
        .eq("user_id", state.user.id)
        .in("post_id", ids)
    ]);

    const failed = results.find(result => result.error);
    if (failed) throw failed.error;

    const [profilesResult, likesResult, mineResult] = results;

    const profiles = new Map(
      (profilesResult.data || []).map(item => [item.id, item])
    );

    const likes = new Map();

    (likesResult.data || []).forEach(item => {
      likes.set(
        item.post_id,
        (likes.get(item.post_id) || 0) + 1
      );
    });

    const myLikes = new Set(
      (mineResult.data || []).map(item => item.post_id)
    );

    return { profiles, likes, myLikes };
  }

  function createAction(name, label, count, liked = false) {
    const wrap = document.createElement("div");
    wrap.className = "action-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${liked ? " liked" : ""}`;
    button.innerHTML = icon(name);
    button.setAttribute("aria-label", label);
    button.title = label;

    const small = document.createElement("small");
    small.textContent = count;

    wrap.append(button, small);

    return { wrap, button, small };
  }

  function buildVideo(video, data) {
    const profile = data.profiles.get(video.user_id) || {};
    const name = displayName(profile);

    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.videoId = video.id;

    const media = document.createElement("video");
    media.src = videoURL(video.media_path);
    media.controls = true;
    media.playsInline = true;
    media.preload = "metadata";
    media.loop = true;
    media.setAttribute("aria-label", "فيديو قصير");

    const shade = document.createElement("div");
    shade.className = "video-shade";

    const info = document.createElement("div");
    info.className = "video-info";

    const creator = document.createElement("div");
    creator.className = "creator";

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const avatarPath = avatarURL(profile.avatar_path);

    if (avatarPath) {
      const image = document.createElement("img");
      image.src = avatarPath;
      image.alt = name;
      image.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%";
      avatar.appendChild(image);
    } else {
      avatar.textContent = name.charAt(0);
    }

    const creatorName = document.createElement("div");
    creatorName.className = "creator-name";
    creatorName.textContent = name;

    creator.append(avatar, creatorName);

    const caption = document.createElement("p");
    caption.className = "caption";
    caption.textContent =
      video.content || "فيديو جديد من مجتمع هنون";

    const date = document.createElement("p");
    date.className = "caption";
    date.style.opacity = ".7";
    date.style.marginTop = "5px";
    date.textContent = formatDate(video.created_at);

    info.append(creator, caption, date);

    const actions = document.createElement("div");
    actions.className = "video-actions";

    const like = createAction(
      "heart",
      "إعجاب",
      data.likes.get(video.id) || 0,
      data.myLikes.has(video.id)
    );

    like.button.addEventListener("click", () => {
      toggleLike(video.id, like.button, like.small);
    });

    const comment = createAction("comment", "تعليق", "");
    comment.button.addEventListener("click", () => {
      addComment(video.id);
    });

    const share = createAction("share", "مشاركة", "");
    share.button.addEventListener("click", () => {
      shareVideo(video);
    });

    const sound = createAction("volume", "الصوت", "");
    sound.button.addEventListener("click", () => {
      media.muted = !media.muted;
      sound.button.innerHTML = media.muted
        ? icon("play")
        : icon("volume");
      sound.button.title = media.muted
        ? "تشغيل الصوت"
        : "كتم الصوت";
    });

    actions.append(
      like.wrap,
      comment.wrap,
      share.wrap,
      sound.wrap
    );

    card.append(media, shade, info, actions);

    return card;
  }

  async function renderVideos() {
    if (!state.videos.length) {
      showEmpty("لا توجد فيديوهات قصيرة حتى الآن.");
      return;
    }

    const data = await getInteractions();
    const fragment = document.createDocumentFragment();

    state.videos.forEach(video => {
      fragment.appendChild(buildVideo(video, data));
    });

    ui.feed.replaceChildren(fragment);

    const videos = [...ui.feed.querySelectorAll("video")];

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const video = entry.target;

          if (entry.isIntersecting) {
            videos.forEach(other => {
              if (other !== video) other.pause();
            });
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.65 });

      videos.forEach(video => observer.observe(video));
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
        counter.textContent = Math.max(
          0,
          Number(counter.textContent) - 1
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
        counter.textContent = Number(counter.textContent) + 1;
      }
    } catch (error) {
      console.error("HANOON Shorts like:", error);
      notify(error.message || "تعذر تسجيل الإعجاب.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function addComment(postId) {
    const body = prompt("اكتب تعليقك على الفيديو:");

    if (body === null) return;

    const content = body.trim();

    if (!content) {
      notify("اكتب التعليق أولاً.", "error");
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

      notify("تم إضافة تعليقك بنجاح.", "success");
    } catch (error) {
      console.error("HANOON Shorts comment:", error);
      notify(error.message || "تعذر إضافة التعليق.", "error");
    }
  }

  async function shareVideo(video) {
    const url = new URL(window.location.href);
    url.hash = `video-${video.id}`;

    const shareData = {
      title: "فيديو من هنون",
      text: video.content || "شاهد هذا الفيديو على هنون",
      url: url.toString()
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        notify("تم نسخ رابط الفيديو.", "success");
      } else {
        notify("المتصفح لا يدعم المشاركة أو النسخ.", "error");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify("تعذرت مشاركة الفيديو.", "error");
      }
    }
  }

  async function uploadVideo(file) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      notify("اختر ملف فيديو صالحًا.", "error");
      return;
    }

    if (!["video/mp4", "video/webm"].includes(file.type)) {
      notify("الصيغ المدعومة حاليًا MP4 وWebM.", "error");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      notify("الحد الأقصى لحجم الفيديو 50 ميجابايت.", "error");
      return;
    }

    if (state.busy) return;

    state.busy = true;
    ui.upload.disabled = true;
    ui.upload.textContent = "جارٍ الرفع...";

    let uploadedPath = null;

    try {
      const extension = file.type === "video/webm"
        ? "webm"
        : "mp4";

      const uniqueName = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const path = `${state.user.id}/${uniqueName}.${extension}`;

      const { data: uploaded, error: uploadError } =
        await state.db.storage
          .from("post-media")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600"
          });

      if (uploadError) throw uploadError;

      uploadedPath = uploaded.path;

      const caption = prompt("اكتب وصفًا للفيديو (اختياري):") || "";

      const { error: insertError } = await state.db
        .from("posts")
        .insert({
          user_id: state.user.id,
          content: caption.trim(),
          media_path: uploadedPath,
          media_type: "video"
        });

      if (insertError) throw insertError;

      notify("تم رفع الفيديو ونشره بنجاح.", "success");

      await loadVideos();

      window.dispatchEvent(
        new CustomEvent("hanoon:short-created")
      );

    } catch (error) {
      console.error("HANOON Shorts upload:", error);

      if (uploadedPath) {
        const { error: cleanupError } = await state.db.storage
          .from("post-media")
          .remove([uploadedPath]);

        if (cleanupError) {
          console.warn("Short video cleanup:", cleanupError);
        }
      }

      notify(
        error.message || "تعذر رفع الفيديو. حاول مرة أخرى.",
        "error"
      );
    } finally {
      state.busy = false;
      ui.upload.disabled = false;
      ui.upload.textContent = "＋ إضافة فيديو";
      ui.input.value = "";
    }
  }

  function bindEvents() {
    ui.upload.addEventListener("click", () => {
      ui.input.click();
    });

    ui.input.addEventListener("change", () => {
      uploadVideo(ui.input.files?.[0]);
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
        notify("سجل الدخول إلى هنون حتى تتمكن من مشاهدة الفيديوهات ورفعها.", "error");
        showEmpty("يجب تسجيل الدخول أولاً لمشاهدة الفيديوهات القصيرة.");
        return;
      }

      state.user = data.user;

      await loadProfile();
      bindEvents();
      await loadVideos();

    } catch (error) {
      console.error("HANOON Shorts:", error);
      notify(error.message || "تعذر تشغيل صفحة الفيديوهات.", "error");
      showEmpty("تعذر تحميل الفيديوهات. تحقق من الاتصال وحاول مرة أخرى.");
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
          "error"
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
