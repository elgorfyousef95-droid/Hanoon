
/* ==========================================
   HANOON - SMART CHAPTER LOADER
   تحميل الفصول وتنسيق المحتوى تلقائيًا
========================================== */

(function () {
  "use strict";

  // حماية النصوص العادية قبل عرضها داخل صفحة القراءة
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  // تحويل النص العادي إلى فقرات مرتبة
  function formatContent(value) {
    const content = String(value ?? "").trim();

    if (!content) {
      return "<p>محتوى هذا الفصل غير متاح حاليًا.</p>";
    }

    // إذا كان المحتوى مكتوبًا بالفعل بصيغة HTML
    if (/<\/?[a-z][\s\S]*?>/i.test(content)) {
      return content;
    }

    // تقسيم النص إلى فقرات
    return content
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean)
      .map(paragraph => `<p>${escapeHTML(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  async function getChapter(bookId, chapterNumber) {
    if (
      typeof bookId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(bookId) ||
      !Number.isInteger(chapterNumber) ||
      chapterNumber < 1
    ) {
      throw new Error("بيانات الكتاب أو الفصل غير صحيحة.");
    }

    const number = String(chapterNumber).padStart(2, "0");

    const filePath =
      `../content/books/${encodeURIComponent(bookId)}/chapter-${number}.js`;

    // أولًا: تحميل ملف الفصل المستقل
    try {
      const chapterModule = await import(filePath);
      const chapter = chapterModule.default;

      if (
        !chapter ||
        typeof chapter !== "object" ||
        typeof chapter.content !== "string"
      ) {
        throw new Error("صيغة ملف الفصل غير صحيحة.");
      }

      return {
        title: chapter.title || "",
        summary: chapter.summary || "",
        content: formatContent(chapter.content),
        bookId,
        chapterNumber,
        source: "independent-file"
      };

    } catch (error) {
      console.info(
        `HANOON: لم يتم تحميل الملف المستقل للفصل ${number}، سيتم تجربة بيانات الكتاب الحالية.`
      );
    }

    // ثانيًا: استخدام بيانات الفصل الموجودة حاليًا في books.js
    const book = window.HANOON_BOOKS_API?.getById(bookId);

    const chapter = book?.chapters?.[chapterNumber - 1];

    if (!chapter) {
      throw new Error("لم يتم العثور على بيانات هذا الفصل.");
    }

    if (typeof chapter.content !== "string") {
      throw new Error("محتوى الفصل غير متاح.");
    }

    return {
      title: chapter.title || "",
      summary: chapter.summary || "",
      content: formatContent(chapter.content),
      bookId,
      chapterNumber,
      source: "books-data"
    };
  }

  window.HANOON_CONTENT_API = {
    getChapter
  };

  console.info("HANOON Smart Chapter Loader Ready.");

})();
