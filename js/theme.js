
/* =========================================
   HANOON — Theme Manager
   Dark / Light Theme
========================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "hanoon-theme";
  const DEFAULT_THEME = "dark";

  const root = document.documentElement;

  const getSavedTheme = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch (error) {
      console.warn("HANOON: Unable to read theme preference.", error);
    }

    return DEFAULT_THEME;
  };

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("HANOON: Unable to save theme preference.", error);
    }
  };

  const updateToggleButton = (theme) => {
    const button = document.getElementById("themeToggle");

    if (!button) return;

    const icon = button.querySelector("svg use");

    if (icon) {
      const nextIcon = theme === "dark" ? "sun" : "moon";

      icon.setAttribute(
        "href",
        `assets/icons/icons.svg#${nextIcon}`
      );

      icon.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        `assets/icons/icons.svg#${nextIcon}`
      );
    }

    const label =
      theme === "dark"
        ? "التبديل إلى الوضع النهاري"
        : "التبديل إلى الوضع الليلي";

    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  };

  const applyTheme = (theme, shouldSave = true) => {
    if (theme !== "dark" && theme !== "light") {
      theme = DEFAULT_THEME;
    }

    root.dataset.theme = theme;
    updateToggleButton(theme);

    if (shouldSave) {
      saveTheme(theme);
    }

    window.dispatchEvent(
      new CustomEvent("hanoon:themechange", {
        detail: { theme }
      })
    );
  };

  const toggleTheme = () => {
    const currentTheme = root.dataset.theme || DEFAULT_THEME;

    const nextTheme =
      currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
  };

  const initializeTheme = () => {
    applyTheme(getSavedTheme(), false);

    const button = document.getElementById("themeToggle");

    if (button && !button.dataset.themeInitialized) {
      button.addEventListener("click", toggleTheme);
      button.dataset.themeInitialized = "true";
    }
  };

  // Initialize after the document is ready.
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeTheme,
      { once: true }
    );
  } else {
    initializeTheme();
  }

  // Synchronize theme changes between open tabs.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;

    if (event.newValue === "dark" || event.newValue === "light") {
      applyTheme(event.newValue, false);
    }
  });

  // Public theme controls for other HANOON scripts.
  window.HANOON_THEME = Object.freeze({
    get() {
      return root.dataset.theme || DEFAULT_THEME;
    },

    set(theme) {
      applyTheme(theme);
    },

    toggle() {
      toggleTheme();
    }
  });

})();
