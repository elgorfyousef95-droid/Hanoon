
// =====================================================
// HANOON ARTICLES ENGINE
// محرك عرض المقالات والبحث والتصنيفات
// =====================================================

(function () {
  "use strict";

  const API = window.HANOON_ARTICLES_API;

  if (!API) {
    console.error("HANOON: ملف data/articles.js لم يتم تحميله");
    return;
  }

  const state = {
    category: "all",
    search: "",
    sort: "latest",
    page: 1,
    perPage: 12
  };

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const formatDate = date => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  function getFilteredArticles() {
    let result = API.getAll().filter(article => {
      const categoryMatch =
        state.category === "all" ||
        article.category === state.category;

      const term = state.search.trim().toLowerCase();

      const searchMatch = !term || [
        article.title,
        article.excerpt,
        article.category,
        article.author,
        ...(article.tags || [])
      ].join(" ").toLowerCase().includes(term);

      return categoryMatch && searchMatch;
    });

    if (state.sort === "latest") {
      result.sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );
    }

    if (state.sort === "oldest") {
      result.sort((a, b) =>
        new Date(a.date) - new Date(b.date)
      );
    }

    if (state.sort === "title") {
      result.sort((a, b) =>
        a.title.localeCompare(b.title, "ar")
      );
    }

    return result;
  }

  function createCard(article, index = 0) {
    const image = escapeHTML(article.cover);
    const id = encodeURIComponent(article.id);

    return `
      <article class="ha-card" style="--card-index:${index}">
        <a class="ha-card-image"
           href="article.html?id=${id}"
           aria-label="${escapeHTML(article.title)}">

          <img
            src="${image}"
            alt="${escapeHTML(article.title)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80';"
          >

          <span class="ha-card-category">
            ${escapeHTML(article.category)}
          </span>

        </a>

        <div class="ha-card-body">

          <div class="ha-card-meta">
            <span>
              <i class="ha-dot"></i>
              ${formatDate(article.date)}
            </span>

            <span>
              ${Number(article.readTime) || 5} دقائق قراءة
            </span>
          </div>

          <h3>
            <a href="article.html?id=${id}">
              ${escapeHTML(article.title)}
            </a>
          </h3>

          <p>${escapeHTML(article.excerpt)}</p>

          <div class="ha-card-footer">
            <span class="ha-author">
              ${escapeHTML(article.author || "فريق هنون")}
            </span>

            <a class="ha-read-link"
               href="article.html?id=${id}">
              اقرأ المقال
              <span aria-hidden="true">←</span>
            </a>
          </div>

        </div>
      </article>
    `;
  }

  function renderFeatured() {
    const container = $("#haFeatured");

    if (!container) return;

    const featured = API.getFeatured(4);

    container.innerHTML = featured.map((article, index) => `
      <a class="ha-featured-card"
         href="article.html?id=${encodeURIComponent(article.id)}"
         style="--featured-index:${index}">

        <img
          src="${escapeHTML(article.cover)}"
          alt="${escapeHTML(article.title)}"
          loading="lazy"
        >

        <span class="ha-featured-overlay"></span>

        <span class="ha-featured-content">
          <small>${escapeHTML(article.category)}</small>
          <strong>${escapeHTML(article.title)}</strong>
          <span>اكتشف المقال ←</span>
        </span>

      </a>
    `).join("");
  }

  function renderCategories() {
    const container = $("#haCategories");

    if (!container) return;

    const categories = API.getCategories();

    const all = [
      { name: "كل المقالات", value: "all" },
      ...categories.map(name => ({
        name,
        value: name
      }))
    ];

    container.innerHTML = all.map(category => `
      <button
        type="button"
        class="ha-category-btn ${
          state.category === category.value ? "active" : ""
        }"
        data-category="${escapeHTML(category.value)}">

        ${escapeHTML(category.name)}

      </button>
    `).join("");

    $$(".ha-category-btn", container).forEach(button => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category;
        state.page = 1;
        renderCategories();
        renderArticles();
      });
    });
  }

  function renderArticles() {
    const container = $("#haArticlesGrid");

    if (!container) return;

    const filtered = getFilteredArticles();
    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / state.perPage)
    );

    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * state.perPage;

    const visible = filtered.slice(
      start,
      start + state.perPage
    );

    if (!visible.length) {
      container.innerHTML = `
        <div class="ha-empty">
          <div class="ha-empty-icon">⌕</div>
          <h3>لم نعثر على مقالات</h3>
          <p>جرب كلمة بحث مختلفة أو اختر تصنيفًا آخر.</p>
          <button type="button" id="haResetSearch">
            عرض كل المقالات
          </button>
        </div>
      `;

      $("#haResetSearch")?.addEventListener("click", resetFilters);

    } else {
      container.innerHTML = visible.map(createCard).join("");
    }

    const count = $("#haResultsCount");

    if (count) {
      count.textContent =
        `نعرض ${visible.length} من أصل ${filtered.length} مقال`;
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = $("#haPagination");

    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = `
      <button
        type="button"
        class="ha-page-btn"
        data-page="${state.page - 1}"
        ${state.page === 1 ? "disabled" : ""}>
        السابق
      </button>
    `;

    for (let page = 1; page <= totalPages; page++) {
      html += `
        <button
          type="button"
          class="ha-page-btn ${
            state.page === page ? "active" : ""
          }"
          data-page="${page}">
          ${page}
        </button>
      `;
    }

    html += `
      <button
        type="button"
        class="ha-page-btn"
        data-page="${state.page + 1}"
        ${state.page === totalPages ? "disabled" : ""}>
        التالي
      </button>
    `;

    container.innerHTML = html;

    $$(".ha-page-btn", container).forEach(button => {
      button.addEventListener("click", () => {
        const page = Number(button.dataset.page);

        if (
          page < 1 ||
          page > totalPages ||
          page === state.page
        ) return;

        state.page = page;
        renderArticles();

        $("#haArticlesGrid")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }

  function resetFilters() {
    state.category = "all";
    state.search = "";
    state.sort = "latest";
    state.page = 1;

    const search = $("#haSearch");
    const sort = $("#haSort");

    if (search) search.value = "";
    if (sort) sort.value = "latest";

    renderCategories();
    renderArticles();
  }

  function bindControls() {
    const search = $("#haSearch");
    const sort = $("#haSort");

    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        state.page = 1;
        renderArticles();
      });
    }

    if (sort) {
      sort.addEventListener("change", () => {
        state.sort = sort.value;
        state.page = 1;
        renderArticles();
      });
    }
  }

  function initialize() {
    renderFeatured();
    renderCategories();
    bindControls();
    renderArticles();

    const total = $("#haTotalArticles");

    if (total) {
      total.textContent = API.getCount();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.HANOON_ARTICLES_ENGINE = {
    refresh: initialize,
    reset: resetFilters,
    getFiltered: getFilteredArticles
  };

})();
