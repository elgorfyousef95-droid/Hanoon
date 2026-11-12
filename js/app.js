
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  HANOON.version = "1.2.0";
  HANOON.initialized = false;

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  HANOON.elements = {
    body: document.body,
    splash: $("#splashScreen") || $("#splash"),
    menuToggle: $(".menu-toggle"),
    navigation: $(".main-navigation"),
    searchPanel: $("#searchPanel") || $(".search-panel"),
    toastContainer: $(".toast-container")
  };

  HANOON.toast = function (message, type = "info", duration = 3500) {
    let container = HANOON.elements.toastContainer;

    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
      HANOON.elements.toastContainer = container;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = String(message);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  HANOON.initSplash = function () {
    const splash =
      $("#splashScreen") ||
      $("#splash") ||
      $(".splash-screen");

    if (!splash) return;

    const startTime = Date.now();
    const minimumDuration = 5000;

    const hideSplash = () => {
      const remaining = Math.max(
        0,
        minimumDuration - (Date.now() - startTime)
      );

      window.setTimeout(() => {
        splash.classList.add("is-hidden", "splash-hidden");
        document.body.classList.remove("loading");

        window.setTimeout(() => splash.remove(), 800);
      }, remaining);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hideSplash, {
        once: true
      });
    } else {
      hideSplash();
    }
  };

  HANOON.initMobileMenu = function () {
    const button = HANOON.elements.menuToggle;
    const navigation = HANOON.elements.navigation;

    if (!button || !navigation) return;

    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
      button.classList.toggle("active", isOpen);
    });

    $$(".main-navigation a").forEach(link => {
      link.addEventListener("click", () => {
        navigation.classList.remove("is-open");
        button.classList.remove("active");
        button.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", event => {
      if (
        !navigation.contains(event.target) &&
        !button.contains(event.target)
      ) {
        navigation.classList.remove("is-open");
        button.classList.remove("active");
        button.setAttribute("aria-expanded", "false");
      }
    });
  };

  // البحث مع الاحتفاظ بالكلمة المكتوبة
  HANOON.initSearch = function () {
    const panel = HANOON.elements.searchPanel;
    const toggle = $("#searchToggle");

    if (!panel) return;

    const input = $("input[type='search']", panel);
    const form = $("#globalSearchForm");
    const results = $("#searchResults");

    const openSearch = () => {
      panel.hidden = false;
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");

      if (toggle) toggle.setAttribute("aria-expanded", "true");

      window.setTimeout(() => input?.focus(), 120);
    };

    const closeSearch = () => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");

      if (toggle) toggle.setAttribute("aria-expanded", "false");

      window.setTimeout(() => {
        if (!panel.classList.contains("is-open")) {
          panel.hidden = true;
        }
      }, 250);
    };

    toggle?.addEventListener("click", () => {
      if (panel.hidden || !panel.classList.contains("is-open")) {
        openSearch();
      } else {
        closeSearch();
      }
    });

    $$("[data-search-open]").forEach(button => {
      button.addEventListener("click", openSearch);
    });

    $$("[data-search-close]").forEach(button => {
      button.addEventListener("click", closeSearch);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSearch();
    });

    // استعادة آخر كلمة بحث عند الرجوع للصفحة
    try {
      const savedQuery = sessionStorage.getItem("hanoon-search-query");
      const urlQuery = new URLSearchParams(location.search).get("q");

      if (input && (urlQuery || savedQuery)) {
        input.value = urlQuery || savedQuery;
      }
    } catch (_) {}

    form?.addEventListener("submit", event => {
      event.preventDefault();

      const query = input?.value.trim() || "";

      if (!query) {
        HANOON.toast("اكتب كلمة للبحث أولاً", "warning");
        input?.focus();
        return;
      }

      try {
        sessionStorage.setItem("hanoon-search-query", query);
      } catch (_) {}

      // لا نمسح الكلمة ولا نغلق البحث قبل الانتقال
      if (results) {
        results.setAttribute("aria-busy", "true");
      }

      const url = new URL("pages/library.html", document.baseURI);
      url.searchParams.set("q", query);
      window.location.assign(url.href);
    });

    // منع الضغط داخل نافذة البحث من إغلاقها
    panel.addEventListener("click", event => {
      event.stopPropagation();
    });
  };

  HANOON.injectHeaderStyles = function () {
    if ($("#hanoon-header-runtime-styles")) return;

    const style = document.createElement("style");
    style.id = "hanoon-header-runtime-styles";

    style.textContent = `
      .site-header .header-profile-link {
        width: auto !important;
        min-width: 0 !important;
        max-width: 190px !important;
        height: auto !important;
        min-height: 54px !important;
        flex: 0 1 auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 9px !important;
        padding: 5px 11px 5px 7px !important;
        overflow: visible !important;
        border-radius: 30px !important;
        text-decoration: none !important;
        background: linear-gradient(
          145deg,
          rgba(213,179,108,.16),
          rgba(255,255,255,.055)
        ) !important;
        border: 1px solid rgba(213,179,108,.42) !important;
        box-shadow: 0 5px 18px rgba(0,0,0,.18) !important;
      }

      .site-header .header-profile-link #headerProfileInitial,
      .site-header .header-profile-link #headerProfileImage {
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        flex: 0 0 46px !important;
        border: 2px solid rgba(241,217,159,.85) !important;
        border-radius: 50% !important;
        object-fit: cover !important;
      }

      .site-header .header-profile-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 1px;
        line-height: 1.35;
      }

      .site-header .header-profile-link #headerProfileName {
        display: block !important;
        max-width: 112px !important;
        overflow: hidden !important;
        color: #f7e6bd !important;
        font-family: inherit;
        font-size: 12px !important;
        font-weight: 900 !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .site-header .header-profile-username {
        display: block;
        max-width: 112px;
        overflow: hidden;
        color: rgba(255,255,255,.65);
        font-family: inherit;
        font-size: 10px;
        font-weight: 700;
        direction: ltr;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .site-header .account-button[hidden],
      .site-header .header-profile-link[hidden] {
        display: none !important;
      }

      @media(max-width:600px) {
        .site-header .header-profile-link {
          max-width: 142px !important;
          min-height: 45px !important;
          gap: 6px !important;
          padding: 4px 8px 4px 5px !important;
        }

        .site-header .header-profile-link #headerProfileInitial,
        .site-header .header-profile-link #headerProfileImage {
          width: 39px !important;
          height: 39px !important;
          min-width: 39px !important;
          flex-basis: 39px !important;
        }

        .site-header .header-profile-link #headerProfileName {
          max-width: 82px !important;
          font-size: 10px !important;
        }

        .site-header .header-profile-username {
          max-width: 82px;
          font-size: 9px;
        }
      }

      @media(max-width:380px) {
        .site-header .header-profile-link {
          max-width: 118px !important;
          gap: 5px !important;
        }

        .site-header .header-profile-link #headerProfileInitial,
        .site-header .header-profile-link #headerProfileImage {
          width: 35px !important;
          height: 35px !important;
          min-width: 35px !important;
          flex-basis: 35px !important;
        }

        .site-header .header-profile-link #headerProfileName {
          max-width: 68px !important;
          font-size: 9px !important;
        }

        .site-header .header-profile-username {
          max-width: 68px;
          font-size: 8px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  // عرض الاسم واسم المستخدم بجانب الصورة
  HANOON.initHeaderAccount = function () {
    const profileLink = $("#headerProfileLink");
    const profileName = $("#headerProfileName");
    const accountButton = $("#accountButton");

    if (!profileLink || !profileName) return;

    const copy = document.createElement("span");
    copy.className = "header-profile-copy";

    const username = document.createElement("small");
    username.className = "header-profile-username";
    username.id = "headerProfileUsername";
    username.textContent = "@member";

    profileName.parentNode.insertBefore(copy, profileName);
    copy.append(profileName, username);

    const applyUsername = async () => {
      const supabase = window.HANOON?.supabase;
      if (!supabase) return;

      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user) return;

        let handle =
          user.user_metadata?.username ||
          user.user_metadata?.user_name ||
          "";

        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        handle = profile?.username || handle;

        if (!handle) {
          handle = user.email?.split("@")[0] || "member";
        }

        username.textContent = "@" + String(handle).replace(/^@/, "");
      } catch (error) {
        console.warn("HANOON username display:", error);
      }
    };

    const observer = new MutationObserver(() => {
      const loggedIn = accountButton?.hidden && !profileLink.hidden;

      if (loggedIn) {
        applyUsername();
      } else {
        username.textContent = "@member";
      }
    });

    observer.observe(profileLink, {
      attributes: true,
      attributeFilter: ["hidden"]
    });

    observer.observe(accountButton, {
      attributes: true,
      attributeFilter: ["hidden"]
    });

    if (accountButton?.hidden && !profileLink.hidden) {
      applyUsername();
    }

    window.addEventListener("hanoon:supabase-ready", applyUsername);
    window.addEventListener("pageshow", applyUsername);
  };

  HANOON.initTheme = function () {
    let savedTheme = null;

    try {
      savedTheme = localStorage.getItem("hanoon-theme");
    } catch (_) {}

    const preferredTheme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

    const theme = savedTheme || preferredTheme;

    document.documentElement.setAttribute("data-theme", theme);

    const toggleButtons = [
      ...$$("[data-theme-toggle]"),
      ...($("#themeToggle") ? [$("#themeToggle")] : [])
    ];

    toggleButtons.forEach(button => {
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"
      );

      button.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", next);

        try {
          localStorage.setItem("hanoon-theme", next);
        } catch (_) {}

        button.setAttribute(
          "aria-label",
          next === "dark" ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"
        );
      });
    });
  };

  HANOON.initActiveLinks = function () {
    const currentPath = window.location.pathname;

    $$("a[href]").forEach(link => {
      try {
        const linkUrl = new URL(link.href, window.location.origin);

        if (
          linkUrl.origin === window.location.origin &&
          linkUrl.pathname === currentPath
        ) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      } catch (_) {}
    });
  };

  HANOON.initFooter = function () {
    const year = String(new Date().getFullYear());

    $$("[data-current-year]").forEach(element => {
      element.textContent = year;
    });

    const currentYear = $("#currentYear");
    if (currentYear) currentYear.textContent = year;
  };

  HANOON.initImages = function () {
    $$("img").forEach(img => {
      img.addEventListener("error", () => {
        const source = img.getAttribute("src") || "";

        if (source.includes("logo.svg")) {
          const fallback = document.createElement("span");
          fallback.className = "logo-text-fallback";
          fallback.textContent = "HANOON";
          fallback.setAttribute("aria-label", "HANOON");
          img.replaceWith(fallback);
        } else {
          img.classList.add("image-not-found");
          img.style.display = "none";
        }
      }, { once: true });
    });
  };

  HANOON.initKeyboard = function () {
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      $$(".modal.is-open, .dropdown.is-open").forEach(element => {
        element.classList.remove("is-open");
      });
    });
  };

  HANOON.init = function () {
    if (HANOON.initialized) return;

    HANOON.injectHeaderStyles();
    HANOON.initSplash();
    HANOON.initMobileMenu();
    HANOON.initSearch();
    HANOON.initTheme();
    HANOON.initActiveLinks();
    HANOON.initFooter();
    HANOON.initImages();
    HANOON.initKeyboard();

    // تشغيل واجهة الحساب بعد تحميل جلسة Supabase
    HANOON.initHeaderAccount();

    HANOON.initialized = true;

    document.dispatchEvent(
      new CustomEvent("hanoon:ready", {
        detail: { version: HANOON.version }
      })
    );

    console.log("HANOON initialized successfully.");
  };

  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", HANOON.init, {
      once: true
    });
  } else {
    HANOON.init();
  }
})();
