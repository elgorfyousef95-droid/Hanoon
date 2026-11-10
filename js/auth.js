
(() => {
  "use strict";

  const HANOON = window.HANOON || {};

  const Auth = {
    initialized: false,
    currentUser: null,
    unsubscribe: null,

    get auth() {
      return HANOON.firebase?.auth || null;
    },

    get database() {
      return HANOON.firebase?.db || null;
    },

    // التأكد من توفر Firebase
    requireFirebase() {
      if (!this.auth) {
        throw new Error(
          "Firebase Auth غير مهيأ. يجب إعداد firebase/config.js أولاً."
        );
      }

      return this.auth;
    },

    // إنشاء حساب جديد بالبريد وكلمة المرور
    async register({ name, email, password }) {
      const auth = this.requireFirebase();

      name = String(name || "").trim();
      email = String(email || "").trim().toLowerCase();

      if (!name || !email || !password) {
        throw new Error("يرجى إدخال جميع البيانات المطلوبة.");
      }

      if (name.length < 2) {
        throw new Error("الاسم يجب أن يتكون من حرفين على الأقل.");
      }

      if (password.length < 8) {
        throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      }

      const credential =
        await auth.createUserWithEmailAndPassword(email, password);

      await credential.user.updateProfile({
        displayName: name
      });

      this.currentUser = credential.user;

      document.dispatchEvent(
        new CustomEvent("hanoon:registered", {
          detail: { user: credential.user }
        })
      );

      return credential.user;
    },

    // تسجيل الدخول
    async login(email, password) {
      const auth = this.requireFirebase();

      email = String(email || "").trim().toLowerCase();

      if (!email || !password) {
        throw new Error("أدخل البريد الإلكتروني وكلمة المرور.");
      }

      const credential =
        await auth.signInWithEmailAndPassword(email, password);

      this.currentUser = credential.user;

      document.dispatchEvent(
        new CustomEvent("hanoon:login", {
          detail: { user: credential.user }
        })
      );

      return credential.user;
    },

    // تسجيل الدخول باستخدام Google
    async loginWithGoogle() {
      const auth = this.requireFirebase();

      const provider = new firebase.auth.GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account"
      });

      const credential = await auth.signInWithPopup(provider);

      this.currentUser = credential.user;

      document.dispatchEvent(
        new CustomEvent("hanoon:google-login", {
          detail: { user: credential.user }
        })
      );

      return credential.user;
    },

    // تسجيل الخروج
    async logout() {
      const auth = this.requireFirebase();

      await auth.signOut();

      this.currentUser = null;

      document.dispatchEvent(
        new CustomEvent("hanoon:logout")
      );

      return true;
    },

    // إرسال رابط استعادة كلمة المرور
    async resetPassword(email) {
      const auth = this.requireFirebase();

      email = String(email || "").trim().toLowerCase();

      if (!email) {
        throw new Error("أدخل البريد الإلكتروني أولاً.");
      }

      await auth.sendPasswordResetEmail(email);

      return true;
    },

    // تحديث الاسم الظاهر
    async updateName(name) {
      const auth = this.requireFirebase();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      name = String(name || "").trim();

      if (name.length < 2) {
        throw new Error("الاسم غير صالح.");
      }

      await user.updateProfile({
        displayName: name
      });

      this.currentUser = auth.currentUser;

      return this.currentUser;
    },

    // تحديث البريد الإلكتروني
    async updateEmail(email) {
      const auth = this.requireFirebase();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      email = String(email || "").trim().toLowerCase();

      if (!email) {
        throw new Error("أدخل البريد الإلكتروني الجديد.");
      }

      await user.updateEmail(email);

      this.currentUser = auth.currentUser;

      return this.currentUser;
    },

    // تغيير كلمة المرور
    async updatePassword(password) {
      const auth = this.requireFirebase();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("يجب تسجيل الدخول أولاً.");
      }

      if (!password || password.length < 8) {
        throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      }

      await user.updatePassword(password);

      return true;
    },

    // إعادة تحميل بيانات المستخدم
    async refreshUser() {
      const auth = this.requireFirebase();
      const user = auth.currentUser;

      if (!user) return null;

      await user.reload();

      this.currentUser = auth.currentUser;

      return this.currentUser;
    },

    // بيانات المستخدم الأساسية
    getUserData() {
      const user = this.currentUser || this.auth?.currentUser;

      if (!user) return null;

      return {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        emailVerified: user.emailVerified,
        provider: user.providerData?.[0]?.providerId || "password"
      };
    },

    // مراقبة حالة تسجيل الدخول
    onAuthChange(callback) {
      const auth = this.requireFirebase();

      return auth.onAuthStateChanged(user => {
        this.currentUser = user;

        if (typeof callback === "function") {
          callback(user);
        }

        document.dispatchEvent(
          new CustomEvent("hanoon:auth-state", {
            detail: { user }
          })
        );
      });
    },

    // حماية الصفحات التي تتطلب تسجيل الدخول
    protectPage(options = {}) {
      const auth = this.requireFirebase();

      const loginPage = options.loginPage || "auth.html";
      const redirectAfterLogin = options.redirectAfterLogin !== false;

      return new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();

          this.currentUser = user;

          if (!user) {
            const target = new URL(
              loginPage,
              document.baseURI
            );

            if (redirectAfterLogin) {
              target.searchParams.set(
                "next",
                window.location.href
              );
            }

            window.location.replace(target.href);
            resolve(false);
            return;
          }

          resolve(user);
        });
      });
    },

    // ربط نموذج التسجيل
    bindRegisterForm() {
      const form = document.querySelector("[data-register-form]");

      if (!form) return;

      form.addEventListener("submit", async event => {
        event.preventDefault();

        const name = form.querySelector("[name='name']")?.value;
        const email = form.querySelector("[name='email']")?.value;
        const password = form.querySelector("[name='password']")?.value;

        const submitButton = form.querySelector(
          "button[type='submit']"
        );

        try {
          if (submitButton) submitButton.disabled = true;

          const user = await this.register({
            name,
            email,
            password
          });

          HANOON.toast?.("تم إنشاء الحساب بنجاح", "success");

          document.dispatchEvent(
            new CustomEvent("hanoon:account-created", {
              detail: { user }
            })
          );

          this.redirectAfterLogin();

        } catch (error) {
          HANOON.toast?.(
            this.getErrorMessage(error),
            "error"
          );
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    },

    // ربط نموذج تسجيل الدخول
    bindLoginForm() {
      const form = document.querySelector("[data-login-form]");

      if (!form) return;

      form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = form.querySelector("[name='email']")?.value;
        const password = form.querySelector("[name='password']")?.value;

        const submitButton = form.querySelector(
          "button[type='submit']"
        );

        try {
          if (submitButton) submitButton.disabled = true;

          await this.login(email, password);

          HANOON.toast?.("أهلاً بك في هنون", "success");

          this.redirectAfterLogin();

        } catch (error) {
          HANOON.toast?.(
            this.getErrorMessage(error),
            "error"
          );
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    },

    // ربط أزرار Google
    bindGoogleButtons() {
      document.querySelectorAll("[data-google-login]").forEach(button => {
        button.addEventListener("click", async () => {
          try {
            button.disabled = true;

            await this.loginWithGoogle();

            HANOON.toast?.("تم تسجيل الدخول باستخدام Google", "success");

            this.redirectAfterLogin();

          } catch (error) {
            HANOON.toast?.(
              this.getErrorMessage(error),
              "error"
            );
          } finally {
            button.disabled = false;
          }
        });
      });
    },

    // ربط تسجيل الخروج
    bindLogoutButtons() {
      document.querySelectorAll("[data-logout]").forEach(button => {
        button.addEventListener("click", async () => {
          try {
            button.disabled = true;

            await this.logout();

            HANOON.toast?.("تم تسجيل الخروج", "success");

            window.location.href = new URL(
              "auth.html",
              document.baseURI
            ).href;

          } catch (error) {
            HANOON.toast?.(
              this.getErrorMessage(error),
              "error"
            );
          } finally {
            button.disabled = false;
          }
        });
      });
    },

    // ربط استعادة كلمة المرور
    bindPasswordReset() {
      document.querySelectorAll("[data-password-reset]").forEach(button => {
        button.addEventListener("click", async () => {
          const emailInput = document.querySelector(
            "[name='email']"
          );

          const email = emailInput?.value;

          try {
            await this.resetPassword(email);

            HANOON.toast?.(
              "تم إرسال رابط استعادة كلمة المرور إلى بريدك",
              "success"
            );

          } catch (error) {
            HANOON.toast?.(
              this.getErrorMessage(error),
              "error"
            );
          }
        });
      });
    },

    // توجيه المستخدم بعد تسجيل الدخول
    redirectAfterLogin() {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");

      if (next) {
        try {
          const destination = new URL(next, window.location.origin);

          if (destination.origin === window.location.origin) {
            window.location.assign(destination.href);
            return;
          }
        } catch (_) {
          // الانتقال إلى الصفحة الرئيسية عند وجود رابط غير صالح
        }
      }

      window.location.href = new URL(
        "../index.html",
        document.baseURI
      ).href;
    },

    // رسائل أخطاء مفهومة
    getErrorMessage(error) {
      const messages = {
        "auth/email-already-in-use": "هذا البريد مسجل بالفعل.",
        "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
        "auth/weak-password": "كلمة المرور ضعيفة.",
        "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
        "auth/wrong-password": "كلمة المرور غير صحيحة.",
        "auth/invalid-credential": "بيانات تسجيل الدخول غير صحيحة.",
        "auth/too-many-requests": "محاولات كثيرة. حاول مرة أخرى لاحقاً.",
        "auth/popup-closed-by-user": "تم إغلاق نافذة Google.",
        "auth/popup-blocked": "المتصفح منع نافذة تسجيل الدخول.",
        "auth/network-request-failed": "تحقق من اتصال الإنترنت.",
        "auth/requires-recent-login": "سجل الدخول مرة أخرى لتنفيذ هذا الإجراء.",
        "auth/operation-not-allowed": "طريقة تسجيل الدخول غير مفعلة في Firebase."
      };

      return messages[error?.code] ||
        error?.message ||
        "حدث خطأ أثناء تنفيذ العملية.";
    },

    // تشغيل النظام
    init() {
      if (this.initialized) return;

      this.bindRegisterForm();
      this.bindLoginForm();
      this.bindGoogleButtons();
      this.bindLogoutButtons();
      this.bindPasswordReset();

      this.initialized = true;
    }
  };

  HANOON.Auth = Auth;
  window.HANOON = HANOON;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Auth.init(),
      { once: true }
    );
  } else {
    Auth.init();
  }
})();
