
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    conversations: [],
    activeConversation: null,
    activeFriend: null,
    channel: null,
    loading: false,
    sending: false
  };

  const ui = {
    app: $("messagesApp"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    list: $("conversationList"),
    search: $("conversationSearch"),
    count: $("chatCount"),
    avatar: $("chatAvatar"),
    name: $("chatName"),
    status: $("chatStatus"),
    messages: $("messageList"),
    form: $("messageForm"),
    input: $("messageInput"),
    send: $("sendMessageBtn"),
    refresh: $("refreshChatsBtn"),
    back: $("mobileBackBtn")
  };

  function notify(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 5000);
  }

  function showEmpty(container, message) {
    const element = document.createElement("div");
    element.className = "chat-empty";
    element.textContent = message;
    container.replaceChildren(element);
  }

  function displayName(member) {
    return member?.full_name || member?.username || "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return state.db.storage
      .from("avatars")
      .getPublicUrl(path).data?.publicUrl || "";
  }

  function setAvatar(container, member) {
    container.replaceChildren();

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(member);
      image.loading = "lazy";

      image.onerror = () => {
        container.replaceChildren();
        container.textContent = displayName(member).charAt(0) || "هـ";
      };

      container.appendChild(image);
    } else {
      container.textContent = displayName(member).charAt(0) || "هـ";
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

  function setComposerEnabled(enabled) {
    ui.input.disabled = !enabled;
    ui.send.disabled = !enabled;
  }

  function getOtherUserId(conversation) {
    const ids = String(conversation.direct_key || "").split(":");
    return ids.find(id => id && id !== state.user.id) || null;
  }

  async function loadAcceptedFriends() {
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

  async function loadConversations() {
    showEmpty(ui.list, "جارٍ تحميل المحادثات...");

    const { data: memberships, error: membershipError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", state.user.id);

    if (membershipError) throw membershipError;

    const ids = [...new Set(
      (memberships || []).map(item => item.conversation_id)
    )];

    if (!ids.length) {
      state.conversations = [];
      renderConversations();
      return;
    }

    const { data: conversations, error: conversationError } =
      await state.db
        .from("conversations")
        .select("id,title,conversation_type,direct_key,created_by,updated_at")
        .in("id", ids)
        .eq("conversation_type", "direct")
        .order("updated_at", { ascending: false });

    if (conversationError) throw conversationError;

    const acceptedIds = new Set(await loadAcceptedFriends());

    const otherIds = [...new Set(
      (conversations || [])
        .map(getOtherUserId)
        .filter(id => id && acceptedIds.has(id))
    )];

    let profiles = [];

    if (otherIds.length) {
      const { data, error } = await state.db
        .from("member_directory")
        .select("id,username,member_code,full_name,avatar_path,bio")
        .in("id", otherIds);

      if (error) throw error;
      profiles = data || [];
    }

    const profileMap = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    state.conversations = (conversations || [])
      .map(conversation => {
        const friendId = getOtherUserId(conversation);
        if (!friendId || !acceptedIds.has(friendId)) return null;

        const friend = profileMap.get(friendId);
        if (!friend) return null;

        return { ...conversation, friend };
      })
      .filter(Boolean);

    renderConversations();
  }

  function filteredConversations() {
    const query = ui.search.value.trim().toLowerCase();
    if (!query) return state.conversations;

    return state.conversations.filter(conversation => {
      const friend = conversation.friend;

      return [
        friend.full_name,
        friend.username,
        friend.member_code
      ].some(value =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }

  function renderConversations() {
    ui.list.replaceChildren();
    ui.count.textContent = String(state.conversations.length);

    const conversations = filteredConversations();

    if (!conversations.length) {
      showEmpty(
        ui.list,
        state.conversations.length
          ? "لا توجد محادثات تطابق البحث."
          : "لا توجد محادثات بعد. افتح قائمة أصدقائك وابدأ مراسلة أحدهم."
      );
      return;
    }

    conversations.forEach(conversation => {
      const card = document.createElement("article");
      card.className = "conversation";

      if (state.activeConversation?.id === conversation.id) {
        card.classList.add("active");
      }

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      setAvatar(avatar, conversation.friend);

      const info = document.createElement("div");
      info.className = "conversation-info";

      const name = document.createElement("div");
      name.className = "conversation-name";
      name.textContent = displayName(conversation.friend);

      const last = document.createElement("div");
      last.className = "conversation-last";
      last.textContent = "اضغط لفتح المحادثة";

      info.append(name, last);

      const time = document.createElement("div");
      time.className = "conversation-time";
      time.textContent = formatTime(conversation.updated_at);

      card.append(avatar, info, time);

      card.addEventListener("click", () => {
        openConversation(conversation);
      });

      ui.list.appendChild(card);
    });
  }

  // يتأكد من تسجيل عضوية المستخدم الحالي أولاً.
  // لا يحاول إضافة عضوية الصديق إلا إذا كان المستخدم هو منشئ المحادثة.
  async function ensureOwnMembership(conversation, friend) {
    const { data: existingMembership, error: checkError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id")
        .eq("conversation_id", conversation.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (checkError) throw checkError;

    if (!existingMembership) {
      const { error: insertOwnError } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: state.user.id,
          member_role: "member"
        });

      if (insertOwnError && insertOwnError.code !== "23505") {
        throw insertOwnError;
      }
    }

    // إذا كان المستخدم هو المنشئ، يتأكد من إضافة الطرف الآخر.
    // خطأ التكرار هنا طبيعي إذا كانت عضويته موجودة بالفعل.
    if (conversation.created_by === state.user.id && friend?.id) {
      const { error: insertFriendError } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: friend.id,
          member_role: "member"
        });

      if (
        insertFriendError &&
        insertFriendError.code !== "23505"
      ) {
        throw insertFriendError;
      }
    }

    // تحقق نهائي: لا نفتح المحادثة قبل التأكد من عضويتنا.
    const { data: verifiedMembership, error: verifyError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id")
        .eq("conversation_id", conversation.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (verifyError) throw verifyError;

    if (!verifiedMembership) {
      throw new Error(
        "لم تكتمل عضويتك في المحادثة. تأكد من قبول الصداقة ثم حاول مرة أخرى."
      );
    }

    return true;
  }

  async function getOrCreateConversation(friend) {
    const ids = [state.user.id, friend.id].sort();
    const directKey = ids.join(":");

    const { data: existing, error: findError } = await state.db
      .from("conversations")
      .select("id,title,conversation_type,direct_key,created_by,updated_at")
      .eq("conversation_type", "direct")
      .eq("direct_key", directKey)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      await ensureOwnMembership(existing, friend);

      return {
        ...existing,
        friend
      };
    }

    const { error: createError } = await state.db
      .from("conversations")
      .insert({
        conversation_type: "direct",
        direct_key: directKey,
        created_by: state.user.id
      });

    if (createError && createError.code !== "23505") {
      throw createError;
    }

    // نبحث عن المحادثة بعد الإنشاء، مع مراعاة احتمال إنشائها بالتزامن.
    let created = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await state.db
        .from("conversations")
        .select("id,title,conversation_type,direct_key,created_by,updated_at")
        .eq("conversation_type", "direct")
        .eq("direct_key", directKey)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        created = data;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 350));
    }

    if (!created) {
      throw new Error("تعذر العثور على المحادثة بعد إنشائها.");
    }

    await ensureOwnMembership(created, friend);

    return {
      ...created,
      friend
    };
  }

  async function openConversation(conversation) {
    if (!conversation?.id || state.loading) return;

    state.loading = true;

    try {
      if (state.channel) {
        await state.db.removeChannel(state.channel);
        state.channel = null;
      }

      state.activeConversation = conversation;
      state.activeFriend = conversation.friend;

      setAvatar(ui.avatar, conversation.friend);
      ui.name.textContent = displayName(conversation.friend);
      ui.status.textContent = "محادثة خاصة";

      ui.app.classList.add("show-chat");

      setComposerEnabled(true);
      ui.input.value = "";

      renderConversations();

      await loadMessages(conversation.id);
      subscribeToMessages(conversation.id);

      ui.input.focus();

    } catch (error) {
      console.error("HANOON open conversation:", error);
      notify(error.message || "تعذر فتح المحادثة.", "error");
    } finally {
      state.loading = false;
    }
  }

  function renderMessage(message) {
    const article = document.createElement("article");

    article.className = "message";
    article.classList.add(
      message.sender_id === state.user.id ? "mine" : "theirs"
    );

    article.dataset.messageId = message.id;

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = message.body || "";

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTime(message.created_at);

    article.append(body, time);

    return article;
  }

  function scrollMessagesToBottom() {
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  async function loadMessages(conversationId) {
    showEmpty(ui.messages, "جارٍ تحميل الرسائل...");

    const { data, error } = await state.db
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    ui.messages.replaceChildren();

    if (!data?.length) {
      showEmpty(ui.messages, "ابدأ المحادثة بإرسال أول رسالة.");
      return;
    }

    data.forEach(message => {
      ui.messages.appendChild(renderMessage(message));
    });

    scrollMessagesToBottom();
  }

  function subscribeToMessages(conversationId) {
    if (state.channel) {
      state.db.removeChannel(state.channel);
    }

    state.channel = state.db
      .channel(`hanoon-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        payload => {
          if (
            state.activeConversation?.id !== conversationId ||
            payload.new.deleted_at
          ) return;

          const exists = ui.messages.querySelector(
            `[data-message-id="${CSS.escape(payload.new.id)}"]`
          );

          if (exists) return;

          const emptyState = ui.messages.querySelector(".chat-empty");
          if (emptyState) emptyState.remove();

          ui.messages.appendChild(renderMessage(payload.new));
          scrollMessagesToBottom();

          loadConversations().catch(error => {
            console.warn("Conversation refresh:", error);
          });
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          console.warn("HANOON realtime channel error.");
        }
      });
  }

  async function sendMessage(event) {
    event.preventDefault();

    const body = ui.input.value.trim();

    if (!body || !state.activeConversation || state.sending) return;

    state.sending = true;
    ui.send.disabled = true;

    try {
      const { data, error } = await state.db
        .from("messages")
        .insert({
          conversation_id: state.activeConversation.id,
          sender_id: state.user.id,
          body,
          message_type: "text"
        })
        .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
        .single();

      if (error) throw error;

      ui.input.value = "";

      const emptyState = ui.messages.querySelector(".chat-empty");
      if (emptyState) emptyState.remove();

      const exists = ui.messages.querySelector(
        `[data-message-id="${CSS.escape(data.id)}"]`
      );

      if (!exists) {
        ui.messages.appendChild(renderMessage(data));
      }

      scrollMessagesToBottom();

      const { error: updateError } = await state.db
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", state.activeConversation.id);

      if (updateError) {
        console.warn("Conversation timestamp:", updateError);
      }

      await loadConversations();

    } catch (error) {
      console.error("HANOON send message:", error);
      notify(error.message || "تعذر إرسال الرسالة.", "error");
    } finally {
      state.sending = false;
      ui.send.disabled = !state.activeConversation;
    }
  }

  async function openFriendFromURL() {
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get("user");

    if (!friendId) return;

    if (friendId === state.user.id) {
      notify("لا يمكنك فتح محادثة مع حسابك الشخصي.", "error");
      return;
    }

    const { data: friendship, error: friendshipError } =
      await state.db
        .from("friend_requests")
        .select("id,status,sender_id,receiver_id")
        .eq("status", "accepted")
        .or(
          `and(sender_id.eq.${state.user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${state.user.id})`
        )
        .maybeSingle();

    if (friendshipError) throw friendshipError;

    if (!friendship) {
      notify("المراسلة متاحة بين الأصدقاء بعد قبول طلب الصداقة فقط.", "error");
      return;
    }

    const { data: friend, error: friendError } = await state.db
      .from("member_directory")
      .select("id,username,member_code,full_name,avatar_path,bio")
      .eq("id", friendId)
      .maybeSingle();

    if (friendError) throw friendError;

    if (!friend) {
      notify("لم يتم العثور على حساب هذا العضو.", "error");
      return;
    }

    const conversation = await getOrCreateConversation(friend);

    const existingIndex = state.conversations.findIndex(
      item => item.id === conversation.id
    );

    if (existingIndex === -1) {
      state.conversations.unshift(conversation);
    } else {
      state.conversations[existingIndex] = conversation;
    }

    renderConversations();
    await openConversation(conversation);
  }

  function bindEvents() {
    ui.form.addEventListener("submit", sendMessage);

    ui.search.addEventListener("input", renderConversations);

    ui.refresh.addEventListener("click", async () => {
      ui.refresh.disabled = true;
      ui.refresh.textContent = "جارٍ التحديث...";

      try {
        await loadConversations();

        if (state.activeConversation) {
          await loadMessages(state.activeConversation.id);
        }

        notify("تم تحديث المحادثات.", "success");

      } catch (error) {
        console.error("HANOON refresh:", error);
        notify(error.message || "تعذر تحديث المحادثات.", "error");
      } finally {
        ui.refresh.disabled = false;
        ui.refresh.textContent = "تحديث";
      }
    });

    ui.back.addEventListener("click", () => {
      ui.app.classList.remove("show-chat");
    });

    ui.input.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        window.innerWidth > 700
      ) {
        event.preventDefault();
        ui.form.requestSubmit();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        state.activeConversation
      ) {
        loadMessages(state.activeConversation.id).catch(error => {
          console.warn("Message refresh:", error);
        });
      }
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

      setComposerEnabled(false);
      bindEvents();

      await loadConversations();
      await openFriendFromURL();

    } catch (error) {
      console.error("HANOON messages:", error);

      ui.auth.classList.add("hidden");
      ui.app.classList.remove("hidden");

      notify(error.message || "تعذر تشغيل المراسلات.", "error");
    }
  }

  function startWhenReady() {
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
        ui.auth.classList.remove("hidden");
        ui.app.classList.add("hidden");
        ui.auth.textContent =
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات.";
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady, {
      once: true
    });
  } else {
    startWhenReady();
  }

})();
