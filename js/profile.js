
/* =====================================================
   HANOON - PROFILE SYSTEM
   Profile / Avatar / QR / Posts / Short Videos
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

    return value.filter(
      item => typeof item === "string" && item.trim()
    );
  }

  function splitInput(value) {
    return value
      .split(/[،,]/)
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

    const url = path
      ? getAvatarURL(path)
      : fallbackURL;

    if (!url) {
      container.textContent = (name || "H").trim().charAt(0) || "H";
      return;
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = "الصورة الشخصية";
    image.loading = "eager";

    image.onerror = () => {
      container.replaceChildren();
      container.textContent = (name || "H").trim().charAt(0) || "H";
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

    const publicURL = getPublicProfileURL(username);

    new QRCode(container, {
      text: publicURL,
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
     PROFILE MEDIA DESIGN
  ===================================================== */

  function installMediaStyles() {
    if ($("profileMediaStyles")) return;

    const style = document.createElement("style");
    style.id = "profileMediaStyles";

    style.textContent = `
      .profile-media-section{
        position:relative;
        overflow:hidden;
        margin-top:22px;
        padding:22px;
        border:1px solid rgba(195,164,255,.20);
        border-radius:23px;
        background:linear-gradient(145deg,rgba(26,19,51,.92),rgba(10,8,28,.94));
        box-shadow:0 18px 48px rgba(0,0,0,.25);
      }

      .profile-media-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:17px;
      }

      .profile-media-title{
        display:flex;
        align-items:center;
        gap:10px;
        font-size:17px;
        font-weight:900;
      }

      .profile-media-title svg{
        width:22px;
        height:22px;
        fill:none;
        stroke:#c2a9ff;
        stroke-width:1.8;
      }

      .profile-media-count{
        color:#b7b2ca;
        font-size:10px;
      }

      .profile-media-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }

      .profile-media-card{
        position:relative;
        min-width:0;
        overflow:hidden;
        aspect-ratio:1/1;
        border:1px solid rgba(255,255,255,.12);
        border-radius:14px;
        background:#111026;
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
        aspect-ratio:9/14;
      }

      .profile-video-mark{
        position:absolute;
        left:8px;
        bottom:8px;
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        border:1px solid #ffffff55;
        border-radius:50%;
        background:#080817aa;
        color:#fff;
        pointer-events:none;
      }

      .profile-video-mark svg{
        width:15px;
        height:15px;
        fill:none;
        stroke:currentColor;
        stroke-width:2;
      }

      .profile-media-caption{
        position:absolute;
        right:0;
        left:0;
        bottom:0;
        padding:20px 8px 7px;
        overflow:hidden;
        color:#fff;
        font-size:9px;
        line-height:1.7;
        background:linear-gradient(transparent,#000b);
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .profile-media-empty{
        grid-column:1/-1;
        padding:28px 12px;
        border:1px dashed rgba(195,164,255,.25);
        border-radius:15px;
        color:#b7b2ca;
        text-align:center;
        font-size:11px;
        line-height:2;
      }

      .profile-media-link{
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:34px;
        padding:6px 12px;
        border:1px solid rgba(165,138,255,.32);
        border-radius:10px;
        background:rgba(165,138,255,.10);
        color:#e1d6ff;
        font-size:10px;
        font-weight:900;
        white-space:nowrap;
      }

      .profile-media-modal{
        position:fixed;
        inset:0;
        z-index:9999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(3,3,12,.94);
        backdrop-filter:blur(15px);
      }

      .profile-media-modal.open{
        display:flex;
      }

      .profile-media-modal-content{
        position:relative;
        width:min(100%,650px);
        max-height:88dvh;
        display:grid;
        place-items:center;
      }

      .profile-media-modal-content img,
      .profile-media-modal-content video{
        display:block;
        max-width:100%;
        max-height:82dvh;
        border-radius:15px;
        object-fit:contain;
        background:#000;
      }

      .profile-media-close{
        position:absolute;
        top:-43px;
        left:0;
        width:36px;
        height:36px;
        border:1px solid #ffffff44;
        border-radius:50%;
        background:#ffffff15;
        color:white;
        font-size:20px;
      }

      @media(max-width:600px){
        .profile-media-section{padding:17px 12px}
        .profile-media-grid{gap:6px}
        .profile-media-card{border-radius:10px}
        .profile-media-head{align-items:flex-start}
        .profile-media-title{font-size:14px}
      }
    `;

    document.head.appendChild(style);
  }

  function createMediaSections() {
    if ($("profilePostsSection") || !$("profileContent")) return;

    installMediaStyles();

    const anchor = document.querySelector(".profile-actions");
    if (!anchor) return;

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
            <div class="profile-media-count" id="profilePostsCount">منشورات حسابك</div>
          </div>
          <a class="profile-media-link" href="posts.html">كل المنشورات</a>
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
            <div class="profile-media-count" id="profileVideosCount">فيديوهاتك القصيرة</div>
          </div>
          <a class="profile-media-link" href="shorts.html">كل الفيديوهات</a>
        </div>
        <div class="profile-media-grid" id="profileVideosGrid">
          <div class="profile-media-empty">جارٍ تحميل فيديوهاتك...</div>
        </div>
      </section>
    `;

    anchor.insertAdjacentElement("afterend", wrapper);

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

    const url = getMediaURL(post.media_path);
    const isVideo = post.media_type === "video";

    const media = document.createElement(isVideo ? "video" : "img");
    media.src = url;
    media.alt = post.content || "محتوى من الملف الشخصي";

    if (isVideo) {
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
    card.className = "profile-media-card" + (isVideo ? " video-card" : "");
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
        "height:100%;display:grid;place-items:center;padding:12px;color:#e1d6ff;font-size:11px;line-height:1.8;text-align:center";
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
      `${posts.length} منشور`;

    $("profileVideosCount").textContent =
      `${videos.length} فيديو`;

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
  }

  /* =====================================================
     PROFILE DISPLAY
  ===================================================== */

  function renderProfile(profile) {
    currentProfile = profile;

    const name = (
      profile.full_name ||
      getAccountName()
    ).trim();

    const username = (
      profile.username ||
      getAccountUsername()
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

    renderAvatar(
      profile.avatar_path,
      name,
      avatarFallback
    );

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
    await loadProfileMedia();
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

      showMessage(
        error.message || "تعذر حفظ التعديلات."
      );

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
      loadProfileMedia().catch(error => {
        console.error("Profile posts refresh:", error);
      });
    });

    window.addEventListener("hanoon:short-created", () => {
      loadProfileMedia().catch(error => {
        console.error("Profile videos refresh:", error);
      });
    });
  }

  async function start() {
    try {
      supabase = await waitForSupabase();

      const { data, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        window.location.href = "auth.html";
        return;
      }

      currentUser = data.session.user;

      bindEvents();
      await loadProfile();

      console.info("HANOON: Profile system is ready.");

    } catch (error) {
      console.error("HANOON profile error:", error);

      $("profileLoading").hidden = true;

      showPageError(
        error.message ||
        "حدث خطأ أثناء تحميل الملف الشخصي."
      );
    }
  }

  start();

})();
