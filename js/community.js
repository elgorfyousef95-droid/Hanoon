
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/* =========================================
   HANOON COMMUNITY
   المحادثات - الأصدقاء - الطلبات - المجموعات
========================================= */

const SUPABASE_URL = "https://gjtgvczvclfwvlvcquxh.supabase.co";
const SUPABASE_KEY = "sb_publishable_4DVTUZ-xTlqU2GpFvpb7lw_g-Kxomd4";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-gjtgvczvclfwvlvcquxh-auth-token"
  }
});

const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  profile: null,
  tab: "chats",
  selectedConversation: null,
  selectedMember: null,
  conversations: [],
  friends: [],
  requests: [],
  discover: [],
  messages: [],
  channel: null,
  loading: false
};

const ui = {
  app: $("#communityApp"),
  authNotice: $("#authNotice"),
  sideList: $("#sideList"),
  sideSearch: $("#sideSearch"),
  messages: $("#messages"),
  chatTitle: $("#chatTitle"),
  chatSubtitle: $("#chatSubtitle"),
  messageForm: $("#messageForm"),
  messageInput: $("#messageInput"),
  viewMemberBtn: $("#viewMemberBtn"),
  groupPanel: $("#groupPanel"),
  groupForm: $("#groupForm"),
  globalNotice: $("#globalNotice"),
  newGroupBtn: $("#newGroupBtn"),
  cancelGroupBtn: $("#cancelGroupBtn")
};

/* =========================================
   أدوات مساعدة
========================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showNotice(message, type = "") {
  ui.globalNotice.textContent = message;
  ui.globalNotice.className = `notice ${type}`;
  ui.globalNotice.classList.remove("hidden");

  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    ui.globalNotice.classList.add("hidden");
  }, 4500);
}

function showEmpty(container, message) {
  container.innerHTML = `<div class="empty-state">${escapeHTML(message)}</div>`;
}

function displayName(member) {
  return member?.full_name || member?.username || "عضو هنون";
}

function avatarURL(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) return path;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  return data?.publicUrl || "";
}

function avatarMarkup(member) {
  const url = avatarURL(member?.avatar_path);
  const name = displayName(member);

  if (url) {
    return `
      <div class="avatar">
        <img src="${escapeHTML(url)}" alt="${escapeHTML(name)}"
             loading="lazy"
             onerror="this.parentElement.textContent='${escapeHTML(name.charAt(0))}'">
      </div>
    `;
  }

  return `
    <div class="avatar">
      ${escapeHTML(name.charAt(0) || "هـ")}
    </div>
  `;
}

function formatTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function setButtonBusy(button, busy, text = "جارٍ التنفيذ...") {
  if (!button) return;

  if (busy) {
    button.dataset.oldText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.oldText || button.textContent;
    button.disabled = false;
  }
}

function getErrorMessage(error) {
  console.error("HANOON community:", error);

  const message = error?.message || "";

  if (message.includes("PGRST205") || message.includes("schema cache")) {
    return "جدول من جداول المجتمع غير متاح عبر واجهة البيانات. راجع إعدادات Data API في Supabase.";
  }

  if (message.includes("row-level security")) {
    return "قاعدة البيانات رفضت العملية بسبب صلاحيات الحساب أو شروط الأمان.";
  }

  if (message.includes("Failed to fetch")) {
    return "تعذر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.";
  }

  return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

function getOtherUserId(conversation) {
  if (!conversation?.direct_key || !state.user) return null;

  const parts = conversation.direct_key.split(":");
  return parts.find(id => id !== state.user.id) || null;
}

/* =========================================
   تحميل الحساب
========================================= */

async function initializeCommunity() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    if (!data.user) {
      ui.authNotice.classList.remove("hidden");
      ui.app.classList.add("hidden");
      return;
    }

    state.user = data.user;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,username,avatar_path,member_code")
      .eq("id", state.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    state.profile = profile;

    ui.authNotice.classList.add("hidden");
    ui.app.classList.remove("hidden");

    await loadConversations();
    await loadFriends();
    await loadRequests();

    renderCurrentTab();

  } catch (error) {
    ui.authNotice.classList.remove("hidden");
    ui.authNotice.textContent = getErrorMessage(error);
    ui.app.classList.add("hidden");
  }
}

/* =========================================
   التنقل بين أقسام المجتمع
========================================= */

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", async () => {
    const tab = button.dataset.tab;

    state.tab = tab;

    document.querySelectorAll("[data-tab]").forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tab);
    });

    ui.sideSearch.value = "";

    if (tab === "chats") await loadConversations();
    if (tab === "friends") await loadFriends();
    if (tab === "requests") await loadRequests();
    if (tab === "discover") await searchMembers("");

    renderCurrentTab();
  });
});

function renderCurrentTab() {
  if (state.tab === "chats") renderConversations();
  if (state.tab === "friends") renderFriends();
  if (state.tab === "requests") renderRequests();
  if (state.tab === "discover") renderDiscover();
}

/* =========================================
   المحادثات
========================================= */

async function loadConversations() {
  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_members")
    .select("conversation_id,joined_at,last_read_at")
    .eq("user_id", state.user.id)
    .order("joined_at", { ascending: false });

  if (membershipError) throw membershipError;

  const ids = (memberships || []).map(item => item.conversation_id);

  if (!ids.length) {
    state.conversations = [];
    return;
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  state.conversations = data || [];
}

function renderConversations() {
  const query = ui.sideSearch.value.trim().toLowerCase();

  const filtered = state.conversations.filter(conversation => {
    const title = conversation.title || "";
    const direct = conversation.conversation_type === "direct"
      ? "محادثة خاصة"
      : "مجموعة";

    return `${title} ${direct}`.toLowerCase().includes(query);
  });

  if (!filtered.length) {
    showEmpty(
      ui.sideList,
      state.conversations.length
        ? "لا توجد نتائج مطابقة."
        : "لا توجد محادثات بعد. أضف أصدقاء وابدأ التواصل."
    );
    return;
  }

  ui.sideList.innerHTML = filtered.map(conversation => {
    const isGroup = conversation.conversation_type === "group";
    const title = isGroup
      ? conversation.title
      : "محادثة خاصة";

    const subtitle = isGroup
      ? "مجموعة هنون"
      : "محادثة بين صديقين";

    const selected = state.selectedConversation?.id === conversation.id;

    return `
      <button class="item ${selected ? "selected" : ""}"
              data-conversation-id="${escapeHTML(conversation.id)}">
        <div class="avatar">${isGroup ? "م" : "خ"}</div>
        <div class="item-main">
          <div class="item-name">${escapeHTML(title)}</div>
          <div class="item-sub">${escapeHTML(subtitle)}</div>
        </div>
        <span class="badge">${isGroup ? "مجموعة" : "خاص"}</span>
      </button>
    `;
  }).join("");

  ui.sideList.querySelectorAll("[data-conversation-id]").forEach(button => {
    button.addEventListener("click", () => {
      const conversation = state.conversations.find(
        item => item.id === button.dataset.conversationId
      );

      if (conversation) openConversation(conversation);
    });
  });
}

/* =========================================
   فتح محادثة
========================================= */

async function openConversation(conversation) {
  state.selectedConversation = conversation;
  state.selectedMember = null;

  const isGroup = conversation.conversation_type === "group";

  ui.chatTitle.textContent = isGroup
    ? conversation.title
    : "محادثة خاصة";

  ui.chatSubtitle.textContent = isGroup
    ? "مجموعة مجتمع هنون"
    : "محادثة خاصة بين الأصدقاء";

  ui.messageForm.classList.remove("hidden");
  ui.viewMemberBtn.classList.add("hidden");

  if (!isGroup) {
    const otherId = getOtherUserId(conversation);

    if (otherId) {
      const { data: member } = await supabase
        .from("member_directory")
        .select("id,username,member_code,full_name,avatar_path,bio")
        .eq("id", otherId)
        .maybeSingle();

      if (member) {
        state.selectedMember = member;
        ui.chatTitle.textContent = displayName(member);
        ui.chatSubtitle.textContent = `@${member.username || "عضو هنون"}`;
        ui.viewMemberBtn.classList.remove("hidden");
      }
    }
  }

  renderConversations();
  await loadMessages(conversation.id);
  subscribeToMessages(conversation.id);
}

/* =========================================
   الرسائل
========================================= */

async function loadMessages(conversationId) {
  showEmpty(ui.messages, "جارٍ تحميل الرسائل...");

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    showEmpty(ui.messages, getErrorMessage(error));
    return;
  }

  state.messages = data || [];
  await renderMessages();
}

async function renderMessages() {
  if (!state.messages.length) {
    showEmpty(ui.messages, "ابدأ المحادثة بإرسال أول رسالة.");
    return;
  }

  const senderIds = [...new Set(
    state.messages.map(message => message.sender_id)
  )];

  let membersById = {};

  const { data: members } = await supabase
    .from("member_directory")
    .select("id,full_name,username")
    .in("id", senderIds);

  (members || []).forEach(member => {
    membersById[member.id] = member;
  });

  ui.messages.innerHTML = state.messages.map(message => {
    const mine = message.sender_id === state.user.id;
    const sender = membersById[message.sender_id];

    const senderName = mine
      ? "أنت"
      : displayName(sender);

    return `
      <div class="bubble ${mine ? "mine" : ""}">
        ${!mine && state.selectedConversation?.conversation_type === "group"
          ? `<div style="font-size:10px;color:#e6c77d;margin-bottom:4px">${escapeHTML(senderName)}</div>`
          : ""}
        ${escapeHTML(message.body || "")}
        <span class="time">${formatTime(message.created_at)}</span>
      </div>
    `;
  }).join("");

  ui.messages.scrollTop = ui.messages.scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();

  if (!state.selectedConversation || !state.user) return;

  const body = ui.messageInput.value.trim();
  if (!body) return;

  const submit = ui.messageForm.querySelector("button[type='submit']");
  setButtonBusy(submit, true, "إرسال...");

  try {
    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: state.selectedConversation.id,
        sender_id: state.user.id,
        body,
        message_type: "text"
      });

    if (error) throw error;

    ui.messageInput.value = "";

  } catch (error) {
    showNotice(getErrorMessage(error), "error");
  } finally {
    setButtonBusy(submit, false);
  }
}

ui.messageForm.addEventListener("submit", sendMessage);

function subscribeToMessages(conversationId) {
  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }

  state.channel = supabase
    .channel(`community-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      async payload => {
        const message = payload.new;

        if (message.sender_id === state.user.id) return;
        if (message.deleted_at) return;

        if (!state.messages.some(item => item.id === message.id)) {
          state.messages.push(message);
          await renderMessages();
        }
      }
    )
    .subscribe();
}

/* =========================================
   الأصدقاء
========================================= */

async function loadFriends() {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,updated_at")
    .eq("status", "accepted")
    .or(`sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`);

  if (error) throw error;

  const friendIds = (data || []).map(item =>
    item.sender_id === state.user.id
      ? item.receiver_id
      : item.sender_id
  );

  if (!friendIds.length) {
    state.friends = [];
    return;
  }

  const { data: members, error: memberError } = await supabase
    .from("member_directory")
    .select("id,username,member_code,full_name,avatar_path,bio")
    .in("id", friendIds);

  if (memberError) throw memberError;

  state.friends = members || [];
}

function renderFriends() {
  const query = ui.sideSearch.value.trim().toLowerCase();

  const friends = state.friends.filter(friend =>
    `${friend.full_name || ""} ${friend.username || ""} ${friend.member_code || ""}`
      .toLowerCase()
      .includes(query)
  );

  if (!friends.length) {
    showEmpty(
      ui.sideList,
      state.friends.length
        ? "لا توجد نتائج مطابقة."
        : "قائمة أصدقائك فارغة حالياً. اكتشف أعضاء هنون."
    );
    return;
  }

  ui.sideList.innerHTML = friends.map(friend => `
    <div class="item">
      ${avatarMarkup(friend)}
      <div class="item-main">
        <div class="item-name">${escapeHTML(displayName(friend))}</div>
        <div class="item-sub">@${escapeHTML(friend.username || "عضو هنون")}</div>
      </div>
      <button class="btn" data-open-friend="${escapeHTML(friend.id)}">مراسلة</button>
    </div>
  `).join("");

  ui.sideList.querySelectorAll("[data-open-friend]").forEach(button => {
    button.addEventListener("click", () => {
      const friend = state.friends.find(
        item => item.id === button.dataset.openFriend
      );

      if (friend) startDirectConversation(friend);
    });
  });
}

/* =========================================
   طلبات الصداقة
========================================= */

async function loadRequests() {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at")
    .eq("receiver_id", state.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const ids = (data || []).map(item => item.sender_id);

  if (!ids.length) {
    state.requests = [];
    return;
  }

  const { data: members, error: memberError } = await supabase
    .from("member_directory")
    .select("id,username,member_code,full_name,avatar_path,bio")
    .in("id", ids);

  if (memberError) throw memberError;

  const map = Object.fromEntries(
    (members || []).map(member => [member.id, member])
  );

  state.requests = data.map(request => ({
    ...request,
    member: map[request.sender_id]
  }));
}

function renderRequests() {
  if (!state.requests.length) {
    showEmpty(ui.sideList, "لا توجد طلبات صداقة جديدة.");
    return;
  }

  ui.sideList.innerHTML = state.requests.map(request => `
    <div class="item" style="flex-wrap:wrap">
      ${avatarMarkup(request.member)}
      <div class="item-main">
        <div class="item-name">${escapeHTML(displayName(request.member))}</div>
        <div class="item-sub">يريد إضافتك إلى قائمة أصدقائه</div>
      </div>
      <div class="actions" style="width:100%;padding-right:54px">
        <button class="btn" data-accept="${escapeHTML(request.id)}">قبول</button>
        <button class="btn danger" data-reject="${escapeHTML(request.id)}">رفض</button>
      </div>
    </div>
  `).join("");

  ui.sideList.querySelectorAll("[data-accept]").forEach(button => {
    button.addEventListener("click", () => {
      respondToRequest(button.dataset.accept, "accepted", button);
    });
  });

  ui.sideList.querySelectorAll("[data-reject]").forEach(button => {
    button.addEventListener("click", () => {
      respondToRequest(button.dataset.reject, "rejected", button);
    });
  });
}

async function respondToRequest(requestId, status, button) {
  setButtonBusy(button, true);

  try {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("receiver_id", state.user.id)
      .eq("status", "pending");

    if (error) throw error;

    showNotice(
      status === "accepted" ? "تم قبول طلب الصداقة." : "تم رفض طلب الصداقة.",
      "success"
    );

    await loadRequests();
    await loadFriends();
    renderCurrentTab();

  } catch (error) {
    showNotice(getErrorMessage(error), "error");
  } finally {
    setButtonBusy(button, false);
  }
}

/* =========================================
   اكتشاف الأعضاء والبحث
========================================= */

async function searchMembers(query) {
  if (!state.user) return;

  const term = query.trim();

  if (!term) {
    showEmpty(ui.sideList, "اكتب اسم العضو أو اسم المستخدم أو كود العضوية للبحث.");
    state.discover = [];
    return;
  }

  showEmpty(ui.sideList, "جارٍ البحث عن الأعضاء...");

  try {
    const safeTerm = term.replace(/[,%()]/g, " ").trim();

    const searches = await Promise.all([
      supabase
        .from("member_directory")
        .select("id,username,member_code,full_name,avatar_path,bio")
        .ilike("full_name", `%${safeTerm}%`)
        .limit(20),

      supabase
        .from("member_directory")
        .select("id,username,member_code,full_name,avatar_path,bio")
        .ilike("username", `%${safeTerm}%`)
        .limit(20),

      supabase
        .from("member_directory")
        .select("id,username,member_code,full_name,avatar_path,bio")
        .ilike("member_code", `%${safeTerm}%`)
        .limit(20)
    ]);

    const firstError = searches.find(result => result.error)?.error;
    if (firstError) throw firstError;

    const unique = new Map();

    searches.forEach(result => {
      (result.data || []).forEach(member => {
        if (member.id !== state.user.id) {
          unique.set(member.id, member);
        }
      });
    });

    state.discover = [...unique.values()];

    await renderDiscover();

  } catch (error) {
    showEmpty(ui.sideList, getErrorMessage(error));
  }
}

async function renderDiscover() {
  if (!state.discover.length) {
    showEmpty(ui.sideList, "لم يتم العثور على أعضاء. جرّب كلمة بحث أخرى.");
    return;
  }

  const friendIds = new Set(state.friends.map(friend => friend.id));

  const { data: pending, error } = await supabase
    .from("friend_requests")
    .select("sender_id,receiver_id,status")
    .eq("status", "pending")
    .or(`sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`);

  if (error) {
    showEmpty(ui.sideList, getErrorMessage(error));
    return;
  }

  const pendingIds = new Set();

  (pending || []).forEach(request => {
    pendingIds.add(
      request.sender_id === state.user.id
        ? request.receiver_id
        : request.sender_id
    );
  });

  const query = ui.sideSearch.value.trim().toLowerCase();

  const members = state.discover.filter(member =>
    `${member.full_name || ""} ${member.username || ""} ${member.member_code || ""}`
      .toLowerCase()
      .includes(query)
  );

  ui.sideList.innerHTML = members.map(member => {
    let action = "";

    if (friendIds.has(member.id)) {
      action = `<span class="badge">صديق</span>`;
    } else if (pendingIds.has(member.id)) {
      action = `<span class="badge">طلب معلّق</span>`;
    } else {
      action = `<button class="btn" data-add-friend="${escapeHTML(member.id)}">إضافة</button>`;
    }

    return `
      <div class="item">
        ${avatarMarkup(member)}
        <div class="item-main">
          <div class="item-name">${escapeHTML(displayName(member))}</div>
          <div class="item-sub">
            @${escapeHTML(member.username || "عضو هنون")}
            ${member.member_code ? " · " + escapeHTML(member.member_code) : ""}
          </div>
        </div>
        ${action}
      </div>
    `;
  }).join("");

  ui.sideList.querySelectorAll("[data-add-friend]").forEach(button => {
    button.addEventListener("click", () => {
      sendFriendRequest(button.dataset.addFriend, button);
    });
  });
}

async function sendFriendRequest(receiverId, button) {
  setButtonBusy(button, true);

  try {
    const { data: existing, error: searchError } = await supabase
      .from("friend_requests")
      .select("id,status,sender_id,receiver_id")
      .or(
        `and(sender_id.eq.${state.user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${state.user.id})`
      )
      .in("status", ["pending", "accepted"])
      .limit(1);

    if (searchError) throw searchError;

    if (existing?.some(item => item.status === "accepted")) {
      showNotice("هذا العضو موجود بالفعل في قائمة أصدقائك.");
      await loadFriends();
      return;
    }

    if (existing?.length) {
      showNotice("يوجد طلب صداقة معلّق بينكما بالفعل.");
      return;
    }

    const { error } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: state.user.id,
        receiver_id: receiverId,
        status: "pending"
      });

    if (error) throw error;

    showNotice("تم إرسال طلب الصداقة بنجاح.", "success");

    await searchMembers(ui.sideSearch.value);

  } catch (error) {
    showNotice(getErrorMessage(error), "error");
  } finally {
    setButtonBusy(button, false);
  }
}

/* =========================================
   إنشاء محادثة خاصة
========================================= */

async function startDirectConversation(friend) {
  try {
    const ids = [state.user.id, friend.id].sort();
    const directKey = ids.join(":");

    let { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("direct_key", directKey)
      .maybeSingle();

    if (error) throw error;

    if (!conversation) {
      const result = await supabase
        .from("conversations")
        .insert({
          conversation_type: "direct",
          direct_key: directKey,
          created_by: state.user.id
        })
        .select("*")
        .single();

      if (result.error) {
        if (result.error.code === "23505") {
          const retry = await supabase
            .from("conversations")
            .select("*")
            .eq("direct_key", directKey)
            .single();

          if (retry.error) throw retry.error;
          conversation = retry.data;
        } else {
          throw result.error;
        }
      } else {
        conversation = result.data;
      }
    }

    const { error: memberError } = await supabase
      .from("conversation_members")
      .upsert(
        ids.map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
          member_role: userId === state.user.id ? "owner" : "member"
        })),
        { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
      );

    if (memberError) throw memberError;

    await loadConversations();
    state.tab = "chats";

    document.querySelectorAll("[data-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === "chats");
    });

    renderConversations();
    await openConversation(conversation);

  } catch (error) {
    showNotice(getErrorMessage(error), "error");
  }
}

/* =========================================
   إنشاء مجموعة
========================================= */

ui.newGroupBtn.addEventListener("click", () => {
  ui.groupPanel.classList.remove("hidden");
  ui.groupPanel.scrollIntoView({ behavior: "smooth", block: "center" });
});

ui.cancelGroupBtn.addEventListener("click", () => {
  ui.groupPanel.classList.add("hidden");
  ui.groupForm.reset();
});

async function findGroupMembers(value) {
  const terms = [...new Set(
    value.split(",").map(item => item.trim()).filter(Boolean)
  )];

  const found = new Map();

  for (const term of terms) {
    const safeTerm = term.replace(/[,%()]/g, " ").trim();

    const { data, error } = await supabase
      .from("member_directory")
      .select("id,username,member_code,full_name")
      .or(`username.eq.${safeTerm},member_code.eq.${safeTerm}`)
      .limit(5);

    if (error) throw error;

    (data || []).forEach(member => {
      if (member.id !== state.user.id) {
        found.set(member.id, member);
      }
    });
  }

  return [...found.values()];
}

async function createGroup(event) {
  event.preventDefault();

  const name = $("#groupName").value.trim();
  const description = $("#groupDescription").value.trim();
  const membersText = $("#groupMembers").value.trim();

  if (!name) {
    showNotice("اكتب اسم المجموعة أولاً.", "error");
    return;
  }

  const submit = ui.groupForm.querySelector("button[type='submit']");
  setButtonBusy(submit, true, "جارٍ إنشاء المجموعة...");

  try {
    const selectedMembers = await findGroupMembers(membersText);

    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        conversation_type: "group",
        title: name,
        description: description || null,
        created_by: state.user.id
      })
      .select("*")
      .single();

    if (error) throw error;

    const memberRows = [
      {
        conversation_id: conversation.id,
        user_id: state.user.id,
        member_role: "owner"
      },
      ...selectedMembers.map(member => ({
        conversation_id: conversation.id,
        user_id: member.id,
        member_role: "member"
      }))
    ];

    const { error: insertMembersError } = await supabase
      .from("conversation_members")
      .insert(memberRows);

    if (insertMembersError) throw insertMembersError;

    ui.groupForm.reset();
    ui.groupPanel.classList.add("hidden");

    showNotice("تم إنشاء المجموعة بنجاح.", "success");

    await loadConversations();
    renderConversations();
    await openConversation(conversation);

  } catch (error) {
    showNotice(getErrorMessage(error), "error");
  } finally {
    setButtonBusy(submit, false);
  }
}

ui.groupForm.addEventListener("submit", createGroup);

/* =========================================
   فتح ملف العضو
========================================= */

ui.viewMemberBtn.addEventListener("click", () => {
  if (!state.selectedMember?.id) return;

  window.location.href =
    `member.html?user=${encodeURIComponent(state.selectedMember.id)}`;
});

/* =========================================
   البحث داخل القسم الحالي
========================================= */

ui.sideSearch.addEventListener("input", () => {
  if (state.tab === "chats") {
    renderConversations();
  }

  if (state.tab === "friends") {
    renderFriends();
  }

  if (state.tab === "requests") {
    renderRequests();
  }

  if (state.tab === "discover") {
    window.clearTimeout(ui.sideSearch.timer);

    ui.sideSearch.timer = window.setTimeout(() => {
      searchMembers(ui.sideSearch.value);
    }, 350);
  }
});

/* =========================================
   تحديث دوري للقوائم
========================================= */

async function refreshCommunityLists() {
  if (!state.user) return;

  try {
    await loadConversations();
    await loadFriends();
    await loadRequests();
    renderCurrentTab();
  } catch (error) {
    console.error("Community refresh:", error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshCommunityLists();
  }
});

/* =========================================
   بدء التشغيل
========================================= */

initializeCommunity();
