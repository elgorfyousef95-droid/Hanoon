
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    groupId: null,
    group: null,
    channel: null,
    members: new Map(),
    sending: false,
    loading: false
  };

  const ui = {
    app: $("groupChatApp"),
    auth: $("authNotice"),
    notice: $("globalNotice"),
    title: $("groupTitle"),
    description: $("groupDescription"),
    count: $("memberCount"),
    memberList: $("memberList"),
    messages: $("messageList"),
    form: $("messageForm"),
    input: $("messageInput"),
    send: $("sendMessageBtn")
  };

  function notify(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 4500);
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showEmpty(container, message) {
    const element = document.createElement("div");
    element.className = "empty-state";
    element.textContent = message;
    container.replaceChildren(element);
  }

  function displayName(member) {
    return member?.full_name ||
      member?.username ||
      "عضو هنون";
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

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const { data } = state.db.storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function renderMember(member) {
    const item = document.createElement("div");
    item.className = "member-item";

    const avatar = document.createElement("div");
    avatar.className = "member-avatar";

    const url = avatarURL(member.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(member);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent =
          displayName(member).charAt(0) || "هـ";
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent =
        displayName(member).charAt(0) || "هـ";
    }

    const info = document.createElement("div");
    info.style.minWidth = "0";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = displayName(member);

    const role = document.createElement("span");
    role.className = "member-role";
    role.textContent =
      member.member_role === "owner"
        ? "منشئ المجموعة"
        : member.id === state.user.id
          ? "أنت"
          : "عضو";

    info.append(name, role);
    item.append(avatar, info);

    return item;
  }

  async function loadMembers() {
    ui.memberList.replaceChildren();

    /*
      سياسة قاعدة البيانات الحالية تسمح للمستخدم
      برؤية عضويته فقط في conversation_members.
      لذلك نعرض العضو الحالي دون اختلاق أسماء أو أعداد.
    */

    const { data, error } = await state.db
      .from("conversation_members")
      .select("conversation_id,user_id,member_role")
      .eq("conversation_id", state.groupId)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("لم يتم العثور على عضويتك في هذه المجموعة.");
    }

    const { data: profile, error: profileError } =
      await state.db
        .from("member_directory")
        .select("id,username,full_name,avatar_path")
        .eq("id", state.user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    const currentMember = {
      ...(profile || {}),
      id: state.user.id,
      member_role: data.member_role
    };

    state.members.set(state.user.id, currentMember);

    ui.memberList.appendChild(
      renderMember(currentMember)
    );

    ui.count.textContent = "أنت عضو";

  }

  async function loadSenderProfiles(messages) {
    const ids = [...new Set(
      messages.map(message => message.sender_id)
    )];

    const missingIds = ids.filter(
      id => !state.members.has(id)
    );

    if (!missingIds.length) return;

    const { data, error } = await state.db
      .from("member_directory")
      .select("id,username,full_name,avatar_path")
      .in("id", missingIds);

    if (error) throw error;

    (data || []).forEach(member => {
      state.members.set(member.id, member);
    });
  }

  function renderMessage(message) {
    const article = document.createElement("article");

    article.className =
      "message " +
      (message.sender_id === state.user.id ? "mine" : "");

    article.dataset.messageId = message.id;

    const member = state.members.get(message.sender_id);

    const sender = document.createElement("div");
    sender.className = "message-sender";

    sender.textContent =
      message.sender_id === state.user.id
        ? "أنت"
        : displayName(member);

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = message.body || "";

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTime(message.created_at);

    article.append(sender, body, time);

    return article;
  }

  function scrollToBottom() {
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function appendMessage(message) {
    if (!message || message.deleted_at) return;

    const existing = ui.messages.querySelector(
      `[data-message-id="${CSS.escape(message.id)}"]`
    );

    if (existing) return;

    const empty = ui.messages.querySelector(".empty-state");

    if (empty) empty.remove();

    ui.messages.appendChild(renderMessage(message));
    scrollToBottom();
  }

  async function loadMessages() {
    showEmpty(ui.messages, "جارٍ تحميل الرسائل...");

    const { data, error } = await state.db
      .from("messages")
      .select(
        "id,conversation_id,sender_id,body,message_type,created_at,deleted_at"
      )
      .eq("conversation_id", state.groupId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(150);

    if (error) throw error;

    await loadSenderProfiles(data || []);

    ui.messages.replaceChildren();

    if (!data?.length) {
      showEmpty(
        ui.messages,
        "لا توجد رسائل بعد. ابدأ أول نقاش في المجموعة."
      );
      return;
    }

    data.forEach(message => {
      ui.messages.appendChild(renderMessage(message));
    });

    scrollToBottom();
  }

  function subscribeToMessages() {
    if (state.channel) {
      state.db.removeChannel(state.channel);
      state.channel = null;
    }

    state.channel = state.db
      .channel(`hanoon-group-${state.groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${state.groupId}`
        },
        async payload => {
          if (
            payload.new.conversation_id !== state.groupId ||
            payload.new.deleted_at
          ) {
            return;
          }

          try {
            await loadSenderProfiles([payload.new]);
            appendMessage(payload.new);
          } catch (error) {
            console.error("Group realtime message:", error);
          }
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          notify(
            "تعذر استقبال الرسائل المباشرة. يمكنك تحديث الصفحة.",
            "error"
          );
        }
      });
  }

  async function sendMessage(event) {
    event.preventDefault();

    const body = ui.input.value.trim();

    if (!body || state.sending || !state.groupId) {
      return;
    }

    state.sending = true;
    setComposerEnabled(false);

    try {
      const { data, error } = await state.db
        .from("messages")
        .insert({
          conversation_id: state.groupId,
          sender_id: state.user.id,
          body,
          message_type: "text"
        })
        .select(
          "id,conversation_id,sender_id,body,message_type,created_at,deleted_at"
        )
        .single();

      if (error) throw error;

      ui.input.value = "";

      appendMessage(data);

      await state.db
        .from("conversations")
        .update({
          updated_at: new Date().toISOString()
        })
        .eq("id", state.groupId);

    } catch (error) {
      console.error("HANOON group send:", error);

      notify(
        error.message || "تعذر إرسال الرسالة.",
        "error"
      );

    } finally {
      state.sending = false;
      setComposerEnabled(true);
      ui.input.focus();
    }
  }

  async function loadGroup() {
    const { data: group, error } = await state.db
      .from("conversations")
      .select(
        "id,title,description,conversation_type,created_by"
      )
      .eq("id", state.groupId)
      .eq("conversation_type", "group")
      .maybeSingle();

    if (error) throw error;

    if (!group) {
      throw new Error("المجموعة غير موجودة أو لا يمكنك الوصول إليها.");
    }

    const { data: membership, error: membershipError } =
      await state.db
        .from("conversation_members")
        .select("conversation_id,user_id")
        .eq("conversation_id", state.groupId)
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      throw new Error("هذه المجموعة متاحة لأعضائها فقط. انضم إليها أولاً.");
    }

    state.group = group;

    ui.title.textContent = group.title || "مجموعة هنون";

    ui.description.textContent =
      group.description || "مساحة خاصة بأعضاء المجموعة";

    await loadMembers();
    await loadMessages();

    setComposerEnabled(true);
    subscribeToMessages();
  }

  function bindEvents() {
    ui.form.addEventListener("submit", sendMessage);

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
        state.groupId &&
        state.user
      ) {
        loadMessages().catch(error => {
          console.warn("Group message refresh:", error);
        });
      }
    });
  }

  async function initialize() {
    if (state.loading) return;

    state.loading = true;

    try {
      state.db = window.HANOON?.supabase;

      if (!state.db) {
        throw new Error("اتصال قاعدة البيانات غير جاهز.");
      }

      const params = new URLSearchParams(
        window.location.search
      );

      state.groupId = params.get("id");

      if (!state.groupId) {
        throw new Error("رابط المجموعة غير مكتمل.");
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

      await loadGroup();

    } catch (error) {
      console.error("HANOON group chat:", error);

      ui.app.classList.add("hidden");
      ui.auth.classList.remove("hidden");

      ui.auth.textContent =
        error.message || "تعذر فتح محادثة المجموعة.";

    } finally {
      state.loading = false;
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
        ui.auth.textContent =
          event.detail?.message ||
          "تعذر الاتصال بقاعدة البيانات.";
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
    document.addEventListener(
      "DOMContentLoaded",
      startWhenReady,
      { once: true }
    );
  } else {
    startWhenReady();
  }

})();
