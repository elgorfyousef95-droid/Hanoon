
/* =====================================================
   HANOON - TIKTOK STYLE PROFILE
   Profile / Avatar / QR / Posts / Videos
   Followers / Following / Privacy
===================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let supabase = null;
  let currentUser = null;
  let currentProfile = null;
  let busy = false;

  function waitForSupabase() {
    return new Promise((resolve, reject) => {
      if (window.HANOON?.supabase) {
        resolve(window.HANOON.supabase);
        return;
      }

      let timer;

      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("hanoon:supabase-ready", onReady);
        window.removeEventListener("hanoon:supabase-error", onError);
      };

      const onReady = () => {
        const client = window.HANOON?.supabase;
        cleanup();

        if (client) resolve(client);
        else reject(new Error("تعذر تشغيل قاعدة البيانات."));
      };

      const onError = event => {
        cleanup();
        reject(new Error(
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات."
        ));
      };

      window.addEventListener("hanoon:supabase-ready", onReady);
      window.addEventListener("hanoon:supabase-error", onError);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error("انتهت مهلة الاتصال. حاول تحديث الصفحة."));
      }, 15000);

      if (window.HANOON?.supabase) onReady();
    });
  }

  function toast(message) {
    const element = $("toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 2600);
  }

  function showMessage(message, type = "error") {
    const element = $("profileMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `message show ${type}`;
  }

  function showPageError(message) {
    const element = $("pageError");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");
  }

  function parseList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item =>
      typeof item === "string" && item.trim()
    );
  }

  function splitInput(value) {
    return value.split(/[،,]/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  function listToText(value) {
    return parseList(value).join("، ");
  }

  function renderTags(container, items, emptyMessage) {
    if (!container) return;

    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("span");
      empty.className = "empty-text";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item;
      container.appendChild(tag);
    });
  }

  function getAvatarURL(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function getMediaURL(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    const { data } = supabase.storage
      .from("post-media")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function renderAvatar(path, name, fallbackURL = "") {
    const container = $("profileAvatar");
    if (!container) return;

    container.replaceChildren();

    const url = path ? getAvatarURL(path) : fallbackURL;

    if (!url) {
      container.textContent =
        (name || "H").trim().charAt(0) || "H";
      return;
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = "الصورة الشخصية";
    image.loading = "eager";

    image.onerror = () => {
      container.replaceChildren();
      container.textContent =
        (name || "H").trim().charAt(0) || "H";
    };

    container.appendChild(image);
  }

  function getPublicProfileURL(username) {
    return new URL(
      `member.html?user=${encodeURIComponent(username)}`,
      window.location.href
    ).href;
  }

  function renderQR(username) {
    const container = $("profileQR");
    if (!container) return;

    container.replaceChildren();

    if (!window.QRCode) {
      container.textContent = "تعذر تحميل رمز QR.";
      return;
    }

    new QRCode(container, {
      text: getPublicProfileURL(username),
      width: 150,
      height: 150,
      colorDark: "#111827",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function getAccountName() {
    const metadata = currentUser?.user_metadata || {};

    return (
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      currentUser?.email?.split("@")[0] ||
      "عضو هنون"
    );
  }

  function getAccountUsername() {
    const metadata = currentUser?.user_metadata || {};

    return (
      metadata.username ||
      currentUser?.email?.split("@")[0] ||
      "member_" + String(currentUser?.id || "").slice(0, 8)
    );
  }

  /* =====================================================
     PROFILE SOCIAL UI
  ===================================================== */

  function installSocialStyles() {
    if ($("profileSocialStyles")) return;

    const style = document.createElement("style");
    style.id = "profileSocialStyles";

    style.textContent = `
      .profile-stats{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        padding:15px 8px;
        border-bottom:1px solid #303030;
        background:#101010;
      }

      .profile-stat{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:2px;
        min-width:0;
        border:0;
        background:transparent;
        color:#fff;
      }

      .profile-stat strong{
        font-size:18px;
        font-weight:900;
        line-height:1.5;
        font-variant-numeric:tabular-nums;
      }

      .profile-stat span{
        color:#aaa;
        font-size:10px;
      }

      .profile-privacy{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin:13px 12px;
        padding:14px;
        border:1px solid #303030;
        border-radius:12px;
        background:#141414;
      }

      .profile-privacy-copy{
        min-width:0;
      }

      .profile-privacy-copy strong{
        display:block;
        color:#fff;
        font-size:12px;
        font-weight:900;
      }

      .profile-privacy-copy small{
        display:block;
        margin-top:4px;
        color:#999;
        font-size:10px;
        line-height:1.8;
      }

      .privacy-switch{
        position:relative;
        flex:0 0 48px;
        width:48px;
        height:27px;
      }

      .privacy-switch input{
        position:absolute;
        width:1px;
        height:1px;
        opacity:0;
      }

      .privacy-switch span{
        position:absolute;
        inset:0;
        border-radius:30px;
        background:#444;
        cursor:pointer;
        transition:.2s;
      }

      .privacy-switch span::before{
        content:"";
        position:absolute;
        top:3px;
        right:3px;
        width:21px;
        height:21px;
        border-radius:50%;
        background:#fff;
        transition:.2s;
      }

      .privacy-switch input:checked + span{
        background:#fe2c55;
      }

      .privacy-switch input:checked + span::before{
        transform:translateX(-21px);
      }

      .privacy-switch input:focus-visible + span{
        outline:2px solid #fff;
        outline-offset:3px;
      }

      .profile-tabs{
        position:sticky;
        top:58px;
        z-index:20;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        margin-top:14px;
        border-top:1px solid #303030;
        border-bottom:1px solid #303030;
        background:#090909ed;
        backdrop-filter:blur(15px);
      }

      .profile-tab{
        min-height:48px;
        border:0;
        border-bottom:2px solid transparent;
        background:transparent;
        color:#999;
        font-size:11px;
        font-weight:900;
      }

      .profile-tab.active{
        border-bottom-color:#fe2c55;
        color:#fff;
      }

      .profile-media-section{
        margin:0;
        padding:15px 8px;
        border:0;
        border-radius:0;
        background:#080808;
        box-shadow:none;
      }

      .profile-media-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:12px;
      }

      .profile-media-title{
        display:flex;
        align-items:center;
        gap:8px;
        font-size:14px;
        font-weight:900;
      }

      .profile-media-title svg{
        width:19px;
        height:19px;
        fill:none;
        stroke:#fe2c55;
        stroke-width:1.8;
      }

      .profile-media-count{
        margin-top:2px;
        color:#999;
        font-size:10px;
      }

      .profile-media-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:3px;
      }

      .profile-media-card{
        position:relative;
        min-width:0;
        overflow:hidden;
        aspect-ratio:3/4;
        border:0;
        border-radius:2px;
        background:#202020;
        cursor:pointer;
      }

      .profile-media-card img,
      .profile-media-card video{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
      }

      .profile-media-card.video-card{
        aspect-ratio:3/4;
      }

      .profile-video-mark{
        position:absolute;
        left:7px;
        bottom:7px;
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#0009;
        color:#fff;
        pointer-events:none;
      }

      .profile-video-mark svg{
        width:14px;
        height:14px;
        fill:none;
        stroke:currentColor;
        stroke-width:2;
      }

      .profile-media-caption{
        position:absolute;
        right:0;
        left:0;
        bottom:0;
        padding:18px 6px 5px;
        overflow:hidden;
        color:#fff;
        font-size:9px;
        background:linear-gradient(transparent,#000b);
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .profile-media-empty{
        grid-column:1/-1;
        padding:25px 10px;
        color:#999;
        text-align:center;
        font-size:11px;
        line-height:2;
      }

      .profile-media-link{
        padding:6px 10px;
        border:1px solid #ffffff20;
        border-radius:7px;
        background:#222;
        color:#eee;
        font-size:10px;
        font-weight:800;
      }

      .profile-media-modal{
        position:fixed;
        inset:0;
        z-index:9999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:15px;
        background:#000f;
      }

      .profile-media-modal.open{
        display:flex;
      }

      .profile-media-modal-content{
        position:relative;
        width:min(100%,600px);
        max-height:90dvh;
        display:grid;
        place-items:center;
      }

      .profile-media-modal-content img,
      .profile-media-modal-content video{
        max-width:100%;
        max-height:84dvh;
        object-fit:contain;
        background:#000;
        border-radius:8px;
      }

      .profile-media-close{
        position:absolute;
        top:-42px;
        left:0;
        width:35px;
        height:35px;
        border:1px solid #ffffff44;
        border-radius:50%;
        background:#222;
        color:white;
        font-size:21px;
      }

      @media(max-width:420px){
        .profile-media-section{padding-inline:4px}
        .profile-media-grid{gap:2px}
      }
    `;

    document.head.appendChild(style);
  }

  function createSocialProfileUI() {
    if ($("profileStats")) return;

    installSocialStyles();

    const cover = document.querySelector(".profile-cover");
    const actions = document.querySelector(".profile-actions");

    if (!cover || !actions) return;

    const stats = document.createElement("section");
    stats.className = "profile-stats";
    stats.id = "profileStats";
    stats.innerHTML = `
      <div class="profile-stat">
        <strong id="profilePostsStat">—</strong>
        <span>المنشورات</span>
      </div>
      <div class="profile-stat">
        <strong id="profileFollowersStat">—</strong>
        <span>المتابعون</span>
      </div>
      <div class="profile-stat">
        <strong id="profileFollowingStat">—</strong>
        <span>يتابع</span>
      </div>
    `;
    cover.insertAdjacentElement("afterend", stats);

    const privacy = document.createElement("section");
    privacy.className = "profile-privacy";
    privacy.id = "profilePrivacy";
    privacy.innerHTML = `
      <div class="profile-privacy-copy">
        <strong>خصوصية الحساب</strong>
        <small id="profilePrivacyDescription">
          حساب عام: يمكن للجميع مشاهدة منشوراتك.
        </small>
      </div>
      <label class="privacy-switch" aria-label="تفعيل الحساب الخاص">
        <input id="profilePrivacyToggle" type="checkbox">
        <span></span>
      </label>
    `;
    actions.insertAdjacentElement("afterend", privacy);

    $("profilePrivacyToggle").addEventListener(
      "change",
      updatePrivacy
    );
  }

  async function loadSocialStats() {
    const postsCount = $("profilePostsStat");
    const followersCount = $("profileFollowersStat");
    const followingCount = $("profileFollowingStat");

    if (!postsCount || !followersCount || !followingCount) return;

    try {
      const [posts, followers, following] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUser.id),

        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", currentUser.id),

        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", currentUser.id)
      ]);

      if (posts.error) throw posts.error;
      if (followers.error) throw followers.error;
      if (following.error) throw following.error;

      postsCount.textContent = formatCount(posts.count || 0);
      followersCount.textContent = formatCount(followers.count || 0);
      followingCount.textContent = formatCount(following.count || 0);

    } catch (error) {
      console.error("Social stats error:", error);
      postsCount.textContent = "—";
      followersCount.textContent = "—";
      followingCount.textContent = "—";
    }
  }

  function formatCount(value) {
    return new Intl.NumberFormat("ar-EG").format(value);
  }

  async function updatePrivacy(event) {
    const toggle = event.target;
    const description = $("profilePrivacyDescription");

    if (busy) {
      toggle.checked = Boolean(currentProfile?.is_private);
      return;
    }

    const newValue = toggle.checked;
    const oldValue = Boolean(currentProfile?.is_private);

    toggle.disabled = true;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_private: newValue })
        .eq("id", currentUser.id)
        .select("is_private")
        .single();

      if (error) throw error;

      currentProfile.is_private = data.is_private;

      description.textContent = newValue
        ? "حساب خاص: منشوراتك لا تظهر إلا لمتابعيك المقبولين."
        : "حساب عام: يمكن للجميع مشاهدة منشوراتك.";

      toast(
        newValue
          ? "تم تحويل الحساب إلى خاص."
          : "أصبح حسابك عامًا."
      );

    } catch (error) {
      console.error("Privacy update error:", error);
      toggle.checked = oldValue;
      toast(error.message || "تعذر تحديث الخصوصية.");

    } finally {
      toggle.disabled = false;
    }
  }

  function renderPrivacy(profile) {
    const toggle = $("profilePrivacyToggle");
    const description = $("profilePrivacyDescription");

    if (!toggle || !description) return;

    toggle.checked = Boolean(profile.is_private);

    description.textContent = profile.is_private
      ? "حساب خاص: منشوراتك لا تظهر إلا لمتابعيك المقبولين."
      : "حساب عام: يمكن للجميع مشاهدة منشوراتك.";
  }

  /* =====================================================
     PROFILE MEDIA
  ===================================================== */

  function createMediaSections() {
    if ($("profilePostsSection") || !$("profileContent")) return;

    installSocialStyles();

    const anchor = document.querySelector(".profile-privacy");
    if (!anchor) return;

    const tabs = document.createElement("nav");
    tabs.className = "profile-tabs";
    tabs.id = "profileMediaTabs";
    tabs.setAttribute("aria-label", "محتوى الملف الشخصي");
    tabs.innerHTML = `
      <button class="profile-tab active" type="button" data-tab="all">
        الكل
      </button>
      <button class="profile-tab" type="button" data-tab="videos">
        الفيديوهات
      </button>
      <button class="profile-tab" type="button" data-tab="posts">
        المنشورات
      </button>
    `;

    const wrapper = document.createElement("div");
    wrapper.id = "profileMediaWrapper";

    wrapper.innerHTML = `
      <section class="profile-media-section" id="profilePostsSection">
        <div class="profile-media-head">
          <div>
            <div class="profile-media-title">
              <svg viewBox="0 0 24 24">
                <path d="M4 4h16v16H4z"/>
                <path d="M8 8h8M8 12h8M8 16h5"/>
              </svg>
              منشوراتي
            </div>
            <div class="profile-media-count" id="profilePostsCount">
              منشورات حسابك
            </div>
          </div>
          <a class="profile-media-link" href="posts.html">
            كل المنشورات
          </a>
        </div>
        <div class="profile-media-grid" id="profilePostsGrid">
          <div class="profile-media-empty">جارٍ تحميل منشوراتك...</div>
        </div>
      </section>

      <section class="profile-media-section" id="profileVideosSection">
        <div class="profile-media-head">
          <div>
            <div class="profile-media-title">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="3"/>
                <path d="m10 8 5 4-5 4z"/>
              </svg>
              فيديوهاتي
            </div>
            <div class="profile-media-count" id="profileVideosCount">
              فيديوهاتك القصيرة
            </div>
          </div>
          <a class="profile-media-link" href="shorts.html">
            كل الفيديوهات
          </a>
        </div>
        <div class="profile-media-grid" id="profileVideosGrid">
          <div class="profile-media-empty">جارٍ تحميل فيديوهاتك...</div>
        </div>
      </section>
    `;

    anchor.insertAdjacentElement("afterend", tabs);
    tabs.insertAdjacentElement("afterend", wrapper);

    tabs.addEventListener("click", event => {
      const button = event.target.closest("[data-tab]");
      if (!button) return;

      tabs.querySelectorAll(".profile-tab").forEach(tab => {
        tab.classList.toggle("active", tab === button);
      });

      const selected = button.dataset.tab;
      const postsSection = $("profilePostsSection");
      const videosSection = $("profileVideosSection");

      postsSection.hidden = selected === "videos";
      videosSection.hidden = selected === "posts";
    });

    const modal = document.createElement("div");
    modal.className = "profile-media-modal";
    modal.id = "profileMediaModal";
    modal.innerHTML = `
      <div class="profile-media-modal-content">
        <button class="profile-media-close" type="button" aria-label="إغلاق">×</button>
        <div id="profileMediaModalBody"></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (
        event.target === modal ||
        event.target.closest(".profile-media-close")
      ) {
        closeMediaModal();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMediaModal();
    });
  }

  function closeMediaModal() {
    const modal = $("profileMediaModal");
    const body = $("profileMediaModalBody");

    if (!modal || !body) return;

    body.querySelectorAll("video").forEach(video => video.pause());
    body.replaceChildren();
    modal.classList.remove("open");
  }

  function openMediaModal(post) {
    const modal = $("profileMediaModal");
    const body = $("profileMediaModalBody");

    if (!modal || !body || !post.media_path) return;

    body.replaceChildren();

    const media = document.createElement(
      post.media_type === "video" ? "video" : "img"
    );

    media.src = getMediaURL(post.media_path);
    media.alt = post.content || "محتوى من الملف الشخصي";

    if (post.media_type === "video") {
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    }

    body.appendChild(media);
    modal.classList.add("open");
  }

  function makeMediaCard(post, isVideo) {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "profile-media-card" + (isVideo ? " video-card" : "");

    card.setAttribute(
      "aria-label",
      isVideo ? "مشاهدة الفيديو" : "عرض المنشور"
    );

    if (post.media_path) {
      const url = getMediaURL(post.media_path);

      if (isVideo) {
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        video.preload = "metadata";
        video.playsInline = true;
        card.appendChild(video);

        const mark = document.createElement("span");
        mark.className = "profile-video-mark";
        mark.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="m8 5 12 7-12 7z"/>
          </svg>
        `;
        card.appendChild(mark);

      } else {
        const image = document.createElement("img");
        image.src = url;
        image.alt = post.content || "صورة من منشوراتي";
        image.loading = "lazy";
        card.appendChild(image);
      }

    } else {
      const placeholder = document.createElement("div");
      placeholder.style.cssText =
        "height:100%;display:grid;place-items:center;padding:12px;color:#ddd;font-size:11px;line-height:1.8;text-align:center";
      placeholder.textContent = post.content || "منشور نصي";
      card.appendChild(placeholder);
    }

    if (post.content) {
      const caption = document.createElement("span");
      caption.className = "profile-media-caption";
      caption.textContent = post.content;
      card.appendChild(caption);
    }

    card.addEventListener("click", () => {
      if (post.media_path) {
        openMediaModal(post);
      } else {
        window.location.href = "posts.html";
      }
    });

    return card;
  }

  async function loadProfileMedia() {
    createMediaSections();

    const postsGrid = $("profilePostsGrid");
    const videosGrid = $("profileVideosGrid");

    if (!postsGrid || !videosGrid) return;

    postsGrid.innerHTML =
      '<div class="profile-media-empty">جارٍ تحميل منشوراتك...</div>';

    videosGrid.innerHTML =
      '<div class="profile-media-empty">جارٍ تحميل فيديوهاتك...</div>';

    const { data, error } = await supabase
      .from("posts")
      .select("id,user_id,content,media_path,media_type,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw error;

    const all = data || [];

    const videos = all.filter(post =>
      post.media_type === "video" && post.media_path
    );

    const posts = all.filter(post =>
      post.media_type !== "video"
    );

    $("profilePostsCount").textContent =
      `${formatCount(posts.length)} منشور`;

    $("profileVideosCount").textContent =
      `${formatCount(videos.length)} فيديو`;

    postsGrid.replaceChildren();
    videosGrid.replaceChildren();

    if (!posts.length) {
      const empty = document.createElement("div");
      empty.className = "profile-media-empty";
      empty.textContent = "لم تنشر أي منشورات بعد.";
      postsGrid.appendChild(empty);
    } else {
      posts.forEach(post => {
        postsGrid.appendChild(makeMediaCard(post, false));
      });
    }

    if (!videos.length) {
      const empty = document.createElement("div");
      empty.className = "profile-media-empty";
      empty.textContent = "لم تنشر أي فيديوهات قصيرة بعد.";
      videosGrid.appendChild(empty);
    } else {
      videos.forEach(post => {
        videosGrid.appendChild(makeMediaCard(post, true));
      });
    }

    if ($("profilePostsStat")) {
      $("profilePostsStat").textContent =
        formatCount(all.length);
    }
  }

  /* =====================================================
     PROFILE DISPLAY
  ===================================================== */

  function renderProfile(profile) {
    currentProfile = profile;

    const name = (
      profile.full_name || getAccountName()
    ).trim();

    const username = (
      profile.username || getAccountUsername()
    ).trim();

    const avatarFallback =
      currentUser?.user_metadata?.avatar_url ||
      currentUser?.user_metadata?.picture ||
      "";

    $("profileName").textContent = name;
    $("profileUsername").textContent = "@" + username;

    $("profileBio").textContent =
      profile.bio || "لم تضف نبذة شخصية بعد.";

    $("memberCode").textContent =
      profile.member_code || "غير متاح";

    renderAvatar(profile.avatar_path, name, avatarFallback);

    renderTags(
      $("hobbiesList"),
      parseList(profile.hobbies),
      "لم تتم إضافة هوايات بعد."
    );

    renderTags(
      $("readingList"),
      parseList(profile.reading_interests),
      "لم تتم إضافة اهتمامات قرائية بعد."
    );

    $("editName").value = name;
    $("editUsername").value = username;
    $("editBio").value = profile.bio || "";
    $("editHobbies").value = listToText(profile.hobbies);
    $("editReading").value = listToText(profile.reading_interests);

    renderQR(username);

    $("profileLoading").hidden = true;
    $("profileContent").hidden = false;

    createSocialProfileUI();
    renderPrivacy(profile);
  }

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "لم نعثر على ملفك في قاعدة البيانات. تأكد من اكتمال إنشاء الحساب."
      );
    }

    if (data.profile_completed === false) {
      window.location.href = "auth.html";
      return;
    }

    renderProfile(data);

    await Promise.all([
      loadProfileMedia(),
      loadSocialStats()
    ]);
  }

  /* =====================================================
     AVATAR UPLOAD
  ===================================================== */

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("اختر صورة صحيحة.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
    }

    const image = new Image();
    const objectURL = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("تعذرت قراءة الصورة.")
        );
        image.src = objectURL;
      });

      const canvas = document.createElement("canvas");
      const size = 512;

      canvas.width = size;
      canvas.height = size;

      const cropSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      const x = (image.naturalWidth - cropSize) / 2;
      const y = (image.naturalHeight - cropSize) / 2;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("تعذر تجهيز الصورة.");
      }

      context.drawImage(
        image,
        x, y, cropSize, cropSize,
        0, 0, size, size
      );

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/webp", 0.86);
      });

      if (!blob) {
        throw new Error("تعذر تجهيز الصورة.");
      }

      return blob;

    } finally {
      URL.revokeObjectURL(objectURL);
    }
  }

  async function uploadAvatar(file) {
    const blob = await compressImage(file);
    const path = `${currentUser.id}/avatar.webp`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "3600"
      });

    if (error) throw error;

    return path;
  }

  /* =====================================================
     SAVE PROFILE
  ===================================================== */

  async function saveProfile(event) {
    event.preventDefault();

    if (busy) return;

    const button = $("saveProfileButton");

    busy = true;
    button.disabled = true;
    button.textContent = "جارٍ الحفظ...";

    try {
      const fullName = $("editName").value.trim();

      const username = $("editUsername").value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

      const bio = $("editBio").value.trim();

      if (fullName.length < 2 || fullName.length > 80) {
        throw new Error("الاسم يجب أن يكون بين حرفين و80 حرفًا.");
      }

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        throw new Error(
          "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _."
        );
      }

      if (bio.length > 250) {
        throw new Error("النبذة يجب ألا تتجاوز 250 حرفًا.");
      }

      const file = $("avatarInput").files?.[0];
      let avatarPath = currentProfile.avatar_path;

      if (file) {
        avatarPath = await uploadAvatar(file);
      }

      const hobbies = splitInput($("editHobbies").value);
      const reading = splitInput($("editReading").value);

      const updates = {
        full_name: fullName,
        username,
        bio,
        avatar_path: avatarPath,
        hobbies,
        reading_interests: reading,
        interests: hobbies,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id)
        .select("*")
        .single();

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("duplicate key")
        ) {
          throw new Error("اسم المستخدم مستخدم بالفعل.");
        }

        throw error;
      }

      $("avatarInput").value = "";

      renderProfile(data);
      showMessage("تم حفظ بياناتك بنجاح.", "success");
      toast("تم تحديث اسمك وصورتك وبياناتك.");

    } catch (error) {
      console.error("Profile save error:", error);
      showMessage(error.message || "تعذر حفظ التعديلات.");

    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "حفظ التعديلات";
    }
  }

  /* =====================================================
     CLIPBOARD / LOGOUT
  ===================================================== */

  async function copyText(value, successMessage) {
    if (!value) {
      toast("لا توجد بيانات لنسخها.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast(successMessage);

    } catch {
      const input = document.createElement("textarea");

      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";

      document.body.appendChild(input);
      input.select();

      const copied = document.execCommand("copy");
      input.remove();

      toast(
        copied
          ? successMessage
          : "تعذر النسخ من هذا المتصفح."
      );
    }
  }

  async function logout() {
    const confirmed = confirm("هل تريد تسجيل الخروج من هنون؟");
    if (!confirmed) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      toast("تعذر تسجيل الخروج.");
      return;
    }

    window.location.href = "auth.html";
  }

  function bindEvents() {
    $("profileForm").addEventListener("submit", saveProfile);
    $("logoutButton").addEventListener("click", logout);

    $("editProfileShortcut")?.addEventListener("click", () => {
      $("editSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    $("copyMemberCode").addEventListener("click", () => {
      copyText(
        currentProfile?.member_code,
        "تم نسخ رقم العضوية."
      );
    });

    $("copyProfileLink").addEventListener("click", () => {
      const url = getPublicProfileURL(
        currentProfile?.username || getAccountUsername()
      );

      copyText(url, "تم نسخ رابط الملف الشخصي.");
    });

    $("avatarInput").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast("اختر ملف صورة صحيحًا.");
        event.target.value = "";
        return;
      }

      const previewURL = URL.createObjectURL(file);
      const container = $("profileAvatar");
      const image = document.createElement("img");

      image.src = previewURL;
      image.alt = "معاينة الصورة الشخصية";

      image.onload = () => URL.revokeObjectURL(previewURL);

      image.onerror = () => {
        URL.revokeObjectURL(previewURL);
        toast("تعذرت معاينة الصورة.");
      };

      container.replaceChildren(image);
    });

    window.addEventListener("hanoon:post-created", () => {
      Promise.all([
        loadProfileMedia(),
        loadSocialStats()
      ]).catch(error => {
        console.error("Profile refresh error:", error);
      });
    });

    window.addEventListener("hanoon:short-created", () => {
      Promise.all([
        loadProfileMedia(),
        loadSocialStats()
      ]).catch(error => {
        console.error("Profile refresh error:", error);
      });
    });
  }

  async function start() {
    try {
      supabase = await waitForSupabase();

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        window.location.href = "auth.html";
        return;
      }

      currentUser = data.session.user;

      bindEvents();
      await loadProfile();

      console.info("HANOON: TikTok-style profile is ready.");

    } catch (error) {
      console.error("HANOON profile error:", error);

      if ($("profileLoading")) {
        $("profileLoading").hidden = true;
      }

      showPageError(
        error.message ||
        "حدث خطأ أثناء تحميل الملف الشخصي."
      );
    }
  }

  start();

})();
