
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Exams = {
    initialized: false,
    activeExam: null,
    answers: {},
    startedAt: null,
    submitted: false,

    get database() {
      if (!HANOON.Database) {
        throw new Error("نظام قاعدة البيانات غير محمل.");
      }
      return HANOON.Database;
    },

    get user() {
      return HANOON.Auth?.currentUser || null;
    },

    requireUser() {
      if (!this.user) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }
      return this.user;
    },

    // جلب اختبار
    async getExam(examId) {
      if (!examId) {
        throw new Error("معرف الاختبار غير موجود.");
      }

      const exam = await this.database.get("exams", examId);

      if (!exam || exam.status !== "published") {
        throw new Error("الاختبار غير متاح.");
      }

      return exam;
    },

    // جلب أسئلة الاختبار
    async getQuestions(examId) {
      return this.database.getAll("examQuestions", {
        where: [
          { field: "examId", operator: "==", value: examId },
          { field: "status", operator: "==", value: "published" }
        ],
        orderBy: {
          field: "order",
          direction: "asc"
        },
        limit: 200
      });
    },

    // التحقق من صلاحية دخول الاختبار
    async canStart(examId) {
      const user = this.requireUser();
      const exam = await this.getExam(examId);

      const attempts = await this.database.find(
        "examAttempts",
        "uid",
        "==",
        user.uid,
        500
      );

      const examAttempts = attempts.filter(
        item => item.examId === examId
      );

      const maximum = Number(exam.maxAttempts || 0);

      if (maximum > 0 && examAttempts.length >= maximum) {
        return {
          allowed: false,
          reason: "لقد وصلت إلى الحد الأقصى للمحاولات."
        };
      }

      return {
        allowed: true,
        exam,
        attempts: examAttempts.length
      };
    },

    // بدء الاختبار
    async start(examId) {
      if (this.activeExam && !this.submitted) {
        throw new Error("لديك اختبار مفتوح بالفعل.");
      }

      const access = await this.canStart(examId);

      if (!access.allowed) {
        throw new Error(access.reason);
      }

      const questions = await this.getQuestions(examId);

      if (!questions.length) {
        throw new Error("لا توجد أسئلة منشورة لهذا الاختبار.");
      }

      this.activeExam = {
        ...access.exam,
        questions
      };

      this.answers = {};
      this.startedAt = Date.now();
      this.submitted = false;

      document.dispatchEvent(
        new CustomEvent("hanoon:exam-started", {
          detail: { examId }
        })
      );

      return {
        exam: this.activeExam,
        questions: questions.map(question => ({
          id: question.id,
          text: question.text,
          options: question.options || [],
          type: question.type || "multiple-choice"
        }))
      };
    },

    // حفظ إجابة
    answer(questionId, answer) {
      if (!this.activeExam || this.submitted) {
        throw new Error("لا يوجد اختبار نشط.");
      }

      const question = this.activeExam.questions.find(
        item => item.id === questionId
      );

      if (!question) {
        throw new Error("السؤال غير موجود.");
      }

      this.answers[questionId] = answer;

      return true;
    },

    // عدد الإجابات
    getAnsweredCount() {
      return Object.keys(this.answers).filter(
        id => this.answers[id] !== undefined &&
              this.answers[id] !== null &&
              this.answers[id] !== ""
      ).length;
    },

    // تصحيح الإجابات
    calculateResult() {
      if (!this.activeExam) {
        throw new Error("لا يوجد اختبار نشط.");
      }

      let score = 0;
      let total = 0;

      const details = this.activeExam.questions.map(question => {
        const points = Number(question.points || 1);
        total += points;

        const given = this.answers[question.id];
        const correct = this.compareAnswers(
          given,
          question.correctAnswer
        );

        if (correct) {
          score += points;
        }

        return {
          questionId: question.id,
          correct,
          points: correct ? points : 0
        };
      });

      const percentage = total > 0
        ? Math.round((score / total) * 100)
        : 0;

      const passingScore = Number(
        this.activeExam.passingScore ?? 60
      );

      return {
        score,
        total,
        percentage,
        passed: percentage >= passingScore,
        details
      };
    },

    // مقارنة الإجابات
    compareAnswers(given, correct) {
      if (Array.isArray(correct)) {
        if (!Array.isArray(given)) return false;

        return (
          given.length === correct.length &&
          given.every(value => correct.includes(value))
        );
      }

      if (typeof given === "string" &&
          typeof correct === "string") {
        return given.trim() === correct.trim();
      }

      return given === correct;
    },

    // إرسال الاختبار
    async submit() {
      const user = this.requireUser();

      if (!this.activeExam || this.submitted) {
        throw new Error("لا يوجد اختبار قابل للإرسال.");
      }

      const result = this.calculateResult();

      const attempt = {
        examId: this.activeExam.id,
        uid: user.uid,
        answers: this.answers,
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        passed: result.passed,
        duration: Math.max(
          0,
          Math.floor((Date.now() - this.startedAt) / 1000)
        ),
        submittedAt: new Date().toISOString()
      };

      const attemptId = await this.database.create(
        "examAttempts",
        attempt
      );

      await this.database.saveExamResult(
        user.uid,
        this.activeExam.id,
        result
      );

      this.submitted = true;

      const finalResult = {
        ...result,
        attemptId,
        duration: attempt.duration
      };

      document.dispatchEvent(
        new CustomEvent("hanoon:exam-submitted", {
          detail: finalResult
        })
      );

      this.activeExam = null;

      return finalResult;
    },

    // إلغاء الاختبار
    cancel() {
      this.activeExam = null;
      this.answers = {};
      this.startedAt = null;
      this.submitted = true;

      return true;
    },

    // نتائج المستخدم
    async getMyResults(limit = 50) {
      const user = this.requireUser();

      return this.database.getAll("results", {
        where: [
          { field: "uid", operator: "==", value: user.uid }
        ],
        orderBy: {
          field: "createdAt",
          direction: "desc"
        },
        limit
      });
    },

    // محاولات المستخدم
    async getMyAttempts(examId = null) {
      const user = this.requireUser();

      const attempts = await this.database.find(
        "examAttempts",
        "uid",
        "==",
        user.uid,
        500
      );

      return examId
        ? attempts.filter(item => item.examId === examId)
        : attempts;
    },

    // الاختبارات الأسبوعية
    async getWeeklyExams() {
      return this.database.getAll("exams", {
        where: [
          { field: "status", operator: "==", value: "published" },
          { field: "type", operator: "==", value: "weekly" }
        ],
        orderBy: {
          field: "createdAt",
          direction: "desc"
        },
        limit: 30
      });
    },

    // اختبارات فصل معين
    async getChapterExams(chapterId) {
      if (!chapterId) return [];

      return this.database.getAll("exams", {
        where: [
          { field: "chapterId", operator: "==", value: chapterId },
          { field: "status", operator: "==", value: "published" }
        ],
        limit: 50
      });
    },

    // عرض نتيجة الاختبار
    renderResult(result, container) {
      if (typeof container === "string") {
        container = document.querySelector(container);
      }

      if (!container) {
        throw new Error("عنصر عرض النتيجة غير موجود.");
      }

      container.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = result.passed
        ? "أحسنت! لقد اجتزت الاختبار"
        : "حاول مرة أخرى";

      const percentage = document.createElement("strong");
      percentage.textContent = `${result.percentage}%`;

      const score = document.createElement("p");
      score.textContent =
        `درجتك: ${result.score} من ${result.total}`;

      const status = document.createElement("p");
      status.textContent = result.passed
        ? "ناجح"
        : "لم تحقق درجة النجاح";

      container.append(heading, percentage, score, status);
    },

    // ربط نموذج الإجابة
    bindAnswerForms() {
      document.addEventListener("change", event => {
        const input = event.target.closest(
          "[data-exam-answer]"
        );

        if (!input) return;

        const questionId = input.dataset.questionId;

        if (!questionId) return;

        this.answer(questionId, input.value);
      });
    },

    // ربط زر إرسال الاختبار
    bindSubmitButtons() {
      document.addEventListener("click", async event => {
        const button = event.target.closest(
          "[data-exam-submit]"
        );

        if (!button) return;

        try {
          button.disabled = true;

          const result = await this.submit();

          const container = document.querySelector(
            "[data-exam-result]"
          );

          if (container) {
            this.renderResult(result, container);
          }

          HANOON.toast?.(
            result.passed
              ? "مبروك! اجتزت الاختبار"
              : "تم حفظ نتيجتك",
            result.passed ? "success" : "info"
          );

        } catch (error) {
          HANOON.toast?.(
            error.message || "تعذر إرسال الاختبار",
            "error"
          );

          button.disabled = false;
        }
      });
    },

    // ربط بدء الاختبارات
    bindStartButtons() {
      document.addEventListener("click", async event => {
        const button = event.target.closest(
          "[data-start-exam]"
        );

        if (!button) return;

        try {
          button.disabled = true;

          const examId = button.dataset.startExam;

          const started = await this.start(examId);

          document.dispatchEvent(
            new CustomEvent("hanoon:exam-ready", {
              detail: started
            })
          );

        } catch (error) {
          HANOON.toast?.(
            error.message || "تعذر بدء الاختبار",
            "error"
          );
        } finally {
          button.disabled = false;
        }
      });
    },

    // تشغيل النظام
    init() {
      if (this.initialized) return;

      this.bindAnswerForms();
      this.bindSubmitButtons();
      this.bindStartButtons();

      this.initialized = true;
    }
  };

  HANOON.Exams = Exams;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Exams.init(),
      { once: true }
    );
  } else {
    Exams.init();
  }
})();
