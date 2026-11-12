
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

  const fontSizes = {
    small: "10px",
    medium: "11px",
    large: "14px"
  };

  const bubbleRadii = {
    rounded: "16px",
    soft: "10px",
    square: "5px"
  };

  let observer = null;
  let currentArea = null;
  let applying = false;

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function getConversationId() {
    return new URLSearchParams(location.search).get("id");
  }

  function getConversationWallpaper() {
    const id = getConversationId();
    if (!id) return null;

    try {
      return localStorage.getItem(`hanoon_wallpaper_${id}`);
    } catch {
      return null;
    }
  }

  function isLightTheme(theme) {
    if (theme === "light") return true;

    return theme === "system" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches;
  }

  function applyMessageStyles(area, settings) {
    const light = isLightTheme(settings.theme);
    const fontSize = fontSizes[settings.fontSize] || fontSizes.medium;
    const radius = bubbleRadii[settings.bubbleStyle] || bubbleRadii.rounded;

    const privateWallpaper = getConversationWallpaper();

    if (privateWallpaper) {
      area.style.backgroundImage = "none";
      area.style.backgroundColor = privateWallpaper;
    } else {
      area.style.background = wallpapers[settings.wallpaper] || wallpapers.dark;
      area.style.backgroundSize = "cover";
      area.style.backgroundPosition = "center";
    }

    area.style.color = light ? "#17252d" : "#f2f8fa";
    area.style.fontSize = fontSize;
    area.style.transition = settings.reduceMotion ? "none" : "background .25s ease";

    area.querySelectorAll(".message").forEach(message => {
      const mine = message.classList.contains("mine");

      message.style.borderRadius = radius;
      message.style.color = light ? "#17252d" : "#effbfc";
      message.style.background = light
        ? mine
          ? "linear-gradient(135deg,#b7eee5,#8bd9ce)"
          : "linear-gradient(135deg,#ffffff,#e8f0f2)"
        : mine
          ? "linear-gradient(135deg,#146e68,#18596b)"
          : "linear-gradient(135deg,#103d42,#12404a)";

      message.style.border = light
        ? "1px solid #173b3b22"
        : "1px solid #76dcd52b";

      const body = message.querySelector(".message-body");
      if (body) {
        body.style.fontSize = fontSize;
        body.style.color = "inherit";
      }

      const time = message.querySelector(".message-time");
      if (time) {
        time.style.color = light ? "#526a70" : "#a5cfca";
      }

      const status = message.querySelector(".message-status");
      if (status) {
        status.style.color = light ? "#147e9a" : "#70d9ed";
      }
    });

    document.documentElement.dataset.chatTheme = settings.theme;
    document.documentElement.dataset.chatMotion = settings.reduceMotion
      ? "reduced"
      : "normal";

    if (settings.reduceMotion) {
      area.querySelectorAll("*").forEach(element => {
        element.style.animationDuration = "0.01ms";
        element.style.transitionDuration = "0.01ms";
      });
    }
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
      width:36px;
      height:36px;
      flex:0 0 36px;
      display:grid;
      place-items:center;
      border:1px solid #76dcd533;
      border-radius:11px;
      background:#ffffff09;
      color:#9df2e6;
    `;

    link.querySelector("svg").style.cssText = `
      width:19px;
      height:19px;
      fill:none;
      stroke:currentColor;
      stroke-width:1.7;
      stroke-linecap:round;
      stroke-linejoin:round;
    `;

    header.appendChild(link);
  }

  function applySettings() {
    if (applying) return;

    const area = document.getElementById("messageList");
    if (!area) return;

    applying = true;

    try {
      applyMessageStyles(area, getSettings());
    } finally {
      applying = false;
    }
  }

  function observeMessages() {
    const area = document.getElementById("messageList");
    if (!area || area === currentArea) return;

    observer?.disconnect();
    currentArea = area;

    observer = new MutationObserver(records => {
      if (records.some(record =>
        record.type === "childList" &&
        (record.addedNodes.length || record.removedNodes.length)
      )) {
        applySettings();
      }
    });

    observer.observe(area, {
      childList: true,
      subtree: true
    });

    applySettings();
  }

  function start() {
    addSettingsButton();
    observeMessages();
    applySettings();

    const pageObserver = new MutationObserver(() => {
      addSettingsButton();
      observeMessages();
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener("storage", event => {
      if (
        event.key === STORAGE_KEY ||
        event.key?.startsWith("hanoon_wallpaper_")
      ) {
        applySettings();
      }
    });

    window.addEventListener("pageshow", applySettings);

    window.matchMedia?.("(prefers-color-scheme: light)")
      .addEventListener?.("change", () => {
        if (getSettings().theme === "system") applySettings();
      });

    window.addEventListener("hanoon:chat-preferences-changed", applySettings);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
