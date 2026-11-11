
(function () {
  "use strict";

  const FAVORITES_KEY = "hanoon-poetry-favorites-v2";
  const EXPECTED = {
    collections: 20,
    poems: 400,
    lines: 8000
  };

  function collectParts() {
    const parts = [];

    // الصيغة المستخدمة في ملفات الدواوين الحالية
    for (let i = 1; i <= 20; i++) {
      const part = window["HANOON_POETRY_PART_" + i];

      if (Array.isArray(part)) {
        parts.push(...part);
      }
    }

    // دعم الصيغة المجمعة في الملفات المستقبلية
    if (Array.isArray(window.HANOON_POETRY_PARTS)) {
      window.HANOON_POETRY_PARTS.forEach(function (part) {
        if (Array.isArray(part)) {
          parts.push(...part);
        }
      });
    }

    return parts;
  }

  function normalizeCollection(collection) {
    if (!collection || typeof collection !== "object") {
      return null;
    }

    const poems = Array.isArray(collection.poems)
      ? collection.poems
      : [];

    return {
      ...collection,
      id: String(collection.id || ""),
      title: String(collection.title || "ديوان بلا عنوان"),
      subtitle: String(collection.subtitle || ""),
      category: String(collection.category || "general"),
      author: String(collection.author || "Yousef Elgorf"),
      description: String(collection.description || ""),
      cover: String(collection.cover || ""),
      poems: poems.map(function (poem, index) {
        const lines = Array.isArray(poem.lines)
          ? poem.lines.map(line => String(line))
          : [];

        return {
          ...poem,
          id: String(poem.id || ""),
          title: String(poem.title || "قصيدة بلا عنوان"),
          rhyme: String(poem.rhyme || ""),
          rhythm: String(poem.rhythm || ""),
          category: String(poem.category || collection.category || ""),
          lines: lines,
          collectionId: String(collection.id || ""),
          collectionTitle: String(collection.title || ""),
          author: String(collection.author || "Yousef Elgorf"),
          lineCount: lines.length,
          order: index + 1
        };
      })
    };
  }

  function uniqueById(items) {
    const seen = new Set();

    return items.filter(function (item) {
      if (!item || !item.id || seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    });
  }

  const collections = uniqueById(
    collectParts()
      .map(normalizeCollection)
      .filter(Boolean)
  );

  const allPoems = collections.flatMap(function (collection) {
    return collection.poems;
  });

  function readFavorites() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(FAVORITES_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? [...new Set(saved.map(String))]
        : [];
    } catch (error) {
      return [];
    }
  }

  function writeFavorites(ids) {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify([...new Set(ids)])
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function getFavorites() {
    const validIds = new Set(allPoems.map(poem => poem.id));

    return readFavorites().filter(id => validIds.has(id));
  }

  function getCollectionById(id) {
    return collections.find(item => item.id === String(id)) || null;
  }

  function getPoemById(id) {
    return allPoems.find(item => item.id === String(id)) || null;
  }

  function getPoemsByCollection(id) {
    const collection = getCollectionById(id);
    return collection ? collection.poems.slice() : [];
  }

  function getPoemsByCategory(category) {
    return allPoems.filter(function (poem) {
      return poem.category === category;
    });
  }

  function getCategories() {
    return [...new Set(
      collections.map(item => item.category).filter(Boolean)
    )];
  }

  function search(query) {
    const q = normalizeText(query);

    if (!q) {
      return {
        collections: collections.slice(),
        poems: allPoems.slice()
      };
    }

    return {
      collections: collections.filter(function (collection) {
        return normalizeText([
          collection.title,
          collection.subtitle,
          collection.description,
          collection.category,
          collection.author
        ].join(" ")).includes(q);
      }),

      poems: allPoems.filter(function (poem) {
        return normalizeText([
          poem.title,
          poem.description,
          poem.category,
          poem.rhythm,
          poem.rhyme,
          poem.lines.join(" ")
        ].join(" ")).includes(q);
      })
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFeatured() {
    return collections.find(item => item.featured) ||
      collections[0] ||
      null;
  }

  function getStats() {
    return {
      collections: collections.length,
      poems: allPoems.length,
      lines: allPoems.reduce(function (sum, poem) {
        return sum + poem.lines.length;
      }, 0),
      favorites: getFavorites().length
    };
  }

  function getCollectionStats(id) {
    const collection = getCollectionById(id);

    if (!collection) {
      return {
        poems: 0,
        lines: 0
      };
    }

    return {
      poems: collection.poems.length,
      lines: collection.poems.reduce(function (sum, poem) {
        return sum + poem.lines.length;
      }, 0)
    };
  }

  function isFavorite(id) {
    return getFavorites().includes(String(id));
  }

  function addFavorite(id) {
    const poem = getPoemById(id);

    if (!poem) {
      return false;
    }

    const favorites = getFavorites();

    if (!favorites.includes(poem.id)) {
      favorites.push(poem.id);
    }

    return writeFavorites(favorites);
  }

  function removeFavorite(id) {
    const favorites = getFavorites().filter(function (item) {
      return item !== String(id);
    });

    return writeFavorites(favorites);
  }

  function toggleFavorite(id) {
    if (isFavorite(id)) {
      removeFavorite(id);
      return false;
    }

    addFavorite(id);
    return isFavorite(id);
  }

  function getFavoritePoems() {
    const favorites = new Set(getFavorites());

    return allPoems.filter(poem => favorites.has(poem.id));
  }

  function getValidationErrors() {
    const errors = [];
    const collectionIds = new Set();
    const poemIds = new Set();

    collections.forEach(function (collection) {
      if (!collection.id) {
        errors.push("يوجد ديوان بدون معرف.");
      }

      if (collectionIds.has(collection.id)) {
        errors.push("معرف ديوان مكرر: " + collection.id);
      }

      collectionIds.add(collection.id);

      collection.poems.forEach(function (poem) {
        if (!poem.id) {
          errors.push("قصيدة بدون معرف داخل: " + collection.title);
        }

        if (poemIds.has(poem.id)) {
          errors.push("معرف قصيدة مكرر: " + poem.id);
        }

        poemIds.add(poem.id);

        if (poem.lines.length !== 20) {
          errors.push(
            "القصيدة " + poem.title +
            " تحتوي على " + poem.lines.length +
            " سطرًا بدلًا من 20."
          );
        }

        if (poem.lines.some(line => !line.trim())) {
          errors.push("يوجد سطر فارغ في: " + poem.title);
        }
      });
    });

    return errors;
  }

  function getValidationReport() {
    const stats = getStats();
    const errors = getValidationErrors();

    const countsMatch =
      stats.collections === EXPECTED.collections &&
      stats.poems === EXPECTED.poems &&
      stats.lines === EXPECTED.lines;

    return {
      expected: { ...EXPECTED },
      actual: stats,
      errors: errors,
      complete: countsMatch && errors.length === 0,
      valid: errors.length === 0
    };
  }

  const API = {
    getAllCollections: function () {
      return collections.slice();
    },

    getCollectionById,
    getPoemById,
    getPoemsByCollection,
    getPoemsByCategory,

    getAllPoems: function () {
      return allPoems.slice();
    },

    getCategories,
    search,
    getFeatured,
    getStats,
    getCollectionStats,

    getFavorites,
    getFavoritePoems,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,

    getValidationErrors,
    getValidationReport
  };

  // واجهة موحدة لكل صفحات الشعر
  window.HANOON_POETRY = collections;
  window.HANOON_POEMS = allPoems;
  window.HANOON_POETRY_API = API;

  window.dispatchEvent(
    new CustomEvent("hanoon:poetry-ready", {
      detail: {
        collections: collections.length,
        poems: allPoems.length,
        lines: getStats().lines
      }
    })
  );

})();
