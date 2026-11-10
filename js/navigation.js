
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Navigation = {
    initialized: false,

    // قائمة الصفحات المعتمدة
    routes: {
      home: "../index.html",
      auth: "auth.html",
      library: "library.html",
      book: "book.html",
      articles: "articles.html",
      article: "article.html",
      stories: "stories.html",
      poetry: "poetry.html",
      research: "research.html",
      learning: "learning.html",
      course: "course.html",
      lesson: "lesson.html",
      exams: "exams.html",
      community: "community.html",
      profile: "profile.html",
      settings: "settings.html",
      notifications: "notifications.html",
      admin: "admin.html",
      search: "search.html"
    },

    // الحصول على مسار الصفحة
    getCurrentPage() {
      const pathname = window.location.pathname;
      return pathname.split("/").pop() || "index.html";
    },

    // الانتقال إلى صفحة داخل الموقع
    go(page, params = {}) {
      const route = this.routes[page];

      if (!route) {
        console.error(`HANOON: Unknown route "${page}"`);
        HANOON.toast?.("الصفحة المطلوبة غير موجودة", "error");
        return;
      }

      const target = new URL(route, document.baseURI);

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          target.searchParams.set(key, String(value));
        }
      });

      window.location.assign(target.href);
    },

    // الرجوع إلى الصفحة السابقة
    back(fallback = "home") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        this.go(fallback);
      }
    },

    // استبدال الصفحة الحالية
    replace(page, params = {}) {
      const route = this.routes[page];

      if (!route) {
        HANOON.toast?.("تعذر فتح الصفحة", "error");
        return;
      }

      const target = new URL(route, document.baseURI);

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          target.searchParams.set(key, String(value));
        }
      });

      window.location.replace(target.href);
    },

    // قراءة بيانات الرابط
    getParams() {
      return new URLSearchParams(window.location.search);
    },

    // ربط أزرار الانتقال
    bindNavigationButtons() {
      document.querySelectorAll("[data-go]").forEach(button => {
        button.addEventListener("click", () => {
          const page = button.dataset.go;

          if (page) {
            this.go(page);
          }
        });
      });

      document.querySelectorAll("[data-back]").forEach(button => {
        button.addEventListener("click", () => {
          this.back(button.dataset.back || "home");
        });
      });
    },

    // ربط الروابط الداخلية
    bindInternalLinks() {
      document.querySelectorAll("a[data-route]").forEach(link => {
        link.addEventListener("click", event => {
          const page = link.dataset.route;

          if (!page || !this.routes[page]) return;

          event.preventDefault();
          this.go(page);
        });
      });
    },

    // تحديث الرابط النشط
    updateActiveNavigation() {
      const currentPage = this.getCurrentPage();

      document.querySelectorAll("[data-page]").forEach(item => {
        const isActive = item.dataset.page === currentPage;

        item.classList.toggle("active", isActive);

        if (isActive) {
          item.setAttribute("aria-current", "page");
        } else {
          item.removeAttribute("aria-current");
        }
      });
    },

    // التعامل مع روابط العودة
    bindReturnLinks() {
      document.querySelectorAll("[data-return]").forEach(link => {
        link.addEventListener("click", event => {
          event.preventDefault();

          const fallback = link.dataset.return || "home";
          this.back(fallback);
        });
      });
    },

    // تهيئة نظام التنقل
    init() {
      if (this.initialized) return;

      this.bindNavigationButtons();
      this.bindInternalLinks();
      this.updateActiveNavigation();
      this.bindReturnLinks();

      this.initialized = true;
    }
  };

  HANOON.Navigation = Navigation;

  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Navigation.init(),
      { once: true }
    );
  } else {
    Navigation.init();
  }
})();
