
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

  // =========================================
  // الإشعارات
  // =========================================

  HANOON.toast = function (
    message,
    type = "info",
    duration = 3500
  ) {
    let container = HANOON.elements.toastContainer;

    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-atomic", "true");

      document.body.appendChild(container);
      HANOON.elements.toastContainer = container;
    }

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = String(message);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    window.setTimeout(() => {
      toast.classList.remove("show");

      window.setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  };

  // =========================================
  // شاشة البداية
  // =========================================

  HANOON.initSplash = function () {
    const splash =
      $("#splashScreen") ||
      $("#splash") ||
      $(".splash-screen");

    if (!splash) return;

    const startTime = Date.now();
    const minimumDuration = 5000;

    const hideSplash = () => {
      if (!splash.isConnected) return;

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(
        0,
        minimumDuration - elapsed
      );

      window.setTimeout(() => {
        if (!splash.isConnected) return;

        splash.classList.add("is-hidden");
        splash.classList.add("splash-hidden");

        document.body.classList.remove("loading");

        window.setTimeout(() => {
          if (splash.isConnected) {
            splash.remove();
          }
        }, 850);

      }, remaining);
    };

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        hideSplash,
        { once: true }
      );
    } else {
      hideSplash();
    }
  };

  // =========================================
  // القائمة الرئيسية للموبايل
  // =========================================

  HANOON.closeMobileMenu = function () {
    const button = HANOON.elements.menuToggle;
    const navigation = HANOON.elements.navigation;

    if (!button || !navigation) return;

    navigation.classList.remove("is-open");
    button.classList.remove("active");

    button.setAttribute("aria-expanded", "false");
  };

  HANOON.initMobileMenu = function () {
    const button = HANOON.elements.menuToggle;
    const navigation = HANOON.elements.navigation;

    if (!button || !navigation) return;

    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      const isOpen =
        navigation.classList.toggle("is-open");

      button.setAttribute(
        "aria-expanded",
        String(isOpen)
      );

      button.classList.toggle("active", isOpen);
    });

    $$(".main-navigation a").forEach(link => {
      link.addEventListener("click", () => {
        HANOON.closeMobileMenu();
      });
    });

    document.addEventListener("click", event => {
      if (
        !navigation.contains(event.target) &&
        !button.contains(event.target)
      ) {
        HANOON.closeMobileMenu();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        HANOON.closeMobileMenu();
      }
    });
  };

  // =========================================
  // البحث العام
  // =========================================

  HANOON.openSearch = function () {
    const panel = HANOON.elements.searchPanel;

    if (!panel) return;

    panel.hidden = false;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");

    const input = $("input[type='search']", panel);

    window.setTimeout(() => {
      input?.focus();
    }, 120);
  };

  HANOON.closeSearch = function () {
    const panel = HANOON.elements.searchPanel;

    if (!panel) return;

    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");

    window.setTimeout(() => {
      if (!panel.classList.contains("is-open")) {
        panel.hidden = true;
      }
    }, 300);
  };

  HANOON.initSearch = function () {
    const panel = HANOON.elements.searchPanel;

    const toggleButton = $("#searchToggle");

    const openButtons = [
      ...$$("[data-search-open]"),
      ...(toggleButton ? [toggleButton] : [])
    ];

    if (!panel) return;

    const closeButtons = $$("[data-search-close]", panel);

    const input =
      $("input[type='search']", panel) ||
      $("#globalSearchInput");

    openButtons.forEach(button => {
      button.addEventListener("click", () => {
        HANOON.openSearch();
      });
    });

    closeButtons.forEach(button => {
      button.addEventListener("click", () => {
        HANOON.closeSearch();
      });
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        HANOON.closeSearch();
      }
    });

    const searchForm = $("#globalSearchForm");

    if (searchForm) {
      searchForm.addEventListener("submit", event => {
        event.preventDefault();

        const query = input?.value.trim();

        if (!query) {
          HANOON.toast(
            "اكتب كلمة للبحث أولاً",
            "warning"
          );
          input?.focus();
          return;
        }

        const url = new URL(
          "pages/library.html",
          document.baseURI
        );

        url.searchParams.set("q", query);

        window.location.href = url.href;
      });
    }
  };

  // =========================================
  // الوضع الليلي والنهاري
  // =========================================

  HANOON.getSavedTheme = function () {
    try {
      return localStorage.getItem("hanoon-theme");
    } catch (_) {
      return null;
    }
  };

  HANOON.saveTheme = function (theme) {
    try {
      localStorage.setItem("hanoon-theme", theme);
    } catch (_) {}
  };

  HANOON.applyTheme = function (theme) {
    const selected =
      theme === "light" ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      selected
    );

    const buttons = [
      ...$$("[data-theme-toggle]"),
      ...($("#themeToggle") ? [$("#themeToggle")] : [])
    ];

    buttons.forEach(button => {
      button.setAttribute(
        "aria-label",
        selected === "dark"
          ? "تفعيل الوضع النهاري"
          : "تفعيل الوضع الليلي"
      );

      button.setAttribute(
        "title",
        selected === "dark"
          ? "تفعيل الوضع النهاري"
          : "تفعيل الوضع الليلي"
      );
    });

    return selected;
  };

  HANOON.initTheme = function () {
    const savedTheme = HANOON.getSavedTheme();

    const preferredTheme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

    const initialTheme = HANOON.applyTheme(
      savedTheme || preferredTheme
    );

    const buttons = [
      ...$$("[data-theme-toggle]"),
      ...($("#themeToggle") ? [$("#themeToggle")] : [])
    ];

    buttons.forEach(button => {
      button.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") ||
          "dark";

        const next =
          current === "dark" ? "light" : "dark";

        HANOON.applyTheme(next);
        HANOON.saveTheme(next);
      });
    });

    return initialTheme;
  };

  // =========================================
  // تحديد الصفحة الحالية
  // =========================================

  HANOON.initActiveLinks = function () {
    const currentPath = window.location.pathname;

    $$("a[href]").forEach(link => {
      try {
        const linkUrl = new URL(
          link.href,
          window.location.origin
        );

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

  // =========================================
  // سنة حقوق النشر
  // =========================================

  HANOON.initFooter = function () {
    const year = String(new Date().getFullYear());

    $$("[data-current-year]").forEach(element => {
      element.textContent = year;
    });

    const currentYear = $("#currentYear");

    if (currentYear) {
      currentYear.textContent = year;
    }
  };

  // =========================================
  // التعامل مع الصور
  // =========================================

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
          return;
        }

        img.classList.add("image-not-found");
        img.style.display = "none";
      }, { once: true });
    });
  };

  // =========================================
  // إغلاق النوافذ باستخدام Escape
  // =========================================

  HANOON.initKeyboard = function () {
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      $$(".modal.is-open, .dropdown.is-open").forEach(
        element => {
          element.classList.remove("is-open");
        }
      );
    });
  };

  // =========================================
  // تشغيل الموقع
  // =========================================

  HANOON.init = function () {
    if (HANOON.initialized) return;

    HANOON.elements.body = document.body;

    HANOON.initSplash();
    HANOON.initMobileMenu();
    HANOON.initSearch();
    HANOON.initTheme();
    HANOON.initActiveLinks();
    HANOON.initFooter();
    HANOON.initImages();
    HANOON.initKeyboard();

    HANOON.initialized = true;

    document.dispatchEvent(
      new CustomEvent("hanoon:ready", {
        detail: {
          version: HANOON.version
        }
      })
    );

    console.log(
      "HANOON initialized successfully - version " +
      HANOON.version
    );
  };

  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      HANOON.init,
      { once: true }
    );
  } else {
    HANOON.init();
  }

})();
