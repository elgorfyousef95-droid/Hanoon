
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const el = {
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
  let viewer = null;
  let isPrivate = false;
  let isFollowing = false;
  let outgoingRequest = null;
  let incomingRequests = [];

  const number = value =>
    new Intl.NumberFormat("ar-EG").format(value || 0);

  function showError(message) {
    el.loading.hidden = true;
    el.content.hidden = true;
    el.error.textContent = message;
    el.error.classList.add("show");
  }

  function showLoading(message) {
    el.loading.hidden = false;
    el.loading.textContent = message;
    el.error.classList.remove("show");
    el.content.hidden = true;
  }

  function showContent() {
    el.loading.hidden = true;
    el.error.classList.remove("show");
    el.content.hidden = false;
  }

  function toast(message) {
    let node = $("memberToast");

    if (!node) {
      node = document.createElement("div");
      node.id = "memberToast";
      node.style.cssText = `
        position:fixed;bottom:22px;left:50%;
        transform:translateX(-50%);z-index:10020;
        padding:12px 20px;border-radius:10px;
        background:#252525;color:white;
        font:700 12px Cairo,sans-serif;
        box-shadow:0 10px 30px #0008;
        text-align:center;max-width:90%;
      `;
      document.body.appendChild(node);
    }

    node.textContent = message;
    node.hidden = false;

    clearTimeout(node._timer);
    node._timer = setTimeout(() => {
      node.hidden = true;
    }, 2600);
  }

  async function waitForSupabase() {
    if (window.HANOON?.supabase) {
      return window.HANOON.supabase;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("تعذر الاتصال بقاعدة البيانات."));
      }, 15000);

      function cleanup() {
        clearTimeout(timeout);
        window.removeEventListener("hanoon:supabase-ready", ready);
        window.removeEventListener("hanoon:supabase-error", failed);
      }

      function ready() {
        const client = window.HANOON?.supabase;
        cleanup();

        if (client) resolve(client);
        else reject(new Error("لم يتم تجهيز اتصال قاعدة البيانات."));
      }

      function failed(event) {
        cleanup();
        reject(new Error(
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات."
        ));
      }

      window.addEventListener("hanoon:supabase-ready", ready);
      window.addEventListener("hanoon:supabase-error", failed);
    });
  }

  function getSearchValue() {
    const params = new URLSearchParams(location.search);

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
      throw new Error("رابط الملف الشخصي غير مكتمل.");
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(error);
      throw new Error("حدث خطأ أثناء البحث عن العضو.");
    }

    if (!data) throw new Error("لم نعثر على هذا العضو.");

    return data;
  }

  function getStorageURL(bucket, path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return db.storage.from(bucket).getPublicUrl(path).data?.publicUrl || "";
  }

  function renderTags(container, values, emptyMessage) {
    if (!container) return;

    container.replaceChildren();

    const list = Array.isArray(values)
      ? values.filter(value =>
          typeof value === "string" && value.trim()
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

  function renderMember(profile) {
    member = profile;

    const name = profile.full_name || "عضو هنون";

    el.name.textContent = name;
    el.username.textContent = profile.username
      ? "@" + profile.username
      : "";

    el.bio.textContent =
      profile.bio || "لم يضف العضو نبذة شخصية بعد.";

    el.code.textContent = profile.member_code
      ? "HANOON ID: " + profile.member_code
      : "عضو في مجتمع هنون";

    el.avatar.replaceChildren();

    const avatarURL = getStorageURL("avatars", profile.avatar_path);

    if (avatarURL) {
      const image = document.createElement("img");
      image.src = avatarURL;
      image.alt = name;
      image.loading = "lazy";

      image.onerror = () => {
        el.avatar.textContent = name.charAt(0) || "هـ";
      };

      el.avatar.appendChild(image);
    } else {
      el.avatar.textContent = name.charAt(0) || "هـ";
    }

    renderTags(el.hobbies, profile.hobbies, "لا توجد هوايات مضافة.");
    renderTags(el.reading, profile.reading_interests, "لا توجد اهتمامات مضافة.");

    document.title = name + " | HANOON";

    createSocialSections();
    createMediaSections();
  }

  /* قسم الإحصائيات والأزرار */

  function createSocialSections() {
    if ($("memberSocialSection")) return;

    const section = document.createElement("section");
    section.className = "member-social";
    section.id = "memberSocialSection";

    section.innerHTML = `
      <div class="member-stats">
        <button class="member-stat" id="memberPostsStat" type="button">
          <strong>—</strong><span>المنشورات</span>
        </button>
        <button class="member-stat" id="memberFollowersStat" type="button">
          <strong>—</strong><span>المتابعون</span>
        </button>
        <button class="member-stat" id="memberFollowingStat" type="button">
          <strong>—</strong><span>يتابع</span>
        </button>
      </div>
      <div class="member-actions" id="memberActionButtons"></div>
      <div id="memberIncomingRequests"></div>
      <div id="memberPrivateNote"></div>
    `;

    const card = document.querySelector(".card");
    if (!card) return;

    card.insertAdjacentElement("afterend", section);

    $("memberFollowersStat").addEventListener("click", () => {
      openMemberList("followers");
    });

    $("memberFollowingStat").addEventListener("click", () => {
      openMemberList("following");
    });

    const modal = document.createElement("div");
    modal.className = "member-list-modal";
    modal.id = "memberListModal";

    modal.innerHTML = `
      <div class="member-list-box">
        <div class="member-list-head">
          <span id="memberListTitle">القائمة</span>
          <button class="member-list-close" type="button">×</button>
        </div>
        <div id="memberListContent"></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (
        event.target === modal ||
        event.target.closest(".member-list-close")
      ) {
        modal.classList.remove("open");
      }
    });
  }

  function addActionButton(label, action, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "member-action" + (primary ? " primary" : "");
    button.textContent = label;
    button.addEventListener("click", action);

    $("memberActionButtons").appendChild(button);
    return button;
  }

  async function loadTargetPrivacy() {
    const { data, error } = await db
      .from("profiles")
      .select("is_private")
      .eq("id", member.id)
      .maybeSingle();

    if (error) throw error;
    isPrivate = Boolean(data?.is_private);
  }

  async function loadFollowState() {
    if (!viewer || viewer.id === member.id) return;

    const [follow, outgoing] = await Promise.all([
      db.from("follows")
        .select("follower_id")
        .eq("follower_id", viewer.id)
        .eq("following_id", member.id)
        .maybeSingle(),

      db.from("follow_requests")
        .select("id,status")
        .eq("sender_id", viewer.id)
        .eq("receiver_id", member.id)
        .eq("status", "pending")
        .maybeSingle()
    ]);

    if (follow.error) throw follow.error;
    if (outgoing.error) throw outgoing.error;

    isFollowing = Boolean(follow.data);
    outgoingRequest = outgoing.data || null;
  }

  async function loadIncomingRequests() {
    incomingRequests = [];

    if (!viewer || viewer.id !== member.id) return;

    const { data, error } = await db
      .from("follow_requests")
      .select("id,sender_id,created_at")
      .eq("receiver_id", viewer.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    incomingRequests = data || [];
  }

  async function loadSocialStats() {
    const posts = await db
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.id);

    if (posts.error) console.warn(posts.error);

    $("memberPostsStat").querySelector("strong").textContent =
      number(posts.count || 0);

    const canSeeCounts =
      !isPrivate ||
      (viewer && (viewer.id === member.id || isFollowing));

    if (!canSeeCounts) {
      $("memberFollowersStat").querySelector("strong").textContent = "—";
      $("memberFollowingStat").querySelector("strong").textContent = "—";
      return;
    }

    const [followers, following] = await Promise.all([
      db.from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", member.id),

      db.from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", member.id)
    ]);

    if (followers.error) throw followers.error;
    if (following.error) throw following.error;

    $("memberFollowersStat").querySelector("strong").textContent =
      number(followers.count || 0);

    $("memberFollowingStat").querySelector("strong").textContent =
      number(following.count || 0);
  }

  /* المتابعة */

  async function followMember(button) {
    button.disabled = true;

    try {
      if (isPrivate) {
        const { error } = await db
          .from("follow_requests")
          .insert({
            sender_id: viewer.id,
            receiver_id: member.id,
            status: "pending"
          });

        if (error) throw error;

        outgoingRequest = { status: "pending" };
        toast("تم إرسال طلب المتابعة.");
      } else {
        const { error } = await db
          .from("follows")
          .insert({
            follower_id: viewer.id,
            following_id: member.id
          });

        if (error) throw error;

        isFollowing = true;
        toast("أصبحت تتابع هذا العضو.");
      }

      await refreshSocial();
    } catch (error) {
      console.error(error);
      toast(error.code === "23505"
        ? "الطلب أو المتابعة موجود بالفعل."
        : error.message || "تعذرت عملية المتابعة.");
    } finally {
      button.disabled = false;
    }
  }

  async function cancelRequest(button) {
    if (!outgoingRequest?.id) return;

    button.disabled = true;

    try {
      const { error } = await db
        .from("follow_requests")
        .delete()
        .eq("id", outgoingRequest.id)
        .eq("sender_id", viewer.id)
        .eq("status", "pending");

      if (error) throw error;

      outgoingRequest = null;
      toast("تم إلغاء طلب المتابعة.");
      await refreshSocial();
    } catch (error) {
      console.error(error);
      toast("تعذر إلغاء الطلب.");
    } finally {
      button.disabled = false;
    }
  }

  async function unfollowMember(button) {
    if (!confirm("هل تريد إلغاء متابعة هذا العضو؟")) return;

    button.disabled = true;

    try {
      const { error } = await db
        .from("follows")
        .delete()
        .eq("follower_id", viewer.id)
        .eq("following_id", member.id);

      if (error) throw error;

      isFollowing = false;
      toast("تم إلغاء المتابعة.");
      await refreshSocial();
    } catch (error) {
      console.error(error);
      toast("تعذر إلغاء المتابعة.");
    } finally {
      button.disabled = false;
    }
  }

  /* طلبات المتابعة الواردة */

  async function respondToRequest(request, status, button) {
    button.disabled = true;

    try {
      const { data, error } = await db
        .from("follow_requests")
        .update({ status })
        .eq("id", request.id)
        .eq("receiver_id", viewer.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("الطلب لم يعد متاحًا.");

      if (status === "accepted") {
        const { error: followError } = await db
          .from("follows")
          .insert({
            follower_id: request.sender_id,
            following_id: viewer.id
          });

        if (followError && followError.code !== "23505") {
          throw followError;
        }

        toast("تم قبول طلب المتابعة.");
      } else {
        toast("تم رفض طلب المتابعة.");
      }

      await refreshSocial();
    } catch (error) {
      console.error(error);
      toast(error.message || "تعذرت معالجة الطلب.");
      button.disabled = false;
    }
  }

  async function renderIncomingRequests() {
    const container = $("memberIncomingRequests");
    container.replaceChildren();

    if (!incomingRequests.length) return;

    const ids = incomingRequests.map(request => request.sender_id);

    const { data: people, error } = await db
      .from("member_directory")
      .select("id,full_name,username")
      .in("id", ids);

    if (error) {
      console.error(error);
      return;
    }

    const peopleById = new Map(
      (people || []).map(person => [person.id, person])
    );

    const box = document.createElement("div");
    box.className = "member-request-box";

    const title = document.createElement("div");
    title.className = "member-request-title";
    title.textContent = "طلبات المتابعة";
    box.appendChild(title);

    incomingRequests.forEach(request => {
      const person = peopleById.get(request.sender_id);
      const row = document.createElement("div");
      row.className = "member-request-row";

      const name = document.createElement("span");
      name.textContent =
        person?.full_name ||
        (person?.username ? "@" + person.username : "عضو هنون");

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px";

      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = "قبول";
      accept.addEventListener("click", () => {
        respondToRequest(request, "accepted", accept);
      });

      const reject = document.createElement("button");
      reject.type = "button";
      reject.textContent = "رفض";
      reject.style.background = "#633b50";
      reject.addEventListener("click", () => {
        respondToRequest(request, "rejected", reject);
      });

      actions.append(accept, reject);
      row.append(name, actions);
      box.appendChild(row);
    });

    container.appendChild(box);
  }

  function renderActionButtons() {
    const container = $("memberActionButtons");
    container.replaceChildren();
    $("memberIncomingRequests").replaceChildren();

    if (!viewer) {
      addActionButton("تسجيل الدخول للمتابعة", () => {
        location.href = "../index.html";
      }, true);
      return;
    }

    if (viewer.id === member.id) {
      addActionButton("تعديل الملف الشخصي", () => {
        location.href = "profile.html";
      }, true);

      renderIncomingRequests();
      return;
    }

    if (isFollowing) {
      addActionButton(
        "إلغاء المتابعة",
        event => unfollowMember(event.currentTarget)
      );
    } else if (outgoingRequest) {
      addActionButton(
        "إلغاء طلب المتابعة",
        event => cancelRequest(event.currentTarget)
      );
    } else {
      addActionButton(
        isPrivate ? "طلب متابعة" : "متابعة",
        event => followMember(event.currentTarget),
        true
      );
    }

    addActionButton("مشاركة الملف", () => {
      const link = location.href;

      if (navigator.share) {
        navigator.share({
          title: member.full_name || "عضو هنون",
          url: link
        }).catch(() => {});
      } else {
        copyText(link);
      }
    });
  }

  async function refreshSocial() {
    await Promise.all([
      loadFollowState(),
      loadIncomingRequests()
    ]);

    renderActionButtons();
    await loadSocialStats();
    await loadMemberMedia();
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast("تم نسخ رابط الملف الشخصي.");
    } catch {
      toast("تعذر النسخ من المتصفح.");
    }
  }

  /* قوائم المتابعين */

  async function openMemberList(type) {
    if (
      isPrivate &&
      (!viewer || (viewer.id !== member.id && !isFollowing))
    ) {
      toast("قوائم هذا الحساب خاصة بالمتابعين المقبولين.");
      return;
    }

    const modal = $("memberListModal");
    const content = $("memberListContent");

    $("memberListTitle").textContent =
      type === "followers" ? "المتابعون" : "يتابع";

    content.innerHTML =
      '<div class="member-list-empty">جارٍ تحميل القائمة...</div>';

    modal.classList.add("open");

    try {
      let query = db
        .from("follows")
        .select("follower_id,following_id");

      query = type === "followers"
        ? query.eq("following_id", member.id)
        : query.eq("follower_id", member.id);

      const { data, error } = await query.limit(200);
      if (error) throw error;

      const ids = (data || []).map(item =>
        type === "followers" ? item.follower_id : item.following_id
      );

      if (!ids.length) {
        content.innerHTML =
          '<div class="member-list-empty">لا توجد حسابات في هذه القائمة.</div>';
        return;
      }

      const { data: people, error: peopleError } = await db
        .from("member_directory")
        .select("id,username,full_name,avatar_path")
        .in("id", ids);

      if (peopleError) throw peopleError;

      const byId = new Map(
        (people || []).map(person => [person.id, person])
      );

      content.replaceChildren();

      ids.forEach(id => {
        const person = byId.get(id);
        if (!person) return;

        const link = document.createElement("a");
        link.className = "member-list-person";
        link.href = `member.html?id=${encodeURIComponent(id)}`;

        const avatarURL = getStorageURL("avatars", person.avatar_path);

        if (avatarURL) {
          const image = document.createElement("img");
          image.src = avatarURL;
          image.alt = "";
          link.appendChild(image);
        } else {
          const avatar = document.createElement("span");
          avatar.className = "member-list-avatar";
          avatar.textContent = (person.full_name || "هـ").charAt(0);
          link.appendChild(avatar);
        }

        const details = document.createElement("span");
        details.textContent = person.full_name || "عضو هنون";

        const username = document.createElement("small");
        username.textContent = person.username ? "@" + person.username : "";

        details.appendChild(username);
        link.appendChild(details);
        content.appendChild(link);
      });

      if (!content.children.length) {
        content.innerHTML =
          '<div class="member-list-empty">لا توجد حسابات ظاهرة.</div>';
      }
    } catch (error) {
      console.error(error);
      content.innerHTML =
        '<div class="member-list-empty">تعذر تحميل القائمة.</div>';
    }
  }

  /* الفيديوهات والمنشورات */

  function createMediaSections() {
    if ($("memberPostsSection")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "memberMediaWrapper";

    wrapper.innerHTML = `
      <nav class="member-tabs">
        <button class="member-tab active" data-tab="posts" type="button">
          المنشورات
        </button>
        <button class="member-tab" data-tab="videos" type="button">
          الفيديوهات
        </button>
      </nav>

      <section class="member-media-section" id="memberPostsSection">
        <div class="member-media-grid" id="memberPostsGrid">
          <div class="member-media-empty">جارٍ تحميل المنشورات...</div>
        </div>
      </section>

      <section class="member-media-section" id="memberVideosSection" hidden>
        <div class="member-media-grid" id="memberVideosGrid">
          <div class="member-media-empty">جارٍ تحميل الفيديوهات...</div>
        </div>
      </section>
    `;

    wrapper.querySelectorAll("[data-tab]").forEach(button => {
      button.addEventListener("click", () => {
        wrapper.querySelectorAll(".member-tab").forEach(tab => {
          tab.classList.toggle("active", tab === button);
        });

        $("memberPostsSection").hidden =
          button.dataset.tab !== "posts";

        $("memberVideosSection").hidden =
          button.dataset.tab !== "videos";
      });
    });

    $("memberSocialSection").insertAdjacentElement("afterend", wrapper);

    const viewerBox = document.createElement("div");
    viewerBox.className = "member-viewer";
    viewerBox.id = "memberViewer";

    viewerBox.innerHTML = `
      <button class="member-viewer-close" type="button">×</button>
      <div id="memberViewerBody"></div>
    `;

    document.body.appendChild(viewerBox);

    viewerBox.addEventListener("click", event => {
      if (
        event.target === viewerBox ||
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
    const viewerElement = $("memberViewer");
    const body = $("memberViewerBody");

    if (!viewerElement || !body) return;

    body.querySelectorAll("video").forEach(video => video.pause());
    body.replaceChildren();
    viewerElement.classList.remove("open");
  }

  function openViewer(post) {
    const viewerElement = $("memberViewer");
    const body = $("memberViewerBody");
    const url = getStorageURL("post-media", post.media_path);

    if (!url) {
      toast("تعذر فتح الوسائط.");
      return;
    }

    body.replaceChildren();

    const isVideo = post.media_type === "video";
    const media = document.createElement(isVideo ? "video" : "img");

    media.src = url;
    media.alt = post.content || "منشور هنون";

    if (isVideo) {
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    }

    body.appendChild(media);
    viewerElement.classList.add("open");
  }

  function makeMediaCard(post) {
    const isVideo = post.media_type === "video";

    const card = document.createElement("button");
    card.type = "button";
    card.className = "member-media-item";

    if (post.media_path) {
      const url = getStorageURL("post-media", post.media_path);

      if (url) {
        const media = document.createElement(isVideo ? "video" : "img");
        media.src = url;
        media.alt = post.content || "منشور";
        media.loading = "lazy";

        if (isVideo) {
          media.muted = true;
          media.preload = "metadata";
          media.playsInline = true;
        }

        card.appendChild(media);
      }
    } else {
      const text = document.createElement("span");
      text.className = "member-media-text";
      text.textContent = post.content || "منشور نصي";
      card.appendChild(text);
    }

    if (post.content) {
      const caption = document.createElement("span");
      caption.className = "member-media-caption";
      caption.textContent = post.content;
      card.appendChild(caption);
    }

    card.addEventListener("click", () => {
      if (post.media_path) openViewer(post);
    });

    return card;
  }

  async function loadMemberMedia() {
    const postsGrid = $("memberPostsGrid");
    const videosGrid = $("memberVideosGrid");

    const canSeeContent =
      !isPrivate ||
      (viewer && (viewer.id === member.id || isFollowing));

    if (!canSeeContent) {
      postsGrid.innerHTML =
        '<div class="member-media-empty">هذا الحساب خاص. تابع العضو وانتظر موافقته لمشاهدة منشوراته.</div>';

      videosGrid.innerHTML =
        '<div class="member-media-empty">الفيديوهات متاحة للمتابعين المقبولين فقط.</div>';

      return;
    }

    const { data, error } = await db
      .from("posts")
      .select("id,user_id,content,media_path,media_type,created_at")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error(error);

      postsGrid.innerHTML =
        '<div class="member-media-empty">تعذر تحميل المنشورات.</div>';

      videosGrid.innerHTML =
        '<div class="member-media-empty">تعذر تحميل الفيديوهات.</div>';

      return;
    }

    const all = data || [];
    const posts = all.filter(post => post.media_type !== "video");
    const videos = all.filter(post => post.media_type === "video");

    postsGrid.replaceChildren();
    videosGrid.replaceChildren();

    if (!posts.length) {
      postsGrid.innerHTML =
        '<div class="member-media-empty">لا توجد منشورات حتى الآن.</div>';
    } else {
      posts.forEach(post =>
        postsGrid.appendChild(makeMediaCard(post))
      );
    }

    if (!videos.length) {
      videosGrid.innerHTML =
        '<div class="member-media-empty">لا توجد فيديوهات حتى الآن.</div>';
    } else {
      videos.forEach(video =>
        videosGrid.appendChild(makeMediaCard(video))
      );
    }
  }

  /* تشغيل صفحة العضو */

  async function init() {
    try {
      showLoading("جارٍ الاتصال بقاعدة البيانات...");

      db = await waitForSupabase();

      const sessionResult = await db.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;

      viewer = sessionResult.data.session?.user || null;

      showLoading("جارٍ البحث عن العضو...");

      member = await findMember(getSearchValue());

      renderMember(member);

      await loadTargetPrivacy();

      if (viewer && viewer.id !== member.id) {
        await loadFollowState();
      }

      if (viewer && viewer.id === member.id) {
        await loadIncomingRequests();
      }

      renderActionButtons();

      await loadSocialStats();
      await loadMemberMedia();

      if (isPrivate && viewer?.id !== member.id && !isFollowing) {
        $("memberPrivateNote").className = "member-private-note";
        $("memberPrivateNote").textContent =
          "هذا الحساب خاص. أرسل طلب متابعة وانتظر موافقة صاحبه لمشاهدة منشوراته.";
      }

      showContent();
    } catch (error) {
      console.error("HANOON member page:", error);
      showError(error.message || "تعذر عرض الملف الشخصي.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
