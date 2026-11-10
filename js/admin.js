
(function () {
  "use strict";

  const H = window.HANOON = window.HANOON || {};

  const Admin = {
    state: {
      user: null,
      stats: null,
      users: [],
      reports: [],
      loading: false
    },

    db() {
      if (!window.firebase || !firebase.firestore) {
        throw new Error("Firebase Firestore غير مهيأ");
      }

      return firebase.firestore();
    },

    currentUser() {
      if (H.Auth && typeof H.Auth.getCurrentUser === "function") {
        return H.Auth.getCurrentUser();
      }

      return window.firebase?.auth
        ? firebase.auth().currentUser
        : null;
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    toast(message, type = "info") {
      if (H.UI?.toast) {
        H.UI.toast(message, type);
      } else {
        console.info("[HANOON Admin]", message);
      }
    },

    async authorize() {
      const user = this.currentUser();

      if (!user) {
        this.toast("يجب تسجيل الدخول أولًا", "warning");
        return false;
      }

      try {
        const doc = await this.db()
          .collection("users")
          .doc(user.uid)
          .get();

        if (!doc.exists || doc.data().role !== "admin") {
          this.toast("ليس لديك صلاحية دخول لوحة الإدارة", "error");

          document.querySelectorAll("[data-admin-panel]")
            .forEach(el => el.hidden = true);

          return false;
        }

        this.state.user = {
          uid: user.uid,
          ...doc.data()
        };

        return true;
      } catch (error) {
        console.error("Admin authorization error:", error);
        this.toast("تعذر التحقق من الصلاحيات", "error");
        return false;
      }
    },

    async loadStats() {
      const db = this.db();

      const collections = [
        "users",
        "books",
        "articles",
        "stories",
        "poetry",
        "research",
        "courses",
        "communityPosts"
      ];

      const counts = await Promise.all(
        collections.map(async name => {
          const snapshot = await db.collection(name)
            .limit(500)
            .get();

          return [name, snapshot.size];
        })
      );

      const stats = Object.fromEntries(counts);

      this.state.stats = stats;

      const mapping = {
        users: "users",
        books: "books",
        articles: "articles",
        stories: "stories",
        poetry: "poetry",
        research: "research",
        courses: "courses",
        communityPosts: "posts"
      };

      Object.entries(mapping).forEach(([key, attribute]) => {
        document.querySelectorAll(`[data-admin-stat="${attribute}"]`)
          .forEach(el => {
            el.textContent = stats[key].toLocaleString("ar-EG");
          });
      });

      return stats;
    },

    async loadUsers() {
      const container = document.querySelector("[data-admin-users]");
      if (container) {
        container.innerHTML = '<p>جاري تحميل المستخدمين...</p>';
      }

      try {
        const snapshot = await this.db()
          .collection("users")
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();

        this.state.users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (container) {
          container.innerHTML = this.state.users.map(user => `
            <div class="admin-user-row">
              <div>
                <strong>${this.escape(user.displayName || "مستخدم")}</strong>
                <small>${this.escape(user.email || "")}</small>
                <small>@${this.escape(user.username || "")}</small>
              </div>

              <span>${this.escape(user.role || "user")}</span>

              <select data-user-role="${this.escape(user.id)}">
                <option value="user" ${user.role !== "admin" ? "selected" : ""}>عضو</option>
                <option value="admin" ${user.role === "admin" ? "selected" : ""}>مدير</option>
              </select>

              <button
                type="button"
                data-user-save="${this.escape(user.id)}"
              >حفظ الصلاحية</button>
            </div>
          `).join("");
        }

        return this.state.users;
      } catch (error) {
        console.error("Load admin users error:", error);
        if (container) container.textContent = "تعذر تحميل المستخدمين";
        return [];
      }
    },

    async changeUserRole(userId, role) {
      if (!await this.authorize()) return false;

      if (!["user", "admin"].includes(role)) {
        this.toast("الصلاحية غير صحيحة", "warning");
        return false;
      }

      if (userId === this.state.user.uid && role !== "admin") {
        this.toast("لا يمكنك إزالة صلاحية الإدارة من حسابك هنا", "warning");
        return false;
      }

      if (!window.confirm("هل تريد تغيير صلاحية هذا المستخدم؟")) {
        return false;
      }

      try {
        await this.db()
          .collection("users")
          .doc(userId)
          .update({
            role,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

        this.toast("تم تحديث الصلاحية", "success");
        await this.loadUsers();

        return true;
      } catch (error) {
        console.error("Change user role error:", error);
        this.toast("تعذر تحديث الصلاحية", "error");
        return false;
      }
    },

    async loadReports() {
      const container = document.querySelector("[data-admin-reports]");

      try {
        const snapshot = await this.db()
          .collection("reports")
          .where("status", "==", "pending")
          .limit(100)
          .get();

        this.state.reports = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (container) {
          container.innerHTML = this.state.reports.length
            ? this.state.reports.map(report => `
                <article class="admin-report">
                  <strong>${this.escape(report.targetType)}</strong>
                  <p>${this.escape(report.reason)}</p>
                  <small>المستخدم: ${this.escape(report.reporterId)}</small>

                  <button
                    type="button"
                    data-report-resolve="${this.escape(report.id)}"
                  >تمت المراجعة</button>
                </article>
              `).join("")
            : '<p class="empty-state">لا توجد بلاغات معلقة</p>';
        }

        return this.state.reports;
      } catch (error) {
        console.error("Load reports error:", error);
        if (container) container.textContent = "تعذر تحميل البلاغات";
        return [];
      }
    },

    async resolveReport(reportId) {
      if (!await this.authorize()) return false;

      try {
        await this.db()
          .collection("reports")
          .doc(reportId)
          .update({
            status: "reviewed",
            reviewedBy: this.state.user.uid,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

        this.toast("تم تسجيل مراجعة البلاغ", "success");
        await this.loadReports();

        return true;
      } catch (error) {
        console.error("Resolve report error:", error);
        this.toast("تعذرت مراجعة البلاغ", "error");
        return false;
      }
    },

    async saveContent(collection, data, id = null) {
      if (!await this.authorize()) return false;

      const allowed = [
        "books",
        "articles",
        "stories",
        "poetry",
        "research",
        "courses"
      ];

      if (!allowed.includes(collection)) {
        this.toast("نوع المحتوى غير مسموح", "error");
        return false;
      }

      const title = String(data.title || "").trim();
      const body = String(data.body || "").trim();

      if (!title || title.length > 200) {
        this.toast("أدخل عنوانًا صحيحًا", "warning");
        return false;
      }

      try {
        const record = {
          title,
          body,
          description: String(data.description || "").trim(),
          cover: String(data.cover || "").trim(),
          category: String(data.category || "general").trim(),
          status: data.status === "draft" ? "draft" : "published",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.state.user.uid
        };

        const ref = this.db().collection(collection);

        if (id) {
          await ref.doc(id).update(record);
        } else {
          record.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          record.createdBy = this.state.user.uid;
          await ref.add(record);
        }

        this.toast("تم حفظ المحتوى", "success");
        return true;
      } catch (error) {
        console.error("Save content error:", error);
        this.toast("تعذر حفظ المحتوى", "error");
        return false;
      }
    },

    async deleteContent(collection, id) {
      if (!await this.authorize()) return false;

      const allowed = [
        "books",
        "articles",
        "stories",
        "poetry",
        "research",
        "courses"
      ];

      if (!allowed.includes(collection)) return false;

      if (!window.confirm("هل أنت متأكد من حذف هذا المحتوى؟")) {
        return false;
      }

      try {
        await this.db()
          .collection(collection)
          .doc(id)
          .update({
            status: "deleted",
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: this.state.user.uid
          });

        this.toast("تم حذف المحتوى", "success");
        return true;
      } catch (error) {
        console.error("Delete content error:", error);
        this.toast("تعذر حذف المحتوى", "error");
        return false;
      }
    },

    bindEvents() {
      if (this._eventsBound) return;
      this._eventsBound = true;

      document.addEventListener("click", async event => {
        const saveRole = event.target.closest("[data-user-save]");
        const resolve = event.target.closest("[data-report-resolve]");
        const refresh = event.target.closest("[data-admin-refresh]");

        if (saveRole) {
          const userId = saveRole.getAttribute("data-user-save");
          const select = document.querySelector(
            `[data-user-role="${CSS.escape(userId)}"]`
          );

          if (select) {
            await this.changeUserRole(userId, select.value);
          }
        }

        if (resolve) {
          await this.resolveReport(
            resolve.getAttribute("data-report-resolve")
          );
        }

        if (refresh) {
          await this.refresh();
        }
      });

      document.addEventListener("submit", async event => {
        const form = event.target.closest("[data-admin-content-form]");
        if (!form) return;

        event.preventDefault();

        const data = Object.fromEntries(new FormData(form).entries());
        const collection = form.dataset.collection;
        const id = form.dataset.id || null;

        const saved = await this.saveContent(collection, data, id);

        if (saved && !id) form.reset();
      });
    },

    async refresh() {
      if (!await this.authorize()) return false;

      await Promise.all([
        this.loadStats(),
        this.loadUsers(),
        this.loadReports()
      ]);

      return true;
    },

    async init() {
      this.bindEvents();

      if (!document.querySelector("[data-admin-panel]")) return;

      this.state.loading = true;

      try {
        const authorized = await this.authorize();

        if (authorized) {
          document.querySelectorAll("[data-admin-panel]")
            .forEach(el => el.hidden = false);

          await this.refresh();
        }
      } finally {
        this.state.loading = false;
      }
    }
  };

  H.Admin = Admin;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Admin.init());
  } else {
    Admin.init();
  }
})();
