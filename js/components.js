
/* =========================================
   HANOON — Components System
   Reusable UI Components
========================================= */

(() => {
  "use strict";

  const H = window.HANOON;

  if (!H) {
    console.error("HANOON core must load before components.js");
    return;
  }

  const Components = {};

  /* =========================================
     HTML SECURITY
  ========================================= */

  Components.escapeHTML = (value = "") => {
    return String(value).replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[char];
    });
  };

  Components.safeURL = (value, fallback = "") => {
    if (!value) return fallback;

    try {
      const url = new URL(value, window.location.href);

      if (
        url.protocol === "http:" ||
        url.protocol === "https:"
      ) {
        return url.href;
      }

      if (
        !url.origin ||
        url.origin === window.location.origin
      ) {
        return url.pathname + url.search + url.hash;
      }
    } catch (error) {
      return fallback;
    }

    return fallback;
  };

  const e = Components.escapeHTML;

  const imageHTML = (src, alt, className = "") => {
    const safeSrc = Components.safeURL(src);

    if (!safeSrc) {
      return `
        <div class="component-image-fallback ${e(className)}"
             aria-hidden="true">
          <span>هنون</span>
        </div>
      `;
    }

    return `
      <img
        src="${e(safeSrc)}"
        alt="${e(alt)}"
        class="${e(className)}"
        loading="lazy"
        decoding="async"
      >
    `;
  };

  /* =========================================
     ICON COMPONENT
  ========================================= */

  Components.icon = (name, className = "", label = "") => {
    const safeName = String(name || "").replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    );

    if (!safeName) return "";

    return `
      <svg
        class="icon ${e(className)}"
        ${label ? `role="img" aria-label="${e(label)}"` : 'aria-hidden="true"'}
        focusable="false"
      >
        <use href="assets/icons/icons.svg#${safeName}"></use>
      </svg>
    `;
  };

  /* =========================================
     BADGE COMPONENT
  ========================================= */

  Components.badge = (label, type = "default") => {
    const allowed = [
      "default",
      "gold",
      "success",
      "warning",
      "danger",
      "info"
    ];

    const safeType = allowed.includes(type)
      ? type
      : "default";

    return `
      <span class="badge badge-${safeType}">
        ${e(label)}
      </span>
    `;
  };

  /* =========================================
     PROGRESS COMPONENT
  ========================================= */

  Components.progress = (
    value = 0,
    options = {}
  ) => {
    const percentage = Math.max(
      0,
      Math.min(100, Number(value) || 0)
    );

    const label = options.label || "نسبة الإنجاز";

    return `
      <div class="component-progress">
        <div class="component-progress-heading">
          <span>${e(label)}</span>
          <strong>${percentage}%</strong>
        </div>

        <div
          class="progress-track"
          role="progressbar"
          aria-label="${e(label)}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${percentage}"
        >
          <span
            class="progress-fill"
            style="width:${percentage}%"
          ></span>
        </div>
      </div>
    `;
  };

  /* =========================================
     CATEGORY CARD
  ========================================= */

  Components.categoryCard = (category) => {
    if (!category || !category.id) return "";

    const id = encodeURIComponent(category.id);
    const title = e(category.title || category.name || "");
    const description = e(category.description || "");
    const icon = category.icon || "book";
    const count = Number(category.count) || 0;

    return `
      <a
        class="category-card"
        href="category.html?id=${id}"
        data-category-id="${e(category.id)}"
      >
        <div class="category-card-icon">
          ${Components.icon(icon)}
        </div>

        <div class="category-card-content">
          <h3>${title}</h3>
          <p>${description}</p>

          ${
            count > 0
              ? `<span class="category-count">${H.utils.formatNumber(count)} محتوى</span>`
              : ""
          }
        </div>

        <span class="category-card-arrow">
          ${Components.icon("arrow-left")}
        </span>
      </a>
    `;
  };

  /* =========================================
     BOOK CARD
  ========================================= */

  Components.bookCard = (book) => {
    if (!book || !book.id) return "";

    const id = encodeURIComponent(book.id);
    const title = e(book.title || "");
    const author = e(book.author || "هنون");
    const description = e(book.description || "");
    const cover = book.cover || "";
    const chapters = Number(book.chapters) || 0;
    const category = book.category
      ? e(book.category)
      : "";

    return `
      <article class="book-card" data-book-id="${e(book.id)}">

        <a
          class="book-card-cover"
          href="book.html?id=${id}"
          aria-label="عرض كتاب ${title}"
        >
          ${imageHTML(cover, title, "book-cover-image")}
        </a>

        <div class="book-card-content">

          ${
            category
              ? `<span class="book-card-category">${category}</span>`
              : ""
          }

          <h3>
            <a href="book.html?id=${id}">
              ${title}
            </a>
          </h3>

          <p class="book-card-description">
            ${e(H.utils.truncate(description, 115))}
          </p>

          <div class="book-card-meta">
            <span>${Components.icon("user")} ${author}</span>

            ${
              chapters > 0
                ? `<span>${Components.icon("book")} ${H.utils.formatNumber(chapters)} فصل</span>`
                : ""
            }
          </div>

          <a class="book-card-link" href="book.html?id=${id}">
            اكتشف الكتاب
            ${Components.icon("arrow-left")}
          </a>

        </div>
      </article>
    `;
  };

  /* =========================================
     ARTICLE CARD
  ========================================= */

  Components.articleCard = (article) => {
    if (!article || !article.id) return "";

    const id = encodeURIComponent(article.id);
    const title = e(article.title || "");
    const description = e(article.description || "");
    const cover = article.image || article.cover || "";
    const date = article.date || "";

    return `
      <article class="article-card" data-article-id="${e(article.id)}">

        <a
          class="article-card-image"
          href="article.html?id=${id}"
        >
          ${imageHTML(cover, title)}
        </a>

        <div class="article-card-content">

          ${
            article.category
              ? `<span class="article-category">${e(article.category)}</span>`
              : ""
          }

          <h3>
            <a href="article.html?id=${id}">
              ${title}
            </a>
          </h3>

          <p>${e(H.utils.truncate(description, 140))}</p>

          <div class="article-card-footer">
            ${
              date
                ? `<time>${e(date)}</time>`
                : ""
            }

            <a href="article.html?id=${id}" aria-label="قراءة المقال">
              اقرأ المقال
              ${Components.icon("arrow-left")}
            </a>
          </div>

        </div>
      </article>
    `;
  };

  /* =========================================
     STORY CARD
  ========================================= */

  Components.storyCard = (story) => {
    if (!story || !story.id) return "";

    const id = encodeURIComponent(story.id);
    const title = e(story.title || "");
    const description = e(story.description || "");

    return `
      <article class="story-card" data-story-id="${e(story.id)}">

        <div class="story-card-decoration">
          ${Components.icon("book")}
        </div>

        <div class="story-card-content">
          ${
            story.category
              ? `<span>${e(story.category)}</span>`
              : ""
          }

          <h3>
            <a href="story.html?id=${id}">
              ${title}
            </a>
          </h3>

          <p>${e(H.utils.truncate(description, 130))}</p>

          <a href="story.html?id=${id}" class="story-card-link">
            اقرأ القصة
            ${Components.icon("arrow-left")}
          </a>
        </div>

      </article>
    `;
  };

  /* =========================================
     COURSE CARD
  ========================================= */

  Components.courseCard = (course) => {
    if (!course || !course.id) return "";

    const id = encodeURIComponent(course.id);
    const title = e(course.title || "");
    const description = e(course.description || "");
    const image = course.image || "";

    const lessons = Number(course.lessons) || 0;
    const level = course.level || "مناسب للمبتدئين";

    return `
      <article class="course-card" data-course-id="${e(course.id)}">

        <a
          class="course-card-image"
          href="course.html?id=${id}"
        >
          ${imageHTML(image, title)}
        </a>

        <div class="course-card-content">

          <span class="course-level">${e(level)}</span>

          <h3>
            <a href="course.html?id=${id}">
              ${title}
            </a>
          </h3>

          <p>${e(H.utils.truncate(description, 120))}</p>

          ${
            lessons > 0
              ? `<span class="course-lessons">${H.utils.formatNumber(lessons)} درس</span>`
              : ""
          }

          <a href="course.html?id=${id}" class="btn btn-outline">
            ابدأ التعلم
          </a>

        </div>
      </article>
    `;
  };

  /* =========================================
     EMPTY STATE
  ========================================= */

  Components.emptyState = (options = {}) => {
    const title = e(options.title || "لا يوجد محتوى حاليًا");
    const description = e(
      options.description || "سيظهر المحتوى هنا عند توفره."
    );

    const icon = options.icon || "book";

    return `
      <div class="empty-state" role="status">

        <div class="empty-state-icon">
          ${Components.icon(icon)}
        </div>

        <h3>${title}</h3>

        <p>${description}</p>

        ${
          options.link && options.linkText
            ? `<a class="btn btn-outline" href="${e(Components.safeURL(options.link))}">${e(options.linkText)}</a>`
            : ""
        }

      </div>
    `;
  };

  /* =========================================
     SECTION HEADER
  ========================================= */

  Components.sectionHeader = (options = {}) => {
    const eyebrow = e(options.eyebrow || "");
    const title = e(options.title || "");
    const description = e(options.description || "");

    return `
      <div class="section-heading">

        ${
          eyebrow
            ? `<span class="section-eyebrow">${eyebrow}</span>`
            : ""
        }

        <h2>${title}</h2>

        ${
          description
            ? `<p>${description}</p>`
            : ""
        }

      </div>
    `;
  };

  /* =========================================
     STAT CARD
  ========================================= */

  Components.statCard = (options = {}) => {
    const value = e(options.value ?? "0");
    const label = e(options.label || "");
    const icon = options.icon || "chart";

    return `
      <div class="stat-card">

        <div class="stat-card-icon">
          ${Components.icon(icon)}
        </div>

        <div class="stat-card-content">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>

      </div>
    `;
  };

  /* =========================================
     CONTENT RENDERER
  ========================================= */

  Components.renderList = (
    container,
    items,
    renderer,
    emptyOptions = {}
  ) => {
    const element =
      typeof container === "string"
        ? H.$(container)
        : container;

    if (!element) return false;

    if (!Array.isArray(items) || items.length === 0) {
      element.innerHTML = Components.emptyState(
        emptyOptions
      );

      return true;
    }

    element.innerHTML = items
      .map((item) => renderer(item))
      .filter(Boolean)
      .join("");

    return true;
  };

  /* =========================================
     PUBLIC COMPONENT API
  ========================================= */

  window.HANOON_COMPONENTS = Object.freeze(
    Components
  );

})();
