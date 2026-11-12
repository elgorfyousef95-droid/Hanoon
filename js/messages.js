
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    rows: [],
    filter: "all",
    busy: false,
    channel: null
  };

  const ui = {
    app: $("messagesApp"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    list: $("conversationList"),
    search: $("conversationSearch"),
    count: $("chatCount"),
    refresh: $("refreshChatsBtn"),
    unread: $("unreadFilterBtn"),
    status: $("listStatus")
  };

  function notify(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 4000);
  }

  function empty(message) {
    const box = document.createElement("div");
    box.className = "chat-empty";
    box.textContent = message;
    ui.list.replaceChildren(box);
  }

  function nameOf(member) {
    return member?.full_name ||
      member?.username ||
      "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage
      .from("avatars")
      .getPublicUrl(path).data?.publicUrl || "";
  }

  function makeAvatar(member) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = nameOf(member);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent = nameOf(member).charAt(0);
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent = nameOf(member).charAt(0) || "هـ";
    }

    return avatar;
  }

  function icon(path) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }

  const icons = {
    pin: '<path d="m16 3 5 5-4 1-4 4-1 5-3-3-5 5-1-1 5-5-3-3 5-1 4-4z"/>',
    archive: '<path d="M3 4h18v4H3zM5 8v12h14V8M9 12h6"/>',
    mute: '<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>',
    read: '<path d="m3 12 5 5L21 4M12 17l2 2 7-7"/>',
    open: '<path d="M4 12h15m-6-6 6 6-6 6"/>'
  };

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (sameDay) {
      return date.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short"
    });
  }

  function getOtherUserId(conversation) {
    const ids = String(conversation.direct_key || "").split(":");
    return ids.find(id => id && id !== state.user.id) || null;
  }

  async function loadFriends() {
    const { data, error } = await state.db
      .from("friend_requests")
      .select("sender_id,receiver_id")
      .eq("status", "accepted")
      .or(
        `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
      );

    if (error) throw error;

    return [...new Set(
      (data || []).map(item =>
        item.sender_id === state.user.id
          ? item.receiver_id
          : item.sender_id
      )
    )];
  }

  async function loadRows() {
    ui.status.textContent = "جارٍ التحديث...";

    const { data: memberships, error: membershipError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id,last_read_at,archived_at,pinned_at,muted_until")
        .eq("user_id", state.user.id);

    if (membershipError) throw membershipError;

    if (!memberships?.length) {
      state.rows = [];
      render();
      ui.status.textContent = "محدّثة";
      return;
    }

    const membershipMap = new Map(
      memberships.map(item => [item.conversation_id, item])
    );

    const ids = memberships.map(item => item.conversation_id);

    const { data: conversations, error: conversationError } =
      await state.db
        .from("conversations")
        .select("id,title,conversation_type,direct_key,created_by,updated_at")
        .in("id", ids)
        .eq("conversation_type", "direct");

    if (conversationError) throw conversationError;

    const acceptedIds = new Set(await loadFriends());

    const valid = (conversations || [])
      .map(conversation => {
        const friendId = getOtherUserId(conversation);
        if (!friendId || !acceptedIds.has(friendId)) return null;

        return {
          conversation,
          friendId,
          membership: membershipMap.get(conversation.id)
        };
      })
      .filter(Boolean);

    const friendIds = [...new Set(valid.map(item => item.friendId))];

    let profiles = [];

    if (friendIds.length) {
      const { data, error } = await state.db
        .from("member_directory")
        .select("id,username,full_name,member_code,avatar_path")
        .in("id", friendIds);

      if (error) throw error;
      profiles = data || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    const conversationIds = valid.map(
      item => item.conversation.id
    );

    let messages = [];

    if (conversationIds.length) {
      const { data, error } = await state.db
        .from("messages")
        .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      messages = data || [];
    }

    const latestMap = new Map();
    const unreadMap = new Map();

    messages.forEach(message => {
      if (!latestMap.has(message.conversation_id)) {
        latestMap.set(message.conversation_id, message);
      }
    });

    valid.forEach(item => {
      const conversationId = item.conversation.id;
      const lastRead = item.membership.last_read_at
        ? new Date(item.membership.last_read_at).getTime()
        : 0;

      const unread = messages.filter(message =>
        message.conversation_id === conversationId &&
        message.sender_id !== state.user.id &&
        new Date(message.created_at).getTime() > lastRead
      ).length;

      unreadMap.set(conversationId, unread);
    });

    state.rows = valid
      .map(item => {
        const friend = profileMap.get(item.friendId);
        if (!friend) return null;

        const conversation = item.conversation;
        const membership = item.membership;

        return {
          id: conversation.id,
          friend,
          membership,
          lastMessage: latestMap.get(conversation.id) || null,
          unread: unreadMap.get(conversation.id) || 0,
          pinned: Boolean(membership.pinned_at),
          archived: Boolean(membership.archived_at),
          muted: membership.muted_until &&
            new Date(membership.muted_until).getTime() > Date.now()
        };
      })
      .filter(Boolean);

    state.rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      const aTime = new Date(
        a.lastMessage?.created_at || 0
      ).getTime();

      const bTime = new Date(
        b.lastMessage?.created_at || 0
      ).getTime();

      return bTime - aTime;
    });

    render();
    ui.status.textContent = "محدّثة";
  }

  function messagePreview(row) {
    const message = row.lastMessage;

    if (!message) return "ابدأ المحادثة بإرسال أول رسالة";

    if (message.deleted_at) return "تم حذف الرسالة";

    if (message.message_type === "image") return "صورة";
    if (message.message_type === "video") return "فيديو";
    if (message.message_type === "audio") return "رسالة صوتية";
    if (message.message_type === "file") return "ملف مرفق";

    const text = String(message.body || "").trim();

    if (message.sender_id === state.user.id) {
      return `أنت: ${text || "رسالة"}`;
    }

    return text || "رسالة جديدة";
  }

  function visibleRows() {
    const query = ui.search.value.trim().toLowerCase();

    return state.rows.filter(row => {
      if (row.archived) return false;

      if (state.filter === "unread" && row.unread < 1) return false;
      if (state.filter === "pinned" && !row.pinned) return false;

      if (!query) return true;

      const searchable = [
        nameOf(row.friend),
        row.friend.username,
        row.friend.member_code,
        row.lastMessage?.body
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }

  function makeAction(label, svg, action, active = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `row-action${active ? " active" : ""}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon(svg);

    button.addEventListener("click", event => {
      event.stopPropagation();
      action();
    });

    return button;
  }

  function makeCard(row) {
    const card = document.createElement("article");
    card.className = "conversation";
    card.dataset.id = row.id;

    const avatar = makeAvatar(row.friend);

    const info = document.createElement("div");
    info.className = "conversation-info";

    const top = document.createElement("div");
    top.className = "conversation-top";

    const name = document.createElement("div");
    name.className = "conversation-name";
    name.textContent = nameOf(row.friend);

    top.appendChild(name);

    if (row.pinned) {
      const pin = document.createElement("span");
      pin.className = "pin-mark";
      pin.innerHTML = icon(icons.pin);
      top.appendChild(pin);
    }

    const last = document.createElement("div");
    last.className = "conversation-last";
    last.textContent = messagePreview(row);

    info.append(top, last);

    const meta = document.createElement("div");
    meta.className = "conversation-meta";

    const time = document.createElement("div");
    time.className = "conversation-time";
    time.textContent = formatTime(row.lastMessage?.created_at);

    meta.appendChild(time);

    if (row.unread > 0) {
      const unread = document.createElement("span");
      unread.className = "unread-count";
      unread.textContent = row.unread > 99 ? "99+" : String(row.unread);
      meta.appendChild(unread);
    } else if (row.muted) {
      const muted = document.createElement("span");
      muted.className = "conversation-time";
      muted.textContent = "مكتومة";
      meta.appendChild(muted);
    }

    card.append(avatar, info, meta);

    card.addEventListener("click", () => openChat(row));

    const actions = document.createElement("div");
    actions.className = "row-actions";

    actions.append(
      makeAction(
        row.pinned ? "إلغاء التثبيت" : "تثبيت المحادثة",
        icons.pin,
        () => togglePin(row),
        row.pinned
      ),
      makeAction(
        row.muted ? "إلغاء الكتم" : "كتم المحادثة",
        icons.mute,
        () => toggleMute(row),
        row.muted
      ),
      makeAction(
        "تعليم كمقروءة",
        icons.read,
        () => markRead(row)
      ),
      makeAction(
        "أرشفة المحادثة",
        icons.archive,
        () => archive(row)
      )
    );

    const wrapper = document.createElement("div");
    wrapper.append(card, actions);

    return wrapper;
  }

  function render() {
    const rows = visibleRows();

    ui.count.textContent = String(
      state.rows.filter(row => !row.archived).length
    );

    ui.list.replaceChildren();

    if (!rows.length) {
      empty(
        state.filter === "unread"
          ? "لا توجد رسائل غير مقروءة."
          : state.filter === "pinned"
            ? "لا توجد محادثات مثبتة."
            : "لا توجد محادثات هنا. ابدأ مراسلة أحد أصدقائك."
      );
      return;
    }

    rows.forEach(row => {
      ui.list.appendChild(makeCard(row));
    });
  }

  async function updateMembership(row, changes, successMessage) {
    try {
      const { error } = await state.db
        .from("conversation_members")
        .update(changes)
        .eq("conversation_id", row.id)
        .eq("user_id", state.user.id);

      if (error) throw error;

      await loadRows();

      if (successMessage) notify(successMessage, "success");

    } catch (error) {
      console.error("HANOON chat preference:", error);
      notify(error.message || "تعذر تنفيذ العملية.", "error");
    }
  }

  async function togglePin(row) {
    await updateMembership(
      row,
      {
        pinned_at: row.pinned ? null : new Date().toISOString()
      },
      row.pinned ? "تم إلغاء تثبيت المحادثة." : "تم تثبيت المحادثة."
    );
  }

  async function toggleMute(row) {
    await updateMembership(
      row,
      {
        muted_until: row.muted
          ? null
          : "2099-12-31T23:59:59.000Z"
      },
      row.muted ? "تم إلغاء كتم المحادثة." : "تم كتم المحادثة."
    );
  }

  async function markRead(row) {
    await updateMembership(
      row,
      { last_read_at: new Date().toISOString() },
      "تم تعليم المحادثة كمقروءة."
    );
  }

  async function archive(row) {
    const confirmed = window.confirm(
      `هل تريد أرشفة محادثة ${nameOf(row.friend)}؟`
    );

    if (!confirmed) return;

    await updateMembership(
      row,
      { archived_at: new Date().toISOString() },
      "تم نقل المحادثة إلى الأرشيف."
    );
  }

  function openChat(row) {
    const params = new URLSearchParams({
      id: row.id,
      user: row.friend.id
    });

    window.location.href = `chat.html?${params.toString()}`;
  }

  function setFilter(filter) {
    state.filter = filter;

    document.querySelectorAll("[data-filter]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === filter
      );
    });

    render();
  }

  function bindEvents() {
    ui.search.addEventListener("input", render);

    ui.refresh.addEventListener("click", async () => {
      ui.refresh.disabled = true;

      try {
        await loadRows();
        notify("تم تحديث المحادثات.", "success");
      } catch (error) {
        notify(error.message || "تعذر تحديث المحادثات.", "error");
      } finally {
        ui.refresh.disabled = false;
      }
    });

    ui.unread.addEventListener("click", () => {
      setFilter(state.filter === "unread" ? "all" : "unread");
    });

    document.querySelectorAll("[data-filter]").forEach(button => {
      button.addEventListener("click", () => {
        setFilter(button.dataset.filter);
      });
    });
  }

  function subscribe() {
    state.channel = state.db
      .channel(`hanoon-list-${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        () => {
          loadRows().catch(error => {
            console.warn("HANOON live list update:", error);
          });
        }
      )
      .subscribe();
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
        ui.auth.classList.remove("hidden");
        ui.app.classList.add("hidden");
        return;
      }

      state.user = data.user;

      ui.auth.classList.add("hidden");
      ui.app.classList.remove("hidden");

      bindEvents();
      await loadRows();
      subscribe();

    } catch (error) {
      console.error("HANOON messages list:", error);
      notify(error.message || "تعذر تحميل المحادثات.", "error");
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
