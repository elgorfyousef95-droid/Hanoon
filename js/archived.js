
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    rows: [],
    busy: new Set(),
    channel: null
  };

  const ui = {
    list: $("archiveList"),
    search: $("archiveSearch"),
    count: $("archiveCount"),
    notice: $("archiveNotice"),
    back: $("archiveBackBtn")
  };

  function notify(message, error = false) {
    ui.notice.textContent = message;
    ui.notice.classList.add("show");

    ui.notice.style.background = error
      ? "rgba(255,80,105,.13)"
      : "rgba(61,201,174,.13)";

    ui.notice.style.color = error
      ? "#ffb9c5"
      : "#9bf0d9";

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
      ui.notice.classList.remove("show");
    }, 4000);
  }

  function displayName(profile) {
    return profile?.full_name ||
      profile?.username ||
      "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return state.db.storage
      .from("avatars")
      .getPublicUrl(path).data?.publicUrl || "";
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
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

  function otherUserId(conversation) {
    const ids = String(conversation.direct_key || "").split(":");

    return ids.find(id => id && id !== state.user.id) || null;
  }

  function messagePreview(message) {
    if (!message) return "لا توجد رسائل بعد";

    if (message.message_type === "image") return "صورة";
    if (message.message_type === "video") return "فيديو";
    if (message.message_type === "audio") return "رسالة صوتية";
    if (message.message_type === "file") return "ملف مرفق";

    const body = String(message.body || "").trim();

    if (message.sender_id === state.user.id) {
      return `أنت: ${body || "رسالة"}`;
    }

    return body || "رسالة";
  }

  function showEmpty(message) {
    const box = document.createElement("div");

    box.className = "archive-empty";

    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.innerHTML =
      '<path d="M3 4h18v4H3zM5 8v12h14V8M9 12h6"/>';

    const text = document.createElement("div");
    text.textContent = message;

    box.append(svg, text);
    ui.list.replaceChildren(box);
  }

  async function loadArchived() {
    ui.list.innerHTML = '<div class="loading">جارٍ تحميل الأرشيف...</div>';

    const { data: memberships, error: memberError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id,archived_at,last_read_at")
        .eq("user_id", state.user.id)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });

    if (memberError) throw memberError;

    if (!memberships?.length) {
      state.rows = [];
      render();
      return;
    }

    const ids = memberships.map(item => item.conversation_id);

    const { data: conversations, error: conversationError } =
      await state.db
        .from("conversations")
        .select("id,conversation_type,direct_key,title")
        .in("id", ids)
        .eq("conversation_type", "direct");

    if (conversationError) throw conversationError;

    const membershipMap = new Map(
      memberships.map(item => [item.conversation_id, item])
    );

    const friendIds = [
      ...new Set(
        (conversations || [])
          .map(otherUserId)
          .filter(Boolean)
      )
    ];

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

    const conversationIds = (conversations || []).map(item => item.id);

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

    messages.forEach(message => {
      if (!latestMap.has(message.conversation_id)) {
        latestMap.set(message.conversation_id, message);
      }
    });

    state.rows = (conversations || [])
      .map(conversation => {
        const friendId = otherUserId(conversation);
        const friend = profileMap.get(friendId);

        if (!friend) return null;

        return {
          id: conversation.id,
          friend,
          membership: membershipMap.get(conversation.id),
          lastMessage: latestMap.get(conversation.id) || null
        };
      })
      .filter(Boolean);

    state.rows.sort((a, b) => {
      return new Date(b.membership.archived_at).getTime() -
        new Date(a.membership.archived_at).getTime();
    });

    render();
  }

  function createCard(row) {
    const card = document.createElement("article");
    card.className = "archive-card";

    const avatar = document.createElement("div");
    avatar.className = "archive-avatar";

    const url = avatarURL(row.friend.avatar_path);

    if (url) {
      const image = document.createElement("img");

      image.src = url;
      image.alt = displayName(row.friend);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent =
          displayName(row.friend).charAt(0);
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent =
        displayName(row.friend).charAt(0) || "هـ";
    }

    const info = document.createElement("div");
    info.className = "archive-info";

    const name = document.createElement("div");
    name.className = "archive-name";
    name.textContent = displayName(row.friend);

    const preview = document.createElement("div");
    preview.className = "archive-preview";
    preview.textContent = messagePreview(row.lastMessage);

    const time = document.createElement("div");
    time.className = "archive-time";
    time.textContent = row.lastMessage
      ? formatTime(row.lastMessage.created_at)
      : `أُرشفت: ${formatTime(row.membership.archived_at)}`;

    info.append(name, preview, time);

    info.addEventListener("click", () => openChat(row));

    const restore = document.createElement("button");

    restore.type = "button";
    restore.className = "restore-button";
    restore.textContent = "استعادة";
    restore.title = "إرجاع المحادثة لصندوق الوارد";

    restore.addEventListener("click", event => {
      event.stopPropagation();
      restoreConversation(row);
    });

    card.append(avatar, info, restore);

    return card;
  }

  function render() {
    const query = ui.search.value.trim().toLowerCase();

    const rows = state.rows.filter(row => {
      if (!query) return true;

      const searchable = [
        displayName(row.friend),
        row.friend.username,
        row.friend.member_code,
        row.lastMessage?.body
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });

    ui.count.textContent = String(state.rows.length);
    ui.list.replaceChildren();

    if (!rows.length) {
      showEmpty(
        query
          ? "لا توجد نتائج مطابقة لبحثك."
          : "الأرشيف فارغ حاليًا. المحادثات التي تؤرشفها ستظهر هنا."
      );
      return;
    }

    rows.forEach(row => {
      ui.list.appendChild(createCard(row));
    });
  }

  async function restoreConversation(row) {
    if (state.busy.has(row.id)) return;

    state.busy.add(row.id);

    try {
      const { error } = await state.db
        .from("conversation_members")
        .update({
          archived_at: null
        })
        .eq("conversation_id", row.id)
        .eq("user_id", state.user.id);

      if (error) throw error;

      state.rows = state.rows.filter(item => item.id !== row.id);

      render();

      notify("تمت استعادة المحادثة إلى صندوق الوارد.");

    } catch (error) {
      console.error("HANOON archive restore:", error);
      notify(error.message || "تعذرت استعادة المحادثة.", true);

    } finally {
      state.busy.delete(row.id);
    }
  }

  function openChat(row) {
    const params = new URLSearchParams({
      id: row.id,
      user: row.friend.id
    });

    window.location.href = `chat.html?${params.toString()}`;
  }

  function bindEvents() {
    ui.search.addEventListener("input", render);

    ui.back.addEventListener("click", () => {
      window.location.href = "messages.html";
    });
  }

  function subscribe() {
    state.channel = state.db
      .channel(`hanoon-archive-${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        () => {
          loadArchived().catch(error => {
            console.warn("HANOON archive refresh:", error);
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
        notify("سجل الدخول أولًا لعرض الأرشيف.", true);

        setTimeout(() => {
          window.location.href = "../index.html";
        }, 1200);

        return;
      }

      state.user = data.user;

      bindEvents();

      await loadArchived();

      subscribe();

    } catch (error) {
      console.error("HANOON archived:", error);

      showEmpty("تعذر تحميل الأرشيف. حاول تحديث الصفحة.");

      notify(error.message || "حدث خطأ أثناء تحميل الأرشيف.", true);
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
        showEmpty("تعذر الاتصال بقاعدة البيانات.");

        notify(
          event.detail?.message || "فشل الاتصال.",
          true
        );
      },
      { once: true }
    );
  }

  window.addEventListener("pagehide", () => {
    if (state.channel && state.db) {
      state.db.removeChannel(state.channel);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
