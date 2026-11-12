
(() => {
  "use strict";

  const STYLE_ID = "hanoon-home-feed-styles";
  const BUCKET = "post-media";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const PAGE_SIZE = 30;

  let supabase = null;
  let currentUser = null;
  let currentProfile = null;
  let selectedFile = null;
  let feedRoot = null;
  let composerPreviewUrl = null;
  let loading = false;

  const icons = {
    image: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
    video: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>`,
    like: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm0 0 4-8c2 0 3 2 2 4l-1 4h7a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
    more: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>`,
    close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>`,
    send: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`
  };

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hf-section {
        width:min(920px,94%);
        margin:0 auto;
        padding:55px 0 75px;
        direction:rtl;
      }
      .hf-heading {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        margin-bottom:22px;
      }
      .hf-heading h2 {
        margin:0;
        color:var(--text-primary,#fff);
        font-size:clamp(23px,4vw,31px);
        font-weight:900;
      }
      .hf-heading p {
        margin:7px 0 0;
        color:var(--text-muted,#aaa);
        font-size:12px;
      }
      .hf-card {
        margin-bottom:18px;
        overflow:hidden;
        border:1px solid rgba(216,181,109,.2);
        border-radius:22px;
        background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));
        box-shadow:0 16px 45px rgba(0,0,0,.16);
        backdrop-filter:blur(18px);
        -webkit-backdrop-filter:blur(18px);
      }
      .hf-composer {
        padding:19px;
      }
      .hf-composer-top {
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:15px;
      }
      .hf-avatar {
        width:46px;
        height:46px;
        flex:0 0 46px;
        display:grid;
        place-items:center;
        overflow:hidden;
        border-radius:50%;
        color:#171421;
        background:linear-gradient(135deg,#f1d99c,#9b75e8);
        border:2px solid rgba(216,181,109,.5);
        font-size:17px;
        font-weight:900;
      }
      .hf-avatar img {
        width:100%;
        height:100%;
        object-fit:cover;
      }
      .hf-user-name {
        display:block;
        color:var(--text-primary,#fff);
        font-size:13px;
        font-weight:900;
      }
      .hf-user-sub {
        display:block;
        margin-top:3px;
        color:var(--text-muted,#aaa);
        font-size:10px;
      }
      .hf-compose-input {
        width:100%;
        min-height:105px;
        resize:vertical;
        padding:15px;
        color:var(--text-primary,#fff);
        background:rgba(0,0,0,.15);
        border:1px solid rgba(255,255,255,.1);
        border-radius:16px;
        outline:none;
        font:inherit;
        font-size:14px;
        line-height:1.9;
      }
      .hf-compose-input:focus {
        border-color:rgba(216,181,109,.65);
        box-shadow:0 0 0 3px rgba(216,181,109,.08);
      }
      .hf-compose-input::placeholder {
        color:var(--text-muted,#aaa);
      }
      .hf-preview {
        position:relative;
        display:none;
        margin-top:13px;
        overflow:hidden;
        border-radius:15px;
        background:#080d1b;
      }
      .hf-preview.is-visible {display:block}
      .hf-preview img,.hf-preview video {
        display:block;
        width:100%;
        max-height:390px;
        object-fit:contain;
      }
      .hf-preview-remove {
        position:absolute;
        top:10px;
        left:10px;
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:white;
        background:rgba(0,0,0,.72);
        border:1px solid rgba(255,255,255,.2);
        border-radius:50%;
        cursor:pointer;
      }
      .hf-preview-remove svg {
        width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;
      }
      .hf-compose-actions {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-top:14px;
        padding-top:13px;
        border-top:1px solid rgba(255,255,255,.08);
      }
      .hf-media-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .hf-tool-btn,.hf-publish-btn {
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:8px 13px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:12px;
        color:var(--text-primary,#fff);
        background:rgba(255,255,255,.055);
        font:inherit;
        font-size:11px;
        font-weight:800;
        cursor:pointer;
      }
      .hf-tool-btn:hover {
        border-color:rgba(216,181,109,.6);
        color:#f1d99c;
      }
      .hf-tool-btn svg,.hf-publish-btn svg {
        width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;
      }
      .hf-publish-btn {
        min-width:105px;
        color:#171421;
        background:linear-gradient(135deg,#f1d99c,#d5a84e);
        border-color:transparent;
      }
      .hf-publish-btn:disabled {
        opacity:.55;
        cursor:wait;
      }
      .hf-status {
        display:none;
        margin-top:12px;
        padding:10px 12px;
        border-radius:10px;
        color:#f1d99c;
        background:rgba(216,181,109,.08);
        font-size:11px;
        line-height:1.8;
      }
      .hf-status.is-visible {display:block}
      .hf-status.is-error {
        color:#ff9ba9;
        background:rgba(255,80,110,.08);
      }
      .hf-feed-list {min-height:80px}
      .hf-post {
        padding:18px;
      }
      .hf-post-head {
        display:flex;
        align-items:center;
        gap:11px;
      }
      .hf-post-author {
        min-width:0;
        flex:1;
        text-decoration:none;
      }
      .hf-post-author strong {
        display:block;
        overflow:hidden;
        color:var(--text-primary,#fff);
        font-size:13px;
        font-weight:900;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .hf-post-author small {
        display:block;
        margin-top:4px;
        color:var(--text-muted,#aaa);
        font-size:10px;
      }
      .hf-post-menu {
        width:36px;height:36px;
        display:grid;place-items:center;
        color:var(--text-muted,#aaa);
        background:transparent;
        border:0;
        border-radius:50%;
        cursor:pointer;
      }
      .hf-post-menu svg {width:20px;height:20px;fill:currentColor}
      .hf-post-menu:hover {background:rgba(255,255,255,.08)}
      .hf-post-text {
        margin:17px 0;
        color:var(--text-primary,#fff);
        font-size:14px;
        line-height:2;
        overflow-wrap:anywhere;
        white-space:pre-wrap;
      }
      .hf-post-media {
        display:block;
        width:calc(100% + 36px);
        max-height:520px;
        margin:0 -18px;
        object-fit:contain;
        background:rgba(0,0,0,.28);
      }
      video.hf-post-media {max-height:520px}
      .hf-post-stats {
        display:flex;
        justify-content:space-between;
        gap:12px;
        padding:13px 2px;
        color:var(--text-muted,#aaa);
        font-size:11px;
      }
      .hf-post-actions {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
        padding-top:10px;
        border-top:1px solid rgba(255,255,255,.09);
      }
      .hf-action {
        min-height:42px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        color:var(--text-muted,#bbb);
        background:transparent;
        border:0;
        border-radius:11px;
        font:inherit;
        font-size:11px;
        font-weight:800;
        cursor:pointer;
      }
      .hf-action:hover {background:rgba(255,255,255,.06);color:#f1d99c}
      .hf-action.is-liked {color:#f1bd77}
      .hf-action svg {
        width:18px;height:18px;
        fill:none;stroke:currentColor;stroke-width:1.8;
        stroke-linecap:round;stroke-linejoin:round;
      }
      .hf-comments {
        display:none;
        margin-top:13px;
        padding-top:13px;
        border-top:1px solid rgba(255,255,255,.08);
      }
      .hf-comments.is-open {display:block}
      .hf-comment-list {
        display:flex;
        flex-direction:column;
        gap:12px;
        margin-bottom:13px;
      }
      .hf-comment {
        display:flex;
        align-items:flex-start;
        gap:9px;
      }
      .hf-comment .hf-avatar {
        width:32px;height:32px;flex-basis:32px;font-size:12px;
      }
      .hf-comment-body {
        min-width:0;
        padding:9px 12px;
        border-radius:13px;
        background:rgba(255,255,255,.055);
      }
      .hf-comment-body strong {
        display:block;
        color:var(--text-primary,#fff);
        font-size:11px;
      }
      .hf-comment-body p {
        margin:4px 0 0;
        color:var(--text-secondary,#ddd);
        font-size:12px;
        line-height:1.8;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }
      .hf-comment-form {
        display:flex;
        align-items:center;
        gap:8px;
      }
      .hf-comment-input {
        min-width:0;
        flex:1;
        min-height:42px;
        padding:9px 13px;
        color:var(--text-primary,#fff);
        background:rgba(0,0,0,.16);
        border:1px solid rgba(255,255,255,.1);
        border-radius:13px;
        outline:none;
        font:inherit;
        font-size:12px;
      }
      .hf-comment-send {
        width:42px;height:42px;
        display:grid;place-items:center;
        color:#171421;
        background:#e5c57e;
        border:0;border-radius:13px;
        cursor:pointer;
      }
      .hf-comment-send svg {width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .hf-empty,.hf-loading,.hf-login-note {
        padding:28px 18px;
        text-align:center;
        color:var(--text-muted,#aaa);
        font-size:12px;
        line-height:1.9;
      }
      .hf-login-note a {
        color:#f1d99c;
        font-weight:900;
        text-decoration:none;
      }
      .hf-feed-error {color:#ff9ba9}
      .hf-hidden-file {display:none!important}
      @media(max-width:600px) {
        .hf-section {width:94%;padding:35px 0 50px}
        .hf-card {border-radius:18px}
        .hf-composer,.hf-post {padding:14px}
        .hf-post-media {width:calc(100% + 28px);margin:0 -14px}
        .hf-compose-actions {align-items:stretch;flex-direction:column}
        .hf-media-actions {width:100%}
        .hf-tool-btn {flex:1}
        .hf-publish-btn {width:100%}
        .hf-post-text {font-size:13px}
      }
    `;
    document.head.appendChild(style);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setStatus(node, message, isError = false) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-visible", Boolean(message));
    node.classList.toggle("is-error", Boolean(isError));
  }

  function getName(profile, user) {
    return profile?.full_name ||
      profile?.username ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "عضو هنون";
  }

  function getAvatarUrl(path) {
    if (!path || !supabase) return "";
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data?.publicUrl || "";
  }

  function makeAvatar(name, url, className = "hf-avatar") {
    const avatar = element("div", className);
    avatar.textContent = (name || "م").trim().charAt(0) || "م";

    if (url) {
      const image = document.createElement("img");
      image.alt = name || "صورة العضو";
      image.src = url;
      image.onload = () => {
        avatar.textContent = "";
        avatar.appendChild(image);
      };
    }
    return avatar;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  async function getProfileMap(userIds) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();

    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,username,avatar_path")
      .in("id", ids);

    if (error) throw error;

    return new Map((data || []).map(profile => [profile.id, profile]));
  }

  function buildComposer() {
    const card = element("section", "hf-card hf-composer");
    card.setAttribute("aria-label", "إنشاء منشور");

    const top = element("div", "hf-composer-top");
    top.appendChild(makeAvatar(
      getName(currentProfile, currentUser),
      getAvatarUrl(currentProfile?.avatar_path)
    ));

    const userBox = element("div");
    userBox.appendChild(element("strong", "hf-user-name", getName(currentProfile, currentUser)));
    userBox.appendChild(element("small", "hf-user-sub", "شارك فكرة أو صورة أو فيديو"));
    top.appendChild(userBox);

    const textarea = element("textarea", "hf-compose-input");
    textarea.placeholder = "بماذا تفكر؟ شارك مجتمع هنون...";
    textarea.maxLength = 10000;
    textarea.setAttribute("aria-label", "محتوى المنشور");

    const preview = element("div", "hf-preview");
    const previewContent = element("div");
    preview.appendChild(previewContent);

    const removePreview = element("button", "hf-preview-remove");
    removePreview.type = "button";
    removePreview.setAttribute("aria-label", "إزالة الوسائط");
    removePreview.innerHTML = icons.close;
    preview.appendChild(removePreview);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
    fileInput.className = "hf-hidden-file";
    fileInput.setAttribute("aria-label", "اختيار صورة أو فيديو");

    const actions = element("div", "hf-compose-actions");
    const mediaActions = element("div", "hf-media-actions");

    const imageButton = element("button", "hf-tool-btn");
    imageButton.type = "button";
    imageButton.innerHTML = icons.image + "<span>صورة</span>";
    imageButton.addEventListener("click", () => {
      fileInput.accept = "image/jpeg,image/png,image/webp,image/gif";
      fileInput.click();
    });

    const videoButton = element("button", "hf-tool-btn");
    videoButton.type = "button";
    videoButton.innerHTML = icons.video + "<span>فيديو</span>";
    videoButton.addEventListener("click", () => {
      fileInput.accept = "video/mp4,video/webm,video/quicktime";
      fileInput.click();
    });

    mediaActions.append(imageButton, videoButton);

    const publishButton = element("button", "hf-publish-btn", "نشر");
    publishButton.type = "button";

    const status = element("div", "hf-status");

    function clearSelectedFile() {
      selectedFile = null;
      fileInput.value = "";
      previewContent.replaceChildren();
      preview.classList.remove("is-visible");

      if (composerPreviewUrl) {
        URL.revokeObjectURL(composerPreviewUrl);
        composerPreviewUrl = null;
      }
    }

    function showSelectedFile(file) {
      clearSelectedFile();
      if (!file) return;

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setStatus(status, "نوع الملف غير مدعوم. اختر صورة أو فيديو.", true);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setStatus(status, "حجم الملف أكبر من الحد المسموح (50 ميجابايت).", true);
        return;
      }

      selectedFile = file;
      composerPreviewUrl = URL.createObjectURL(file);

      const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
      media.src = composerPreviewUrl;
      if (media.tagName === "VIDEO") {
        media.controls = true;
        media.playsInline = true;
      } else {
        media.alt = "معاينة الصورة قبل النشر";
      }

      previewContent.appendChild(media);
      preview.classList.add("is-visible");
      setStatus(status, "");
    }

    fileInput.addEventListener("change", () => {
      showSelectedFile(fileInput.files?.[0]);
    });

    removePreview.addEventListener("click", clearSelectedFile);

    publishButton.addEventListener("click", async () => {
      const content = textarea.value.trim();

      if (!content && !selectedFile) {
        setStatus(status, "اكتب شيئًا أو أضف صورة أو فيديو أولًا.", true);
        return;
      }

      if (!currentUser) {
        setStatus(status, "سجّل الدخول أولًا حتى تتمكن من النشر.", true);
        return;
      }

      publishButton.disabled = true;
      publishButton.textContent = "جارٍ النشر...";
      setStatus(status, "يتم تجهيز المنشور ورفعه...");

      let uploadedPath = null;

      try {
        let mediaType = null;

        if (selectedFile) {
          const extension = (selectedFile.name.split(".").pop() || "bin")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

          const safeExtension = extension || (selectedFile.type.startsWith("video/") ? "mp4" : "jpg");
          uploadedPath = `${currentUser.id}/posts/${crypto.randomUUID()}.${safeExtension}`;
          mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(uploadedPath, selectedFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: selectedFile.type
            });

          if (uploadError) throw uploadError;
        }

        const { data, error } = await supabase
          .from("posts")
          .insert({
            user_id: currentUser.id,
            content,
            media_path: uploadedPath,
            media_type: mediaType
          })
          .select("id,user_id,content,media_path,media_type,created_at")
          .single();

        if (error) throw error;

        textarea.value = "";
        clearSelectedFile();
        setStatus(status, "تم نشر منشورك بنجاح.");
        await loadPosts(feedRoot, { userId: null });

        window.dispatchEvent(new CustomEvent("hanoon:post-created", {
          detail: { post: data }
        }));

      } catch (error) {
        console.error("HANOON publish error:", error);

        if (uploadedPath) {
          await supabase.storage.from(BUCKET).remove([uploadedPath]);
        }

        setStatus(
          status,
          error?.message || "تعذر نشر المنشور. تحقق من الاتصال وحاول مرة أخرى.",
          true
        );
      } finally {
        publishButton.disabled = false;
        publishButton.textContent = "نشر";
      }
    });

    actions.append(mediaActions, publishButton);
    card.append(top, textarea, preview, fileInput, actions, status);
    return card;
  }

  function mediaUrl(path) {
    if (!path) return "";
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function loadPosts(target, options = {}) {
    if (!target || !supabase) return;
    if (loading && !options.userId) return;

    if (!options.userId) loading = true;
    target.replaceChildren(element("div", "hf-loading", "جارٍ تحميل المنشورات..."));

    try {
      let query = supabase
        .from("posts")
        .select("id,user_id,content,media_path,media_type,created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (options.userId) {
        query = query.eq("user_id", options.userId);
      }

      const { data: posts, error } = await query;
      if (error) throw error;

      if (!posts?.length) {
        target.replaceChildren(element(
          "div",
          "hf-empty",
          options.userId
            ? "لا توجد منشورات في هذا الملف الشخصي حتى الآن."
            : "لا توجد منشورات حتى الآن. كن أول من يشارك شيئًا مع مجتمع هنون."
        ));
        return;
      }

      const profiles = await getProfileMap(posts.map(post => post.user_id));
      const postIds = posts.map(post => post.id);

      const { data: likes, error: likesError } = await supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds);

      if (likesError) throw likesError;

      const likesByPost = new Map();
      (likes || []).forEach(like => {
        const list = likesByPost.get(like.post_id) || [];
        list.push(like.user_id);
        likesByPost.set(like.post_id, list);
      });

      const { data: comments, error: commentsError } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      if (commentsError) throw commentsError;

      const commentCounts = new Map();
      (comments || []).forEach(comment => {
        commentCounts.set(
          comment.post_id,
          (commentCounts.get(comment.post_id) || 0) + 1
        );
      });

      const fragment = document.createDocumentFragment();

      posts.forEach(post => {
        fragment.appendChild(buildPostCard(
          post,
          profiles.get(post.user_id),
          likesByPost.get(post.id) || [],
          commentCounts.get(post.id) || 0
        ));
      });

      target.replaceChildren(fragment);

    } catch (error) {
      console.error("HANOON feed load error:", error);
      target.replaceChildren(element(
        "div",
        "hf-empty hf-feed-error",
        "تعذر تحميل المنشورات. قد تكون صلاحيات القراءة أو الاتصال غير متاحة."
      ));
    } finally {
      if (!options.userId) loading = false;
    }
  }

  function buildPostCard(post, profile, likedUsers, commentCount) {
    const card = element("article", "hf-card hf-post");
    card.dataset.postId = post.id;

    const name = getName(profile, null);
    const avatarUrl = getAvatarUrl(profile?.avatar_path);

    const head = element("div", "hf-post-head");
    head.appendChild(makeAvatar(name, avatarUrl));

    const author = element("a", "hf-post-author");
    author.href = `pages/member.html?user=${encodeURIComponent(post.user_id)}`;
    author.appendChild(element("strong", "", name));

    const handle = profile?.username ? `@${profile.username}` : "عضو هنون";
    author.appendChild(element("small", "", `${handle} · ${formatDate(post.created_at)}`));
    head.appendChild(author);

    if (currentUser?.id === post.user_id) {
      const menu = element("button", "hf-post-menu");
      menu.type = "button";
      menu.innerHTML = icons.more;
      menu.setAttribute("aria-label", "إدارة المنشور");
      menu.addEventListener("click", () => showPostMenu(post));
      head.appendChild(menu);
    }

    card.appendChild(head);

    if (post.content) {
      card.appendChild(element("p", "hf-post-text", post.content));
    }

    if (post.media_path) {
      const url = mediaUrl(post.media_path);
      if (post.media_type === "video") {
        const video = document.createElement("video");
        video.className = "hf-post-media";
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", "فيديو المنشور");
        card.appendChild(video);
      } else {
        const image = document.createElement("img");
        image.className = "hf-post-media";
        image.src = url;
        image.alt = "صورة المنشور";
        image.loading = "lazy";
        card.appendChild(image);
      }
    }

    const stats = element("div", "hf-post-stats");
    const likeCount = element("span", "hf-like-count", `${likedUsers.length} إعجاب`);
    const commentCountNode = element("span", "hf-comment-count", `${commentCount} تعليق`);
    stats.append(likeCount, commentCountNode);
    card.appendChild(stats);

    const actions = element("div", "hf-post-actions");

    const likeButton = element("button", "hf-action");
    likeButton.type = "button";
    likeButton.innerHTML = `${icons.like}<span>إعجاب</span>`;
    const hasLiked = Boolean(currentUser && likedUsers.includes(currentUser.id));
    if (hasLiked) likeButton.classList.add("is-liked");

    const commentButton = element("button", "hf-action");
    commentButton.type = "button";
    commentButton.innerHTML = `${icons.comment}<span>تعليق</span>`;

    const shareButton = element("button", "hf-action");
    shareButton.type = "button";
    shareButton.innerHTML = `${icons.share}<span>مشاركة</span>`;

    actions.append(likeButton, commentButton, shareButton);
    card.appendChild(actions);

    const commentsBox = element("div", "hf-comments");
    const commentList = element("div", "hf-comment-list");
    const commentForm = element("form", "hf-comment-form");
    const commentInput = element("input", "hf-comment-input");
    commentInput.type = "text";
    commentInput.maxLength = 2000;
    commentInput.placeholder = "اكتب تعليقك...";
    commentInput.autocomplete = "off";

    const sendComment = element("button", "hf-comment-send");
    sendComment.type = "submit";
    sendComment.innerHTML = icons.send;
    sendComment.setAttribute("aria-label", "إرسال التعليق");

    commentForm.append(commentInput, sendComment);
    commentsBox.append(commentList, commentForm);
    card.appendChild(commentsBox);

    likeButton.addEventListener("click", async () => {
      if (!currentUser) {
        alert("سجّل الدخول أولًا للإعجاب بالمنشورات.");
        return;
      }

      likeButton.disabled = true;
      try {
        if (likeButton.classList.contains("is-liked")) {
          const { error } = await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", post.id)
            .eq("user_id", currentUser.id);
          if (error) throw error;

          likeButton.classList.remove("is-liked");
          const index = likedUsers.indexOf(currentUser.id);
          if (index >= 0) likedUsers.splice(index, 1);
        } else {
          const { error } = await supabase
            .from("post_likes")
            .insert({ post_id: post.id, user_id: currentUser.id });
          if (error) throw error;

          likeButton.classList.add("is-liked");
          likedUsers.push(currentUser.id);
        }

        likeCount.textContent = `${likedUsers.length} إعجاب`;
      } catch (error) {
        console.error("HANOON like error:", error);
        alert("تعذر تحديث الإعجاب. حاول مرة أخرى.");
      } finally {
        likeButton.disabled = false;
      }
    });

    commentButton.addEventListener("click", async () => {
      const opening = !commentsBox.classList.contains("is-open");
      commentsBox.classList.toggle("is-open", opening);

      if (opening && !commentsBox.dataset.loaded) {
        await loadComments(post.id, commentList);
        commentsBox.dataset.loaded = "true";
      }

      if (opening) commentInput.focus();
    });

    commentForm.addEventListener("submit", async event => {
      event.preventDefault();
      const body = commentInput.value.trim();

      if (!body) return;
      if (!currentUser) {
        alert("سجّل الدخول أولًا لإضافة تعليق.");
        return;
      }

      sendComment.disabled = true;

      try {
        const { error } = await supabase
          .from("post_comments")
          .insert({
            post_id: post.id,
            user_id: currentUser.id,
            body
          });

        if (error) throw error;

        commentInput.value = "";
        await loadComments(post.id, commentList);
        commentsBox.dataset.loaded = "true";

        const count = Number((commentCountNode.textContent.match(/\d+/) || ["0"])[0]) + 1;
        commentCountNode.textContent = `${count} تعليق`;
      } catch (error) {
        console.error("HANOON comment error:", error);
        alert("تعذر إرسال التعليق. حاول مرة أخرى.");
      } finally {
        sendComment.disabled = false;
      }
    });

    shareButton.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}#post-${post.id}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "منشور من هنون", text: post.content || "شاهد هذا المنشور على هنون", url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          alert("تم نسخ رابط المنشور.");
        } else {
          prompt("انسخ رابط المنشور:", url);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("HANOON share error:", error);
        }
      }
    });

    return card;
  }

  async function loadComments(postId, target) {
    target.replaceChildren(element("div", "hf-empty", "جارٍ تحميل التعليقات..."));

    try {
      const { data: comments, error } = await supabase
        .from("post_comments")
        .select("id,user_id,body,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      if (!comments?.length) {
        target.replaceChildren(element("div", "hf-empty", "لا توجد تعليقات حتى الآن."));
        return;
      }

      const profiles = await getProfileMap(comments.map(comment => comment.user_id));
      const fragment = document.createDocumentFragment();

      comments.forEach(comment => {
        const profile = profiles.get(comment.user_id);
        const name = getName(profile, null);
        const row = element("div", "hf-comment");
        row.appendChild(makeAvatar(name, getAvatarUrl(profile?.avatar_path), "hf-avatar"));

        const body = element("div", "hf-comment-body");
        body.appendChild(element("strong", "", name));
        body.appendChild(element("p", "", comment.body));
        row.appendChild(body);
        fragment.appendChild(row);
      });

      target.replaceChildren(fragment);
    } catch (error) {
      console.error("HANOON comments load error:", error);
      target.replaceChildren(element("div", "hf-empty hf-feed-error", "تعذر تحميل التعليقات."));
    }
  }

  async function showPostMenu(post) {
    const action = prompt("اكتب (تعديل) لتعديل المنشور أو (حذف) لحذفه:");
    if (!action) return;

    if (action.trim() === "حذف") {
      if (!confirm("هل تريد حذف هذا المنشور نهائيًا؟")) return;

      try {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", post.id)
          .eq("user_id", currentUser.id);

        if (error) throw error;

        if (post.media_path) {
          await supabase.storage.from(BUCKET).remove([post.media_path]);
        }

        await loadPosts(feedRoot, { userId: null });
      } catch (error) {
        console.error("HANOON delete post error:", error);
        alert("تعذر حذف المنشور.");
      }
      return;
    }

    if (action.trim() === "تعديل") {
      const nextContent = prompt("عدّل نص المنشور:", post.content || "");
      if (nextContent === null) return;

      try {
        const { error } = await supabase
          .from("posts")
          .update({
            content: nextContent.trim(),
            updated_at: new Date().toISOString()
          })
          .eq("id", post.id)
          .eq("user_id", currentUser.id);

        if (error) throw error;
        await loadPosts(feedRoot, { userId: null });
      } catch (error) {
        console.error("HANOON update post error:", error);
        alert("تعذر تعديل المنشور.");
      }
    }
  }

  function buildFeedSection() {
    const section = element("section", "hf-section");
    section.id = "homeFeed";

    const heading = element("div", "hf-heading");
    const titleBox = element("div");
    titleBox.appendChild(element("h2", "", "منشورات المجتمع"));
    titleBox.appendChild(element("p", "", "شارك لحظاتك وأفكارك مع مجتمع هنون."));
    heading.appendChild(titleBox);
    section.appendChild(heading);

    const content = element("div", "hf-feed-content");
    section.appendChild(content);

    if (!currentUser) {
      content.appendChild(element("div", "hf-card hf-login-note"));
      content.firstChild.innerHTML =
        `سجّل الدخول لتشارك منشوراتك وتتفاعل مع مجتمع هنون. <a href="pages/auth.html">تسجيل الدخول</a>`;
      content.appendChild(element("div", "hf-feed-list"));
      return { section, content, list: content.querySelector(".hf-feed-list") };
    }

    content.appendChild(buildComposer());
    const list = element("div", "hf-feed-list");
    content.appendChild(list);
    return { section, content, list };
  }

  async function refreshAccount() {
    if (!supabase) return;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("HANOON current user error:", error);
      currentUser = null;
      currentProfile = null;
      return;
    }

    currentUser = data?.user || null;
    currentProfile = null;

    if (currentUser) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_path")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        console.warn("HANOON profile fetch warning:", profileError);
      } else {
        currentProfile = profile;
      }
    }
  }

  async function initHomeFeed() {
    if (!supabase || document.getElementById("homeFeed")) return;

    addStyles();
    await refreshAccount();

    const hero = document.querySelector(".hero-section");
    const platformSections = document.getElementById("platformSections");
    const built = buildFeedSection();

    if (hero?.parentNode) {
      hero.insertAdjacentElement("afterend", built.section);
    } else if (platformSections?.parentNode) {
      platformSections.parentNode.insertBefore(built.section, platformSections);
    } else {
      document.querySelector("main")?.prepend(built.section);
    }

    feedRoot = built.list;

    if (feedRoot) {
      await loadPosts(feedRoot, { userId: null });
    }

    window.HANOON_POSTS = {
      renderInto: async (container, userId) => {
        if (!container || !supabase) return;
        addStyles();
        await refreshAccount();
        await loadPosts(container, { userId });
      },
      refresh: () => loadPosts(feedRoot, { userId: null })
    };
  }

  function start() {
    supabase = window.HANOON?.supabase || null;
    if (!supabase) return;
    initHomeFeed();
  }

  if (window.HANOON?.supabase) {
    start();
  } else {
    window.addEventListener("hanoon:supabase-ready", start, { once: true });
  }

  window.addEventListener("hanoon:post-created", () => {
    if (feedRoot) loadPosts(feedRoot, { userId: null });
  });

  window.addEventListener("pageshow", () => {
    if (supabase && feedRoot) loadPosts(feedRoot, { userId: null });
  });
})();
