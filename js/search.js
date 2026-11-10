
(function () {
  "use strict";

  const H = window.HANOON = window.HANOON || {};
  const Search = {
    state: {
      query: "",
      results: [],
      type: "all",
      loading: false
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    db() {
      if (!window.firebase || !firebase.firestore) {
        throw new Error("Firebase Firestore غير مهيأ");
      }
      return firebase.firestore();
    },

    toast(message) {
      if (H.UI && H.UI.toast) H.UI.toast(message);
      else console.info("[HANOON Search]", message);
    },

    async searchCollection(collection, field, query, type) {
      const snapshot = await this.db()
        .collection(collection)
        .limit(100)
        .get();

      const normalized = query.toLowerCase();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => {
          const value = String(item[field] || "").toLowerCase();
          return value.includes(normalized);
        })
        .map(item => ({ ...item, resultType: type }));
    },

    async searchUsers(query) {
      const users = await this.searchCollection(
        "users", "displayName", query, "user"
      );

      const usernames = await this.searchCollection(
        "users", "username", query.replace(/^@/, ""), "user"
      );

      const unique = new Map();

      [...users, ...usernames].forEach(user => {
        unique.set(user.id, user);
      });

      return [...unique.values()];
    },

    async searchPosts(query) {
      const posts = await this.searchCollection(
        "communityPosts", "content", query, "post"
      );

      return posts.filter(post => post.status === "published");
    },

    async searchContent(query, type) {
      const sources = {
        books: ["books", "title", "book"],
        articles: ["articles", "title", "article"],
        stories: ["stories", "title", "story"],
        poetry: ["poetry", "title", "poem"],
        research: ["research", "title", "research"],
        courses: ["courses", "title", "course"]
      };

      const selected = type === "all"
        ? Object.entries(sources)
        : [[type, sources[type]]].filter(item => item[1]);

      const results = await Promise.all(
        selected.map(async ([, config]) => {
          const [collection, field, resultType] = config;

          try {
            return await this.searchCollection(
              collection, field, query, resultType
            );
          } catch (error) {
            console.warn("Search source unavailable:", collection, error);
            return [];
          }
        })
      );

      return results.flat();
    },

    async search(query, type = "all") {
      const cleanQuery = String(query || "").trim();

      if (cleanQuery.length < 2) {
        this.toast("اكتب حرفين على الأقل للبحث");
        return [];
      }

      this.state.query = cleanQuery;
      this.state.type = type;
      this.state.loading = true;

      const container = document.querySelector("[data-search-results]");

      if (container) {
        container.innerHTML = '<div class="loading-state">جاري البحث...</div>';
      }

      try {
        let results = [];

        if (type === "all" || type === "users") {
          results.push(...await this.searchUsers(cleanQuery));
        }

        if (type === "all" || type === "posts") {
          results.push(...await this.searchPosts(cleanQuery));
        }

        if (type === "all" || Object.keys({
          books: 1, articles: 1, stories: 1,
          poetry: 1, research: 1, courses: 1
        }).includes(type)) {
          results.push(...await this.searchContent(cleanQuery, type));
        }

        this.state.results = results;
        this.render(results);

        return results;
      } catch (error) {
        console.error("Search error:", error);

        if (container) {
          container.innerHTML = '<div class="error-state">حدث خطأ أثناء البحث</div>';
        }

        return [];
      } finally {
        this.state.loading = false;
      }
    },

    render(results) {
      const container = document.querySelector("[data-search-results]");
      if (!container) return;

      if (!results.length) {
        container.innerHTML = '<div class="empty-state">لا توجد نتائج مطابقة</div>';
        return;
      }

      container.innerHTML = results.map(item => {
        const title = this.escape(
          item.displayName || item.title || item.content || "نتيجة"
        );

        const description = this.escape(
          item.bio || item.description || item.excerpt || ""
        );

        const typeLabels = {
          user: "مستخدم",
          post: "منشور",
          book: "كتاب",
          article: "مقال",
          story: "قصة",
          poem: "شعر",
          research: "بحث",
          course: "دورة"
        };

        const destination = {
          user: `profile.html?uid=${encodeURIComponent(item.id)}`,
          post: `community.html?post=${encodeURIComponent(item.id)}`,
          book: `book.html?id=${encodeURIComponent(item.id)}`,
          article: `article.html?id=${encodeURIComponent(item.id)}`,
          story: `stories.html?id=${encodeURIComponent(item.id)}`,
          poem: `poetry.html?id=${encodeURIComponent(item.id)}`,
          research: `research.html?id=${encodeURIComponent(item.id)}`,
          course: `course.html?id=${encodeURIComponent(item.id)}`
        }[item.resultType] || "#";

        return `
          <a class="search-result"
             href="${destination}"
             data-search-result="${this.escape(item.id)}">
            <span class="search-result-type">
              ${typeLabels[item.resultType] || "نتيجة"}
            </span>
            <strong>${title}</strong>
            <p>${description}</p>
          </a>
        `;
      }).join("");
    },

    bindEvents() {
      if (this._bound) return;
      this._bound = true;

      document.addEventListener("submit", event => {
        const form = event.target.closest("[data-search-form]");
        if (!form) return;

        event.preventDefault();

        const input = form.querySelector(
          '[name="query"], [data-search-input]'
        );

        const type = form.querySelector('[name="type"]');

        this.search(
          input ? input.value : "",
          type ? type.value : "all"
        );
      });

      document.addEventListener("click", event => {
        const button = event.target.closest("[data-search-type]");
        if (!button) return;

        const type = button.getAttribute("data-search-type");

        document.querySelectorAll("[data-search-type]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        if (this.state.query) {
          this.search(this.state.query, type);
        }
      });
    },

    init() {
      this.bindEvents();

      const params = new URLSearchParams(window.location.search);
      const query = params.get("q");

      if (query) {
        const input = document.querySelector("[data-search-input]");
        if (input) input.value = query;
        this.search(query);
      }
    }
  };

  H.Search = Search;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Search.init());
  } else {
    Search.init();
  }
})();
