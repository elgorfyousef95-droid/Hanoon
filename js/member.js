
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const elements = {
    loading: $("loading"),
    error: $("error"),
    content: $("memberContent"),
    avatar: $("avatar"),
    name: $("name"),
    username: $("username"),
    bio: $("bio"),
    code: $("memberCode"),
    hobbies: $("hobbies"),
    reading: $("reading")
  };

  let db = null;
  let member = null;

  function showError(message) {
    elements.loading.hidden = true;
    elements.content.hidden = true;
    elements.error.textContent = message;
    elements.error.classList.add("show");
  }

  function showLoading(message) {
    elements.loading.hidden = false;
    elements.loading.textContent = message;
    elements.error.classList.remove("show");
    elements.content.hidden = true;
  }

  function showContent() {
    elements.loading.hidden = true;
    elements.error.classList.remove("show");
    elements.content.hidden = false;
  }

  async function waitForSupabase() {
    if (window.HANOON?.supabase) {
      return window.HANOON.supabase;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("hanoon:supabase-ready", ready);
        reject(new Error("تعذر الاتصال بقاعدة البيانات."));
      }, 12000);

      function ready() {
        clearTimeout(timeout);

        if (window.HANOON?.supabase) {
          resolve(window.HANOON.supabase);
        } else {
          reject(new Error("لم يتم تجهيز اتصال قاعدة البيانات."));
        }
      }

      window.addEventListener("hanoon:supabase-ready", ready, {
        once: true
      });
    });
  }

  function getSearchValue() {
    const params = new URLSearchParams(window.location.search);

    return {
      id: (params.get("id") || "").trim(),
      code: (params.get("code") || "").trim().toUpperCase(),
      user: (
        params.get("user") ||
        params.get("username") ||
        ""
      ).trim().replace(/^@/, "").toLowerCase()
    };
  }

  async function findMember(search) {
    let query = db
      .from("member_directory")
      .select(
        "id,username,member_code,full_name,avatar_path,bio,hobbies,reading_interests,created_at"
      );

    if (search.code) {
      if (!/^HN-[A-F0-9]{10}$/.test(search.code)) {
        throw new Error("كود العضو غير صحيح.");
      }

      query = query.eq("member_code", search.code);

    } else if (search.id) {
      query = query.eq("id", search.id);

    } else if (search.user) {
      query = query.eq("username", search.user);

    } else {
      throw new Error(
        "رابط الملف الشخصي لا يحتوي على رقم العضو أو الكود أو اسم المستخدم."
      );
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Member lookup error:", error);
      throw new Error("حدث خطأ أثناء البحث عن العضو.");
    }

    if (!data) {
      throw new Error(
        "لم نعثر على هذا العضو. تأكد من الرابط أو اسم المستخدم."
      );
    }

    return data;
  }

  function renderTags(container, values, emptyMessage) {
    container.replaceChildren();

    const list = Array.isArray(values)
      ? values.filter(
          value => typeof value === "string" && value.trim()
        )
      : [];

    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    list.forEach(value => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      container.appendChild(tag);
    });
  }

  function getStorageURL(bucket, path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    const { data, error } = db.storage
      .from(bucket)
      .getPublicUrl(path);

    if (error) {
      console.warn("Storage URL error:", error);
      return "";
    }

    return data?.publicUrl || "";
  }

  function renderMember(profile) {
    member = profile;

    const name = profile.full_name || "عضو هنون";

    elements.name.textContent = name;
    elements.username.textContent = profile.username
      ? "@" + profile.username
      : "";

    elements.bio.textContent =
      profile.bio || "لم يضف العضو نبذة شخصية بعد.";

    elements.code.textContent = profile.member_code
      ? "HANOON ID: " + profile.member_code
      : "عضو في مجتمع هنون";

    const avatarURL = getStorageURL(
      "avatars",
      profile.avatar_path
    );

    elements.avatar.replaceChildren();

    if (avatarURL) {
      const image = document.createElement("img");
      image.src = avatarURL;
      image.alt = name;
      image.loading = "lazy";

      image.onerror = () => {
        elements.avatar.textContent =
          name.trim().charAt(0) || "هـ";
      };

      elements.avatar.appendChild(image);
    } else {
      elements.avatar.textContent =
        name.trim().charAt(0) || "هـ";
    }

    renderTags(
      elements.hobbies,
      profile.hobbies,
      "لم يضف العضو هواياته بعد."
    );

    renderTags(
      elements.reading,
      profile.reading_interests,
      "لم يحدد اهتماماته القرائية بعد."
    );

    document.title = name + " | HANOON";

    addMediaStyles();
    createMediaSections();
    showContent();
  }

  /* ==========================================
     منشورات وفيديوهات العضو
  ========================================== */

  function addMediaStyles() {
    if ($("memberMediaStyles")) return;

    const style = document.createElement("style");
    style.id = "memberMediaStyles";

    style.textContent = `
      .member-media-section{
        position:relative;
        overflow:hidden;
        margin-top:20px;
        padding:21px;
        border:1px solid rgba(193,171,255,.20);
        border-radius:23px;
        background:linear-gradient(145deg,rgba(29,22,57,.88),rgba(13,11,31,.94));
        box-shadow:0 15px 40px rgba(0,0,0,.22);
        text-align:right;
        backdrop-filter:blur(20px);
      }

      .member-media-heading{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:16px;
      }

      .member-media-heading h3{
        display:flex;
        align-items:center;
        gap:9px;
        margin:0;
        color:#f5efff;
        font-size:16px;
        font-weight:900;
      }

      .member-media-heading h3 svg{
        width:21px;
        height:21px;
        fill:none;
        stroke:#c1aaff;
        stroke-width:1.8;
      }

      .member-media-count{
        color:#b9b1d1;
        font-size:10px;
        white-space:nowrap;
      }

      .member-media-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }

      .member-media-item{
        position:relative;
        display:block;
        min-width:0;
        aspect-ratio:1/1;
        overflow:hidden;
        padding:0;
        border:1px solid rgba(255,255,255,.13);
        border-radius:13px;
        background:#100d25;
        cursor:pointer;
      }

      .member-media-item.video{
        aspect-ratio:9/14;
      }

      .member-media-item img,
      .member-media-item video{
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .member-media-text{
        width:100%;
        height:100%;
        display:grid;
        place-items:center;
        padding:10px;
        overflow:hidden;
        color:#e9ddff;
        font-size:10px;
        line-height:1.8;
        text-align:center;
        overflow-wrap:anywhere;
      }

      .member-media-caption{
        position:absolute;
        right:0;
        left:0;
        bottom:0;
        padding:19px 7px 7px;
        overflow:hidden;
        background:linear-gradient(transparent,#000c);
        color:#fff;
        font-size:9px;
        text-align:right;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .member-play{
        position:absolute;
        top:9px;
        left:9px;
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        border:1px solid #ffffff55;
        border-radius:50%;
        background:#080817b8;
        color:white;
      }

      .member-play svg{
        width:14px;
        height:14px;
        fill:none;
        stroke:currentColor;
        stroke-width:2;
      }

      .member-media-empty{
        grid-column:1/-1;
        padding:25px 12px;
        border:1px dashed rgba(193,171,255,.23);
        border-radius:14px;
        color:#bdb5d2;
        font-size:11px;
        line-height:2;
        text-align:center;
      }

      .member-viewer{
        position:fixed;
        inset:0;
        z-index:9999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:16px;
        background:rgba(3,3,12,.95);
        backdrop-filter:blur(14px);
      }

      .member-viewer.open{
        display:flex;
      }

      .member-viewer-inner{
        position:relative;
        width:min(100%,650px);
        max-height:88dvh;
        display:grid;
        place-items:center;
      }

      .member-viewer-inner img,
      .member-viewer-inner video{
        display:block;
        max-width:100%;
        max-height:82dvh;
        border-radius:15px;
        object-fit:contain;
        background:#000;
      }

      .member-viewer-close{
        position:absolute;
        top:-43px;
        left:0;
        width:36px;
        height:36px;
        border:1px solid #ffffff55;
        border-radius:50%;
        background:#ffffff16;
        color:#fff;
        font-size:21px;
      }

      @media(max-width:550px){
        .member-media-section{
          padding:18px 13px;
          border-radius:19px;
        }

        .member-media-grid{gap:6px}
        .member-media-item{border-radius:9px}
        .member-media-heading h3{font-size:14px}
      }
    `;

    document.head.appendChild(style);
  }

  function createMediaSections() {
    if ($("memberPostsSection")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "memberMediaWrapper";

    wrapper.innerHTML = `
      <section class="member-media-section" id="memberPostsSection">
        <div class="member-media-heading">
          <h3>
            <svg viewBox="0 0 24 24">
              <path d="M4 4h16v16H4z"/>
              <path d="M8 8h8M8 12h8M8 16h5"/>
            </svg>
            المنشورات
          </h3>
          <span class="member-media-count" id="memberPostsCount">0 منشور</span>
        </div>
        <div class="member-media-grid" id="memberPostsGrid">
          <div class="member-media-empty">جارٍ تحميل المنشورات...</div>
        </div>
      </section>

      <section class="member-media-section" id="memberVideosSection">
        <div class="member-media-heading">
          <h3>
            <svg viewBox="0 0 24 24">
              <rect x="4" y="3" width="16" height="18" rx="3"/>
              <path d="m10 8 5 4-5 4z"/>
            </svg>
            الفيديوهات القصيرة
          </h3>
          <span class="member-media-count" id="memberVideosCount">0 فيديو</span>
        </div>
        <div class="member-media-grid" id="memberVideosGrid">
          <div class="member-media-empty">جارٍ تحميل الفيديوهات...</div>
        </div>
      </section>
    `;

    elements.content.appendChild(wrapper);

    const viewer = document.createElement("div");
    viewer.className = "member-viewer";
    viewer.id = "memberViewer";

    viewer.innerHTML = `
      <div class="member-viewer-inner">
        <button class="member-viewer-close" type="button" aria-label="إغلاق">×</button>
        <div id="memberViewerBody"></div>
      </div>
    `;

    document.body.appendChild(viewer);

    viewer.addEventListener("click", event => {
      if (
        event.target === viewer ||
        event.target.closest(".member-viewer-close")
      ) {
        closeViewer();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeViewer();
    });
  }

  function closeViewer() {
    const viewer = $("memberViewer");
    const body = $("memberViewerBody");

    if (!viewer || !body) return;

    body.querySelectorAll("video").forEach(video => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });

    body.replaceChildren();
    viewer.classList.remove("open");
  }

  function openViewer(post) {
    const viewer = $("memberViewer");
    const body = $("memberViewerBody");

    if (!viewer || !body || !post.media_path) return;

    const url = getStorageURL("post-media", post.media_path);

    if (!url) {
      alert("تعذر فتح الملف. تأكد من صلاحية عرض الوسائط.");
      return;
    }

    body.replaceChildren();

    const isVideo = post.media_type === "video";
    const media = document.createElement(isVideo ? "video" : "img");

    media.src = url;
    media.alt = post.content || "محتوى من هنون";

    if (isVideo) {
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    }

    body.appendChild(media);
    viewer.classList.add("open");
  }

  function makeMediaCard(post, isVideo) {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "member-media-item" + (isVideo ? " video" : "");

    card.setAttribute(
      "aria-label",
      isVideo ? "مشاهدة فيديو العضو" : "عرض منشور العضو"
    );

    if (post.media_path) {
      const url = getStorageURL("post-media", post.media_path);

      if (url) {
        if (isVideo) {
          const video = document.createElement("video");
          video.src = url;
          video.preload = "metadata";
          video.muted = true;
          video.playsInline = true;
          card.appendChild(video);
        } else {
          const image = document.createElement("img");
          image.src = url;
          image.alt = post.content || "صورة من المنشورات";
          image.loading = "lazy";
          card.appendChild(image);
        }
      } else {
        const text = document.createElement("span");
        text.className = "member-media-text";
        text.textContent = post.content || "تعذر عرض الوسائط";
        card.appendChild(text);
      }
    } else {
      const text = document.createElement("span");
      text.className = "member-media-text";
      text.textContent = post.content || "منشور نصي";
      card.appendChild(text);
    }

    if (isVideo) {
      const play = document.createElement("span");
      play.className = "member-play";
      play.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="m8 5 12 7-12 7z"/>
        </svg>
      `;
      card.appendChild(play);
    }

    if (post.content) {
      const caption = document.createElement("span");
      caption.className = "member-media-caption";
      caption.textContent = post.content;
      card.appendChild(caption);
    }

    card.addEventListener("click", () => {
      if (post.media_path) {
        openViewer(post);
      }
    });

    return card;
  }

  function showMediaEmpty(container, message) {
    const empty = document.createElement("div");
    empty.className = "member-media-empty";
    empty.textContent = message;
    container.replaceChildren(empty);
  }

  async function loadMemberMedia() {
    const postsGrid = $("memberPostsGrid");
    const videosGrid = $("memberVideosGrid");

    if (!postsGrid || !videosGrid || !member?.id) return;

    const { data, error } = await db
      .from("posts")
      .select("id,user_id,content,media_path,media_type,created_at")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("Member media error:", error);

      showMediaEmpty(
        postsGrid,
        "تعذر تحميل منشورات هذا العضو."
      );

      showMediaEmpty(
        videosGrid,
        "تعذر تحميل فيديوهات هذا العضو."
      );

      return;
    }

    const all = data || [];

    const videos = all.filter(post =>
      post.media_type === "video" && Boolean(post.media_path)
    );

    const posts = all.filter(post =>
      post.media_type !== "video"
    );

    $("memberPostsCount").textContent =
      `${posts.length} منشور`;

    $("memberVideosCount").textContent =
      `${videos.length} فيديو`;

    postsGrid.replaceChildren();
    videosGrid.replaceChildren();

    if (!posts.length) {
      showMediaEmpty(postsGrid, "لا توجد منشورات لهذا العضو حتى الآن.");
    } else {
      posts.forEach(post => {
        postsGrid.appendChild(makeMediaCard(post, false));
      });
    }

    if (!videos.length) {
      showMediaEmpty(videosGrid, "لا توجد فيديوهات قصيرة لهذا العضو حتى الآن.");
    } else {
      videos.forEach(video => {
        videosGrid.appendChild(makeMediaCard(video, true));
      });
    }
  }

  /* ==========================================
     تشغيل الصفحة
  ========================================== */

  async function init() {
    try {
      showLoading("جارٍ الاتصال بقاعدة البيانات...");

      db = await waitForSupabase();

      const search = getSearchValue();

      showLoading("جارٍ البحث عن العضو...");

      const profile = await findMember(search);

      renderMember(profile);

      showLoading("جارٍ تحميل منشورات وفيديوهات العضو...");

      await loadMemberMedia();

      showContent();

    } catch (error) {
      console.error("HANOON member page:", error);

      showError(
        error.message || "تعذر عرض الملف الشخصي حاليًا."
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
