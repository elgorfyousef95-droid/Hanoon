
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const now = () => new Date().toISOString();

  const state = {
    db: null,
    user: null,
    friend: null,
    conversation: null,
    channel: null,
    sending: false,
    messageIds: new Set(),
    recorder: null,
    recordingStream: null,
    recordingChunks: [],
    recordingStarted: 0,
    recordingTimer: null,
    cancelRecording: false,
    typingTimer: null,
    typingActive: false,
    presenceTimer: null,
    settings: {
      read_receipts: true,
      last_seen_visibility: "contacts",
      online_visibility: "contacts"
    },
    wallpaperUrl: null
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
    more: $("chatMoreBtn"),
    attach: $("attachBtn"),
    sticker: $("stickerBtn"),
    record: $("recordVoiceBtn"),
    recordingStrip: $("recordingStrip"),
    recordingTime: $("recordingTime"),
    cancelRecording: $("cancelRecordingBtn"),
    imageInput: $("chatImageInput"),
    fileInput: $("chatFileInput")
  };

  function showNotice(message, type = "") {
    if (!ui.notice) return;

    ui.notice.textContent = message;
    ui.notice.className = "chat-notice show";
    ui.notice.style.background = type === "error"
      ? "rgba(255,80,105,.15)"
      : "rgba(0,168,132,.13)";
    ui.notice.style.color = type === "error"
      ? "#ffb3c0"
      : "#b9f4e9";

    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => {
      ui.notice.classList.remove("show");
    }, 4500);
  }

  function hideLoading() {
    ui.loading?.classList.add("hidden");
  }

  function showLoading(message) {
    if (!ui.loading) return;
    ui.loading.textContent = message;
    ui.loading.classList.remove("hidden");
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

  function setAvatar(member) {
    ui.avatar.replaceChildren();

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = displayName(member);
      image.onerror = () => {
        ui.avatar.textContent = displayName(member).charAt(0);
      };
      ui.avatar.appendChild(image);
    } else {
      ui.avatar.textContent = displayName(member).charAt(0) || "هـ";
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

  function formatDuration(seconds) {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
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
    ui.attach.disabled = !enabled;
    ui.sticker.disabled = !enabled;
    ui.record.disabled = !enabled;
  }

  function getFriendIdFromKey(key) {
    return String(key || "")
      .split(":")
      .find(id => id && id !== state.user.id) || null;
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
      throw new Error("لا يمكن فتح المراسلة إلا بين الأصدقاء بعد قبول طلب الصداقة.");
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
    if (!data) throw new Error("لم يتم العثور على حساب الصديق.");

    return data;
  }

  async function findConversationById(id) {
    const { data, error } = await state.db
      .from("conversations")
      .select("id,title,conversation_type,direct_key,created_by,updated_at")
      .eq("id", id)
      .eq("conversation_type", "direct")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("المحادثة غير موجودة أو لا يمكن الوصول إليها.");

    return data;
  }

  async function findConversationByFriend(friendId) {
    const directKey = [state.user.id, friendId].sort().join(":");

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
    const { data: existing, error } = await state.db
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("conversation_id", conversation.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    if (!existing) {
      const { error: insertError } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: state.user.id,
          member_role: "member"
        });

      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }
    }

    if (conversation.created_by === state.user.id && friend?.id) {
      const { error: friendError } = await state.db
        .from("conversation_members")
        .insert({
          conversation_id: conversation.id,
          user_id: friend.id,
          member_role: "member"
        });

      if (friendError && friendError.code !== "23505") {
        console.warn("Friend membership:", friendError);
      }
    }

    const { data: verified, error: verifyError } = await state.db
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversation.id)
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (verifyError) throw verifyError;
    if (!verified) throw new Error("عضويتك في المحادثة غير مكتملة.");
  }

  async function createConversation(friend) {
    const directKey = [state.user.id, friend.id].sort().join(":");

    const { error } = await state.db
      .from("conversations")
      .insert({
        conversation_type: "direct",
        direct_key: directKey,
        created_by: state.user.id
      });

    if (error && error.code !== "23505") throw error;

    let conversation = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      conversation = await findConversationByFriend(friend.id);
      if (conversation) break;
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    if (!conversation) throw new Error("تعذر إنشاء المحادثة.");

    await ensureMembership(conversation, friend);
    return conversation;
  }

  async function updateReadStatus() {
    if (!state.conversation || !state.user) return;

    const { error } = await state.db
      .from("conversation_members")
      .update({ last_read_at: now() })
      .eq("conversation_id", state.conversation.id)
      .eq("user_id", state.user.id);

    if (error) console.warn("Read status:", error);
  }

  async function loadSettings() {
    const { data, error } = await state.db
      .from("chat_presence")
      .select("is_online,last_seen_visibility,online_visibility,read_receipts")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) {
      console.warn("Presence settings:", error);
      return;
    }

    if (data) {
      state.settings = {
        read_receipts: data.read_receipts ?? true,
        last_seen_visibility: data.last_seen_visibility || "contacts",
        online_visibility: data.online_visibility || "contacts"
      };
    }
  }

  async function setMyPresence(online) {
    if (!state.user) return;

    const values = {
      user_id: state.user.id,
      is_online: online,
      last_seen_visibility: state.settings.last_seen_visibility,
      online_visibility: state.settings.online_visibility,
      read_receipts: state.settings.read_receipts,
      updated_at: now()
    };

    if (!online) values.last_seen_at = now();

    const { error } = await state.db
      .from("chat_presence")
      .upsert(values, { onConflict: "user_id" });

    if (error) console.warn("Presence update:", error);
  }

  async function loadFriendPresence() {
    if (!state.friend) return;

    const { data, error } = await state.db
      .from("chat_presence")
      .select("is_online,last_seen_at,last_seen_visibility,online_visibility")
      .eq("user_id", state.friend.id)
      .maybeSingle();

    if (error || !data) {
      ui.status.textContent = "محادثة خاصة";
      ui.status.classList.remove("online");
      return;
    }

    const canSeeOnline =
      data.online_visibility === "everyone" ||
      data.online_visibility === "contacts";

    const canSeeLast =
      data.last_seen_visibility === "everyone" ||
      data.last_seen_visibility === "contacts";

    if (data.is_online && canSeeOnline) {
      ui.status.textContent = "متصل الآن";
      ui.status.classList.add("online");
    } else {
      ui.status.classList.remove("online");

      if (canSeeLast && data.last_seen_at) {
        ui.status.textContent = "آخر ظهور " + formatTime(data.last_seen_at);
      } else {
        ui.status.textContent = "محادثة خاصة";
      }
    }
  }

  async function resolveAttachment(path) {
    if (!path) return "";

    const { data, error } = await state.db.storage
      .from("chat-media")
      .createSignedUrl(path, 60 * 60);

    if (error) {
      console.warn("Attachment URL:", error);
      return "";
    }

    return data?.signedUrl || "";
  }

  async function makeMessage(message) {
    const article = document.createElement("article");
    article.className = "message";
    article.classList.add(
      message.sender_id === state.user.id ? "mine" : "theirs"
    );
    article.dataset.messageId = message.id;

    const body = document.createElement("div");
    body.className = "message-body";

    if (["image", "video", "audio"].includes(message.message_type)) {
      const url = await resolveAttachment(message.attachment_path);

      if (!url) {
        body.textContent = "تعذر تحميل المرفق";
      } else if (message.message_type === "image") {
        const image = document.createElement("img");
        image.className = "message-image";
        image.src = url;
        image.alt = "صورة مرسلة";
        image.loading = "lazy";
        body.appendChild(image);
      } else if (message.message_type === "video") {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        body.appendChild(video);
      } else {
        const audio = document.createElement("audio");
        audio.src = url;
        audio.controls = true;
        audio.className = "message-audio";
        body.appendChild(audio);

        if (message.duration_seconds) {
          const duration = document.createElement("div");
          duration.textContent = formatDuration(message.duration_seconds);
          duration.style.fontSize = "10px";
          duration.style.color = "#b9c8ce";
          body.appendChild(duration);
        }
      }
    } else if (message.message_type === "sticker") {
      body.style.fontSize = "54px";
      body.style.textAlign = "center";
      body.textContent = message.body || "❤️";
    } else if (message.message_type === "file") {
      const link = document.createElement("a");
      const url = await resolveAttachment(message.attachment_path);
      link.href = url || "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = message.body || "فتح الملف";
      link.style.color = "white";
      body.appendChild(link);
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

    article.addEventListener("contextmenu", event => {
      event.preventDefault();
      showMessageActions(message);
    });

    article.addEventListener("dblclick", () => {
      showMessageActions(message);
    });

    return article;
  }

  async function appendMessage(message) {
    if (!message?.id || state.messageIds.has(message.id)) return;

    state.messageIds.add(message.id);

    const empty = ui.messages.querySelector(".empty-chat");
    if (empty) empty.remove();

    const element = await makeMessage(message);
    ui.messages.appendChild(element);
    scrollToBottom();
  }

  async function loadMessages() {
    if (!state.conversation) return;

    showEmpty("جارٍ تحميل الرسائل...");
    state.messageIds.clear();

    const { data, error } = await state.db
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,attachment_path,duration_seconds,created_at,deleted_at,reply_to")
      .eq("conversation_id", state.conversation.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    ui.messages.replaceChildren();

    if (!data?.length) {
      showEmpty("لا توجد رسائل بعد. ابدأ المحادثة الآن.");
    } else {
      for (const message of data) {
        await appendMessage(message);
      }
    }

    await updateReadStatus();
    scrollToBottom();
  }

  async function updateConversationTime() {
    const { error } = await state.db
      .from("conversations")
      .update({ updated_at: now() })
      .eq("id", state.conversation.id);

    if (error) console.warn("Conversation timestamp:", error);
  }

  async function insertMessage(values) {
    const { data, error } = await state.db
      .from("messages")
      .insert({
        conversation_id: state.conversation.id,
        sender_id: state.user.id,
        ...values
      })
      .select("id,conversation_id,sender_id,body,message_type,attachment_path,duration_seconds,created_at,deleted_at,reply_to")
      .single();

    if (error) throw error;

    await appendMessage(data);
    await updateConversationTime();

    return data;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const body = ui.input.value.trim();
    if (!body || !state.conversation || state.sending) return;

    state.sending = true;
    ui.send.disabled = true;

    try {
      await insertMessage({
        body,
        message_type: "text"
      });

      ui.input.value = "";
      sendTyping(false);
      await updateReadStatus();

    } catch (error) {
      console.error("Send message:", error);
      showNotice(error.message || "تعذر إرسال الرسالة.", "error");
    } finally {
      state.sending = false;
      ui.send.disabled = false;
      ui.input.focus();
    }
  }

  async function uploadAndSend(file, type, extra = {}) {
    if (!file || !state.conversation) return null;

    if (file.size > 25 * 1024 * 1024) {
      showNotice("حجم الملف يجب ألا يتجاوز 25 ميجابايت.", "error");
      return null;
    }

    const extension = (file.name?.split(".").pop() || "bin")
      .toLowerCase().replace(/[^a-z0-9]/g, "");

    const unique = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path = `${state.conversation.id}/${state.user.id}/${Date.now()}-${unique}.${extension}`;

    showNotice("جارٍ رفع الملف...");

    try {
      const { error: uploadError } = await state.db.storage
        .from("chat-media")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const message = await insertMessage({
        body: file.name || "",
        message_type: type,
        attachment_path: path,
        duration_seconds: extra.duration_seconds ?? null
      });

      showNotice("تم إرسال المرفق.");
      return message;

    } catch (error) {
      console.error("Upload:", error);
      showNotice(error.message || "تعذر رفع المرفق.", "error");
      return null;
    }
  }

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showNotice("تسجيل الصوت غير مدعوم في هذا المتصفح.", "error");
      return;
    }

    try {
      state.recordingStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      state.recordingChunks = [];
      state.recorder = new MediaRecorder(state.recordingStream);
      state.recordingStarted = Date.now();
      state.cancelRecording = false;

      state.recorder.ondataavailable = event => {
        if (event.data?.size) state.recordingChunks.push(event.data);
      };

      state.recorder.onstop = async () => {
        const duration = Math.round(
          (Date.now() - state.recordingStarted) / 1000
        );

        const mimeType = state.recorder.mimeType || "audio/webm";
        const blob = new Blob(state.recordingChunks, { type: mimeType });

        stopRecordingUI();

        if (state.cancelRecording) {
          state.cancelRecording = false;
          return;
        }

        if (!blob.size) {
          showNotice("لم يتم تسجيل صوت.");
          return;
        }

        const extension = mimeType.includes("ogg") ? "ogg" :
          mimeType.includes("mp4") ? "mp4" : "webm";

        const file = new File(
          [blob],
          `voice-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        await uploadAndSend(file, "audio", {
          duration_seconds: duration
        });
      };

      state.recorder.start();

      ui.record.classList.add("recording");
      ui.recordingStrip.classList.remove("hidden");

      state.recordingTimer = setInterval(() => {
        ui.recordingTime.textContent = formatDuration(
          (Date.now() - state.recordingStarted) / 1000
        );
      }, 500);

    } catch (error) {
      console.error("Microphone:", error);
      showNotice("لم نتمكن من تشغيل الميكروفون. راجع إذن الوصول للصوت.", "error");
      stopRecordingUI();
    }
  }

  function stopRecordingUI() {
    clearInterval(state.recordingTimer);
    state.recordingTimer = null;

    ui.record.classList.remove("recording");
    ui.recordingStrip.classList.add("hidden");

    if (state.recordingStream) {
      state.recordingStream.getTracks().forEach(track => track.stop());
      state.recordingStream = null;
    }
  }

  function stopVoiceRecording(cancel = false) {
    if (!state.recorder || state.recorder.state === "inactive") return;

    state.cancelRecording = cancel;
    state.recorder.stop();
  }

  async function sendSticker(sticker) {
    if (!sticker || !state.conversation) return;

    try {
      await insertMessage({
        body: sticker,
        message_type: "sticker"
      });

      closePanel("stickerPanel");
    } catch (error) {
      showNotice("تعذر إرسال الملصق.", "error");
    }
  }

  function ensurePanel(id, title) {
    let panel = $(id);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = id;
    panel.className = "panel-overlay hidden";

    const box = document.createElement("div");
    box.className = "bottom-panel";

    const heading = document.createElement("div");
    heading.className = "panel-heading";

    const strong = document.createElement("strong");
    strong.textContent = title;

    const close = document.createElement("button");
    close.className = "close-panel";
    close.type = "button";
    close.textContent = "×";
    close.addEventListener("click", () => closePanel(id));

    heading.append(strong, close);
    box.appendChild(heading);
    panel.appendChild(box);
    document.querySelector(".chat-shell").appendChild(panel);

    panel.addEventListener("click", event => {
      if (event.target === panel) closePanel(id);
    });

    return panel;
  }

  function closePanel(id) {
    $(id)?.classList.add("hidden");
  }

  function openPanel(id) {
    $(id)?.classList.remove("hidden");
  }

  function sendTyping(active) {
    if (!state.channel) return;

    state.channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: state.user.id,
        active: Boolean(active)
      }
    }).catch(() => {});
  }

  function bindTyping() {
    ui.input.addEventListener("input", () => {
      if (!state.channel) return;

      if (!state.typingActive) {
        state.typingActive = true;
        sendTyping(true);
      }

      clearTimeout(state.typingTimer);
      state.typingTimer = setTimeout(() => {
        state.typingActive = false;
        sendTyping(false);
      }, 1800);
    });
  }

  function showTyping(active) {
    if (active) {
      ui.status.textContent = "يكتب الآن...";
      ui.status.classList.add("online");
    } else {
      loadFriendPresence();
    }
  }

  function subscribeToMessages() {
    if (state.channel) {
      state.db.removeChannel(state.channel);
      state.channel = null;
    }

    const conversationId = state.conversation.id;

    state.channel = state.db
      .channel(`hanoon-chat-${conversationId}`, {
        config: { broadcast: { self: false } }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      }, async payload => {
        if (state.conversation?.id !== conversationId) return;
        if (payload.new.deleted_at) return;

        await appendMessage(payload.new);

        if (
          payload.new.sender_id !== state.user.id &&
          document.visibilityState === "visible"
        ) {
          await updateReadStatus();
        }
      })
      .on("broadcast", { event: "typing" }, event => {
        if (event.payload?.user_id !== state.friend.id) return;
        showTyping(Boolean(event.payload.active));
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") loadFriendPresence();

        if (status === "CHANNEL_ERROR") {
          console.warn("HANOON realtime connection error.");
        }
      });
  }

  function showMessageActions(message) {
    const panel = ensurePanel("messageActionsPanel", "خيارات الرسالة");
    const box = panel.querySelector(".bottom-panel");

    box.querySelectorAll(".message-action-item").forEach(item => item.remove());

    const actions = [
      ["نسخ الرسالة", async () => {
        try {
          await navigator.clipboard.writeText(message.body || "");
          showNotice("تم نسخ الرسالة.");
        } catch {
          showNotice("تعذر نسخ الرسالة.", "error");
        }
      }],
      ["الرد على الرسالة", () => {
        ui.input.value = `↩ ${message.body || "مرفق"} `;
        ui.input.focus();
      }],
      ["حذف الرسالة لدي", async () => {
        const { error } = await state.db.from("messages")
          .update({ deleted_at: now() })
          .eq("id", message.id)
          .eq("sender_id", state.user.id);

        if (error) {
          showNotice("لا يمكن حذف هذه الرسالة.", "error");
        } else {
          document.querySelector(`[data-message-id="${message.id}"]`)?.remove();
          showNotice("تم حذف الرسالة من عرضك.");
        }
      }]
    ];

    if (message.sender_id === state.user.id) {
      actions.push(["حذف الرسالة", async () => {
        const { error } = await state.db.from("messages")
          .update({ deleted_at: now() })
          .eq("id", message.id)
          .eq("sender_id", state.user.id);

        if (error) {
          showNotice("تعذر حذف الرسالة.", "error");
        } else {
          document.querySelector(`[data-message-id="${message.id}"]`)?.remove();
        }
      }]);
    }

    actions.forEach(([label, callback]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-item message-action-item";
      button.textContent = label;

      button.addEventListener("click", async () => {
        closePanel("messageActionsPanel");
        await callback();
      });

      box.appendChild(button);
    });

    openPanel("messageActionsPanel");
  }

  function applyWallpaper(value) {
    state.wallpaperUrl = value;

    if (value) {
      ui.messages.style.backgroundImage =
        `linear-gradient(rgba(12,18,32,.30),rgba(12,18,32,.30)),url("${value}")`;
      ui.messages.style.backgroundSize = "cover";
      ui.messages.style.backgroundPosition = "center";
    } else {
      ui.messages.style.backgroundImage = "";
      ui.messages.style.backgroundSize = "";
      ui.messages.style.backgroundPosition = "";
    }
  }

  function setupWallpaperOptions() {
    const panel = ensurePanel("wallpaperPanel", "خلفية المحادثة");
    const box = panel.querySelector(".bottom-panel");

    box.querySelectorAll(".message-action-item").forEach(item => item.remove());

    const options = [
      ["اللون الأصلي", "#0c1220"],
      ["بنفسجي", "#211a3d"],
      ["تركواز", "#102d32"],
      ["ليلي", "#080d18"],
      ["وردي داكن", "#351d30"]
    ];

    options.forEach(([label, color]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-item message-action-item";
      button.textContent = label;
      button.style.background = color;

      button.addEventListener("click", () => {
        applyWallpaper("");
        ui.messages.style.backgroundColor = color;

        localStorage.setItem(
          `hanoon_wallpaper_${state.conversation.id}`,
          color
        );

        closePanel("wallpaperPanel");
        showNotice("تم تغيير خلفية المحادثة على هذا الجهاز.");
      });

      box.appendChild(button);
    });

    const upload = document.createElement("button");
    upload.type = "button";
    upload.className = "menu-item message-action-item";
    upload.textContent = "اختيار صورة من الهاتف";

    upload.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;

        if (state.wallpaperUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(state.wallpaperUrl);
        }

        const url = URL.createObjectURL(file);
        applyWallpaper(url);
        closePanel("wallpaperPanel");
        showNotice("تم تطبيق الصورة كخلفية على هذا الجهاز.");
      });

      input.click();
    });

    box.appendChild(upload);
    openPanel("wallpaperPanel");
  }

  async function savePrivacySettings() {
    const { error } = await state.db
      .from("chat_presence")
      .upsert({
        user_id: state.user.id,
        is_online: true,
        last_seen_visibility: state.settings.last_seen_visibility,
        online_visibility: state.settings.online_visibility,
        read_receipts: state.settings.read_receipts,
        updated_at: now()
      }, { onConflict: "user_id" });

    if (error) throw error;
  }

  async function setupPrivacyOptions() {
    const panel = ensurePanel("privacyPanel", "الخصوصية والظهور");
    const box = panel.querySelector(".bottom-panel");

    box.querySelectorAll(".privacy-option").forEach(item => item.remove());

    const fields = [
      { key: "online_visibility", title: "من يمكنه رؤية اتصالك؟" },
      { key: "last_seen_visibility", title: "من يمكنه رؤية آخر ظهور؟" }
    ];

    const choices = [
      ["everyone", "الجميع"],
      ["contacts", "الأصدقاء"],
      ["nobody", "لا أحد"]
    ];

    fields.forEach(field => {
      const heading = document.createElement("div");
      heading.className = "privacy-option";
      heading.style.padding = "12px 4px 5px";
      heading.textContent = field.title;
      box.appendChild(heading);

      choices.forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "menu-item privacy-option";
        button.textContent =
          `${label}${state.settings[field.key] === value ? " ✓" : ""}`;

        button.addEventListener("click", async () => {
          const previous = state.settings[field.key];
          state.settings[field.key] = value;

          try {
            await savePrivacySettings();
            showNotice("تم حفظ إعداد الخصوصية.");
            setupPrivacyOptions();
          } catch {
            state.settings[field.key] = previous;
            showNotice("تعذر حفظ إعداد الخصوصية.", "error");
          }
        });

        box.appendChild(button);
      });
    });

    const receipt = document.createElement("button");
    receipt.type = "button";
    receipt.className = "menu-item privacy-option";
    receipt.textContent = state.settings.read_receipts
      ? "✓ مؤشرات القراءة مفعلة"
      : "مؤشرات القراءة متوقفة";

    receipt.addEventListener("click", async () => {
      const previous = state.settings.read_receipts;
      state.settings.read_receipts = !previous;

      try {
        await savePrivacySettings();
        showNotice("تم تحديث مؤشرات القراءة.");
        setupPrivacyOptions();
      } catch {
        state.settings.read_receipts = previous;
        showNotice("تعذر حفظ الإعداد.", "error");
      }
    });

    box.appendChild(receipt);
    openPanel("privacyPanel");
  }

  function bindEvents() {
    ui.form.addEventListener("submit", sendMessage);

    ui.back.addEventListener("click", () => {
      window.location.href = "messages.html";
    });

    ui.more.addEventListener("click", () => openPanel("chatActionsPanel"));
    ui.attach.addEventListener("click", () => openPanel("attachPanel"));
    ui.sticker.addEventListener("click", () => openPanel("stickerPanel"));

    $("chooseImageBtn")?.addEventListener("click", () => {
      closePanel("attachPanel");
      ui.imageInput.click();
    });

    $("chooseFileBtn")?.addEventListener("click", () => {
      closePanel("attachPanel");
      ui.fileInput.click();
    });

    $("chooseCameraBtn")?.addEventListener("click", () => {
      closePanel("attachPanel");

      const input = ui.imageInput;
      input.setAttribute("capture", "environment");
      input.click();

      input.addEventListener("change", () => {
        input.removeAttribute("capture");
      }, { once: true });
    });

    ui.imageInput.addEventListener("change", async () => {
      const file = ui.imageInput.files?.[0];
      if (file) await uploadAndSend(file, "image");
      ui.imageInput.value = "";
    });

    ui.fileInput.addEventListener("change", async () => {
      const file = ui.fileInput.files?.[0];

      if (file) {
        const type = file.type.startsWith("video/") ? "video" : "file";
        await uploadAndSend(file, type);
      }

      ui.fileInput.value = "";
    });

    $("stickerGrid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-sticker]");
      if (button) sendSticker(button.dataset.sticker);
    });

    document.querySelectorAll("[data-close-panel]").forEach(button => {
      button.addEventListener("click", () => {
        closePanel(button.dataset.closePanel);
      });
    });

    document.querySelectorAll(".panel-overlay").forEach(panel => {
      panel.addEventListener("click", event => {
        if (event.target === panel) closePanel(panel.id);
      });
    });

    ui.record.addEventListener("click", () => {
      if (state.recorder?.state === "recording") {
        stopVoiceRecording(false);
      } else {
        startVoiceRecording();
      }
    });

    ui.cancelRecording.addEventListener("click", () => {
      stopVoiceRecording(true);
    });

    $("chatWallpaperBtn")?.addEventListener("click", () => {
      closePanel("chatActionsPanel");
      setupWallpaperOptions();
    });

    $("chatPrivacyBtn")?.addEventListener("click", () => {
      closePanel("chatActionsPanel");
      setupPrivacyOptions();
    });

    $("chatSearchBtn")?.addEventListener("click", () => {
      const term = prompt("اكتب كلمة للبحث داخل المحادثة:");
      if (!term?.trim()) return;

      const matches = [...ui.messages.querySelectorAll(".message")]
        .filter(item =>
          item.textContent.toLowerCase().includes(term.trim().toLowerCase())
        );

      ui.messages.querySelectorAll(".message").forEach(item => {
        item.style.outline = "";
      });

      matches.forEach(item => {
        item.style.outline = "2px solid #00a884";
      });

      if (matches[0]) {
        matches[0].scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

      showNotice(`تم العثور على ${matches.length} نتيجة.`);
    });

    $("chatMediaBtn")?.addEventListener("click", () => {
      closePanel("chatActionsPanel");

      const media = [...ui.messages.querySelectorAll("img,video,audio")];

      if (!media.length) {
        showNotice("لا توجد وسائط في هذه المحادثة.");
        return;
      }

      media[0].scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });

    $("chatClearBtn")?.addEventListener("click", async () => {
      closePanel("chatActionsPanel");

      if (!confirm("هل تريد مسح الرسائل التي أرسلتها من عرضك؟")) return;

      const { error } = await state.db
        .from("messages")
        .update({ deleted_at: now() })
        .eq("conversation_id", state.conversation.id)
        .eq("sender_id", state.user.id);

      if (error) {
        showNotice("تعذر مسح الرسائل.", "error");
        return;
      }

      ui.messages.replaceChildren();
      state.messageIds.clear();
      showEmpty("تم إخفاء رسائلك من هذه المحادثة.");
      showNotice("تم تنفيذ طلب المسح للرسائل التي أرسلتها.");
    });

    $("chatBlockBtn")?.addEventListener("click", () => {
      closePanel("chatActionsPanel");
      showNotice("ميزة الحظر لم يتم ربطها بقاعدة البيانات بعد.", "error");
    });

    ui.input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ui.form.requestSubmit();
      }
    });

    bindTyping();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.conversation) {
        updateReadStatus();
        setMyPresence(true);
      } else if (document.visibilityState === "hidden") {
        setMyPresence(false);
      }
    });

    window.addEventListener("pagehide", () => {
      if (state.channel) state.db.removeChannel(state.channel);
      setMyPresence(false);
      stopRecordingUI();
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
      const idFromConversation = getFriendIdFromKey(conversation.direct_key);

      if (friendId && idFromConversation && friendId !== idFromConversation) {
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

    const savedWallpaper = localStorage.getItem(
      `hanoon_wallpaper_${state.conversation.id}`
    );

    if (savedWallpaper) {
      ui.messages.style.backgroundColor = savedWallpaper;
    }

    await loadSettings();
    await setMyPresence(true);
    await loadMessages();

    subscribeToMessages();
    await loadFriendPresence();

    state.presenceTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        setMyPresence(true);
      }
    }, 60000);

    setComposerEnabled(true);
    hideLoading();
    ui.input.focus();
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
      showNotice(error.message || "تعذر فتح المحادثة.", "error");
      setComposerEnabled(false);
    }
  }

  function start() {
    if (window.HANOON?.supabase) {
      initialize();
      return;
    }

    window.addEventListener("hanoon:supabase-ready", initialize, { once: true });

    window.addEventListener("hanoon:supabase-error", event => {
      hideLoading();
      showNotice(
        event.detail?.message || "تعذر الاتصال بقاعدة البيانات.",
        "error"
      );
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
