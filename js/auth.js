
/* =====================================================
   HANOON AUTH
   Username + Password
   Supabase Authentication
   Profile + Avatar + Member Code + QR
===================================================== */

(async () => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  const state = {
    photo: null,
    compressedPhoto: null,
    busy: false,
    existingUser: null
  };

  const elements = {
    loginTab: $("#loginTab"),
    registerTab: $("#registerTab"),
    loginForm: $("#loginForm"),
    registerForm: $("#registerForm"),
    title: $("#formTitle"),
    subtitle: $("#formSubtitle"),
    message: $("#authMessage"),
    dots: [...document.querySelectorAll(".step-dot")],
    steps: [...document.querySelectorAll(".step")]
  };

  let supabase;

  /* =====================================================
     Supabase connection
  ===================================================== */

  function waitForSupabase() {
    return new Promise((resolve, reject) => {
      if (window.HANOON?.supabase) {
        resolve(window.HANOON.supabase);
        return;
      }

      let timer;

      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("hanoon:supabase-ready", onReady);
        window.removeEventListener("hanoon:supabase-error", onError);
      };

      const onReady = () => {
        cleanup();

        if (window.HANOON?.supabase) {
          resolve(window.HANOON.supabase);
        } else {
          reject(new Error("تعذر تشغيل قاعدة البيانات."));
        }
      };

      const onError = event => {
        cleanup();
        reject(new Error(
          event.detail?.message || "تعذر الاتصال بقاعدة البيانات."
        ));
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(
          "انتهت مهلة الاتصال. حدّث الصفحة وحاول مرة أخرى."
        ));
      }, 15000);

      window.addEventListener("hanoon:supabase-ready", onReady);
      window.addEventListener("hanoon:supabase-error", onError);
    });
  }

  /* =====================================================
     Messages and loading states
  ===================================================== */

  function notify(message, type = "error") {
    if (!elements.message) return;

    elements.message.textContent = message;
    elements.message.className = `message show ${type}`;

    elements.message.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function clearMessage() {
    if (!elements.message) return;

    elements.message.textContent = "";
    elements.message.className = "message";
  }

  function setBusy(button, busy, text) {
    if (!button) return;

    button.disabled = busy;

    if (busy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.textContent = text || "جارٍ التنفيذ...";
    } else {
      button.textContent =
        button.dataset.originalText || button.textContent;

      delete button.dataset.originalText;
    }
  }

  /* =====================================================
     Username authentication
  ===================================================== */

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function validateUsername(value) {
    const username = normalizeUsername(value);

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new Error(
        "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _."
      );
    }

    return username;
  }

  /*
    Supabase Auth requires email or phone credentials.
    This hidden internal address lets the user use username/password.
    It is never displayed to the user and is not a real mailbox.
  */
  function internalEmailForUsername(username) {
    return `${normalizeUsername(username)}@hanoon.invalid`;
  }

  function errorMessage(error) {
    const message = String(error?.message || "");

    const messages = [
      [
        "Invalid login credentials",
        "اسم المستخدم أو كلمة المرور غير صحيحة."
      ],
      [
        "User already registered",
        "اسم المستخدم مسجل بالفعل. جرّب تسجيل الدخول."
      ],
      [
        "Email not confirmed",
        "تأكيد البريد الداخلي ما زال مفعّلًا. يجب إيقاف Confirm email في إعدادات Supabase."
      ],
      [
        "Signups not allowed",
        "إنشاء الحسابات متوقف حاليًا في إعدادات Supabase."
      ],
      [
        "Password should be at least",
        "كلمة المرور قصيرة جدًا."
      ],
      [
        "duplicate key value violates unique constraint",
        "اسم المستخدم مستخدم بالفعل."
      ],
      [
        "duplicate key",
        "اسم المستخدم مستخدم بالفعل."
      ],
      [
        "row-level security",
        "قاعدة البيانات منعت العملية. راجع صلاحيات وسياسات الجدول."
      ],
      [
        "Failed to fetch",
        "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى."
      ]
    ];

    for (const [key, value] of messages) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
  }

  /* =====================================================
     Tabs and registration steps
  ===================================================== */

  function showLogin() {
    clearMessage();

    elements.loginForm.hidden = false;
    elements.registerForm.hidden = true;

    elements.loginTab.classList.add("active");
    elements.registerTab.classList.remove("active");

    elements.title.textContent = "تسجيل الدخول";
    elements.subtitle.textContent =
      "تابع رحلتك المعرفية من حيث توقفت";
  }

  function showRegister() {
    clearMessage();

    elements.loginForm.hidden = true;
    elements.registerForm.hidden = false;

    elements.loginTab.classList.remove("active");
    elements.registerTab.classList.add("active");

    elements.title.textContent = "إنشاء حساب جديد";
    elements.subtitle.textContent =
      "أنشئ هويتك الخاصة في مجتمع هنون";

    goToStep(state.existingUser ? 2 : 1);
  }

  function goToStep(number) {
    elements.steps.forEach((step, index) => {
      step.classList.toggle("active", index + 1 === number);
    });

    elements.dots.forEach((dot, index) => {
      dot.classList.toggle("active", index < number);
    });

    clearMessage();
  }

  /* =====================================================
     Step validation
  ===================================================== */

  function validateStepOne() {
    try {
      validateUsername($("#registerUsername").value);
    } catch (error) {
      notify(error.message);
      return false;
    }

    const password = $("#registerPassword").value;
    const confirm = $("#confirmPassword").value;

    if (password.length < 8) {
      notify("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return false;
    }

    if (password !== confirm) {
      notify("كلمتا المرور غير متطابقتين.");
      return false;
    }

    return true;
  }

  function validateStepTwo() {
    const name = $("#displayName").value.trim();

    if (!state.photo && !state.existingUser) {
      notify("اختَر صورة شخصية أولاً.");
      return false;
    }

    if (!state.photo && state.existingUser) {
      notify("اختَر صورة شخصية لإكمال حسابك.");
      return false;
    }

    if (name.length < 2) {
      notify("اكتب اسمًا صحيحًا.");
      return false;
    }

    return true;
  }

  /* =====================================================
     Image processing
  ===================================================== */

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("الملف المختار ليس صورة.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
    }

    const image = new Image();
    const url = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("تعذر قراءة الصورة.")
        );
        image.src = url;
      });

      const size = 512;
      const canvas = document.createElement("canvas");

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("تعذر تجهيز الصورة.");
      }

      const cropSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      const sx = (image.naturalWidth - cropSize) / 2;
      const sy = (image.naturalHeight - cropSize) / 2;

      ctx.drawImage(
        image,
        sx,
        sy,
        cropSize,
        cropSize,
        0,
        0,
        size,
        size
      );

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/webp", 0.86);
      });

      if (!blob) {
        throw new Error("تعذر تجهيز الصورة.");
      }

      return blob;

    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* =====================================================
     Avatar storage
  ===================================================== */

  async function uploadAvatar(userId, blob) {
    if (!blob) {
      throw new Error("الصورة الشخصية مطلوبة.");
    }

    const path = `${userId}/avatar.webp`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "3600"
      });

    if (error) throw error;

    return path;
  }

  /* =====================================================
     Profile data
  ===================================================== */

  function splitList(value) {
    return String(value || "")
      .split(/[،,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  async function saveProfile(user, photoBlob) {
    const name = $("#displayName").value.trim();

    const username = state.existingUser
      ? normalizeUsername(user.user_metadata?.username)
      : validateUsername($("#registerUsername").value);

    if (!username) {
      throw new Error("تعذر تحديد اسم المستخدم.");
    }

    const hobbies = splitList($("#hobbies").value);
    const readingInterests = splitList(
      $("#readingInterests").value
    );

    const bio = $("#bio").value.trim();

    const avatarPath = await uploadAvatar(user.id, photoBlob);

    const profileData = {
      id: user.id,
      full_name: name,
      username,
      avatar_path: avatarPath,
      bio,
      hobbies,
      reading_interests: readingInterests,
      interests: [],
      profile_completed: true
    };

    const { data: existingProfile, error: fetchError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (fetchError) throw fetchError;

    let profile;

    if (existingProfile) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.full_name,
          username: profileData.username,
          avatar_path: profileData.avatar_path,
          bio: profileData.bio,
          hobbies: profileData.hobbies,
          reading_interests: profileData.reading_interests,
          interests: profileData.interests,
          profile_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      profile = data;

    } else {
      const { data, error } = await supabase
        .from("profiles")
        .insert(profileData)
        .select()
        .single();

      if (error) throw error;
      profile = data;
    }

    /*
      Keep the account metadata synchronized with the profile.
      Authorization must still rely on database policies, not metadata.
    */
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        username,
        full_name: name,
        hobbies,
        reading_interests: readingInterests,
        bio
      }
    });

    if (metadataError) {
      console.warn("Profile metadata sync:", metadataError.message);
    }

    return profile;
  }

  /* =====================================================
     Safe HTML
  ===================================================== */

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  /* =====================================================
     Member identity and QR
  ===================================================== */

  function showIdentity(profile) {
    $("#hanoonIdentity")?.remove();

    const overlay = document.createElement("div");

    overlay.id = "hanoonIdentity";

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      display:grid;
      place-items:center;
      padding:20px;
      background:rgba(5,8,18,.96);
      backdrop-filter:blur(12px);
      font-family:Cairo,sans-serif;
      overflow-y:auto;
    `;

    const avatarURL = profile.avatar_path
      ? supabase.storage
          .from("avatars")
          .getPublicUrl(profile.avatar_path).data.publicUrl
      : "";

    overlay.innerHTML = `
      <div style="
        width:100%;
        max-width:390px;
        padding:28px;
        border-radius:24px;
        background:#171D32;
        border:1px solid rgba(213,179,108,.4);
        text-align:center;
        color:#F5EAD1;
      ">
        <div style="color:#D5B36C;font-size:13px">
          مرحبًا بك في مجتمع هنون
        </div>

        <h2 style="margin:12px 0">تم إنشاء هويتك</h2>

        <div style="
          margin:18px auto;
          width:90px;
          height:90px;
          border-radius:50%;
          overflow:hidden;
          border:2px solid #D5B36C;
        ">
          <img
            src="${escapeHTML(avatarURL)}"
            alt="الصورة الشخصية"
            style="width:100%;height:100%;object-fit:cover"
          >
        </div>

        <h3>${escapeHTML(profile.full_name)}</h3>

        <p style="color:#D5B36C;margin:8px">
          @${escapeHTML(profile.username)}
        </p>

        <div style="
          background:#0C1020;
          border-radius:12px;
          padding:12px;
          margin:18px 0;
        ">
          <small style="color:#A9AEC2">رقم عضويتك</small>
          <h2 style="letter-spacing:2px;color:#D5B36C">
            ${escapeHTML(profile.member_code || "جارٍ تجهيز الرقم")}
          </h2>
        </div>

        <div id="hanoonQR" style="
          display:inline-block;
          padding:12px;
          background:white;
          border-radius:12px;
          min-width:150px;
          min-height:150px;
        "></div>

        <p style="font-size:11px;color:#A9AEC2;margin:12px 0">
          امسح رمز QR للوصول إلى هويتك في هنون
        </p>

        <button id="hanoonContinue" style="
          width:100%;
          padding:14px;
          border:0;
          border-radius:12px;
          background:#2879D8;
          color:white;
          font-family:inherit;
          font-weight:bold;
          cursor:pointer;
        ">دخول إلى هنون</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const profileURL = new URL(
      `member.html?user=${encodeURIComponent(profile.username)}`,
      window.location.href
    ).href;

    function createQR() {
      const target = $("#hanoonQR");

      if (!window.QRCode || !target) return;

      target.innerHTML = "";

      new QRCode(target, {
        text: profileURL,
        width: 150,
        height: 150,
        colorDark: "#111827",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    if (window.QRCode) {
      createQR();
    } else {
      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

      script.onload = createQR;

      script.onerror = () => {
        $("#hanoonQR").textContent =
          "تعذر تحميل رمز QR حاليًا.";
      };

      document.head.appendChild(script);
    }

    $("#hanoonContinue").addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }

  /* =====================================================
     Username availability
  ===================================================== */

  async function checkUsernameAvailable(username) {
    const { data, error } = await supabase
      .from("member_directory")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      throw new Error("اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.");
    }
  }

  /* =====================================================
     Registration
  ===================================================== */

  async function register(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#createAccountButton");

    state.busy = true;
    setBusy(button, true, "جارٍ إنشاء الحساب...");

    try {
      if (!validateStepTwo()) return;

      const photoBlob = await compressImage(state.photo);

      state.compressedPhoto = photoBlob;

      let user = state.existingUser;

      if (!user) {
        if (!validateStepOne()) {
          goToStep(1);
          return;
        }

        const username = validateUsername(
          $("#registerUsername").value
        );

        const password = $("#registerPassword").value;

        await checkUsernameAvailable(username);

        const { data, error } = await supabase.auth.signUp({
          email: internalEmailForUsername(username),
          password,
          options: {
            data: {
              username,
              full_name: $("#displayName").value.trim()
            }
          }
        });

        if (error) throw error;

        if (!data.user) {
          throw new Error("لم يتم إنشاء الحساب.");
        }

        if (!data.session) {
          throw new Error(
            "الحساب أُنشئ لكن تسجيل الدخول التلقائي لم يكتمل. افتح إعدادات Supabase ثم أوقف Confirm email، وبعدها حاول مرة أخرى."
          );
        }

        user = data.user;
      }

      const profile = await saveProfile(user, photoBlob);

      showIdentity(profile);

    } catch (error) {
      console.error("HANOON registration error:", error);
      notify(errorMessage(error));

    } finally {
      state.busy = false;
      setBusy(button, false);
    }
  }

  /* =====================================================
     Resume incomplete profile
  ===================================================== */

  function resumeProfile(user) {
    state.existingUser = user;

    const metadata = user.user_metadata || {};

    $("#displayName").value = metadata.full_name || "";

    $("#hobbies").value = Array.isArray(metadata.hobbies)
      ? metadata.hobbies.join("، ")
      : "";

    $("#readingInterests").value =
      Array.isArray(metadata.reading_interests)
        ? metadata.reading_interests.join("، ")
        : "";

    $("#bio").value = metadata.bio || "";

    showRegister();

    goToStep(2);

    notify(
      "حسابك موجود. أكمل صورتك وبيانات ملفك الشخصي.",
      "success"
    );
  }

  /* =====================================================
     Login
  ===================================================== */

  async function login(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#loginButton");

    state.busy = true;
    setBusy(button, true, "جارٍ تسجيل الدخول...");

    try {
      const username = validateUsername(
        $("#loginUsername").value
      );

      const password = $("#loginPassword").value;

      if (!password) {
        throw new Error("أدخل كلمة المرور.");
      }

      const { data, error } = await supabase.auth
        .signInWithPassword({
          email: internalEmailForUsername(username),
          password
        });

      if (error) throw error;

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.profile_completed) {
        resumeProfile(data.user);
        return;
      }

      window.location.href = "profile.html";

    } catch (error) {
      console.error("HANOON login error:", error);
      notify(errorMessage(error));

    } finally {
      state.busy = false;
      setBusy(button, false);
    }
  }

  /* =====================================================
     Events
  ===================================================== */

  function bindEvents() {
    elements.loginTab.addEventListener("click", showLogin);
    elements.registerTab.addEventListener("click", showRegister);

    $("#nextStep1").addEventListener("click", async () => {
      if (!validateStepOne()) return;

      try {
        const username = validateUsername(
          $("#registerUsername").value
        );

        await checkUsernameAvailable(username);

        goToStep(2);

      } catch (error) {
        notify(errorMessage(error));
      }
    });

    $("#nextStep2").addEventListener("click", () => {
      if (validateStepTwo()) {
        goToStep(3);
      }
    });

    $("#backStep2").addEventListener("click", () => {
      if (state.existingUser) {
        showLogin();
      } else {
        goToStep(1);
      }
    });

    $("#backStep3").addEventListener("click", () => {
      goToStep(2);
    });

    $("#profilePhoto").addEventListener("change", event => {
      const file = event.target.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        notify("اختَر ملف صورة صالحًا.");
        event.target.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        notify("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
        event.target.value = "";
        return;
      }

      state.photo = file;

      const preview = $("#photoPreview");
      const url = URL.createObjectURL(file);

      preview.innerHTML = "";

      const image = document.createElement("img");

      image.src = url;
      image.alt = "معاينة الصورة الشخصية";

      image.onload = () => URL.revokeObjectURL(url);

      preview.appendChild(image);

      clearMessage();
    });

    elements.loginForm.addEventListener("submit", login);
    elements.registerForm.addEventListener("submit", register);
  }

  /* =====================================================
     Initialization
  ===================================================== */

  async function init() {
    bindEvents();

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!data.session) return;

    const user = data.session.user;

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,profile_completed")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.profile_completed) {
      window.location.href = "profile.html";
      return;
    }

    resumeProfile(user);
  }

  /* =====================================================
     Start
  ===================================================== */

  try {
    supabase = await waitForSupabase();

    await init();

    console.info("HANOON: Username authentication is ready.");

  } catch (error) {
    console.error("HANOON initialization error:", error);
    notify(errorMessage(error));
  }

})();
