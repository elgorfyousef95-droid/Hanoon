
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
        transform:translateX(-50%);
        z-index:10020;padding:12px 20px;
        border:1px solid #ffffff25;border-radius:12px;
        background:#211a38;color:#fff;
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

    if (!data) {
      throw new Error("لم نعثر على هذا العضو.");
    }

    return data;
  }

  function getStorageURL(bucket, path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return db.storage.from(bucket).getPublicUrl(path).data?.publicUrl || "";
  }

  function renderTags(container, values, emptyMessage) {
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

    renderTags(
      el.hobbies,
      profile.hobbies,
      "لم يضف العضو هواياته بعد."
    );

    renderTags(
      el.reading,
      profile.reading_interests,
      "لم يحدد اهتماماته القرائية بعد."
    );

    document.title = name + " | HANOON";

    installSocialStyles();
    createSocialSections();
    createMediaSections();
  }

  /* ==========================================
     تنسيق المتابعة
  ========================================== */

  function installSocialStyles() {
    if ($("memberSocialStyles")) return;

    const style = document.createElement("style");
    style.id = "memberSocialStyles";

    style.textContent = `
      .member-social{
        margin-top:20px;
        padding:18px;
        border:1px solid rgba(193,171,255,.22);
        border-radius:20px;
        background:rgba(20,16,39,.82);
        backdrop-filter:blur(18px);
      }

      .member-stats{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:5px;
        margin-bottom:16px;
      }

      .member-stat{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:3px;
        border:0;
        background:transparent;
        color:#fff;
        cursor:pointer;
      }

      .member-stat strong{
        font-size:18px;
        font-weight:900;
      }

      .member-stat span{
        color:#bdb5d2;
        font-size:10px;
      }

      .member-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:9px;
      }

      .member-action{
        min-height:42px;
        flex:1;
        padding:9px 13px;
        border:1px solid #ffffff24;
        border-radius:10px;
        background:#ffffff0d;
        color:#fff;
        font:800 12px Cairo,sans-serif;
        cursor:pointer;
      }

      .member-action.primary{
        border-color:#fe2c55;
        background:#fe2c55;
        color:white;
      }

      .member-action:disabled{
        opacity:.55;
        cursor:wait;
      }

      .member-request-box{
        margin-top:14px;
        padding:13px;
        border:1px solid #c1aaff30;
        border-radius:13px;
        background:#ffffff08;
      }

      .member-request-title{
        margin-bottom:9px;
        color:#fff;
        font-size:12px;
        font-weight:900;
      }

      .member-request-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:8px 0;
        border-top:1px solid #ffffff12;
      }

      .member-request-row span{
        color:#eee;
        font-size:11px;
      }

      .member-request-row button{
        padding:6px 10px;
        border:0;
        border-radius:8px;
        background:#8c70e8;
        color:white;
        font:700 10px Cairo,sans-serif;
      }

      .member-private-note{
        margin-top:15px;
        padding:15px;
        border:1px solid #ffffff20;
        border-radius:13px;
        color:#d8cfff;
        background:#ffffff08;
        font-size:11px;
        line-height:2;
        text-align:center;
      }

      .member-list-modal{
        position:fixed;
        inset:0;
        z-index:10010;
        display:none;
        align-items:center;
        justify-content:center;
        padding:15px;
        background:#000d;
      }

      .member-list-modal.open{display:flex}

      .member-list-box{
        width:min(100%,430px);
        max-height:80dvh;
        overflow:auto;
        padding:18px;
        border:1px solid #ffffff24;
        border-radius:18px;
        background:#171329;
      }

      .member-list-head{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:13px;
        color:#fff;
        font-size:14px;
        font-weight:900;
      }

      .member-list-close{
        width:32px;
        height:32px;
        border:0;
        border-radius:50%;
        background:#ffffff16;
        color:white;
        font-size:20px;
      }

      .member-list-person{
        display:flex;
        align-items:center;
        gap:11px;
        padding:10px 0;
        border-bottom:1px solid #ffffff12;
        color:#fff;
      }

      .member-list-person img,
      .member-list-avatar{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border-radius:50%;
        object-fit:cover;
        background:#56418b;
        color:white;
        font-weight:900;
      }

      .member-list-person small{
        display:block;
        margin-top:3px;
        color:#aaa;
        direction:ltr;
        text-align:right;
      }

      .member-list-empty{
        padding:20px;
        color:#aaa;
        text-align:center;
        font-size:12px;
      }

      .member-tabs{
        display:grid;
        grid-template-columns:repeat(2,1fr);
        margin-top:20px;
        border-bottom:1px solid #ffffff25;
      }

      .member-tab{
        padding:13px 5px;
        border:0;
        border-bottom:2px solid transparent;
        background:transparent;
        color:#bdb5d2;
        font:800 12px Cairo,sans-serif;
      }

      .member-tab.active{
        border-bottom-color:#c1aaff;
        color:white;
      }

      @media(max-width:450px){
        .member-social{padding:14px}
        .member-stat strong{font-size:16px}
      }
    `;

    document.head.appendChild(style);
  }

  function createSocialSections() {
    if ($("memberSocialSection")) return;

    const card = document.querySelector(".card");
    if (!card) return;

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

    if (posts.error) {
      console.warn("Member posts count:", posts.error);
    }

    $("memberPostsStat").querySelector("strong").textContent =
      number(posts.count || 0);

    const canSeeCounts =
      !isPrivate ||
      (viewer && (
        viewer.id === member.id ||
        isFollowing
      ));

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

  /* ==========================================
     زر المتابعة وإلغاء المتابعة
  ========================================== */

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

        if (error) {
          if (error.code === "23505") {
            throw new Error("طلب المتابعة موجود بالفعل.");
          }
          throw error;
        }

        outgoingRequest = { status: "pending" };
        toast("تم إرسال طلب المتابعة.");

      } else {
        const { error } = await db
          .from("follows")
          .insert({
            follower_id: viewer.id,
            following_id: member.id
          });

        if (error) {
          if (error.code === "23505") {
            throw new Error("أنت تتابع هذا الحساب بالفعل.");
          }
          throw error;
        }

        isFollowing = true;
        toast("أصبحت تتابع هذا العضو.");
      }

      await refreshSocial();

    } catch (error) {
      console.error(error);
      toast(error.message || "تعذرت عملية المتابعة.");

    } finally {
      button.disabled = false;
    }
  }

  async function cancelRequest(button) {
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
    const confirmed = confirm("هل تريد إلغاء متابعة هذا العضو؟");
    if (!confirmed) return;

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

  /* ==========================================
     قبول ورفض طلبات المتابعة
  ========================================== */

  async function respondToRequest(request, status, button) {
    button.disabled = true;

    try {
      const { data, error } = await db
        .from("follow_requests")
        .update({
          status,
          updated_at: new Date().toISOString()
        })
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
    title.textContent = "طلبات المتابعة الواردة";
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
        location.href = "auth.html";
      }, true);
      return;
    }

    if (viewer.id === member.id) {
      addActionButton("ملفي الشخصي", () => {
        location.href = "profile.html";
      }, true);

      renderIncomingRequests();
      return;
    }

    if (isFollowing) {
      addActionButton(
        "إلغاء المتابعة",
        event => unfollowMember(event.currentTarget),
        false
      );

    } else if (outgoingRequest) {
      addActionButton(
        "إلغاء طلب المتابعة",
        event => cancelRequest(event.currentTarget),
        false
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
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast("تم نسخ رابط الملف الشخصي.");
    } catch {
      toast("تعذر النسخ من المتصفح.");
    }
  }

  /* ==========================================
     قوائم المتابعين والمتابَعين
  ========================================== */

  async function openMemberList(type) {
    if (
      isPrivate &&
      (!viewer || (
        viewer.id !== member.id &&
        !isFollowing
      ))
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

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const ids = (data || []).map(item =>
        type === "followers"
          ? item.follower_id
          : item.following_id
      );

      if (!ids.length) {
        content.innerHTML =
          '<div class="member-list-empty">لا توجد حسابات في هذه القائمة حتى الآن.</div>';
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

        const avatarURL = getStorageURL(
          "avatars",
          person.avatar_path
        );

        if (avatarURL) {
          const image = document.createElement("img");
          image.src = avatarURL;
          image.alt = "";
          link.appendChild(image);
        } else {
          const avatar = document.createElement("span");
          avatar.className = "member-list-avatar";
          avatar.textContent =
            (person.full_name || "هـ").charAt(0);
          link.appendChild(avatar);
        }

        const details = document.createElement("span");
        details.textContent =
          person.full_name || "عضو هنون";

        const username = document.createElement("small");
        username.textContent = person.username
          ? "@" + person.username
          : "";

        details.appendChild(username);
        link.appendChild(details);
        content.appendChild(link);
      });

      if (!content.children.length) {
        content.innerHTML =
          '<div class="member-list-empty">لا توجد حسابات ظاهرة في هذه القائمة.</div>';
      }

    } catch (error) {
      console.error(error);
      content.innerHTML =
        '<div class="member-list-empty">تعذر تحميل القائمة.</div>';
    }
  }

  /* ==========================================
     منشورات وفيديوهات العضو
  ========================================== */

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

    wrapper.style.cssText = "margin-top:16px";

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

    const card = document.querySelector(".card");
    const social = $("memberSocialSection");

    social.insertAdjacentElement("afterend", wrapper);

    const mediaStyle = document.createElement("style");
    mediaStyle.textContent = `
      .member-media-section{
        margin-top:12px;
        padding:8px;
        border-radius:14px;
        background:#15102a;
      }

      .member-media-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:5px;
      }

      .member-media-item{
        position:relative;
        display:block;
        aspect-ratio:3/4;
        overflow:hidden;
        padding:0;
        border:0;
        border-radius:5px;
        background:#211a38;
      }

      .member-media-item img,
      .member-media-item video{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .member-media-text{
        display:grid;
        place-items:center;
        height:100%;
        padding:8px;
        color:#eee;
        font-size:10px;
        line-height:1.8;
      }

      .member-media-caption{
        position:absolute;
        right:0;
        left:0;
        bottom:0;
        padding:15px 5px 5px;
        overflow:hidden;
        background:linear-gradient(transparent,#000b);
        color:#fff;
        font-size:9px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .member-media-empty{
        grid-column:1/-1;
        padding:25px 10px;
        color:#aaa;
        font-size:11px;
        text-align:center;
      }

      .member-viewer{
        position:fixed;
        inset:0;
        z-index:10000;
        display:none;
        align-items:center;
        justify-content:center;
        padding:15px;
        background:#000f;
      }

      .member-viewer.open{display:flex}

      .member-viewer img,
      .member-viewer video{
        max-width:100%;
        max-height:85dvh;
        object-fit:contain;
      }

      .member-viewer-close{
        position:absolute;
        top:20px;
        left:20px;
        width:40px;
        height:40px;
        border:0;
        border-radius:50%;
        background:#ffffff22;
        color:white;
        font-size:23px;
      }
    `;

    document.head.appendChild(mediaStyle);

    const viewer = document.createElement("div");
    viewer.className = "member-viewer";
    viewer.id = "memberViewer";

    viewer.innerHTML = `
      <button class="member-viewer-close" type="button">×</button>
      <div id="memberViewerBody"></div>
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
        const media = document.createElement(
          isVideo ? "video" : "img"
        );

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
      (viewer && (
        viewer.id === member.id ||
        isFollowing
      ));

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

    const posts = all.filter(post =>
      post.media_type !== "video"
    );

    const videos = all.filter(post =>
      post.media_type === "video"
    );

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

  /* ==========================================
     تشغيل الصفحة
  ========================================== */

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
