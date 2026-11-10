
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Database = {
    initialized: false,
    db: null,

    // الحصول على قاعدة البيانات
    getDB() {
      const database =
        this.db ||
        HANOON.firebase?.db ||
        window.firebase?.firestore?.();

      if (!database) {
        throw new Error(
          "قاعدة Firestore غير مهيأة. راجع إعداد Firebase أولاً."
        );
      }

      return database;
    },

    // أسماء مجموعات قاعدة البيانات
    collections: {
      users: "users",
      books: "books",
      articles: "articles",
      stories: "stories",
      poetry: "poetry",
      research: "research",
      courses: "courses",
      lessons: "lessons",
      exams: "exams",
      results: "examResults",
      progress: "learningProgress",
      posts: "communityPosts",
      comments: "comments",
      notifications: "notifications",
      reports: "reports",
      follows: "follows",
      likes: "likes",
      achievements: "achievements",
      settings: "settings",
      activity: "activityLogs"
    },

    // الحصول على مرجع مجموعة
    collection(name) {
      const collectionName = this.collections[name];

      if (!collectionName) {
        throw new Error(`مجموعة غير معروفة: ${name}`);
      }

      return this.getDB().collection(collectionName);
    },

    // إنشاء سجل جديد بمعرف تلقائي
    async create(name, data) {
      if (!data || typeof data !== "object") {
        throw new Error("بيانات السجل غير صالحة.");
      }

      const ref = await this.collection(name).add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return ref.id;
    },

    // إنشاء أو استبدال سجل بمعرف محدد
    async set(name, id, data, merge = false) {
      if (!id || !data || typeof data !== "object") {
        throw new Error("يجب تحديد المعرف والبيانات.");
      }

      await this.collection(name).doc(id).set(
        {
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge }
      );

      return true;
    },

    // قراءة سجل واحد
    async get(name, id) {
      if (!id) {
        throw new Error("يجب تحديد معرف السجل.");
      }

      const snapshot = await this.collection(name).doc(id).get();

      if (!snapshot.exists) return null;

      return {
        id: snapshot.id,
        ...snapshot.data()
      };
    },

    // قراءة مجموعة كاملة
    async getAll(name, options = {}) {
      let query = this.collection(name);

      if (options.where) {
        options.where.forEach(condition => {
          query = query.where(
            condition.field,
            condition.operator,
            condition.value
          );
        });
      }

      if (options.orderBy) {
        query = query.orderBy(
          options.orderBy.field,
          options.orderBy.direction || "desc"
        );
      }

      if (Number.isInteger(options.limit) && options.limit > 0) {
        query = query.limit(options.limit);
      }

      if (options.startAfter) {
        query = query.startAfter(options.startAfter);
      }

      const snapshot = await query.get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    // تحديث سجل
    async update(name, id, data) {
      if (!id || !data || typeof data !== "object") {
        throw new Error("بيانات التحديث غير صالحة.");
      }

      await this.collection(name).doc(id).update({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return true;
    },

    // حذف سجل
    async delete(name, id) {
      if (!id) {
        throw new Error("يجب تحديد معرف السجل.");
      }

      await this.collection(name).doc(id).delete();

      return true;
    },

    // البحث عن سجلات باستخدام شرط
    async find(name, field, operator, value, limit = 20) {
      const snapshot = await this.collection(name)
        .where(field, operator, value)
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    // مراقبة سجل لحظيًا
    listen(name, id, callback) {
      if (typeof callback !== "function") {
        throw new Error("يجب توفير دالة لاستقبال التغييرات.");
      }

      return this.collection(name).doc(id).onSnapshot(snapshot => {
        callback(
          snapshot.exists
            ? { id: snapshot.id, ...snapshot.data() }
            : null
        );
      });
    },

    // مراقبة مجموعة لحظيًا
    listenCollection(name, callback, options = {}) {
      if (typeof callback !== "function") {
        throw new Error("يجب توفير دالة لاستقبال البيانات.");
      }

      let query = this.collection(name);

      if (options.where) {
        options.where.forEach(condition => {
          query = query.where(
            condition.field,
            condition.operator,
            condition.value
          );
        });
      }

      if (options.orderBy) {
        query = query.orderBy(
          options.orderBy.field,
          options.orderBy.direction || "desc"
        );
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      return query.onSnapshot(snapshot => {
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        callback(records);
      });
    },

    // إنشاء ملف مستخدم أول مرة
    async createUserProfile(user, extraData = {}) {
      if (!user?.uid) {
        throw new Error("بيانات الحساب غير متوفرة.");
      }

      const ref = this.collection("users").doc(user.uid);
      const existing = await ref.get();

      if (existing.exists) {
        return {
          id: existing.id,
          ...existing.data()
        };
      }

      const profile = {
        uid: user.uid,
        name: user.displayName || "مستخدم هنون",
        email: user.email || "",
        photoURL: user.photoURL || "",
        bio: "",
        username: "",
        userCode: "",
        role: "user",
        points: 0,
        level: 1,
        totalLessonsCompleted: 0,
        totalExamsCompleted: 0,
        totalBooksRead: 0,
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extraData
      };

      await ref.set(profile);

      return {
        id: user.uid,
        ...profile
      };
    },

    // قراءة ملف المستخدم
    async getUserProfile(uid) {
      return this.get("users", uid);
    },

    // تحديث ملف المستخدم
    async updateUserProfile(uid, data) {
      const allowedFields = [
        "name",
        "photoURL",
        "bio",
        "username",
        "userCode",
        "location",
        "website",
        "socialLinks"
      ];

      const safeData = {};

      Object.keys(data || {}).forEach(key => {
        if (allowedFields.includes(key)) {
          safeData[key] = data[key];
        }
      });

      if (Object.keys(safeData).length === 0) {
        throw new Error("لا توجد بيانات صالحة للتحديث.");
      }

      return this.update("users", uid, safeData);
    },

    // زيادة نقاط المستخدم
    async addPoints(uid, points, reason = "activity") {
      if (!Number.isFinite(points) || points <= 0) {
        throw new Error("عدد النقاط غير صالح.");
      }

      const ref = this.collection("users").doc(uid);

      await this.getDB().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists) {
          throw new Error("ملف المستخدم غير موجود.");
        }

        const currentPoints = snapshot.data().points || 0;

        transaction.update(ref, {
          points: currentPoints + points,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await this.create("activity", {
        uid,
        type: "points",
        amount: points,
        reason
      });

      return true;
    },

    // حفظ تقدم المستخدم في درس
    async saveLessonProgress(uid, courseId, lessonId, progress = {}) {
      if (!uid || !courseId || !lessonId) {
        throw new Error("بيانات الدرس غير مكتملة.");
      }

      const id = `${uid}_${courseId}_${lessonId}`;

      await this.set("progress", id, {
        uid,
        courseId,
        lessonId,
        completed: Boolean(progress.completed),
        lastPosition: progress.lastPosition || 0,
        score: progress.score ?? null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, true);

      return id;
    },

    // جلب تقدم المستخدم في دورة
    async getCourseProgress(uid, courseId) {
      return this.find(
        "progress",
        "uid",
        "==",
        uid
      ).then(records =>
        records.filter(record => record.courseId === courseId)
      );
    },

    // حفظ نتيجة اختبار
    async saveExamResult(uid, examId, result) {
      if (!uid || !examId || !result) {
        throw new Error("بيانات نتيجة الاختبار غير مكتملة.");
      }

      return this.create("results", {
        uid,
        examId,
        score: Number(result.score || 0),
        total: Number(result.total || 0),
        percentage: Number(result.percentage || 0),
        answers: result.answers || [],
        passed: Boolean(result.passed)
      });
    },

    // إنشاء إشعار لمستخدم
    async createNotification(uid, notification) {
      if (!uid || !notification?.title) {
        throw new Error("بيانات الإشعار غير مكتملة.");
      }

      return this.create("notifications", {
        uid,
        title: notification.title,
        message: notification.message || "",
        type: notification.type || "general",
        link: notification.link || "",
        read: false
      });
    },

    // جلب إشعارات المستخدم
    async getUserNotifications(uid, limit = 30) {
      return this.getAll("notifications", {
        where: [
          { field: "uid", operator: "==", value: uid }
        ],
        orderBy: {
          field: "createdAt",
          direction: "desc"
        },
        limit
      });
    },

    // تعليم الإشعار كمقروء
    async markNotificationRead(id) {
      return this.update("notifications", id, {
        read: true
      });
    },

    // تسجيل إعجاب بمنشور
    async likePost(postId, uid) {
      if (!postId || !uid) {
        throw new Error("بيانات الإعجاب غير مكتملة.");
      }

      const id = `${postId}_${uid}`;
      const ref = this.collection("likes").doc(id);

      await this.getDB().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);

        if (snapshot.exists) {
          transaction.delete(ref);
        } else {
          transaction.set(ref, {
            postId,
            uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      return true;
    },

    // إضافة تعليق
    async addComment(postId, uid, text) {
      text = String(text || "").trim();

      if (!postId || !uid || !text) {
        throw new Error("اكتب التعليق أولاً.");
      }

      if (text.length > 3000) {
        throw new Error("التعليق طويل جدًا.");
      }

      return this.create("comments", {
        postId,
        uid,
        text,
        edited: false
      });
    },

    // إنشاء منشور
    async createPost(uid, content, media = null) {
      content = String(content || "").trim();

      if (!uid || (!content && !media)) {
        throw new Error("المنشور فارغ.");
      }

      if (content.length > 10000) {
        throw new Error("المنشور طويل جدًا.");
      }

      return this.create("posts", {
        uid,
        content,
        media,
        likesCount: 0,
        commentsCount: 0,
        visibility: "public"
      });
    },

    // البحث عن مستخدم باستخدام UID أو اسم المستخدم
    async searchUser(value) {
      value = String(value || "").trim();

      if (!value) return [];

      const exactUid = await this.getUserProfile(value);

      if (exactUid) return [exactUid];

      const usernameResults = await this.find(
        "users",
        "username",
        "==",
        value.toLowerCase(),
        10
      );

      if (usernameResults.length) return usernameResults;

      return this.find(
        "users",
        "userCode",
        "==",
        value.toUpperCase(),
        10
      );
    },

    // تجهيز قاعدة البيانات
    init() {
      if (this.initialized) return;

      this.db =
        HANOON.firebase?.db ||
        window.firebase?.firestore?.() ||
        null;

      this.initialized = true;
    }
  };

  HANOON.Database = Database;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Database.init(),
      { once: true }
    );
  } else {
    Database.init();
  }
})();
