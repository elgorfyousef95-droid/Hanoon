
/* =====================================================
   HANOON - ARTICLE READER
   محرك عرض وقراءة المقالات
   متوافق مع pages/article.html
===================================================== */

(function () {
  "use strict";

  const root = document.getElementById("articleRoot");
  const relatedSection = document.getElementById("relatedSection");
  const relatedContainer = document.getElementById("arRelated");
  const toast = document.getElementById("toast");

  let article = null;

  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  // تحويل النص إلى HTML آمن
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  // عرض رسالة للمستخدم
  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  // عرض حالة الخطأ بدل التحميل المستمر
  function showError(title, message) {
    document.title = title + " | هنون";

    if (!root) return;

    root.innerHTML = `
      <section class="error-state">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(message)}</p>
        <a href="articles.html">العودة إلى المقالات</a>
      </section>
    `;

    if (relatedSection) {
      relatedSection.hidden = true;
    }
  }

  // قراءة المفضلة
  function getFavorites() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("hanoon_article_favorites") || "[]"
      );

      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  // حفظ المفضلة
  function saveFavorites(items) {
    try {
      localStorage.setItem(
        "hanoon_article_favorites",
        JSON.stringify(items)
      );

      return true;
    } catch (error) {
      showToast("تعذر حفظ المفضلة على هذا الجهاز");
      return false;
    }
  }

  // تنسيق التاريخ
  function formatDate(dateValue) {
    if (!dateValue) return "هنون";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "هنون";
    }

    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  // تجهيز محتوى المقال
  function buildContent(content) {
    if (typeof content === "string") {
      return `<p>${escapeHTML(content)}</p>`;
    }

    if (!Array.isArray(content) || !content.length) {
      return "<p>لا يوجد محتوى متاح لهذا المقال حاليًا.</p>";
    }

    return content.map(function (section) {
      const heading = escapeHTML(section.heading || "");

      const paragraphs = Array.isArray(section.paragraphs)
        ? section.paragraphs
        : [];

      return `
        <section>
          ${heading ? `<h2>${heading}</h2>` : ""}

          ${paragraphs.map(function (paragraph) {
            return `<p>${escapeHTML(paragraph)}</p>`;
          }).join("")}
        </section>
      `;
    }).join("");
  }

  // تجهيز الوسوم
  function buildTags(tags) {
    if (!Array.isArray(tags) || !tags.length) {
      return "";
    }

    return tags.map(function (tag) {
      return `<span class="tag">${escapeHTML(tag)}</span>`;
    }).join("");
  }

  // إنشاء واجهة المقال
  function renderArticle() {
    const date = formatDate(article.date);
    const readTime = Math.max(1, Number(article.readTime) || 5);
    const favorites = getFavorites();
    const isFavorite = favorites.includes(article.id);

    document.title = article.title + " | هنون";

    const breadcrumbTitle = document.getElementById("breadcrumbTitle");

    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = article.title;
    }

    const cover = escapeHTML(article.cover || "");

    root.innerHTML = `
      <article class="article-card">

        <header class="article-header">

          <div class="category">
            ✦ ${escapeHTML(article.category || "مقالات هنون")}
          </div>

          <h1 class="article-title">
            ${escapeHTML(article.title)}
          </h1>

          <p class="article-excerpt">
            ${escapeHTML(article.excerpt || "")}
          </p>

          <div class="article-meta">

            <div class="meta-item">
              <span>✍</span>
              <strong>${escapeHTML(article.author || "فريق هنون")}</strong>
            </div>

            <div class="meta-item">
              <span>◷</span>
              <strong>${readTime} دقائق قراءة</strong>
            </div>

            <div class="meta-item">
              <span>▦</span>
              <strong>${escapeHTML(date)}</strong>
            </div>

          </div>
        </header>

        <div class="cover-wrap">
          <img
            class="cover-image"
            id="arCover"
            src="${cover}"
            alt="${escapeHTML(article.title)}"
            loading="eager"
          >
        </div>

        <div class="article-body">
          <div class="article-content" id="arContent">
            ${buildContent(article.content)}
          </div>
        </div>

        <footer class="article-footer">

          <div class="tags" id="arTags">
            ${buildTags(article.tags)}
          </div>

          <div class="article-controls">

            <button
              class="control-btn favorite ${isFavorite ? "active" : ""}"
              id="arFavorite"
              type="button"
              aria-pressed="${isFavorite}"
            >
              ${isFavorite ? "★ محفوظ في المفضلة" : "☆ أضف للمفضلة"}
            </button>

            <button
              class="control-btn"
              id="arShare"
              type="button"
            >
              ↗ مشاركة المقال
            </button>

            <button
              class="control-btn"
              id="arPrint"
              type="button"
            >
              ▤ طباعة المقال
            </button>

          </div>

        </footer>

      </article>
    `;

    const image = document.getElementById("arCover");

    image.addEventListener("error", function () {
      this.onerror = null;
      this.src =
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80";
    });

    bindActions();
    renderRelated();

    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // عرض المقالات المرتبطة
  function renderRelated() {
    if (!relatedContainer || !relatedSection) return;

    const API = window.HANOON_ARTICLES_API;

    if (!API || typeof API.getAll !== "function") {
      relatedSection.hidden = true;
      return;
    }

    const allArticles = API.getAll();

    const related = allArticles.filter(function (item) {
      return item.id !== article.id &&
        item.category === article.category;
    }).slice(0, 3);

    if (!related.length) {
      relatedSection.hidden = true;
      return;
    }

    relatedContainer.innerHTML = related.map(function (item) {
      return `
        <a
          class="related-card"
          href="article.html?id=${encodeURIComponent(item.id)}"
        >

          <img
            src="${escapeHTML(item.cover || "")}"
            alt="${escapeHTML(item.title)}"
            loading="lazy"
          >

          <div class="related-info">
            <small>${escapeHTML(item.category || "مقالات هنون")}</small>
            <h3>${escapeHTML(item.title)}</h3>
          </div>

        </a>
      `;
    }).join("");

    relatedSection.hidden = false;
  }

  // زر المفضلة
  function bindFavorite() {
    const button = document.getElementById("arFavorite");

    if (!button) return;

    button.addEventListener("click", function () {
      let favorites = getFavorites();

      if (favorites.includes(article.id)) {
        favorites = favorites.filter(function (id) {
          return id !== article.id;
        });

        showToast("تمت إزالة المقال من المفضلة");
      } else {
        favorites.push(article.id);
        showToast("تمت إضافة المقال إلى المفضلة");
      }

      if (saveFavorites(favorites)) {
        const saved = favorites.includes(article.id);

        button.classList.toggle("active", saved);
        button.textContent = saved
          ? "★ محفوظ في المفضلة"
          : "☆ أضف للمفضلة";

        button.setAttribute("aria-pressed", String(saved));
      }
    });
  }

  // مشاركة المقال
  async function shareArticle() {
    const shareData = {
      title: article.title,
      text: article.excerpt || article.title,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== "AbortError") {
          showToast("تعذرت المشاركة");
        }
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("تم نسخ رابط المقال");
    } catch (error) {
      window.prompt("انسخ رابط المقال:", window.location.href);
    }
  }

  // ربط الأزرار
  function bindActions() {
    const shareButton = document.getElementById("arShare");
    const printButton = document.getElementById("arPrint");

    if (shareButton) {
      shareButton.addEventListener("click", shareArticle);
    }

    if (printButton) {
      printButton.addEventListener("click", function () {
        window.print();
      });
    }

    bindFavorite();
  }

  // تشغيل الصفحة
  function initialize() {
    if (!root) {
      console.error("HANOON: articleRoot is missing.");
      return;
    }

    // التأكد من تحميل قاعدة البيانات
    const API = window.HANOON_ARTICLES_API;

    if (!API || typeof API.getById !== "function") {
      showError(
        "تعذر تحميل المقالات",
        "ملف قاعدة بيانات المقالات لم يتم تحميله. تأكد من وجود data/articles.js."
      );
      return;
    }

    // التأكد من وجود رقم المقال
    if (!articleId) {
      showError(
        "لم يتم تحديد المقال",
        "افتح المقال من صفحة المقالات حتى يتم تحميله بشكل صحيح."
      );
      return;
    }

    // البحث عن المقال
    article = API.getById(articleId);

    if (!article) {
      showError(
        "المقال غير موجود",
        "لم نعثر على مقال بهذا الرابط. ارجع إلى قائمة المقالات واختر المقال مرة أخرى."
      );
      return;
    }

    // التحقق من البيانات الأساسية
    if (!article.title || !article.id) {
      showError(
        "بيانات المقال غير مكتملة",
        "بيانات هذا المقال تحتاج إلى مراجعة."
      );
      return;
    }

    try {
      renderArticle();
    } catch (error) {
      console.error("HANOON ARTICLE ERROR:", error);

      showError(
        "حدث خطأ أثناء عرض المقال",
        "تعذر تجهيز محتوى المقال. حاول فتحه مرة أخرى."
      );
    }
  }

  // التشغيل بعد تحميل الصفحة
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // إتاحة أدوات المحرك عند الحاجة
  window.HANOON_ARTICLE_READER = {
    getCurrentArticle: function () {
      return article;
    },
    refresh: initialize
  };

})();
