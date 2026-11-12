
/* =====================================================
   HANOON ADMIN PANEL
   Supabase Authentication & Admin Dashboard
===================================================== */

(() => {
  "use strict";

  const H = window.HANOON = window.HANOON || {};

  const state = {
    supabase: null,
    user: null,
    profile: null,
    loading: false
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const elements = {
    loading: $("#adminLoading"),
    denied: $("#adminDenied"),
    deniedMessage: $("#adminDeniedMessage"),
    app: $("#adminApp"),
    title: $("#adminPageTitle"),
    refresh: $("#adminRefresh")
  };

  const titles = {
    overview: "لوحة التحكم",
    members: "إدارة الأعضاء",
    content: "إدارة المحتوى",
    reports: "البلاغات",
    announcements: "الإعلانات والإشعارات",
    site: "إعدادات الموقع",
    groups: "إدارة الجروبات",
    games: "الألعاب والتحديات",
    competitions: "المسابقات",
    analytics: "تحليلات المنصة"
  };

  /* -----------------------------------------------------
     انتظار اتصال Supabase
  ----------------------------------------------------- */

  function waitForSupabase() {
    return new Promise((resolve, reject) => {
      if (window.HANOON?.supabase) {
        resolve(window.HANOON.supabase);
        return;
      }

      let timer;

      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener(
          "hanoon:supabase-ready",
          onReady
        );
        window.removeEventListener(
          "hanoon:supabase-error",
          onError
        );
      };

      const onReady = () => {
        cleanup();

        if (window.HANOON?.supabase) {
          resolve(window.HANOON.supabase);
        } else {
          reject(new Error("تعذر تهيئة Supabase."));
        }
      };

      const onError = event => {
        cleanup();

        reject(new Error(
          event.detail?.message ||
          "تعذر الاتصال بقاعدة البيانات."
        ));
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(
          "انتهت مهلة الاتصال بقاعدة البيانات."
        ));
      }, 15000);

      window.addEventListener(
        "hanoon:supabase-ready",
        onReady
      );

      window.addEventListener(
        "hanoon:supabase-error",
        onError
      );

      if (window.HANOON?.supabase) onReady();
    });
  }

  /* -----------------------------------------------------
     رسائل الحالة
  ----------------------------------------------------- */

  function showDenied(message) {
    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.app) {
      elements.app.hidden = true;
    }

    if (elements.denied) {
      elements.denied.hidden = false;
    }

    if (elements.deniedMessage) {
      elements.deniedMessage.textContent = message;
    }
  }

  function showLoading(message) {
    if (!elements.loading) return;

    elements.loading.hidden = false;

    const paragraph = $("p", elements.loading);

    if (paragraph && message) {
      paragraph.textContent = message;
    }
  }

  function showApp() {
    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.denied) {
      elements.denied.hidden = true;
    }

    if (elements.app) {
      elements.app.hidden = false;
    }
  }

  function notify(message, type = "info") {
    if (typeof H.UI?.toast === "function") {
      H.UI.toast(message, type);
      return;
    }

    console.info(`[HANOON ADMIN] ${message}`);
  }

  /* -----------------------------------------------------
     التحقق من الحساب والصلاحية
  ----------------------------------------------------- */

  async function authorize() {
    const { data, error } =
      await state.supabase.auth.getSession();

    if (error) throw error;

    const session = data.session;

    if (!session?.user) {
      showDenied(
        "يجب تسجيل الدخول إلى حساب هنون أولاً."
      );
      return false;
    }

    state.user = session.user;

    const { data: profile, error: profileError } =
      await state.supabase
        .from("profiles")
        .select("id,full_name,username,role,profile_completed")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.role !== "admin") {
      showDenied(
        "هذا الحساب لا يمتلك صلاحية إدارة هنون."
      );
      return false;
    }

    state.profile = profile;

    return true;
  }

  /* -----------------------------------------------------
     التنقل بين أقسام لوحة الإدارة
  ----------------------------------------------------- */

  function openView(name) {
    const target = $(`[data-view="${name}"]`);

    if (!target) return;

    $$(".admin-view").forEach(view => {
      view.classList.toggle(
        "active",
        view === target
      );
    });

    $$("[data-admin-view]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.adminView === name
      );
    });

    if (elements.title) {
      elements.title.textContent =
        titles[name] || "لوحة الإدارة";
    }

    if (name === "members") {
      loadMembersSummary();
    }

    if (name === "content") {
      loadContentSummary();
    }

    if (name === "reports") {
      loadReportsSummary();
    }

    if (name === "announcements") {
      loadAnnouncementsSummary();
    }

    if (name === "site") {
      loadSiteSettingsSummary();
    }
  }

  function bindNavigation() {
    document.addEventListener("click", event => {
      const nav = event.target.closest(
        "[data-admin-view]"
      );

      const quickLink = event.target.closest(
        "[data-open-view]"
      );

      if (nav) {
        openView(nav.dataset.adminView);
      }

      if (quickLink) {
        event.preventDefault();
        openView(quickLink.dataset.openView);
      }
    });
  }

  /* -----------------------------------------------------
     الإحصائيات
  ----------------------------------------------------- */

  function setStat(name, value) {
    $$(`[data-admin-stat="${name}"]`).forEach(element => {
      element.textContent =
        Number(value).toLocaleString("ar-EG");
    });
  }

  function setStatUnavailable(name) {
    $$(`[data-admin-stat="${name}"]`).forEach(element => {
      element.textContent = "—";
    });
  }

  async function loadStats() {
    /*
      member_directory هو الدليل العام الآمن.
      لا نستخدم profiles لعرض بيانات جميع الحسابات
      لأن صلاحيات قراءة ملفات الأعضاء محدودة.
    */

    const { count, error } = await state.supabase
      .from("member_directory")
      .select("id", {
        count: "exact",
        head: true
      });

    if (error) {
      setStatUnavailable("members");
      throw error;
    }

    setStat("members", count || 0);

    /*
      الكتب والمقالات والبلاغات ستظهر بعد إنشاء
      جداولها وربطها بسياسات الإدارة.
      لا نعرض أرقامًا افتراضية.
    */

    setStatUnavailable("books");
    setStatUnavailable("articles");
    setStatUnavailable("reports");
  }

  /* -----------------------------------------------------
     ملخص الأقسام
  ----------------------------------------------------- */

  function showSectionMessage(containerId, message) {
    const container = document.getElementById(containerId);

    if (!container) return;

    container.innerHTML = "";

    const box = document.createElement("div");

    box.style.cssText = `
      padding:22px;
      border:1px solid rgba(215,184,117,.16);
      border-radius:15px;
      background:#111a30;
      color:#aeb8cc;
      font-size:13px;
      line-height:2;
    `;

    box.textContent = message;

    container.appendChild(box);
  }

  async function loadMembersSummary() {
    showSectionMessage(
      "adminMembersContent",
      "تم تجهيز مدخل إدارة الأعضاء. عرض بيانات جميع الأعضاء وتعديل صلاحياتهم يحتاج سياسات إدارية آمنة مستقلة في قاعدة البيانات، وسنضيفها قبل تفعيل هذه العمليات."
    );
  }

  async function loadContentSummary() {
    showSectionMessage(
      "adminContentArea",
      "إدارة المحتوى ستُربط بجداول الكتب والمقالات والقصص والشعر والأبحاث والدورات بعد تجهيز مخطط قاعدة البيانات وسياسات النشر."
    );
  }

  async function loadReportsSummary() {
    showSectionMessage(
      "adminReportsContent",
      "نظام البلاغات يحتاج جدول البلاغات وسياسات المراجعة الإدارية. سيظهر هنا بمجرد إنشاء النظام."
    );
  }

  async function loadAnnouncementsSummary() {
    showSectionMessage(
      "adminAnnouncementsContent",
      "سيتم ربط الإعلانات والإشعارات بجدول الإشعارات، مع تسجيل المسؤول الذي أنشأ كل إعلان."
    );
  }

  async function loadSiteSettingsSummary() {
    showSectionMessage(
      "adminSiteSettingsContent",
      "إعدادات الموقع العامة ستُحفظ في قاعدة البيانات وتُطبق على الموقع بعد تجهيز صلاحيات التحكم."
    );
  }

  /* -----------------------------------------------------
     تحديث لوحة الإدارة
  ----------------------------------------------------- */

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    if (elements.refresh) {
      elements.refresh.disabled = true;
      elements.refresh.textContent = "…";
    }

    try {
      await loadStats();
      notify("تم تحديث الإحصائيات.", "success");
    } catch (error) {
      console.error(
        "HANOON admin refresh error:",
        error
      );

      notify(
        "تعذر تحديث الإحصائيات: " +
        (error.message || "خطأ غير معروف"),
        "error"
      );
    } finally {
      state.loading = false;

      if (elements.refresh) {
        elements.refresh.disabled = false;
        elements.refresh.textContent = "↻";
      }
    }
  }

  /* -----------------------------------------------------
     تسجيل الخروج
  ----------------------------------------------------- */

  async function logout() {
    const confirmed = window.confirm(
      "هل تريد تسجيل الخروج من هنون؟"
    );

    if (!confirmed) return;

    const { error } =
      await state.supabase.auth.signOut();

    if (error) {
      notify("تعذر تسجيل الخروج.", "error");
      return;
    }

    window.location.href = "../index.html";
  }

  /* -----------------------------------------------------
     الأحداث
  ----------------------------------------------------- */

  function bindEvents() {
    bindNavigation();

    elements.refresh?.addEventListener(
      "click",
      refresh
    );

    document.addEventListener("click", event => {
      const logoutButton = event.target.closest(
        "[data-admin-logout]"
      );

      if (logoutButton) {
        logout();
      }
    });

    state.supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          showDenied(
            "انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى."
          );
        }
      }
    );
  }

  /* -----------------------------------------------------
     تشغيل لوحة الإدارة
  ----------------------------------------------------- */

  async function init() {
    showLoading("يتم التحقق من حسابك وصلاحيات الإدارة...");

    try {
      state.supabase = await waitForSupabase();

      const authorized = await authorize();

      if (!authorized) return;

      bindEvents();
      showApp();

      await refresh();

      console.info(
        "HANOON Admin Panel initialized."
      );

    } catch (error) {
      console.error(
        "HANOON Admin initialization error:",
        error
      );

      showDenied(
        error.message ||
        "تعذر تشغيل لوحة الإدارة. حاول تحديث الصفحة."
      );
    }
  }

  H.AdminPanel = {
    init,
    refresh,
    openView,
    authorize,
    get state() {
      return {
        user: state.user,
        profile: state.profile
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
