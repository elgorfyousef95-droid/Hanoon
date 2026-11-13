
(() => {
  "use strict";

  const EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

  const state = {
    db: null,
    user: null,
    conversationId: null,
    observer: null,
    channel: null,
    busy: new Set()
  };

  const $ = id => document.getElementById(id);

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
    notice.timer = setTimeout(
      () => box.classList.remove("show"),
      3000
    );
  }

  function installStyles() {
    if ($("chatReactionsStyles")) return;

    const style = document.createElement("style");
    style.id = "chatReactionsStyles";

    style.textContent = `
      .reaction-tools {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
        position: relative;
      }

      .reaction-add {
        width: 27px;
        height: 25px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 20px;
        background: rgba(255,255,255,.07);
        color: #dce7eb;
        cursor: pointer;
        font-size: 14px;
      }

      .reaction-chip {
        min-width: 31px;
        height: 26px;
        padding: 2px 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 20px;
        background: rgba(255,255,255,.08);
        color: white;
        cursor: pointer;
        font-size: 13px;
      }

      .reaction-chip.mine {
        border-color: #20c997;
        background: rgba(32,201,151,.17);
      }

      .reaction-chip small {
        font-size: 10px;
        color: #dce7eb;
      }

      .reaction-picker {
        position: absolute;
        z-index: 50;
        bottom: calc(100% + 7px);
        right: 0;
        display: flex;
        gap: 5px;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 24px;
        background: #202c35;
        box-shadow: 0 8px 25px rgba(0,0,0,.35);
      }

      .reaction-picker button {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        font-size: 21px;
        cursor: pointer;
      }

      .reaction-picker button:active {
        background: rgba(255,255,255,.13);
        transform: scale(.92);
      }

      .reaction-picker[hidden] {
        display: none !important;
      }

      .reaction-chip:disabled,
      .reaction-add:disabled {
        opacity: .5;
        cursor: wait;
      }
    `;

    document.head.appendChild(style);
  }

  function closePickers(except = null) {
    document.querySelectorAll(".reaction-picker").forEach(picker => {
      if (picker !== except) picker.hidden = true;
    });
  }

  async function loadReactions(messageId) {
    const { data, error } = await state.db
      .from("message_reactions")
      .select("id,message_id,user_id,reaction")
      .eq("message_id", messageId);

    if (error) throw error;
    return data || [];
  }

  function renderReactions(element, reactions) {
    let tools = element.querySelector(".reaction-tools");

    if (!tools) {
      tools = document.createElement("div");
      tools.className = "reaction-tools";

      const add = document.createElement("button");
      add.type = "button";
      add.className = "reaction-add";
      add.textContent = "＋";
      add.title = "إضافة تفاعل";
      add.setAttribute("aria-label", "إضافة تفاعل");

      const picker = document.createElement("div");
      picker.className = "reaction-picker";
      picker.hidden = true;

      EMOJIS.forEach(emoji => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = emoji;
        button.setAttribute("aria-label", `تفاعل ${emoji}`);

        button.addEventListener("click", () => {
          closePickers();
          toggleReaction(element, emoji);
        });

        picker.appendChild(button);
      });

      add.addEventListener("click", event => {
        event.stopPropagation();

        const shouldOpen = picker.hidden;
        closePickers();
        picker.hidden = !shouldOpen;
      });

      tools.append(add, picker);
      element.appendChild(tools);
    }

    tools.querySelectorAll(".reaction-chip").forEach(chip => {
      chip.remove();
    });

    const grouped = new Map();

    reactions.forEach(item => {
      if (!grouped.has(item.reaction)) {
        grouped.set(item.reaction, {
          count: 0,
          mine: false
        });
      }

      const group = grouped.get(item.reaction);
      group.count++;

      if (item.user_id === state.user.id) {
        group.mine = true;
      }
    });

    for (const [emoji, info] of grouped) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "reaction-chip";
      if (info.mine) chip.classList.add("mine");

      chip.textContent = emoji;

      const count = document.createElement("small");
      count.textContent = info.count;

      chip.appendChild(count);
      chip.title = info.mine
        ? "اضغط لإزالة تفاعلك"
        : "اضغط لإضافة تفاعلك";

      chip.addEventListener("click", () => {
        toggleReaction(element, emoji);
      });

      tools.insertBefore(chip, tools.querySelector(".reaction-picker"));
    }
  }

  async function refreshMessage(element) {
    const id = element?.dataset.messageId;
    if (!id || !state.db || !element.isConnected) return;

    try {
      const reactions = await loadReactions(id);

      if (element.isConnected) {
        renderReactions(element, reactions);
      }
    } catch (error) {
      console.warn("HANOON reactions:", error);
    }
  }

  async function toggleReaction(element, emoji) {
    const messageId = element?.dataset.messageId;
    if (!messageId || state.busy.has(messageId)) return;

    state.busy.add(messageId);

    const buttons = element.querySelectorAll(
      ".reaction-add,.reaction-chip"
    );

    buttons.forEach(button => button.disabled = true);

    try {
      const { data: existing, error: readError } = await state.db
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", state.user.id)
        .eq("reaction", emoji)
        .maybeSingle();

      if (readError) throw readError;

      if (existing) {
        const { error } = await state.db
          .from("message_reactions")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", state.user.id);

        if (error) throw error;

      } else {
        const { error } = await state.db
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: state.user.id,
            reaction: emoji
          });

        if (error) throw error;
      }

      await refreshMessage(element);

    } catch (error) {
      console.error("Toggle reaction:", error);
      notice(
        error.message || "تعذر حفظ التفاعل.",
        true
      );

    } finally {
      state.busy.delete(messageId);

      element.querySelectorAll(
        ".reaction-add,.reaction-chip"
      ).forEach(button => {
        button.disabled = false;
      });
    }
  }

  function decorateMessage(element) {
    if (!element || element.dataset.reactionsReady === "1") return;

    const id = element.dataset.messageId;
    if (!id) return;

    element.dataset.reactionsReady = "1";
    refreshMessage(element);
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

          if (node.matches?.(".message")) {
            decorateMessage(node);
          }

          node.querySelectorAll?.(".message")
            .forEach(decorateMessage);
        });
      });
    });

    state.observer.observe(list, {
      childList: true,
      subtree: true
    });
  }

  function subscribeToReactions() {
    if (state.channel) {
      state.db.removeChannel(state.channel);
    }

    state.channel = state.db
      .channel(`hanoon-reactions-${state.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions"
        },
        payload => {
          const row = payload.new?.message_id
            ? payload.new
            : payload.old;

          const messageId = row?.message_id;
          if (!messageId) return;

          const element = document.querySelector(
            `.message[data-message-id="${messageId}"]`
          );

          if (element) refreshMessage(element);
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Reaction realtime connection error.");
        }
      });
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

    installStyles();
    watchMessages();
    subscribeToReactions();

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

    document.addEventListener("click", event => {
      if (!event.target.closest(".reaction-tools")) {
        closePickers();
      }
    });
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
