
(function () {
  "use strict";

  const H = window.HANOON = window.HANOON || {};
  const DB = H.Database;
  const Auth = H.Auth;
  const Community = H.Community;

  const Profile = {
    state: {
      profile: null,
      loading: false,
      editing: false
    },

    currentUser() {
      if (Auth && typeof Auth.getCurrentUser === "function") {
        return Auth.getCurrentUser();
      }

      if (window.firebase && firebase.auth) {
        return firebase.auth().currentUser;
      }

      return null;
    },

    database() {
      if (!window.firebase || !firebase.firestore) {
        throw new Error("Firebase Firestore غير مهيأ");
      }

      return firebase.firestore();
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
      if (H.UI && typeof H.UI.toast === "function") {
        H.UI.toast(message, type);
      } else if (typeof H.showToast === "function") {
        H.showToast(message, type);
      } else {
        console.info("[HANOON Profile]", message);
      }
    },

    async getProfile(userId) {
      if (!userId) throw new Error("معرف المستخدم غير موجود");

      if (DB && typeof DB.getUserProfile === "function") {
        return await DB.getUserProfile(userId);
      }

      const doc = await this.database()
        .collection("users")
        .doc(userId)
        .get();

      if (!doc.exists) return null;

      return {
        id: doc.id,
        ...doc.data()
      };
    },

    async ensureProfile(user) {
      const existing = await this.getProfile(user.uid);

      if (existing) return existing;

      const profile = {
        uid: user.uid,
        displayName: user.displayName || "مستخدم HANOON",
        email: user.email || "",
        photoURL: user.photoURL || "",
        bio: "",
        username: "user_" + user.uid.slice(0, 8),
        points: 0,
        level: 1,
        role: "user",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.database()
        .collection("users")
        .doc(user.uid)
        .set(profile, { merge: true });

      return profile;
    },

    async load(userId) {
      const user = this.currentUser();
      const targetId = userId || (user && user.uid);

      if (!targetId) {
        this.toast("سجّل دخولك لعرض الملف الشخصي", "warning");
        return null;
      }

      this.state.loading = true;

      try {
        let profile = await this.getProfile(targetId);

        if (!profile && user && user.uid === targetId) {
          profile = await this.ensureProfile(user);
        }

        if (!profile) {
          this.toast("لم يتم العثور على الملف الشخصي", "warning");
          return null;
        }

        this.state.profile = profile;
        this.render(profile);

        return profile;
      } catch (error) {
        console.error("Profile loading error:", error);
        this.toast("تعذر تحميل الملف الشخصي", "error");
        throw error;
      } finally {
        this.state.loading = false;
      }
    },

    render(profile) {
      if (!profile) return;

      const name = this.escape(profile.displayName || "مستخدم HANOON");
      const username = this.escape(profile.username || "");
      const bio = this.escape(profile.bio || "لم يضف نبذة شخصية بعد");
      const photo = this.escape(profile.photoURL || "");
      const points = Number(profile.points || 0);
      const level = Number(profile.level || 1);

      document.querySelectorAll("[data-profile-name]").forEach(el => {
        el.textContent = profile.displayName || "مستخدم HANOON";
      });

      document.querySelectorAll("[data-profile-username]").forEach(el => {
        el.textContent = username ? "@" + username : "";
      });

      document.querySelectorAll("[data-profile-bio]").forEach(el => {
        el.textContent = profile.bio || "لم يضف نبذة شخصية بعد";
      });

      document.querySelectorAll("[data-profile-points]").forEach(el => {
        el.textContent = points.toLocaleString("ar-EG");
      });

      document.querySelectorAll("[data-profile-level]").forEach(el => {
        el.textContent = level.toLocaleString("ar-EG");
      });

      document.querySelectorAll("[data-profile-email]").forEach(el => {
        el.textContent = profile.email || "";
      });

      document.querySelectorAll("[data-profile-avatar]").forEach(el => {
        if (el.tagName === "IMG") {
          el.src = photo || "assets/avatars/default.png";
          el.alt = name;
        } else {
          el.innerHTML = photo
            ? `<img src="${photo}" alt="${name}">`
            : `<span>${name.charAt(0)}</span>`;
        }
      });

      document.querySelectorAll("[data-profile-role]").forEach(el => {
        el.textContent = profile.role === "admin" ? "مدير المنصة" : "عضو";
      });

      const form = document.querySelector("[data-profile-edit-form]");

      if (form) {
        const fields = {
          displayName: profile.displayName || "",
          username: profile.username || "",
          bio: profile.bio || ""
        };

        Object.entries(fields).forEach(([name, value]) => {
          const input = form.querySelector(`[name="${name}"]`);
          if (input && document.activeElement !== input) {
            input.value = value;
          }
        });
      }
    },

    async updateProfile(formData) {
      const user = this.currentUser();

      if (!user) {
        this.toast("سجّل دخولك الأول", "warning");
        return false;
      }

      const displayName = String(formData.displayName || "").trim();
      const username = String(formData.username || "")
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

      const bio = String(formData.bio || "").trim();

      if (displayName.length < 2 || displayName.length > 50) {
        this.toast("الاسم لازم يكون من 2 إلى 50 حرفًا", "warning");
        return false;
      }

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        this.toast("اسم المستخدم يجب أن يكون 3 إلى 24 حرفًا بالإنجليزية أو الأرقام", "warning");
        return false;
      }

      if (bio.length > 250) {
        this.toast("النبذة الشخصية طويلة جدًا", "warning");
        return false;
      }

      try {
        const db = this.database();
        const userRef = db.collection("users").doc(user.uid);

        await db.runTransaction(async transaction => {
          const userDoc = await transaction.get(userRef);

          const existingUsername = await db.collection("usernames")
            .doc(username)
            .get();

          if (
            existingUsername.exists &&
            existingUsername.data().uid !== user.uid
          ) {
            throw new Error("اسم المستخدم مستخدم بالفعل");
          }

          const oldUsername = userDoc.exists
            ? userDoc.data().username
            : null;

          if (oldUsername && oldUsername !== username) {
            transaction.delete(db.collection("usernames").doc(oldUsername));
          }

          transaction.set(db.collection("usernames").doc(username), {
            uid: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          transaction.set(userRef, {
            displayName,
            username,
            bio,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        await user.updateProfile({ displayName });

        this.toast("تم تحديث الملف الشخصي", "success");
        await this.load(user.uid);

        return true;
      } catch (error) {
        console.error("Profile update error:", error);
        this.toast(error.message || "تعذر تحديث الملف الشخصي", "error");
        return false;
      }
    },

    async uploadAvatar(file) {
      const user = this.currentUser();

      if (!user) {
        this.toast("سجّل دخولك الأول", "warning");
        return false;
      }

      if (!file || !file.type.startsWith("image/")) {
        this.toast("اختر صورة صحيحة", "warning");
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.toast("حجم الصورة يجب ألا يتجاوز 5 ميجابايت", "warning");
        return false;
      }

      try {
        if (!window.firebase || !firebase.storage) {
          throw new Error("Firebase Storage غير مهيأ");
        }

        const extension = file.name.split(".").pop().toLowerCase();
        const path = `avatars/${user.uid}/profile_${Date.now()}.${extension}`;

        const ref = firebase.storage().ref(path);

        const snapshot = await ref.put(file, {
          contentType: file.type
        });

        const url = await snapshot.ref.getDownloadURL();

        await this.database()
          .collection("users")
          .doc(user.uid)
          .set({
            photoURL: url,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

        await user.updateProfile({ photoURL: url });

        this.toast("تم تحديث الصورة الشخصية", "success");
        await this.load(user.uid);

        return url;
      } catch (error) {
        console.error("Avatar upload error:", error);
        this.toast("تعذر رفع الصورة الشخصية", "error");
        return false;
      }
    },

    async loadUserPosts(userId) {
      const container = document.querySelector("[data-profile-posts]");
      if (!container) return [];

      try {
        const snapshot = await this.database()
          .collection("communityPosts")
          .where("authorId", "==", userId)
          .where("status", "==", "published")
          .limit(30)
          .get();

        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        posts.sort((a, b) => {
          const first = a.createdAt?.toMillis?.() || 0;
          const second = b.createdAt?.toMillis?.() || 0;
          return second - first;
        });

        if (Community && typeof Community.renderPost === "function") {
          container.innerHTML = posts.map(post => Community.renderPost(post)).join("");
        } else {
          container.innerHTML = posts.map(post => `
            <article class="profile-post">
              <p>${this.escape(post.content || "")}</p>
              <small>${Number(post.likesCount || 0)} إعجاب · ${Number(post.commentsCount || 0)} تعليق</small>
            </article>
          `).join("");
        }

        return posts;
      } catch (error) {
        console.error("User posts error:", error);
        container.textContent = "تعذر تحميل المنشورات";
        return [];
      }
    },

    async loadStats(userId) {
      const db = this.database();

      const [posts, followers, following] = await Promise.all([
        db.collection("communityPosts")
          .where("authorId", "==", userId)
          .where("status", "==", "published")
          .get(),

        db.collection("follows")
          .where("followingId", "==", userId)
          .get(),

        db.collection("follows")
          .where("followerId", "==", userId)
          .get()
      ]);

      const stats = {
        posts: posts.size,
        followers: followers.size,
        following: following.size
      };

      Object.entries(stats).forEach(([key, value]) => {
        document.querySelectorAll(`[data-profile-stat="${key}"]`)
          .forEach(el => {
            el.textContent = value.toLocaleString("ar-EG");
          });
      });

      return stats;
    },

    bindEvents() {
      if (this._eventsBound) return;
      this._eventsBound = true;

      document.addEventListener("submit", async event => {
        const form = event.target.closest("[data-profile-edit-form]");
        if (!form) return;

        event.preventDefault();

        const data = Object.fromEntries(new FormData(form).entries());
        await this.updateProfile(data);
      });

      document.addEventListener("change", async event => {
        const input = event.target.closest("[data-avatar-upload]");
        if (!input || !input.files || !input.files[0]) return;

        await this.uploadAvatar(input.files[0]);
        input.value = "";
      });

      document.addEventListener("click", async event => {
        const editButton = event.target.closest("[data-profile-edit-toggle]");
        const followButton = event.target.closest("[data-follow-user]");

        if (editButton) {
          const form = document.querySelector("[data-profile-edit-form]");

          if (form) {
            form.hidden = !form.hidden;
            this.state.editing = !form.hidden;
          }
        }

        if (followButton && Community) {
          const targetId = followButton.getAttribute("data-follow-user");

          try {
            const following = await Community.toggleFollow(targetId);
            followButton.textContent = following ? "إلغاء المتابعة" : "متابعة";
          } catch (error) {
            console.error("Profile follow error:", error);
          }
        }
      });
    },

    async init() {
      this.bindEvents();

      const user = this.currentUser();

      if (!user) return;

      const profile = await this.load(user.uid);

      if (profile) {
        await Promise.all([
          this.loadUserPosts(user.uid),
          this.loadStats(user.uid)
        ]);
      }
    }
  };

  H.Profile = Profile;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Profile.init());
  } else {
    Profile.init();
  }
})();
