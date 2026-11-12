
(() => {
  "use strict";

  const DB_NAME = "HanoonChatWallpaperDB";
  const STORE_NAME = "wallpapers";
  const DB_VERSION = 1;

  let dbPromise = null;
  let currentObjectUrl = null;

  function getConversationId() {
    return new URLSearchParams(location.search).get("id");
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, {
            keyPath: "conversationId"
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function saveWallpaper(conversationId, file) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readwrite"
      );

      transaction.objectStore(STORE_NAME).put({
        conversationId,
        image: file,
        type: file.type,
        savedAt: Date.now()
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async function getWallpaper(conversationId) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readonly"
      );

      const request = transaction
        .objectStore(STORE_NAME)
        .get(conversationId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function removeWallpaper(conversationId) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readwrite"
      );

      transaction.objectStore(STORE_NAME).delete(conversationId);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function applyImage(blob) {
    const area = document.getElementById("messageList");
    if (!area || !blob) return;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }

    currentObjectUrl = URL.createObjectURL(blob);

    area.style.backgroundImage =
      `linear-gradient(rgba(12,18,32,.30),rgba(12,18,32,.30)),url("${currentObjectUrl}")`;

    area.style.backgroundSize = "cover";
    area.style.backgroundPosition = "center";
    area.style.backgroundRepeat = "no-repeat";
  }

  async function restoreWallpaper() {
    const conversationId = getConversationId();
    if (!conversationId) return;

    try {
      const saved = await getWallpaper(conversationId);

      if (saved?.image) {
        applyImage(saved.image);
      }
    } catch (error) {
      console.error("HANOON wallpaper restore:", error);
    }
  }

  function chooseImage() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.style.display = "none";

    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("من فضلك اختر صورة صحيحة.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
        return;
      }

      const conversationId = getConversationId();

      if (!conversationId) {
        alert("تعذر تحديد المحادثة الحالية.");
        return;
      }

      try {
        await saveWallpaper(conversationId, file);
        applyImage(file);

        window.dispatchEvent(
          new CustomEvent("hanoon:wallpaper-saved", {
            detail: { conversationId }
          })
        );

        const panel = document.getElementById("wallpaperPanel");
        const closeButton = panel?.querySelector("[data-close-panel]");

        closeButton?.click();

        alert("تم حفظ صورة الخلفية لهذه المحادثة على جهازك.");
      } catch (error) {
        console.error("HANOON wallpaper save:", error);
        alert("تعذر حفظ الصورة على الجهاز. حاول مرة أخرى.");
      }
    });

    input.click();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(
      "#wallpaperPanel .menu-item"
    );

    if (!button) return;

    const label = (button.textContent || "").trim();

    if (label.includes("اختيار صورة من الهاتف")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      chooseImage();
      return;
    }

    const conversationId = getConversationId();

    if (conversationId) {
      removeWallpaper(conversationId).catch(error => {
        console.error("HANOON wallpaper remove:", error);
      });
    }
  }, true);

  function start() {
    restoreWallpaper();

    const area = document.getElementById("messageList");

    if (area) {
      const observer = new MutationObserver(() => {
        if (currentObjectUrl && area.style.backgroundImage === "") {
          applyImageFromCurrentUrl();
        }
      });

      observer.observe(area, {
        attributes: true,
        attributeFilter: ["style"]
      });
    }

    window.addEventListener("pageshow", restoreWallpaper);
  }

  function applyImageFromCurrentUrl() {
    const conversationId = getConversationId();
    if (!conversationId) return;

    getWallpaper(conversationId)
      .then(saved => {
        if (saved?.image) applyImage(saved.image);
      })
      .catch(error => {
        console.error("HANOON wallpaper refresh:", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
