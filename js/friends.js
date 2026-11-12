
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    friends: [],
    results: [],
    pending: [],
    view: "friends",
    searchTimer: null,
    searching: false
  };

  const ui = {
    app: $("friendsApp"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    friends: $("friendsList"),
    results: $("searchResults"),
    count: $("friendsCount"),
    search: $("memberSearch"),
    friendsView: $("friendsView"),
    searchView: $("searchView")
  };

  function notice(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 4500);
  }

  function empty(container, message) {
    const box = document.createElement("div");
    box.className = "empty-state";
    box.textContent = message;
    container.replaceChildren(box);
  }

  function displayName(member) {
    return member?.full_name || member?.username || "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    const { data } = state.db.storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function makeAvatar(member) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(member);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent = displayName(member).charAt(0);
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent = displayName(member).charAt(0) || "هـ";
    }

    return avatar;
  }

  function makeButton(label, className, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function makeMemberCard(member, actionLabel, actionHandler, metaText) {
    const card = document.createElement("article");
    card.className = "member-card";

    const avatar = makeAvatar(member);

    const info = document.createElement("div");
    info.className = "member-info";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = displayName(member);

    const meta = document.createElement("div");
    meta.className = "member-meta";
    meta.textContent = metaText ||
      (member.username ? `@${member.username}` : "عضو هنون");

    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "member-action";

    if (actionLabel && actionHandler) {
      actions.appendChild(
        makeButton(actionLabel, "btn", actionHandler)
      );
    }

    card.append(avatar, info, actions);

    card.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      openMember(member);
    });

    return card;
  }

  function openMember(member) {
    if (!member?.id) return;

    const params = new URLSearchParams();

    if (member.username) {
      params.set("user", member.username);
    } else if (member.member_code) {
      params.set("code", member.member_code);
    } else {
      params.set("id", member.id);
    }

    window.location.href = `member.html?${params.toString()}`;
  }

  function getFriendId(request) {
    return request.sender_id === state.user.id
      ? request.receiver_id
      : request.sender_id;
  }

  function showAuthenticated() {
    ui.auth.classList.add("hidden");
    ui.app.classList.remove("hidden");
  }

  function showUnauthenticated() {
    ui.app.classList.add("hidden");
    ui.auth.classList.remove("hidden");
  }

  async function loadFriends() {
    empty(ui.friends, "جارٍ تحميل الأصدقاء...");

    const { data, error } = await state.db
      .from("friend_requests")
      .select("id,sender_id,receiver_id,status,updated_at")
      .eq("status", "accepted")
      .or(
        `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
      );

    if (error) throw error;

    const ids = [...new Set((data || []).map(getFriendId))];

    if (!ids.length) {
      state.friends = [];
      renderFriends();
      return;
    }

    const { data: members, error: memberError } = await state.db
      .from("member_directory")
      .select("id,username,member_code,full_name,avatar_path,bio")
      .in("id", ids);

    if (memberError) throw memberError;

    state.friends = members || [];
    renderFriends();
  }

  function renderFriends() {
    ui.count.textContent = `${state.friends.length} صديق`;
    ui.friends.replaceChildren();

    if (!state.friends.length) {
      empty(
        ui.friends,
        "قائمة أصدقائك فارغة حالياً. افتح اكتشاف الأعضاء وابحث عن أصدقائك."
      );
      return;
    }

    state.friends.forEach(friend => {
      const card = makeMemberCard(
        friend,
        "مراسلة",
        () => openMessages(friend),
        [
          friend.username ? `@${friend.username}` : "",
          friend.member_code || ""
        ].filter(Boolean).join(" · ")
      );

      ui.friends.appendChild(card);
    });
  }

  function openMessages(friend) {
    const params = new URLSearchParams();

    params.set("user", friend.id);

    window.location.href =
      `messages.html?${params.toString()}`;
  }

  async function loadPendingRequests() {
    const { data, error } = await state.db
      .from("friend_requests")
      .select("sender_id,receiver_id,status")
      .eq("status", "pending")
      .or(
        `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
      );

    if (error) throw error;

    state.pending = data || [];
  }

  function getRelationship(memberId) {
    const request = state.pending.find(item =>
      item.sender_id === memberId ||
      item.receiver_id === memberId
    );

    if (!request) return "none";

    return request.sender_id === state.user.id
      ? "sent"
      : "received";
  }

  async function searchMembers(value) {
    const term = value.trim();

    if (!term) {
      state.results = [];
      empty(
        ui.results,
        "اكتب اسم العضو أو اسم المستخدم أو كود العضوية للبحث."
      );
      return;
    }

    if (state.searching) return;

    state.searching = true;
    empty(ui.results, "جارٍ البحث عن الأعضاء...");

    try {
      const safeTerm = term.replace(/[,%()]/g, " ").trim();

      if (!safeTerm) {
        empty(ui.results, "اكتب كلمة بحث صحيحة.");
        return;
      }

      const fields = [
        state.db
          .from("member_directory")
          .select("id,username,member_code,full_name,avatar_path,bio")
          .ilike("full_name", `%${safeTerm}%`)
          .limit(20),

        state.db
          .from("member_directory")
          .select("id,username,member_code,full_name,avatar_path,bio")
          .ilike("username", `%${safeTerm}%`)
          .limit(20),

        state.db
          .from("member_directory")
          .select("id,username,member_code,full_name,avatar_path,bio")
          .ilike("member_code", `%${safeTerm}%`)
          .limit(20)
      ];

      const responses = await Promise.all(fields);

      const failed = responses.find(result => result.error);

      if (failed) throw failed.error;

      const unique = new Map();

      responses.forEach(result => {
        (result.data || []).forEach(member => {
          if (member.id !== state.user.id) {
            unique.set(member.id, member);
          }
        });
      });

      state.results = [...unique.values()];

      await loadPendingRequests();
      renderSearchResults();

    } catch (error) {
      console.error("HANOON friends search:", error);
      empty(ui.results, error.message || "تعذر البحث عن الأعضاء.");
    } finally {
      state.searching = false;
    }
  }

  function renderSearchResults() {
    ui.results.replaceChildren();

    if (!state.results.length) {
      empty(
        ui.results,
        "لم يتم العثور على أعضاء. جرّب اسمًا أو كود عضوية مختلفًا."
      );
      return;
    }

    state.results.forEach(member => {
      const relationship = getRelationship(member.id);
      let label = "إضافة صديق";
      let handler = () => sendFriendRequest(member.id);

      if (state.friends.some(friend => friend.id === member.id)) {
        label = "صديق بالفعل";
        handler = null;
      } else if (relationship === "sent") {
        label = "تم إرسال الطلب";
        handler = null;
      } else if (relationship === "received") {
        label = "لديك طلب منه";
        handler = () => {
          window.location.href = "friend-requests.html";
        };
      }

      const card = makeMemberCard(
        member,
        label,
        handler,
        [
          member.username ? `@${member.username}` : "",
          member.member_code || ""
        ].filter(Boolean).join(" · ")
      );

      ui.results.appendChild(card);
    });
  }

  async function sendFriendRequest(receiverId) {
    if (!receiverId || receiverId === state.user.id) return;

    try {
      const { data: existing, error: checkError } = await state.db
        .from("friend_requests")
        .select("id,status,sender_id,receiver_id")
        .or(
          `and(sender_id.eq.${state.user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${state.user.id})`
        )
        .in("status", ["pending", "accepted"])
        .limit(1);

      if (checkError) throw checkError;

      if (existing?.some(item => item.status === "accepted")) {
        notice("هذا العضو موجود بالفعل في قائمة أصدقائك.");
        await loadFriends();
        await renderSearchResults();
        return;
      }

      if (existing?.length) {
        const request = existing[0];

        if (request.sender_id === receiverId) {
          notice("هذا العضو أرسل لك طلب صداقة. يمكنك قبوله من صفحة الطلبات.");
          return;
        }

        notice("يوجد طلب صداقة معلّق بينكما بالفعل.");
        return;
      }

      const { error } = await state.db
        .from("friend_requests")
        .insert({
          sender_id: state.user.id,
          receiver_id: receiverId,
          status: "pending"
        });

      if (error) throw error;

      notice("تم إرسال طلب الصداقة بنجاح.", "success");

      await loadPendingRequests();
      renderSearchResults();

    } catch (error) {
      console.error("HANOON send friend request:", error);
      notice(error.message || "تعذر إرسال طلب الصداقة.", "error");
    }
  }

  function switchView(view) {
    state.view = view;

    ui.friendsView.classList.toggle("hidden", view !== "friends");
    ui.searchView.classList.toggle("hidden", view !== "search");

    document.querySelectorAll("[data-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    if (view === "search") {
      setTimeout(() => ui.search.focus(), 80);
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach(button => {
      button.addEventListener("click", () => {
        switchView(button.dataset.view);
      });
    });

    $("focusSearchBtn")?.addEventListener("click", () => {
      switchView("search");
      $("searchView")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });

    ui.search.addEventListener("input", () => {
      clearTimeout(state.searchTimer);

      state.searchTimer = setTimeout(() => {
        searchMembers(ui.search.value);
      }, 450);
    });
  }

  async function initialize() {
    try {
      if (!window.HANOON?.supabase) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("انتهت مهلة الاتصال بقاعدة البيانات."));
          }, 12000);

          window.addEventListener("hanoon:supabase-ready", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });

          window.addEventListener("hanoon:supabase-error", event => {
            clearTimeout(timer);
            reject(new Error(
              event.detail?.message || "تعذر الاتصال بقاعدة البيانات."
            ));
          }, { once: true });
        });
      }

      state.db = window.HANOON.supabase;

      if (!state.db) {
        throw new Error("اتصال قاعدة البيانات غير جاهز.");
      }

      const { data, error } = await state.db.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        showUnauthenticated();
        return;
      }

      state.user = data.user;
      showAuthenticated();

      bindEvents();

      await loadFriends();
      await loadPendingRequests();

    } catch (error) {
      console.error("HANOON friends:", error);

      showUnauthenticated();

      notice(
        error.message || "تعذر تحميل صفحة الأصدقاء.",
        "error"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
