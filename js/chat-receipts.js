
(() => {
  "use strict";

  const state = {
    db: null,
    user: null,
    conversationId: null,
    timer: null,
    observer: null,
    running: false,
    refreshing: false,
    visibilityHandler: null,
    pageHideHandler: null
  };

  const $ = id => document.getElementById(id);

  function addStyles() {
    if ($("hanoonReceiptStyles")) return;

    const style = document.createElement("style");
    style.id = "hanoonReceiptStyles";

    style.textContent = `
      .message-status {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        min-width: 17px;
        margin-inline-start: 5px;
        font-size: 13px !important;
        line-height: 1;
        font-weight: 800;
        direction: ltr;
        letter-spacing: -3px;
        white-space: nowrap;
        user-select: none;
        transition: color .2s ease;
      }

      .message-status.is-sent {
        color: #aeb8c5 !important;
        letter-spacing: 0;
      }

      .message-status.is-delivered {
        color: #aeb8c5 !important;
      }

      .message-status.is-read {
        color: #45b7ff !important;
        text-shadow: 0 0 8px rgba(69,183,255,.25);
      }

      .message-status.is-error {
        color: #ff667d !important;
        letter-spacing: 0;
      }

      .message-status svg {
        width: 17px;
        height: 13px;
        overflow: visible;
      }
    `;

    document.head.appendChild(style);
  }

  function getStatusElement(article) {
    let status = article.querySelector(".message-status");

    if (!status) {
      status = document.createElement("span");
      status.className = "message-status";
      article.appendChild(status);
    }

    return status;
  }

  function paintStatus(article, value) {
    if (!article || !article.classList.contains("mine")) return;

    const status = getStatusElement(article);

    status.classList.remove(
      "is-sent",
      "is-delivered",
      "is-read",
      "is-error"
    );

    if (value === "read") {
      status.textContent = "✓✓";
      status.classList.add("is-read");
      status.title = "تمت قراءة الرسالة";
      status.setAttribute("aria-label", "تمت قراءة الرسالة");
    } else if (value === "delivered") {
      status.textContent = "✓✓";
      status.classList.add("is-delivered");
      status.title = "تم تسليم الرسالة";
      status.setAttribute("aria-label", "تم تسليم الرسالة");
    } else if (value === "error") {
      status.textContent = "!";
      status.classList.add("is-error");
      status.title = "تعذر تحديث حالة الرسالة";
      status.setAttribute("aria-label", "تعذر تحديث الحالة");
    } else {
      status.textContent = "✓";
      status.classList.add("is-sent");
      status.title = "تم إرسال الرسالة";
      status.setAttribute("aria-label", "تم إرسال الرسالة");
    }
  }

  function getMessageArticles() {
    return document.querySelectorAll(
      "#messageList .message.mine[data-message-id]"
    );
  }

  async function markIncomingDelivered() {
    if (
      !state.db ||
      !state.conversationId ||
      !state.user ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    try {
      const { error } = await state.db.rpc(
        "mark_conversation_messages_delivered",
        {
          p_conversation_id: state.conversationId
        }
      );

      if (error) {
        console.warn("HANOON delivery receipt:", error);
      }
    } catch (error) {
      console.warn("HANOON delivery receipt:", error);
    }
  }

  async function refreshReceipts() {
    if (
      state.refreshing ||
      !state.db ||
      !state.conversationId ||
      !state.user
    ) {
      return;
    }

    state.refreshing = true;

    try {
      const { data, error } = await state.db.rpc(
        "get_my_message_receipts",
        {
          p_conversation_id: state.conversationId
        }
      );

      if (error) throw error;

      const receipts = new Map(
        (data || []).map(item => [
          item.message_id,
          item.receipt_status
        ])
      );

      getMessageArticles().forEach(article => {
        const id = article.dataset.messageId;
        const status = receipts.get(id) || "sent";

        paintStatus(article, status);
      });
    } catch (error) {
      console.warn("HANOON receipt refresh:", error);
    } finally {
      state.refreshing = false;
    }
  }

  async function updateReceipts() {
    await markIncomingDelivered();
    await refreshReceipts();
  }

  function observeMessages() {
    const list = $("messageList");

    if (!list || state.observer) return;

    state.observer = new MutationObserver(records => {
      let incomingAdded = false;

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const ownMessages = [];

          if (node.matches?.(".message.mine")) {
            ownMessages.push(node);
          }

          node.querySelectorAll?.(".message.mine").forEach(item => {
            ownMessages.push(item);
          });

          ownMessages.forEach(article => {
            paintStatus(article, "sent");
          });

          if (node.matches?.(".message.theirs")) {
            incomingAdded = true;
          }

          if (node.querySelector?.(".message.theirs")) {
            incomingAdded = true;
          }
        }
      }

      if (incomingAdded && document.visibilityState === "visible") {
        updateReceipts();
      }
    });

    state.observer.observe(list, {
      childList: true,
      subtree: true
    });
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    state.observer?.disconnect();
    state.observer = null;

    if (state.visibilityHandler) {
      document.removeEventListener(
        "visibilitychange",
        state.visibilityHandler
      );

      state.visibilityHandler = null;
    }

    if (state.pageHideHandler) {
      window.removeEventListener(
        "pagehide",
        state.pageHideHandler
      );

      state.pageHideHandler = null;
    }

    state.running = false;
    state.refreshing = false;
  }

  async function initialize() {
    if (state.running) return;

    const db = window.HANOON?.supabase;
    if (!db) return;

    const conversationId =
      new URLSearchParams(location.search).get("id");

    if (!conversationId) return;

    try {
      const { data, error } = await db.auth.getUser();

      if (error || !data?.user) return;

      state.db = db;
      state.user = data.user;
      state.conversationId = conversationId;
      state.running = true;

      addStyles();
      observeMessages();

      await updateReceipts();

      state.timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          updateReceipts();
        }
      }, 4000);

      state.visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          updateReceipts();
        }
      };

      document.addEventListener(
        "visibilitychange",
        state.visibilityHandler
      );

      state.pageHideHandler = stop;

      window.addEventListener(
        "pagehide",
        state.pageHideHandler
      );

    } catch (error) {
      console.error("HANOON receipts initialization:", error);
      stop();
    }
  }

  function start() {
    if (window.HANOON?.supabase) {
      initialize();
      return;
    }

    window.addEventListener(
      "hanoon:supabase-ready",
      initialize
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
