
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    friend: null,
    conversation: null,
    channel: null,
    sending: false,
    loading: false,
    messageIds: new Set()
  };

  const ui = {
    loading: $("loadingScreen"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    avatar: $("chatAvatar"),
    name: $("chatName"),
    status: $("chatStatus"),
    messages: $("messageList"),
    form: $("messageForm"),
    input: $("messageInput"),
    send: $("sendMessageBtn"),
    back: $("mobileBackBtn"),
    more: $("chatMoreBtn")
  };

  function showNotice(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = "chat-notice show";

    if (type === "error") {
      ui.notice.style.background = "rgba(255,80,105,.15)";
      ui.notice.style.color = "#ffb3c0";
    } else {
      ui.notice.style.background = "rgba(65,200,180,.12)";
      ui.notice.style.color = "#b9f4e9";
    }

    clearTimeout(showNotice.timer);

    showNotice.timer = setTimeout(() => {
      ui.notice.classList.remove("show");
    }, 4500);
  }

  function hideLoading() {
    ui.loading.classList.add("hidden");
  }

  function showLoading(message) {
    ui.loading.textContent = message;
    ui.loading.classList.remove("hidden");
  }

  function displayName(member) {
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

  function setAvatar(member) {
    ui.avatar.replaceChildren();

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");

      image.src = url;
      image.alt = displayName(member);
      image.loading = "lazy";

      image.onerror = () => {
        ui.avatar.replaceChildren();
        ui.avatar.textContent =
          displayName(member).charAt(0) || "هـ";
      };

      ui.avatar.appendChild(image);
    } else {
      ui.avatar.textContent =
        displayName(member).charAt(0) || "هـ";
    }
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showEmpty(message) {
    const element = document.createElement("div");

    element.className = "empty-chat";
    element.textContent = message;

    ui.messages.replaceChildren(element);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      ui.messages.scrollTop = ui.messages.scrollHeight;
    });
  }

  function setComposerEnabled(enabled) {
    ui.input.disabled = !enabled;
    ui.send.disabled = !enabled;
  }

  function getFriendIdFromKey(key) {
    const ids = String(key || "").split(":");

    return ids.find(id => id && id !== state.user.id) || null;
  }

  async function verifyFriendship(friendId) {
    const { data, error } = await state.db
      .from("friend_requests")
      .select("id,status,sender_id,receiver_id")
      .eq("status", "accepted")
      .or(
        `and(sender_id.eq.${state.user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${state.user.id})`
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "لا يمكن فتح المراسلة إلا بين الأصدقاء بعد قبول طلب الصداقة."
      );
    }

    return data;
  }

  async function loadFriend(friendId) {
    const { data, error } = await state.db
      .from("member_directory")
      .select("id,username,member_code,full_name,avatar_path,bio")
      .eq("id", friendId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("لم يتم العثور على حساب الصديق.");
    }

    return data;
  }

  async function findConversationById(conversationId) {
    const { data, error } = await state.db
      .from("conversations")
      .select("id,title,conversation_type,direct_key,created_by,updated_at")
      .eq("id", conversationId)
      .eq("conversation_type", "direct")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("المحادثة غير موجودة أو لا يمكن الوصول إليها.");
    }

    return data;
  }

  async function findConversationByFriend(friendId) {
    const directKey = [
      state.user.id,
      friendId
    ].sort().join(":");

    const { data, error } = await state.db
      .from("conversations")
      .select("id,title,conversation_type,direct_key,created_by,updated_at")
      .eq("conversation_type", "direct")
      .eq("direct_key", directKey)
      .maybeSingle();

    if (error) throw error;

    return data;
  }

  async function ensureMembership(conversation, friend) {
    const { data: existing, error: checkError } = await state.db
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("conversation_id", conversation.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!existing) {
      const { error } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: state.user.id,
          member_role: "member"
        });

      if (error && error.code !== "23505") {
        throw error;
      }
    }

    if (conversation.created_by === state.user.id && friend?.id) {
      const { error } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: friend.id,
          member_role: "member"
        });

      if (error && error.code !== "23505") {
        console.warn("Friend membership:", error);
      }
    }

    const { data: verified, error: verifyError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id")
        .eq("conversation_id", conversation.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (verifyError) throw verifyError;

    if (!verified) {
      throw new Error(
        "عضويتك في المحادثة غير مكتملة. حدّث الصفحة وحاول مرة أخرى."
      );
    }
  }

  async function createConversation(friend) {
    const directKey = [
      state.user.id,
      friend.id
    ].sort().join(":");

    const { error } = await state.db
      .from("conversations")
      .insert({
        conversation_type: "direct",
        direct_key: directKey,
        created_by: state.user.id
      });

    if (error && error.code !== "23505") {
      throw error;
    }

    let conversation = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      conversation = await findConversationByFriend(friend.id);

      if (conversation) break;

      await new Promise(resolve => setTimeout(resolve, 350));
    }

    if (!conversation) {
      throw new Error("تعذر إنشاء المحادثة.");
    }

    await ensureMembership(conversation, friend);

    return conversation;
  }

  async function updateReadStatus() {
    if (!state.conversation || !state.user) return;

    const { error } = await state.db
      .from("conversation_members")
      .update({
        last_read_at: new Date().toISOString()
      })
      .eq("conversation_id", state.conversation.id)
      .eq("user_id", state.user.id);

    if (error) {
      console.warn("HANOON read status:", error);
    }
  }

  function makeMessage(message) {
    const article = document.createElement("article");

    article.className = "message";
    article.classList.add(
      message.sender_id === state.user.id ? "mine" : "theirs"
    );

    article.dataset.messageId = message.id;

    const body = document.createElement("div");
    body.className = "message-body";

    if (message.message_type === "image") {
      const image = document.createElement("img");

      image.className = "message-image";
      image.src = message.body || "";
      image.alt = "صورة مرسلة";
      image.loading = "lazy";

      body.appendChild(image);

    } else if (message.message_type === "video") {
      const video = document.createElement("video");

      video.src = message.body || "";
      video.controls = true;
      video.playsInline = true;
      video.style.maxWidth = "100%";
      video.style.maxHeight = "280px";
      video.style.borderRadius = "11px";

      body.appendChild(video);

    } else {
      body.textContent = message.body || "";
    }

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTime(message.created_at);

    article.append(body, time);

    if (message.sender_id === state.user.id) {
      const status = document.createElement("div");

      status.className = "message-status";
      status.textContent = "✓";

      article.appendChild(status);
    }

    return article;
  }

  function appendMessage(message) {
    if (!message?.id || state.messageIds.has(message.id)) {
      return;
    }

    state.messageIds.add(message.id);

    const empty = ui.messages.querySelector(".empty-chat");

    if (empty) empty.remove();

    ui.messages.appendChild(makeMessage(message));

    scrollToBottom();
  }

  async function loadMessages() {
    if (!state.conversation) return;

    showEmpty("جارٍ تحميل الرسائل...");

    state.messageIds.clear();

    const { data, error } = await state.db
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
      .eq("conversation_id", state.conversation.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    ui.messages.replaceChildren();

    if (!data?.length) {
      showEmpty("لا توجد رسائل بعد. ابدأ المحادثة الآن.");
    } else {
      data.forEach(appendMessage);
    }

    await updateReadStatus();
    scrollToBottom();
  }

  async function sendMessage(event) {
    event.preventDefault();

    const body = ui.input.value.trim();

    if (!body || !state.conversation || state.sending) {
      return;
    }

    state.sending = true;
    setComposerEnabled(false);

    try {
      const { data, error } = await state.db
        .from("messages")
        .insert({
          conversation_id: state.conversation.id,
          sender_id: state.user.id,
          body,
          message_type: "text"
        })
        .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
        .single();

      if (error) throw error;

      ui.input.value = "";

      appendMessage(data);

      const { error: updateError } = await state.db
        .from("conversations")
        .update({
          updated_at: new Date().toISOString()
        })
        .eq("id", state.conversation.id);

      if (updateError) {
        console.warn("Conversation timestamp:", updateError);
      }

      await updateReadStatus();

    } catch (error) {
      console.error("HANOON send:", error);

      showNotice(
        error.message || "تعذر إرسال الرسالة.",
        "error"
      );

    } finally {
      state.sending = false;
      setComposerEnabled(true);
      ui.input.focus();
    }
  }

  function subscribeToMessages() {
    if (state.channel) {
      state.db.removeChannel(state.channel);
      state.channel = null;
    }

    const conversationId = state.conversation.id;

    state.channel = state.db
      .channel(`hanoon-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        async payload => {
          if (
            state.conversation?.id !== conversationId ||
            payload.new.deleted_at
          ) {
            return;
          }

          appendMessage(payload.new);

          if (
            payload.new.sender_id !== state.user.id &&
            document.visibilityState === "visible"
          ) {
            await updateReadStatus();
          }
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          console.warn("HANOON realtime connection error.");
        }
      });
  }

  async function openConversation() {
    const params = new URLSearchParams(window.location.search);

    const conversationId = params.get("id");
    const friendIdFromURL = params.get("user");

    if (!conversationId && !friendIdFromURL) {
      throw new Error("رابط المحادثة غير مكتمل.");
    }

    let conversation = null;
    let friendId = friendIdFromURL;

    if (conversationId) {
      conversation = await findConversationById(conversationId);

      const idFromConversation = getFriendIdFromKey(
        conversation.direct_key
      );

      if (
        friendId &&
        idFromConversation &&
        friendId !== idFromConversation
      ) {
        throw new Error("بيانات المحادثة غير متطابقة.");
      }

      friendId = idFromConversation;
    }

    if (!friendId || friendId === state.user.id) {
      throw new Error("تعذر تحديد الطرف الآخر في المحادثة.");
    }

    await verifyFriendship(friendId);

    state.friend = await loadFriend(friendId);

    if (!conversation) {
      conversation = await findConversationByFriend(friendId);

      if (conversation) {
        await ensureMembership(conversation, state.friend);
      } else {
        conversation = await createConversation(state.friend);
      }
    } else {
      await ensureMembership(conversation, state.friend);
    }

    state.conversation = conversation;

    setAvatar(state.friend);

    ui.name.textContent = displayName(state.friend);
    ui.status.textContent = "محادثة خاصة";

    await loadMessages();
    subscribeToMessages();

    setComposerEnabled(true);
    hideLoading();

    ui.input.focus();
  }

  function bindEvents() {
    ui.form.addEventListener("submit", sendMessage);

    ui.back.addEventListener("click", () => {
      window.location.href = "messages.html";
    });

    ui.more.addEventListener("click", () => {
      window.location.href = "messages.html";
    });

    ui.input.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        ui.form.requestSubmit();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        state.conversation
      ) {
        updateReadStatus();
      }
    });

    window.addEventListener("pagehide", () => {
      if (state.channel) {
        state.db.removeChannel(state.channel);
      }
    });
  }

  async function initialize() {
    try {
      showLoading("جارٍ الاتصال بحسابك...");

      state.db = window.HANOON?.supabase;

      if (!state.db) {
        throw new Error("اتصال قاعدة البيانات غير جاهز.");
      }

      const { data, error } = await state.db.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        hideLoading();
        ui.auth.classList.add("show");
        setComposerEnabled(false);
        return;
      }

      state.user = data.user;

      bindEvents();

      setComposerEnabled(false);

      await openConversation();

    } catch (error) {
      console.error("HANOON chat:", error);

      hideLoading();

      showNotice(
        error.message || "تعذر فتح المحادثة.",
        "error"
      );

      setComposerEnabled(false);
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
        hideLoading();

        showNotice(
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات.",
          "error"
        );
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
