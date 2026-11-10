
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  HANOON.version = "1.1.0";
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

  // الإشعارات
  HANOON.toast = function (
    message,
    type = "info",
    duration = 3500
  ) {
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

  // شاشة البداية
  HANOON.initSplash = function () {
    const splash =
      $("#splashScreen") ||
      $("#splash") ||
      $(".splash-screen");

    if (!splash) return;

    const startTime = Date.now();
    const minimumDuration = 5000;

    const hideSplash = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(
        0,
        minimumDuration - elapsed
      );

      window.setTimeout(() => {
        splash.classList.add("is-hidden");
        splash.classList.add("splash-hidden");

        document.body.classList.remove("loading");

        window.setTimeout(() => {
          splash.remove();
        }, 800);
      }, remaining);
    };

    // لا ننتظر تحميل الصور الخارجية حتى لا تتوقف الشاشة
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

  // القائمة على الهاتف
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

  // البحث
  HANOON.initSearch = function () {
    const panel = HANOON.elements.searchPanel;
    const openButtons = [
      ...$$("[data-search-open]"),
      ...$("#searchToggle")
        ? [$("#searchToggle")]
        : []
    ];

    if (!panel) return;

    const closeButtons = $$("[data-search-close]");
    const input = $("input[type='search']", panel);

    const openSearch = () => {
      panel.hidden = false;
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");

      window.setTimeout(() => {
        input?.focus();
      }, 100);
    };

    const closeSearch = () => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        if (!panel.classList.contains("is-open")) {
          panel.hidden = true;
        }
      }, 300);
    };

    openButtons.forEach(button => {
      button.addEventListener("click", openSearch);
    });

    closeButtons.forEach(button => {
      button.addEventListener("click", closeSearch);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeSearch();
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

  // الوضع الليلي والنهاري
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

    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    const toggleButtons = [
      ...$$("[data-theme-toggle]"),
      ...($("#themeToggle") ? [$("#themeToggle")] : [])
    ];

    toggleButtons.forEach(button => {
      button.setAttribute(
        "aria-label",
        theme === "dark"
          ? "تفعيل الوضع النهاري"
          : "تفعيل الوضع الليلي"
      );

      button.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute(
            "data-theme"
          ) || "dark";

        const next =
          current === "dark" ? "light" : "dark";

        document.documentElement.setAttribute(
          "data-theme",
          next
        );

        try {
          localStorage.setItem("hanoon-theme", next);
        } catch (_) {}

        button.setAttribute(
          "aria-label",
          next === "dark"
            ? "تفعيل الوضع النهاري"
            : "تفعيل الوضع الليلي"
        );
      });
    });
  };

  // تحديد الرابط الحالي
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

  // سنة حقوق النشر
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

  // التعامل مع الصور غير الموجودة
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

  // إغلاق النوافذ باستخدام Escape
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

  // تشغيل الموقع
  HANOON.init = function () {
    if (HANOON.initialized) return;

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

    console.log("HANOON initialized successfully.");
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
