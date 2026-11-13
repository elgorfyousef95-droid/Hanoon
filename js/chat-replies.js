
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    conversationId: null,
    reply: null,
    selectedMessage: null,
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
    notice.timer = setTimeout(() => box.classList.remove("show"), 3500);
  }

  function getMessageText(message) {
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
    if (input) input.placeholder = "اكتب رسالة...";
  }

  function selectReply(message, element) {
    if (!message?.id || !element) return;

    state.reply = {
      id: message.id,
      text: getMessageText(message),
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
      .select("id,sender_id,body,message_type,attachment_path,created_at,deleted_at")
      .eq("id", id)
      .eq("conversation_id", state.conversationId)
      .maybeSingle();

    if (error || !data || data.deleted_at) return null;
    return data;
  }

  async function addReplyQuote(element, replyId) {
    if (!element || element.querySelector(".reply-quote")) return;

    const original = await loadMessage(replyId);
    if (!original || !element.isConnected) return;

    const quote = document.createElement("div");
    quote.className = "reply-quote";
    quote.tabIndex = 0;
    quote.setAttribute("role", "button");
    quote.setAttribute("aria-label", "الانتقال إلى الرسالة الأصلية");

    const author = document.createElement("strong");
    author.textContent = original.sender_id === state.user.id
      ? "أنت"
      : "الطرف الآخر";

    const content = document.createElement("span");
    content.textContent = getMessageText(original);

    quote.append(author, content);

    const goToOriginal = () => {
      const target = [...document.querySelectorAll(".message")]
        .find(item => item.dataset.messageId === replyId);

      if (!target) {
        notice("الرسالة الأصلية غير موجودة ضمن الرسائل المعروضة.");
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("reply-target-highlight");

      setTimeout(
        () => target.classList.remove("reply-target-highlight"),
        1600
      );
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
    if (!list) return;

    list.querySelectorAll(".message").forEach(decorateMessage);

    state.observer?.disconnect();

    state.observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;

          if (node.matches?.(".message")) decorateMessage(node);
          node.querySelectorAll?.(".message").forEach(decorateMessage);
        });
      });
    });

    state.observer.observe(list, {
      childList: true,
      subtree: true
    });
  }

  function installStyles() {
    if ($("chatRepliesStyles")) return;

    const style = document.createElement("style");
    style.id = "chatRepliesStyles";

    style.textContent = `
      .reply-quote {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 7px 10px;
        margin-bottom: 3px;
        border-right: 3px solid #20c997;
        border-radius: 7px;
        background: rgba(0,0,0,.19);
        cursor: pointer;
        min-width: 0;
      }

      .reply-quote strong {
        color: #65dfc2;
        font-size: 10px;
      }

      .reply-quote span {
        color: #e2eaed;
        font-size: 11px;
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
    `;

    document.head.appendChild(style);
  }

  function bindEvents() {
    const list = $("messageList");
    const form = $("messageForm");
    const input = $("messageInput");

    if (!list || !form || !input) return;

    getPreview();

    document.addEventListener("click", event => {
      if (event.target.closest("#cancelReplyBtn")) {
        cancelReply();
        return;
      }

      const action = event.target.closest(
        "#messageActionsPanel .message-action-item"
      );

      if (!action) return;

      const label = action.textContent.trim();

      if (label !== "الرد على الرسالة") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const selected = state.selectedMessage;
      if (!selected) {
        notice("حدد الرسالة التي تريد الرد عليها.", true);
        return;
      }

      const panel = $("messageActionsPanel");
      panel?.classList.add("hidden");

      selectReply(selected.message, selected.element);
      state.selectedMessage = null;
    }, true);

    function rememberSelectedMessage(event) {
      const element = event.target.closest(".message");
      if (!element) return;

      const id = element.dataset.messageId;
      if (!id) return;

      state.selectedMessage = { id, element };
    }

    // نترك قائمة خيارات الرسالة الأصلية تعمل دون اعتراض.
    list.addEventListener("contextmenu", rememberSelectedMessage, true);
    list.addEventListener("dblclick", rememberSelectedMessage, true);

    form.addEventListener("submit", async event => {
      if (!state.reply) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const body = input.value.trim();
      if (!body || state.busy) return;

      state.busy = true;

      const sendButton = $("sendMessageBtn");
      if (sendButton) sendButton.disabled = true;

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
          .select("id")
          .single();

        if (error) throw error;
        if (!data?.id) throw new Error("لم يتم تأكيد حفظ الرد.");

        input.value = "";
        cancelReply();
        notice("تم إرسال ردك بنجاح.");

      } catch (error) {
        console.error("HANOON reply:", error);
        notice(error.message || "تعذر إرسال الرد.", true);
      } finally {
        state.busy = false;
        if (sendButton) sendButton.disabled = false;
        input.focus();
      }
    }, true);

    installStyles();
    watchMessages();
  }

  async function initialize() {
    if (state.db) return;

    const db = window.HANOON?.supabase;
    if (!db) return;

    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) return;

    const conversationId = new URLSearchParams(location.search).get("id");
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
      window.addEventListener("hanoon:supabase-ready", initialize);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
