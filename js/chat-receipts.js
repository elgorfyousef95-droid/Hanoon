
(() => {
  "use strict";

  const state = {
    db: null,
    user: null,
    conversationId: null,
    timer: null,
    observer: null,
    running: false
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
        min-width: 18px;
        margin-inline-start: 5px;
        font-size: 13px !important;
        line-height: 1;
        font-weight: 800;
        color: #aeb8c5;
        letter-spacing: -4px;
        direction: ltr;
        user-select: none;
        transition: color .2s ease;
      }

      .message-status.is-sent {
        color: #aeb8c5;
        letter-spacing: 0;
      }

      .message-status.is-delivered {
        color: #aeb8c5;
        letter-spacing: -4px;
      }

      .message-status.is-read {
        color: #45b7ff;
        letter-spacing: -4px;
        text-shadow: 0 0 8px rgba(69,183,255,.2);
      }

      .message-status::after {
        content: "";
        display: block;
      }

      .message {
        position: relative;
      }
    `;

    document.head.appendChild(style);
  }

  function getStatusElement(article) {
    let status = article.querySelector(".message-status");

    if (!status) {
      status = document.createElement("span");
      status.className = "message-status is-sent";
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
      "is-read"
    );

    if (value === "read") {
      status.textContent = "✓✓";
      status.classList.add("is-read");
      status.title = "تمت قراءة الرسالة";
    } else if (value === "delivered") {
      status.textContent = "✓✓";
      status.classList.add("is-delivered");
      status.title = "تم تسليم الرسالة";
    } else {
      status.textContent = "✓";
      status.classList.add("is-sent");
      status.title = "تم إرسال الرسالة";
    }
  }

  async function markIncomingDelivered() {
    if (!state.db || !state.conversationId || !state.user) return;

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
    if (!state.db || !state.conversationId || !state.user) return;

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

      document
        .querySelectorAll("#messageList .message.mine[data-message-id]")
        .forEach(article => {
          const status = receipts.get(article.dataset.messageId) || "sent";
          paintStatus(article, status);
        });
    } catch (error) {
      console.warn("HANOON receipt refresh:", error);
    }
  }

  function observeMessages() {
    const list = $("messageList");
    if (!list || state.observer) return;

    state.observer = new MutationObserver(records => {
      let hasIncoming = false;

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (node.matches?.(".message.theirs")) {
            hasIncoming = true;
          }

          if (node.querySelector?.(".message.theirs")) {
            hasIncoming = true;
          }

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
        }
      }

      if (hasIncoming && document.visibilityState === "visible") {
        markIncomingDelivered().then(refreshReceipts);
      }
    });

    state.observer.observe(list, {
      childList: true,
      subtree: true
    });
  }

  async function initialize() {
    if (state.running) return;

    const db = window.HANOON?.supabase;
    if (!db) return;

    const conversationId = new URLSearchParams(location.search).get("id");

    if (!conversationId) return;

    const { data, error } = await db.auth.getUser();

    if (error || !data?.user) return;

    state.db = db;
    state.user = data.user;
    state.conversationId = conversationId;
    state.running = true;

    addStyles();
    observeMessages();

    await markIncomingDelivered();
    await refreshReceipts();

    state.timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;

      await markIncomingDelivered();
      await refreshReceipts();
    }, 4000);

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        await markIncomingDelivered();
        await refreshReceipts();
      }
    });

    window.addEventListener("pagehide", () => {
      if (state.timer) clearInterval(state.timer);
      state.observer?.disconnect();
      state.running = false;
    });
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
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
