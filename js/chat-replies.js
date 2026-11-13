
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    conversationId: null,
    reply: null,
    selectedMessageId: null,
    observer: null,
    busy: false
  };

  function notice(message, error = false) {
    const box = $("globalNotice");
    if (!box) return;

    box.textContent = message;
    box.className = "chat-notice show";
    box.style.background = error
      ? "rgba(255,80,105,.15)"
      : "rgba(65,200,180,.12)";
    box.style.color = error ? "#ffb3c0" : "#b9f4e9";

    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => {
      box.classList.remove("show");
    }, 3500);
  }

  function messageDescription(message) {
    if (!message) return "رسالة";
    if (message.deleted_at) return "رسالة محذوفة";

    switch (message.message_type) {
      case "image": return "صورة";
      case "video": return "فيديو";
      case "audio": return "رسالة صوتية";
      case "file": return message.body || "ملف";
      case "sticker": return message.body || "ملصق";
      default: return message.body || "رسالة";
    }
  }

  function getPreview() {
    let preview = $("replyPreview");

    if (!preview) {
      preview = document.createElement("div");
      preview.id = "replyPreview";
      preview.className = "reply-preview hidden";

      const text = document.createElement("span");
      text.id = "replyPreviewText";

      const cancel = document.createElement("button");
      cancel.id = "cancelReplyBtn";
      cancel.type = "button";
      cancel.textContent = "×";
      cancel.setAttribute("aria-label", "إلغاء الرد");

      preview.append(text, cancel);
      $("messageForm")?.before(preview);
    }

    return preview;
  }

  function cancelReply() {
    state.reply = null;

    getPreview().classList.add("hidden");

    const input = $("messageInput");
    if (input) {
      input.placeholder = "اكتب رسالة...";
      input.focus();
    }
  }

  function selectReply(message) {
    if (!message?.id) return;

    state.reply = {
      id: message.id,
      text: messageDescription(message),
      sender: message.sender_id === state.user.id
        ? "أنت"
        : "الطرف الآخر"
    };

    const preview = getPreview();
    const text = $("replyPreviewText");

    if (text) {
      text.textContent =
        `الرد على ${state.reply.sender}: ${state.reply.text}`;
    }

    preview.classList.remove("hidden");

    const input = $("messageInput");
    if (input) {
      input.placeholder = "اكتب ردك...";
      input.focus();
    }
  }

  async function loadMessage(id) {
    if (!id) return null;

    const { data, error } = await state.db
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,created_at,deleted_at")
      .eq("id", id)
      .eq("conversation_id", state.conversationId)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.deleted_at) return null;

    return data;
  }

  async function addReplyQuote(element, replyId) {
    if (!element || element.querySelector(".reply-quote")) return;

    try {
      const original = await loadMessage(replyId);
      if (!original || !element.isConnected) return;

      const quote = document.createElement("div");
      quote.className = "reply-quote";
      quote.tabIndex = 0;
      quote.setAttribute("role", "button");
      quote.setAttribute(
        "aria-label",
        "الانتقال إلى الرسالة الأصلية"
      );

      const author = document.createElement("strong");
      author.textContent = original.sender_id === state.user.id
        ? "أنت"
        : "الطرف الآخر";

      const content = document.createElement("span");
      content.textContent = messageDescription(original);

      quote.append(author, content);

      const goToOriginal = () => {
        const target = [...document.querySelectorAll(".message")]
          .find(item => item.dataset.messageId === replyId);

        if (!target) {
          notice("الرسالة الأصلية ليست ضمن الرسائل المحمّلة حاليًا.");
          return;
        }

        target.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        target.classList.add("reply-target-highlight");

        setTimeout(() => {
          target.classList.remove("reply-target-highlight");
        }, 1600);
      };

      quote.addEventListener("click", goToOriginal);

      quote.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToOriginal();
        }
      });

      const body = element.querySelector(".message-body");
      if (body) body.before(quote);

    } catch (error) {
      console.warn("Reply quote:", error);
    }
  }

  async function decorateMessage(element) {
    if (!element || element.dataset.replyChecked === "1") return;

    const id = element.dataset.messageId;
    if (!id) return;

    element.dataset.replyChecked = "1";

    const { data, error } = await state.db
      .from("messages")
      .select("reply_to")
      .eq("id", id)
      .maybeSingle();

    if (!error && data?.reply_to) {
      await addReplyQuote(element, data.reply_to);
    }
  }

  function watchMessages() {
    const list = $("messageList");
    if (!list || !state.db) return;

    list.querySelectorAll(".message").forEach(decorateMessage);

    state.observer?.disconnect();

    state.observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;

          if (node.matches?.(".message")) {
            decorateMessage(node);
          }

          node.querySelectorAll?.(".message")
            .forEach(decorateMessage);
        }
      }
    });

    state.observer.observe(list, {
      childList: true,
      subtree: true
    });
  }

  function appendSentReply(message) {
    const list = $("messageList");
    if (!list || !message?.id) return;

    if (list.querySelector(
      `[data-message-id="${message.id}"]`
    )) return;

    list.querySelector(".empty-chat")?.remove();

    const article = document.createElement("article");
    article.className = "message mine";
    article.dataset.messageId = message.id;

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = message.body || "";

    const time = document.createElement("div");
    time.className = "message-time";

    time.textContent = new Date(
      message.created_at
    ).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const status = document.createElement("div");
    status.className = "message-status";
    status.textContent = "✓";

    article.append(body, time, status);
    list.appendChild(article);

    if (message.reply_to) {
      addReplyQuote(article, message.reply_to);
    }

    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }

  function installStyles() {
    if ($("chatRepliesStyles")) return;

    const style = document.createElement("style");
    style.id = "chatRepliesStyles";

    style.textContent = `
      .reply-quote {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 8px 10px;
        margin-bottom: 5px;
        border-right: 3px solid #20c997;
        border-radius: 7px;
        background: rgba(0,0,0,.19);
        cursor: pointer;
        min-width: 0;
      }

      .reply-quote strong {
        color: #65dfc2;
        font-size: 11px;
      }

      .reply-quote span {
        color: #e2eaed;
        font-size: 12px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .message.reply-target-highlight {
        outline: 2px solid #20c997;
        outline-offset: 3px;
      }

      #replyPreview {
        flex-shrink: 0;
      }

      #replyPreview.hidden {
        display: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function rememberSelectedMessage(event) {
    const element = event.target.closest(".message");
    if (!element) return;

    const id = element.dataset.messageId;
    if (!id) return;

    state.selectedMessageId = id;
  }

  async function handleReplyAction(event) {
    const action = event.target.closest(
      "#messageActionsPanel .message-action-item"
    );

    if (!action) return;
    if (action.textContent.trim() !== "الرد على الرسالة") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const id = state.selectedMessageId;

    $("messageActionsPanel")?.classList.add("hidden");

    if (!id) {
      notice("حدد الرسالة التي تريد الرد عليها.", true);
      return;
    }

    try {
      const message = await loadMessage(id);

      if (!message) {
        notice("لم نتمكن من العثور على الرسالة الأصلية.", true);
        return;
      }

      selectReply(message);

    } catch (error) {
      console.error("Load reply target:", error);
      notice("تعذر تحميل الرسالة الأصلية.", true);
    }
  }

  async function sendReply(event) {
    if (!state.reply) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const input = $("messageInput");
    const button = $("sendMessageBtn");
    const body = input?.value.trim();

    if (!body || state.busy) return;

    state.busy = true;
    if (button) button.disabled = true;

    try {
      const replyId = state.reply.id;

      const { data, error } = await state.db
        .from("messages")
        .insert({
          conversation_id: state.conversationId,
          sender_id: state.user.id,
          body,
          message_type: "text",
          reply_to: replyId
        })
        .select(
          "id,conversation_id,sender_id,body,message_type,created_at,reply_to"
        )
        .single();

      if (error) throw error;

      appendSentReply(data);

      input.value = "";
      cancelReply();

      notice("تم إرسال الرد.");

    } catch (error) {
      console.error("Send reply:", error);
      notice(
        error.message || "تعذر إرسال الرد. حاول مرة أخرى.",
        true
      );

    } finally {
      state.busy = false;
      if (button) button.disabled = false;
      input?.focus();
    }
  }

  function bindEvents() {
    const list = $("messageList");
    const form = $("messageForm");

    if (!list || !form) return;

    getPreview();
    installStyles();

    list.addEventListener(
      "contextmenu",
      rememberSelectedMessage,
      true
    );

    list.addEventListener(
      "dblclick",
      rememberSelectedMessage,
      true
    );

    document.addEventListener(
      "click",
      event => {
        if (event.target.closest("#cancelReplyBtn")) {
          cancelReply();
          return;
        }

        handleReplyAction(event);
      },
      true
    );

    form.addEventListener("submit", sendReply, true);

    watchMessages();
  }

  async function initialize() {
    if (state.db) return;

    const db = window.HANOON?.supabase;
    if (!db) return;

    const { data, error } = await db.auth.getUser();

    if (error || !data?.user) return;

    const conversationId =
      new URLSearchParams(location.search).get("id");

    if (!conversationId) return;

    state.db = db;
    state.user = data.user;
    state.conversationId = conversationId;

    bindEvents();

    setTimeout(watchMessages, 500);
    setTimeout(watchMessages, 1500);
  }

  function start() {
    if (window.HANOON?.supabase) {
      initialize();
    } else {
      window.addEventListener(
        "hanoon:supabase-ready",
        initialize,
        { once: true }
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
