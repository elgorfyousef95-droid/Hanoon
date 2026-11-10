
(function () {
  "use strict";

  const H = window.HANOON = window.HANOON || {};

  const Notifications = {
    state: {
      items: [],
      unsubscribe: null,
      loading: false
    },

    db() {
      if (!window.firebase || !firebase.firestore) {
        throw new Error("Firebase Firestore غير مهيأ");
      }
      return firebase.firestore();
    },

    user() {
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

    toast(message) {
      if (H.UI?.toast) H.UI.toast(message);
      else console.info("[HANOON Notifications]", message);
    },

    collection() {
      return this.db().collection("notifications");
    },

    async create(data) {
      const required = ["recipientId", "type", "title"];

      for (const field of required) {
        if (!data[field]) {
          throw new Error(`بيانات الإشعار ناقصة: ${field}`);
        }
      }

      const notification = {
        recipientId: data.recipientId,
        senderId: data.senderId || "",
        senderName: data.senderName || "",
        senderPhoto: data.senderPhoto || "",
        type: data.type,
        title: data.title,
        body: data.body || "",
        targetId: data.targetId || "",
        targetType: data.targetType || "",
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const ref = await this.collection().add(notification);
      return ref.id;
    },

    async load() {
      const user = this.user();
      if (!user) return [];

      this.state.loading = true;

      try {
        const snapshot = await this.collection()
          .where("recipientId", "==", user.uid)
          .limit(100)
          .get();

        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        items.sort((a, b) => this.toMillis(b.createdAt) - this.toMillis(a.createdAt));

        this.state.items = items;
        this.render(items);

        return items;
      } catch (error) {
        console.error("Notifications load error:", error);
        this.toast("تعذر تحميل الإشعارات");
        return [];
      } finally {
        this.state.loading = false;
      }
    },

    listen() {
      const user = this.user();
      if (!user) return;

      this.stopListening();

      this.state.unsubscribe = this.collection()
        .where("recipientId", "==", user.uid)
        .limit(100)
        .onSnapshot(snapshot => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          items.sort((a, b) => this.toMillis(b.createdAt) - this.toMillis(a.createdAt));

          this.state.items = items;
          this.render(items);
          this.updateBadge(items);
        }, error => {
          console.error("Notifications listener error:", error);
        });
    },

    stopListening() {
      if (typeof this.state.unsubscribe === "function") {
        this.state.unsubscribe();
      }

      this.state.unsubscribe = null;
    },

    toMillis(value) {
      if (!value) return 0;
      if (typeof value.toMillis === "function") return value.toMillis();
      if (value.seconds) return value.seconds * 1000;

      const result = new Date(value).getTime();
      return Number.isNaN(result) ? 0 : result;
    },

    formatDate(value) {
      const timestamp = this.toMillis(value);
      if (!timestamp) return "الآن";

      return new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    },

    icon(type) {
      const icons = {
        like: "♥",
        comment: "◌",
        follow: "＋",
        reply: "↩",
        achievement: "★",
        points: "✦",
        system: "●",
        message: "✉"
      };

      return icons[type] || "•";
    },

    render(items) {
      const container = document.querySelector("[data-notifications-list]");
      if (!container) return;

      if (!items.length) {
        container.innerHTML = '<div class="empty-state">لا توجد إشعارات حتى الآن</div>';
        return;
      }

      container.innerHTML = items.map(item => `
        <article
          class="notification-item ${item.read ? "is-read" : "is-unread"}"
          data-notification-id="${this.escape(item.id)}"
        >
          <div class="notification-icon">
            ${this.icon(item.type)}
          </div>

          <div class="notification-content">
            <strong>${this.escape(item.title)}</strong>
            <p>${this.escape(item.body)}</p>
            <time>${this.formatDate(item.createdAt)}</time>
          </div>

          <div class="notification-actions">
            ${!item.read
              ? `<button type="button" data-mark-read="${this.escape(item.id)}">تمت القراءة</button>`
              : ""
            }
          </div>
        </article>
      `).join("");
    },

    updateBadge(items) {
      const unread = items.filter(item => !item.read).length;

      document.querySelectorAll("[data-notification-count]").forEach(el => {
        el.textContent = unread.toLocaleString("ar-EG");
        el.hidden = unread === 0;
      });

      document.querySelectorAll("[data-notification-badge]").forEach(el => {
        el.textContent = unread > 99 ? "99+" : String(unread);
        el.hidden = unread === 0;
      });
    },

    async markRead(notificationId) {
      const user = this.user();
      if (!user) return false;

      try {
        const ref = this.collection().doc(notificationId);

        await this.db().runTransaction(async transaction => {
          const doc = await transaction.get(ref);

          if (!doc.exists) throw new Error("الإشعار غير موجود");

          if (doc.data().recipientId !== user.uid) {
            throw new Error("غير مسموح بتعديل هذا الإشعار");
          }

          transaction.update(ref, {
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        await this.load();
        return true;
      } catch (error) {
        console.error("Mark notification read error:", error);
        this.toast("تعذر تحديث الإشعار");
        return false;
      }
    },

    async markAllRead() {
      const user = this.user();
      if (!user) return false;

      try {
        const snapshot = await this.collection()
          .where("recipientId", "==", user.uid)
          .where("read", "==", false)
          .limit(100)
          .get();

        const batch = this.db().batch();

        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        await batch.commit();
        await this.load();

        this.toast("تم تحديد الإشعارات كمقروءة");
        return true;
      } catch (error) {
        console.error("Mark all read error:", error);
        this.toast("تعذر تحديث الإشعارات");
        return false;
      }
    },

    async delete(notificationId) {
      const user = this.user();
      if (!user) return false;

      try {
        const ref = this.collection().doc(notificationId);

        await this.db().runTransaction(async transaction => {
          const doc = await transaction.get(ref);

          if (!doc.exists) return;

          if (doc.data().recipientId !== user.uid) {
            throw new Error("غير مسموح بحذف هذا الإشعار");
          }

          transaction.delete(ref);
        });

        await this.load();
        return true;
      } catch (error) {
        console.error("Delete notification error:", error);
        this.toast("تعذر حذف الإشعار");
        return false;
      }
    },

    bindEvents() {
      if (this._eventsBound) return;
      this._eventsBound = true;

      document.addEventListener("click", async event => {
        const markButton = event.target.closest("[data-mark-read]");
        const allButton = event.target.closest("[data-mark-all-read]");
        const deleteButton = event.target.closest("[data-delete-notification]");

        if (markButton) {
          await this.markRead(markButton.getAttribute("data-mark-read"));
        }

        if (allButton) {
          await this.markAllRead();
        }

        if (deleteButton) {
          await this.delete(
            deleteButton.getAttribute("data-delete-notification")
          );
        }
      });
    },

    init() {
      this.bindEvents();

      if (this.user()) {
        this.load();
        this.listen();
      }
    }
  };

  H.Notifications = Notifications;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Notifications.init());
  } else {
    Notifications.init();
  }
})();
