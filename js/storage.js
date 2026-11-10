
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Storage = {
    initialized: false,
    storage: null,

    // حدود الملفات المسموح بها
    limits: {
      image: 5 * 1024 * 1024,
      document: 15 * 1024 * 1024,
      video: 50 * 1024 * 1024
    },

    // أنواع الملفات المسموح بها
    allowedTypes: {
      image: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ],

      document: [
        "application/pdf"
      ],

      video: [
        "video/mp4",
        "video/webm"
      ]
    },

    // الحصول على Firebase Storage
    getStorage() {
      const storage =
        this.storage ||
        HANOON.firebase?.storage ||
        window.firebase?.storage?.();

      if (!storage) {
        throw new Error(
          "Firebase Storage غير مهيأ. راجع إعداد Firebase أولاً."
        );
      }

      return storage;
    },

    // التحقق من الملف
    validateFile(file, category = "image") {
      if (!(file instanceof File)) {
        throw new Error("الملف المحدد غير صالح.");
      }

      const allowed = this.allowedTypes[category];
      const maximum = this.limits[category];

      if (!allowed || !maximum) {
        throw new Error("نوع الملفات غير مدعوم.");
      }

      if (!allowed.includes(file.type)) {
        throw new Error("نوع الملف غير مسموح به.");
      }

      if (file.size <= 0 || file.size > maximum) {
        throw new Error(
          `حجم الملف أكبر من الحد المسموح أو الملف فارغ.`
        );
      }

      return true;
    },

    // إنشاء اسم آمن وفريد للملف
    createFileName(file) {
      const extension = file.name.includes(".")
        ? file.name.split(".").pop().toLowerCase()
        : "file";

      const randomId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      return `${randomId}.${extension}`;
    },

    // رفع ملف إلى مسار محدد
    async upload(file, path, category = "image", onProgress) {
      this.validateFile(file, category);

      if (!path || typeof path !== "string") {
        throw new Error("مسار رفع الملف غير صالح.");
      }

      const storage = this.getStorage();
      const fileName = this.createFileName(file);
      const fullPath = `${path.replace(/^\/+|\/+$/g, "")}/${fileName}`;

      const reference = storage.ref(fullPath);

      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      };

      const task = reference.put(file, metadata);

      return new Promise((resolve, reject) => {
        task.on(
          "state_changed",

          snapshot => {
            const progress = snapshot.totalBytes
              ? Math.round(
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                )
              : 0;

            if (typeof onProgress === "function") {
              onProgress(progress);
            }
          },

          error => reject(error),

          async () => {
            try {
              const downloadURL =
                await task.snapshot.ref.getDownloadURL();

              resolve({
                name: fileName,
                originalName: file.name,
                path: fullPath,
                url: downloadURL,
                contentType: file.type,
                size: file.size
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    },

    // رفع صورة الملف الشخصي
    async uploadAvatar(uid, file, onProgress) {
      if (!uid) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      return this.upload(
        file,
        `users/${uid}/avatar`,
        "image",
        onProgress
      );
    },

    // رفع غلاف كتاب
    async uploadBookCover(bookId, file, onProgress) {
      if (!bookId) {
        throw new Error("معرف الكتاب غير موجود.");
      }

      return this.upload(
        file,
        `books/${bookId}/covers`,
        "image",
        onProgress
      );
    },

    // رفع صورة مقال
    async uploadArticleImage(articleId, file, onProgress) {
      if (!articleId) {
        throw new Error("معرف المقال غير موجود.");
      }

      return this.upload(
        file,
        `articles/${articleId}/images`,
        "image",
        onProgress
      );
    },

    // رفع مرفق لمنشور
    async uploadCommunityMedia(uid, file, onProgress) {
      if (!uid) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      let category = "image";

      if (file.type.startsWith("video/")) {
        category = "video";
      }

      return this.upload(
        file,
        `community/${uid}/media`,
        category,
        onProgress
      );
    },

    // رفع ملف PDF
    async uploadDocument(ownerId, file, onProgress) {
      if (!ownerId) {
        throw new Error("معرف صاحب الملف غير موجود.");
      }

      return this.upload(
        file,
        `documents/${ownerId}`,
        "document",
        onProgress
      );
    },

    // حذف ملف باستخدام مساره
    async delete(path) {
      if (!path || typeof path !== "string") {
        throw new Error("مسار الملف غير صالح.");
      }

      const reference = this.getStorage().ref(path);

      await reference.delete();

      return true;
    },

    // حذف صورة الحساب
    async deleteAvatar(uid, filePath) {
      if (!uid || !filePath) {
        throw new Error("بيانات حذف الصورة غير مكتملة.");
      }

      if (!filePath.startsWith(`users/${uid}/avatar/`)) {
        throw new Error("لا يمكن حذف ملف خارج مجلد حسابك.");
      }

      return this.delete(filePath);
    },

    // الحصول على رابط ملف موجود
    async getDownloadURL(path) {
      if (!path) {
        throw new Error("مسار الملف غير موجود.");
      }

      return this.getStorage().ref(path).getDownloadURL();
    },

    // تجهيز النظام
    init() {
      if (this.initialized) return;

      this.storage =
        HANOON.firebase?.storage ||
        window.firebase?.storage?.() ||
        null;

      this.initialized = true;
    }
  };

  HANOON.Storage = Storage;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Storage.init(),
      { once: true }
    );
  } else {
    Storage.init();
  }
})();
