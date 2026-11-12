
(() => {
  "use strict";

  const STORAGE_KEY = "hanoon_chat_preferences_v1";

  const defaults = {
    wallpaper: "dark",
    theme: "dark",
    fontSize: "medium",
    bubbleStyle: "rounded",
    messagePreview: true,
    reduceMotion: false
  };

  const wallpapers = {
    dark: "linear-gradient(145deg,#101820,#263943)",
    teal: "linear-gradient(145deg,#075e59,#123d56)",
    purple: "linear-gradient(145deg,#38245e,#171f45)",
    blue: "linear-gradient(145deg,#123c68,#17283e)",
    rose: "linear-gradient(145deg,#713d57,#38283e)",
    sand: "linear-gradient(145deg,#8a7050,#403b35)",
    green: "linear-gradient(145deg,#234d39,#102b2a)",
    night: "radial-gradient(#ffffff32 1px,transparent 1px),#101b2b",
    waves: "repeating-radial-gradient(ellipse at 20% 20%,transparent 0 9px,#ffffff19 10px 11px,transparent 12px 22px),#123a48"
  };

  function getSettings() {
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      };
    } catch {
      return {...defaults};
    }
  }

  function applySettings() {
    const settings = getSettings();

    const messageArea = document.getElementById("messageList");
    if (!messageArea) return;

    messageArea.style.background =
      wallpapers[settings.wallpaper] || wallpapers.dark;

    messageArea.style.fontSize = {
      small: "10px",
      medium: "11px",
      large: "14px"
    }[settings.fontSize] || "11px";

    const bubbleRadius = {
      rounded: "16px",
      soft: "10px",
      square: "5px"
    }[settings.bubbleStyle] || "16px";

    const isLight = settings.theme === "light" ||
      (settings.theme === "system" &&
       window.matchMedia &&
       window.matchMedia("(prefers-color-scheme: light)").matches);

    messageArea.style.color = isLight ? "#17252d" : "#f2f8fa";

    document.querySelectorAll("#messageList .message").forEach(message => {
      message.style.borderRadius = bubbleRadius;

      if (isLight) {
        message.style.color = "#17252d";
        message.style.background = message.classList.contains("mine")
          ? "linear-gradient(135deg,#b7eee5,#8bd9ce)"
          : "linear-gradient(135deg,#ffffff,#e8f0f2)";
        message.style.borderColor = "#173b3b22";
      } else {
        message.style.color = "#effbfc";
        message.style.background = message.classList.contains("mine")
          ? "linear-gradient(135deg,#146e68,#18596b)"
          : "linear-gradient(135deg,#103d42,#12404a)";
        message.style.borderColor = "#76dcd52b";
      }

      const body = message.querySelector(".message-body");
      if (body) body.style.fontSize = {
        small: "10px",
        medium: "11px",
        large: "14px"
      }[settings.fontSize] || "11px";

      const time = message.querySelector(".message-time");
      if (time) {
        time.style.color = isLight ? "#526a70" : "#a5cfca";
      }
    });

    const empty = messageArea.querySelector(".chat-empty");
    if (empty) {
      empty.style.color = isLight ? "#526a70" : "#9eb9c0";
    }

    document.documentElement.dataset.chatTheme =
      settings.theme;
  }

  function addSettingsButton() {
    const header = document.querySelector(".chat-header");
    if (!header || document.getElementById("chatSettingsLink")) return;

    const link = document.createElement("a");
    link.id = "chatSettingsLink";
    link.href = "chat-settings.html";
    link.title = "إعدادات الشات";
    link.setAttribute("aria-label", "إعدادات الشات");
    link.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.7v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1z"></path>
      </svg>
    `;

    link.style.cssText = `
      width:36px;height:36px;flex:0 0 36px;
      display:grid;place-items:center;
      border:1px solid #76dcd533;
      border-radius:11px;
      background:#ffffff09;
      color:#9df2e6;
    `;

    link.querySelector("svg").style.cssText = `
      width:19px;height:19px;fill:none;
      stroke:currentColor;stroke-width:1.7;
      stroke-linecap:round;stroke-linejoin:round;
    `;

    header.appendChild(link);
  }

  function start() {
    addSettingsButton();
    applySettings();

    const messageArea = document.getElementById("messageList");

    if (messageArea) {
      const observer = new MutationObserver(() => {
        applySettings();
      });

      observer.observe(messageArea, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) applySettings();
    });

    window.addEventListener("pageshow", applySettings);

    window.matchMedia?.("(prefers-color-scheme: light)")
      .addEventListener?.("change", () => {
        if (getSettings().theme === "system") applySettings();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})();
