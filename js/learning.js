
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Learning = {
    initialized: false,

    get database() {
      if (!HANOON.Database) {
        throw new Error("نظام قاعدة البيانات غير محمل.");
      }

      return HANOON.Database;
    },

    get currentUser() {
      return HANOON.Auth?.currentUser || null;
    },

    // إعدادات نظام التعليم
    settings: {
      minimumLessonProgress: 100,
      defaultLessonDuration: 15,
      passingScore: 60
    },

    // التحقق من تسجيل الدخول
    requireUser() {
      if (!this.currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      return this.currentUser;
    },

    // الحصول على جميع المسارات التعليمية
    async getCourses(options = {}) {
      const conditions = [];

      if (options.category) {
        conditions.push({
          field: "category",
          operator: "==",
          value: options.category
        });
      }

      if (options.level) {
        conditions.push({
          field: "level",
          operator: "==",
          value: options.level
        });
      }

      conditions.push({
        field: "status",
        operator: "==",
        value: "published"
      });

      return this.database.getAll("courses", {
        where: conditions,
        orderBy: {
          field: options.orderBy || "createdAt",
          direction: options.direction || "desc"
        },
        limit: options.limit || 100
      });
    },

    // الحصول على دورة واحدة
    async getCourse(courseId) {
      if (!courseId) {
        throw new Error("معرف الدورة غير موجود.");
      }

      const course = await this.database.get(
        "courses",
        courseId
      );

      if (!course || course.status !== "published") {
        return null;
      }

      return course;
    },

    // الحصول على دروس دورة
    async getLessons(courseId) {
      if (!courseId) {
        throw new Error("معرف الدورة غير موجود.");
      }

      return this.database.getAll("lessons", {
        where: [
          {
            field: "courseId",
            operator: "==",
            value: courseId
          },
          {
            field: "status",
            operator: "==",
            value: "published"
          }
        ],
        orderBy: {
          field: "order",
          direction: "asc"
        },
        limit: 300
      });
    },

    // الحصول على درس واحد
    async getLesson(lessonId) {
      if (!lessonId) {
        throw new Error("معرف الدرس غير موجود.");
      }

      return this.database.get("lessons", lessonId);
    },

    // الحصول على تقدم المستخدم في دورة
    async getProgress(courseId) {
      const user = this.requireUser();

      const records = await this.database.find(
        "progress",
        "uid",
        "==",
        user.uid,
        500
      );

      return records.filter(
        record => record.courseId === courseId
      );
    },

    // التحقق من إكمال درس
    async isLessonCompleted(courseId, lessonId) {
      const progress = await this.getProgress(courseId);

      return progress.some(record =>
        record.lessonId === lessonId &&
        record.completed === true
      );
    },

    // حساب نسبة التقدم في الدورة
    async calculateProgress(courseId) {
      const lessons = await this.getLessons(courseId);
      const progress = await this.getProgress(courseId);

      if (!lessons.length) {
        return {
          totalLessons: 0,
          completedLessons: 0,
          percentage: 0
        };
      }

      const completedIds = new Set(
        progress
          .filter(record => record.completed)
          .map(record => record.lessonId)
      );

      const completedLessons = lessons.filter(
        lesson => completedIds.has(lesson.id)
      ).length;

      return {
        totalLessons: lessons.length,
        completedLessons,
        percentage: Math.round(
          (completedLessons / lessons.length) * 100
        )
      };
    },

    // التحقق من إمكانية فتح درس
    async canOpenLesson(courseId, lessonId) {
      const lessons = await this.getLessons(courseId);

      const currentIndex = lessons.findIndex(
        lesson => lesson.id === lessonId
      );

      if (currentIndex === -1) {
        return {
          allowed: false,
          reason: "الدرس غير موجود."
        };
      }

      const lesson = lessons[currentIndex];

      // الدرس الأول مفتوح إذا لم توجد له شروط سابقة
      if (currentIndex === 0 && !lesson.prerequisites?.length) {
        return {
          allowed: true,
          reason: ""
        };
      }

      // فحص الدروس السابقة بالترتيب
      if (lesson.requirePrevious !== false && currentIndex > 0) {
        const previousLessons = lessons.slice(0, currentIndex);
        const progress = await this.getProgress(courseId);

        const completedIds = new Set(
          progress
            .filter(record => record.completed)
            .map(record => record.lessonId)
        );

        const incomplete = previousLessons.find(
          previous => !completedIds.has(previous.id)
        );

        if (incomplete) {
          return {
            allowed: false,
            reason: "أكمل الدرس السابق أولاً.",
            requiredLessonId: incomplete.id
          };
        }
      }

      // فحص المتطلبات الإضافية
      if (
        Array.isArray(lesson.prerequisites) &&
        lesson.prerequisites.length
      ) {
        for (const requiredId of lesson.prerequisites) {
          const completed = await this.isLessonCompleted(
            courseId,
            requiredId
          );

          if (!completed) {
            return {
              allowed: false,
              reason: "يجب إكمال المتطلبات السابقة لهذا الدرس.",
              requiredLessonId: requiredId
            };
          }
        }
      }

      return {
        allowed: true,
        reason: ""
      };
    },

    // فتح درس والتحقق من شروطه
    async openLesson(courseId, lessonId) {
      const access = await this.canOpenLesson(
        courseId,
        lessonId
      );

      if (!access.allowed) {
        throw new Error(access.reason);
      }

      const lesson = await this.getLesson(lessonId);

      if (!lesson || lesson.status !== "published") {
        throw new Error("هذا الدرس غير متاح.");
      }

      return lesson;
    },

    // حفظ تقدم القراءة أو المشاهدة
    async updateLessonProgress(
      courseId,
      lessonId,
      lastPosition = 0
    ) {
      const user = this.requireUser();

      const access = await this.canOpenLesson(
        courseId,
        lessonId
      );

      if (!access.allowed) {
        throw new Error(access.reason);
      }

      const position = Math.max(
        0,
        Number(lastPosition) || 0
      );

      return this.database.saveLessonProgress(
        user.uid,
        courseId,
        lessonId,
        {
          completed: false,
          lastPosition: position
        }
      );
    },

    // إكمال درس
    async completeLesson(courseId, lessonId) {
      const user = this.requireUser();

      const access = await this.canOpenLesson(
        courseId,
        lessonId
      );

      if (!access.allowed) {
        throw new Error(access.reason);
      }

      const lesson = await this.getLesson(lessonId);

      if (!lesson || lesson.status !== "published") {
        throw new Error("الدرس غير متاح.");
      }

      await this.database.saveLessonProgress(
        user.uid,
        courseId,
        lessonId,
        {
          completed: true,
          lastPosition: Number(lesson.duration || 0)
        }
      );

      document.dispatchEvent(
        new CustomEvent("hanoon:lesson-completed", {
          detail: {
            courseId,
            lessonId,
            userId: user.uid
          }
        })
      );

      return this.calculateProgress(courseId);
    },

    // معرفة الدرس التالي
    async getNextLesson(courseId, currentLessonId) {
      const lessons = await this.getLessons(courseId);

      const index = lessons.findIndex(
        lesson => lesson.id === currentLessonId
      );

      if (index === -1 || index >= lessons.length - 1) {
        return null;
      }

      const next = lessons[index + 1];

      const access = await this.canOpenLesson(
        courseId,
        next.id
      );

      return access.allowed ? next : null;
    },

    // معرفة الدرس السابق
    async getPreviousLesson(courseId, currentLessonId) {
      const lessons = await this.getLessons(courseId);

      const index = lessons.findIndex(
        lesson => lesson.id === currentLessonId
      );

      if (index <= 0) {
        return null;
      }

      return lessons[index - 1];
    },

    // ملخص تعلم المستخدم
    async getLearningDashboard() {
      const user = this.requireUser();

      const courses = await this.getCourses({
        limit: 100
      });

      const progressRecords = await this.database.find(
        "progress",
        "uid",
        "==",
        user.uid,
        1000
      );

      const completedLessons = progressRecords.filter(
        record => record.completed
      ).length;

      const activeCourseIds = [
        ...new Set(progressRecords.map(record => record.courseId))
      ];

      return {
        coursesCount: courses.length,
        activeCourses: activeCourseIds.length,
        completedLessons,
        progressRecords
      };
    },

    // التسجيل في دورة
    async enroll(courseId) {
      const user = this.requireUser();

      const course = await this.getCourse(courseId);

      if (!course) {
        throw new Error("الدورة غير موجودة أو غير منشورة.");
      }

      const id = `${user.uid}_${courseId}`;

      const existing = await this.database.get(
        "enrollments",
        id
      );

      if (existing) {
        return existing;
      }

      await this.database.set(
        "enrollments",
        id,
        {
          uid: user.uid,
          courseId,
          status: "active",
          enrolledAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      );

      document.dispatchEvent(
        new CustomEvent("hanoon:course-enrolled", {
          detail: {
            courseId,
            userId: user.uid
          }
        })
      );

      return id;
    },

    // دورات المستخدم المسجل بها
    async getMyCourses() {
      const user = this.requireUser();

      const enrollments = await this.database.find(
        "enrollments",
        "uid",
        "==",
        user.uid,
        100
      );

      const results = await Promise.all(
        enrollments.map(async enrollment => {
          const course = await this.getCourse(
            enrollment.courseId
          );

          if (!course) return null;

          const progress = await this.calculateProgress(
            enrollment.courseId
          );

          return {
            ...course,
            enrollmentId: enrollment.id,
            progress
          };
        })
      );

      return results.filter(Boolean);
    },

    // عرض المسارات التعليمية
    renderCourses(courses, container) {
      if (typeof container === "string") {
        container = document.querySelector(container);
      }

      if (!container) {
        throw new Error("عنصر عرض الدورات غير موجود.");
      }

      container.replaceChildren();

      if (!courses.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "لا توجد دورات متاحة حاليًا.";
        container.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      courses.forEach(course => {
        const card = document.createElement("article");
        card.className = "course-card";

        if (course.coverURL) {
          const image = document.createElement("img");
          image.src = course.coverURL;
          image.alt = course.title || "غلاف الدورة";
          image.loading = "lazy";
          card.appendChild(image);
        }

        const title = document.createElement("h3");
        title.textContent = course.title || "دورة تعليمية";

        const description = document.createElement("p");
        description.textContent =
          course.description || "";

        const level = document.createElement("span");
        level.className = "course-level";
        level.textContent = course.level || "عام";

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "استكشف الدورة";
        button.dataset.openCourse = course.id;

        card.append(title, description, level, button);
        fragment.appendChild(card);
      });

      container.appendChild(fragment);
    },

    // عرض دروس الدورة
    async renderLessons(courseId, container) {
      if (typeof container === "string") {
        container = document.querySelector(container);
      }

      if (!container) {
        throw new Error("عنصر عرض الدروس غير موجود.");
      }

      const lessons = await this.getLessons(courseId);
      const progress = await this.getProgress(courseId);

      const completedIds = new Set(
        progress
          .filter(item => item.completed)
          .map(item => item.lessonId)
      );

      container.replaceChildren();

      const fragment = document.createDocumentFragment();

      for (const lesson of lessons) {
        const access = await this.canOpenLesson(
          courseId,
          lesson.id
        );

        const item = document.createElement("article");
        item.className = "lesson-item";

        const title = document.createElement("h3");
        title.textContent = lesson.title || "درس بدون عنوان";

        const description = document.createElement("p");
        description.textContent = lesson.description || "";

        const status = document.createElement("span");

        if (completedIds.has(lesson.id)) {
          status.textContent = "مكتمل";
          status.className = "lesson-completed";
        } else if (access.allowed) {
          status.textContent = "متاح";
          status.className = "lesson-available";
        } else {
          status.textContent = "مغلق";
          status.className = "lesson-locked";
        }

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = access.allowed
          ? "ابدأ الدرس"
          : "أكمل المتطلبات أولاً";

        button.disabled = !access.allowed;
        button.dataset.openLesson = lesson.id;
        button.dataset.courseId = courseId;

        item.append(title, description, status, button);
        fragment.appendChild(item);
      }

      container.appendChild(fragment);
    },

    // ربط أزرار فتح الدروس
    bindLessonButtons() {
      document.addEventListener("click", async event => {
        const button = event.target.closest(
          "[data-open-lesson]"
        );

        if (!button) return;

        const courseId = button.dataset.courseId;
        const lessonId = button.dataset.openLesson;

        try {
          const lesson = await this.openLesson(
            courseId,
            lessonId
          );

          const target = new URL(
            "pages/lesson.html",
            document.baseURI
          );

          target.searchParams.set("id", lesson.id);
          target.searchParams.set("course", courseId);

          window.location.href = target.href;
        } catch (error) {
          HANOON.toast?.(
            error.message || "تعذر فتح الدرس",
            "warning"
          );
        }
      });
    },

    // ربط زر إكمال الدرس
    bindCompleteButtons() {
      document.addEventListener("click", async event => {
        const button = event.target.closest(
          "[data-complete-lesson]"
        );

        if (!button) return;

        const courseId = button.dataset.courseId;
        const lessonId = button.dataset.completeLesson;

        try {
          button.disabled = true;

          await this.completeLesson(
            courseId,
            lessonId
          );

          HANOON.toast?.(
            "تم تسجيل إكمال الدرس",
            "success"
          );

          button.textContent = "تم إكمال الدرس";

          button.classList.add("is-completed");

        } catch (error) {
          HANOON.toast?.(
            error.message || "تعذر إكمال الدرس",
            "error"
          );

          button.disabled = false;
        }
      });
    },

    // ربط أزرار استكشاف الدورات
    bindCourseButtons() {
      document.addEventListener("click", event => {
        const button = event.target.closest(
          "[data-open-course]"
        );

        if (!button) return;

        const courseId = button.dataset.openCourse;

        if (!courseId) return;

        const target = new URL(
          "pages/course.html",
          document.baseURI
        );

        target.searchParams.set("id", courseId);

        window.location.href = target.href;
      });
    },

    // تشغيل النظام
    init() {
      if (this.initialized) return;

      this.bindLessonButtons();
      this.bindCompleteButtons();
      this.bindCourseButtons();

      this.initialized = true;
    }
  };

  HANOON.Learning = Learning;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Learning.init(),
      { once: true }
    );
  } else {
    Learning.init();
  }
})();
