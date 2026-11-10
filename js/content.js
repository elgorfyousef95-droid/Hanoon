
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Content = {
    initialized: false,

    // أنواع المحتوى داخل المنصة
    types: {
      books: {
        collection: "books",
        title: "الكتب",
        detailPage: "book.html"
      },
      articles: {
        collection: "articles",
        title: "المقالات",
        detailPage: "article.html"
      },
      stories: {
        collection: "stories",
        title: "القصص",
        detailPage: "story.html"
      },
      poetry: {
        collection: "poetry",
        title: "الأشعار",
        detailPage: "poem.html"
      },
      research: {
        collection: "research",
        title: "الأبحاث",
        detailPage: "research.html"
      }
    },

    // التحقق من نوع المحتوى
    getType(type) {
      const config = this.types[type];

      if (!config) {
        throw new Error("نوع المحتوى غير معروف.");
      }

      return config;
    },

    // التحقق من توفر قاعدة البيانات
    get database() {
      if (!HANOON.Database) {
        throw new Error("نظام قاعدة البيانات غير محمل.");
      }

      return HANOON.Database;
    },

    // تنظيف النصوص
    cleanText(value, maxLength = 10000) {
      return String(value || "")
        .trim()
        .slice(0, maxLength);
    },

    // الحصول على محتوى واحد
    async get(type, id) {
      this.getType(type);

      if (!id) {
        throw new Error("معرف المحتوى غير موجود.");
      }

      const item = await this.database.get(type, id);

      if (!item) return null;

      return item;
    },

    // الحصول على قائمة المحتوى
    async list(type, options = {}) {
      this.getType(type);

      const conditions = [
        {
          field: "status",
          operator: "==",
          value: "published"
        }
      ];

      if (options.category) {
        conditions.push({
          field: "category",
          operator: "==",
          value: options.category
        });
      }

      if (options.featured === true) {
        conditions.push({
          field: "featured",
          operator: "==",
          value: true
        });
      }

      if (options.authorId) {
        conditions.push({
          field: "authorId",
          operator: "==",
          value: options.authorId
        });
      }

      const records = await this.database.getAll(type, {
        where: conditions,
        orderBy: {
          field: options.orderBy || "createdAt",
          direction: options.direction || "desc"
        },
        limit: options.limit || 20
      });

      return records;
    },

    // المحتوى المميز
    async featured(type, limit = 6) {
      return this.list(type, {
        featured: true,
        limit
      });
    },

    // أحدث المحتويات
    async latest(type, limit = 10) {
      return this.list(type, {
        limit,
        orderBy: "createdAt",
        direction: "desc"
      });
    },

    // محتوى حسب التصنيف
    async byCategory(type, category, limit = 20) {
      if (!category) {
        throw new Error("حدد التصنيف المطلوب.");
      }

      return this.list(type, {
        category,
        limit
      });
    },

    // البحث النصي داخل المحتوى
    async search(type, searchTerm, limit = 50) {
      this.getType(type);

      const term = this.cleanText(searchTerm, 150).toLowerCase();

      if (term.length < 2) {
        return [];
      }

      const records = await this.database.getAll(type, {
        where: [
          {
            field: "status",
            operator: "==",
            value: "published"
          }
        ],
        limit: 200
      });

      return records
        .filter(item => {
          const searchable = [
            item.title,
            item.description,
            item.summary,
            item.author,
            item.category,
            ...(Array.isArray(item.tags) ? item.tags : [])
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(term);
        })
        .slice(0, limit);
    },

    // زيادة عدد المشاهدات
    async registerView(type, id) {
      this.getType(type);

      const item = await this.database.get(type, id);

      if (!item) {
        throw new Error("المحتوى غير موجود.");
      }

      const db = this.database.getDB();
      const ref = db.collection(type).doc(id);

      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists) return;

        const views = Number(snapshot.data().views || 0);

        transaction.update(ref, {
          views: views + 1
        });
      });

      return true;
    },

    // إضافة المحتوى إلى المفضلة
    async addFavorite(uid, type, contentId) {
      this.getType(type);

      if (!uid || !contentId) {
        throw new Error("بيانات المفضلة غير مكتملة.");
      }

      const id = `${uid}_${type}_${contentId}`;

      await this.database.set(
        "favorites",
        id,
        {
          uid,
          contentType: type,
          contentId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        true
      );

      return id;
    },

    // إزالة محتوى من المفضلة
    async removeFavorite(uid, type, contentId) {
      this.getType(type);

      const id = `${uid}_${type}_${contentId}`;

      return this.database.delete("favorites", id);
    },

    // الحصول على مفضلة المستخدم
    async getFavorites(uid, limit = 100) {
      if (!uid) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      return this.database.getAll("favorites", {
        where: [
          {
            field: "uid",
            operator: "==",
            value: uid
          }
        ],
        limit
      });
    },

    // حفظ آخر محتوى تمت قراءته
    async saveReadingHistory(uid, type, contentId) {
      this.getType(type);

      if (!uid || !contentId) {
        throw new Error("بيانات سجل القراءة غير مكتملة.");
      }

      const id = `${uid}_${type}_${contentId}`;

      await this.database.set(
        "readingHistory",
        id,
        {
          uid,
          contentType: type,
          contentId,
          lastReadAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        true
      );

      return true;
    },

    // سجل قراءة المستخدم
    async getReadingHistory(uid, limit = 30) {
      if (!uid) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      return this.database.getAll("readingHistory", {
        where: [
          {
            field: "uid",
            operator: "==",
            value: uid
          }
        ],
        orderBy: {
          field: "lastReadAt",
          direction: "desc"
        },
        limit
      });
    },

    // إنشاء محتوى جديد
    async create(type, data) {
      this.getType(type);

      if (!data || !data.title) {
        throw new Error("عنوان المحتوى مطلوب.");
      }

      const title = this.cleanText(data.title, 200);

      if (!title) {
        throw new Error("العنوان غير صالح.");
      }

      const currentUser = HANOON.Auth?.currentUser;

      if (!currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      const record = {
        title,
        description: this.cleanText(data.description, 2000),
        summary: this.cleanText(data.summary, 3000),
        body: String(data.body || ""),
        category: this.cleanText(data.category, 100),
        author: this.cleanText(
          data.author || currentUser.displayName,
          150
        ),
        authorId: currentUser.uid,
        coverURL: data.coverURL || "",
        tags: Array.isArray(data.tags)
          ? data.tags.map(tag => this.cleanText(tag, 50)).slice(0, 20)
          : [],
        status: "draft",
        featured: false,
        views: 0
      };

      return this.database.create(type, record);
    },

    // نشر المحتوى
    async publish(type, id) {
      this.getType(type);

      if (!id) {
        throw new Error("معرف المحتوى غير موجود.");
      }

      const currentUser = HANOON.Auth?.currentUser;

      if (!currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      const item = await this.database.get(type, id);

      if (!item) {
        throw new Error("المحتوى غير موجود.");
      }

      if (
        item.authorId !== currentUser.uid &&
        currentUser.uid !== HANOON.adminUID
      ) {
        throw new Error("ليس لديك صلاحية نشر هذا المحتوى.");
      }

      return this.database.update(type, id, {
        status: "published",
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    // تحويل المحتوى إلى مسودة
    async unpublish(type, id) {
      this.getType(type);

      const currentUser = HANOON.Auth?.currentUser;

      if (!currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      const item = await this.database.get(type, id);

      if (!item) {
        throw new Error("المحتوى غير موجود.");
      }

      if (
        item.authorId !== currentUser.uid &&
        currentUser.uid !== HANOON.adminUID
      ) {
        throw new Error("ليس لديك صلاحية تعديل هذا المحتوى.");
      }

      return this.database.update(type, id, {
        status: "draft"
      });
    },

    // تجهيز بطاقات المحتوى
    createCard(item, type) {
      const config = this.getType(type);

      const card = document.createElement("article");
      card.className = `content-card ${type}-card`;

      const link = document.createElement("a");
      link.className = "content-card-link";

      const page = new URL(
        `pages/${config.detailPage}`,
        document.baseURI
      );

      page.searchParams.set("id", item.id);

      link.href = page.href;

      if (item.coverURL) {
        const image = document.createElement("img");

        image.src = item.coverURL;
        image.alt = item.title || config.title;
        image.loading = "lazy";

        link.appendChild(image);
      }

      const title = document.createElement("h3");
      title.textContent = item.title || "بدون عنوان";

      const description = document.createElement("p");
      description.textContent =
        item.summary ||
        item.description ||
        "اكتشف هذا المحتوى على هنون.";

      link.append(title, description);
      card.appendChild(link);

      return card;
    },

    // عرض مجموعة محتويات داخل عنصر
    render(items, container, type) {
      this.getType(type);

      if (typeof container === "string") {
        container = document.querySelector(container);
      }

      if (!container) {
        throw new Error("عنصر العرض غير موجود.");
      }

      container.replaceChildren();

      if (!items.length) {
        const empty = document.createElement("p");

        empty.className = "empty-state";
        empty.textContent = "لا يوجد محتوى متاح حاليًا.";

        container.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      items.forEach(item => {
        fragment.appendChild(this.createCard(item, type));
      });

      container.appendChild(fragment);
    },

    // تفعيل أزرار المفضلة
    bindFavoriteButtons() {
      document.querySelectorAll("[data-favorite]").forEach(button => {
        button.addEventListener("click", async () => {
          const user = HANOON.Auth?.currentUser;

          if (!user) {
            HANOON.toast?.("سجل الدخول لاستخدام المفضلة", "warning");
            return;
          }

          const type = button.dataset.type;
          const id = button.dataset.favorite;

          try {
            const favorites = await this.getFavorites(user.uid);

            const exists = favorites.some(item =>
              item.contentType === type &&
              item.contentId === id
            );

            if (exists) {
              await this.removeFavorite(user.uid, type, id);
              button.classList.remove("is-favorite");
              button.setAttribute("aria-pressed", "false");

              HANOON.toast?.("تمت الإزالة من المفضلة", "success");
            } else {
              await this.addFavorite(user.uid, type, id);
              button.classList.add("is-favorite");
              button.setAttribute("aria-pressed", "true");

              HANOON.toast?.("تمت الإضافة إلى المفضلة", "success");
            }
          } catch (error) {
            HANOON.toast?.(
              error.message || "تعذر تحديث المفضلة",
              "error"
            );
          }
        });
      });
    },

    // تهيئة النظام
    init() {
      if (this.initialized) return;

      this.bindFavoriteButtons();
      this.initialized = true;
    }
  };

  HANOON.Content = Content;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Content.init(),
      { once: true }
    );
  } else {
    Content.init();
  }
})();
