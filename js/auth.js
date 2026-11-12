
/* =====================================================
   HANOON AUTHENTICATION
   Supabase Login / Registration / Profile
===================================================== */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const supabase = window.HANOON?.supabase;

  if (!supabase) {
    console.error("HANOON: Supabase client is not ready.");
    return;
  }

  const state = {
    step: 1,
    photo: null,
    compressedPhoto: null,
    busy: false
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

  function notify(message, type = "error") {
    elements.message.textContent = message;
    elements.message.className = `message show ${type}`;
    elements.message.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function clearMessage() {
    elements.message.textContent = "";
    elements.message.className = "message";
  }

  function setBusy(button, busy, text) {
    if (!button) return;

    button.disabled = busy;

    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = text || "جارٍ التنفيذ...";
    } else {
      button.textContent =
        button.dataset.originalText || button.textContent;
    }
  }

  function errorMessage(error) {
    const messages = {
      "Invalid login credentials":
        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",

      "User already registered":
        "هذا البريد الإلكتروني مسجل بالفعل.",

      "Email not confirmed":
        "يجب تأكيد بريدك الإلكتروني أولاً.",

      "Password should be at least 6 characters":
        "كلمة المرور قصيرة جدًا.",

      "duplicate key value violates unique constraint":
        "اسم المستخدم مستخدم بالفعل."
    };

    const message = error?.message || "";

    for (const [key, value] of Object.entries(messages)) {
      if (message.includes(key)) return value;
    }

    return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
  }

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

    goToStep(1);
  }

  function goToStep(number) {
    state.step = number;

    elements.steps.forEach((step, index) => {
      step.classList.toggle("active", index + 1 === number);
    });

    elements.dots.forEach((dot, index) => {
      dot.classList.toggle("active", index < number);
    });

    clearMessage();
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateStepOne() {
    const email = $("#registerEmail").value.trim().toLowerCase();
    const password = $("#registerPassword").value;
    const confirm = $("#confirmPassword").value;

    if (!validateEmail(email)) {
      notify("أدخل بريدًا إلكترونيًا صحيحًا.");
      return false;
    }

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
    const username = $("#username").value.trim().toLowerCase();

    if (!state.photo) {
      notify("اختَر صورة شخصية أولاً.");
      return false;
    }

    if (name.length < 2) {
      notify("اكتب اسمًا صحيحًا.");
      return false;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      notify(
        "اسم المستخدم يجب أن يحتوي على 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _."
      );
      return false;
    }

    return true;
  }

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

      const cropSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      const sx = (image.naturalWidth - cropSize) / 2;
      const sy = (image.naturalHeight - cropSize) / 2;

      ctx.drawImage(
        image,
        sx, sy, cropSize, cropSize,
        0, 0, size, size
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

  function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error("تعذر حفظ الصورة مؤقتًا.")
      );

      reader.readAsDataURL(blob);
    });
  }

  async function saveTemporaryPhoto(blob) {
    try {
      const data = await readAsDataURL(blob);
      sessionStorage.setItem("hanoon_pending_avatar", data);
    } catch (error) {
      console.warn("Temporary photo could not be saved.", error);
    }
  }

  async function getPendingPhoto() {
    const data = sessionStorage.getItem("hanoon_pending_avatar");

    if (!data) return null;

    const response = await fetch(data);
    return await response.blob();
  }

  async function uploadAvatar(userId, blob) {
    if (!blob) {
      throw new Error("الصورة الشخصية مطلوبة.");
    }

    const path = `${userId}/avatar.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "3600"
      });

    if (uploadError) throw uploadError;

    return path;
  }

  async function createProfile(user, photoBlob) {
    const metadata = user.user_metadata || {};

    const name = String(metadata.full_name || "").trim();
    const username = String(metadata.username || "")
      .trim()
      .toLowerCase();

    if (!name || !username) {
      throw new Error(
        "بيانات الملف الشخصي غير مكتملة."
      );
    }

    const avatarPath = await uploadAvatar(
      user.id,
      photoBlob
    );

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: name,
        username,
        avatar_path: avatarPath,
        bio: String(metadata.bio || ""),
        hobbies: Array.isArray(metadata.hobbies)
          ? metadata.hobbies
          : [],
        reading_interests:
          Array.isArray(metadata.reading_interests)
            ? metadata.reading_interests
            : [],
        interests: [],
        profile_completed: true
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function getOrCreateProfile(user) {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (existing) return existing;

    const metadata = user.user_metadata || {};
    let photoBlob = state.compressedPhoto;

    if (!photoBlob) {
      photoBlob = await getPendingPhoto();
    }

    if (!photoBlob) {
      throw new Error(
        "حسابك موجود، لكن إكمال الملف الشخصي يحتاج صورة. أعد اختيار الصورة بعد تسجيل الدخول."
      );
    }

    return await createProfile(user, photoBlob);
  }

  function showIdentity(profile) {
    const old = $("#hanoonIdentity");
    old?.remove();

    const overlay = document.createElement("div");

    overlay.id = "hanoonIdentity";

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      display:grid;
      place-items:center;
      padding:20px;
      background:rgba(5,8,18,.94);
      backdrop-filter:blur(12px);
      font-family:Cairo,sans-serif;
    `;

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
          width:90px;height:90px;
          border-radius:50%;
          overflow:hidden;
          border:2px solid #D5B36C;
        ">
          <img src="${
            profile.avatar_path
              ? supabase.storage.from("avatars")
                  .getPublicUrl(profile.avatar_path).data.publicUrl
              : ""
          }" style="width:100%;height:100%;object-fit:cover">
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
            ${escapeHTML(profile.member_code)}
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
      `profile.html?user=${encodeURIComponent(profile.username)}`,
      window.location.href
    ).href;

    const qr = document.createElement("script");

    qr.src =
      "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

    qr.onload = () => {
      if (window.QRCode) {
        new QRCode($("#hanoonQR"), {
          text: profileURL,
          width: 150,
          height: 150,
          colorDark: "#111827",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    };

    document.head.appendChild(qr);

    $("#hanoonContinue").addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  async function register(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#createAccountButton");

    state.busy = true;
    setBusy(button, true, "جارٍ إنشاء الحساب...");

    try {
      const email = $("#registerEmail").value
        .trim().toLowerCase();

      const password = $("#registerPassword").value;

      const name = $("#displayName").value.trim();

      const username = $("#username").value
        .trim().toLowerCase();

      const hobbies = $("#hobbies").value
        .split(/[،,]/)
        .map(value => value.trim())
        .filter(Boolean);

      const readingInterests = $("#readingInterests").value
        .split(/[،,]/)
        .map(value => value.trim())
        .filter(Boolean);

      const bio = $("#bio").value.trim();

      if (!validateStepOne() || !validateStepTwo()) {
        return;
      }

      state.compressedPhoto = await compressImage(state.photo);
      await saveTemporaryPhoto(state.compressedPhoto);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username,
            hobbies,
            reading_interests: readingInterests,
            bio
          },
          emailRedirectTo: window.location.origin +
            window.location.pathname
        }
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("لم يتم إنشاء الحساب.");
      }

      if (!data.session) {
        notify(
          "تم إنشاء الحساب. افتح رسالة التأكيد التي وصلتك إلى بريدك الإلكتروني، ثم ارجع إلى هنا وسجّل الدخول لإكمال ملفك الشخصي.",
          "success"
        );

        showLogin();
        return;
      }

      const profile = await createProfile(
        data.user,
        state.compressedPhoto
      );

      sessionStorage.removeItem("hanoon_pending_avatar");

      showIdentity(profile);

    } catch (error) {
      console.error("Registration error:", error);
      notify(errorMessage(error));

    } finally {
      state.busy = false;
      setBusy(button, false);
    }
  }

  async function login(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#loginButton");

    state.busy = true;
    setBusy(button, true, "جارٍ تسجيل الدخول...");

    try {
      const email = $("#loginEmail").value
        .trim().toLowerCase();

      const password = $("#loginPassword").value;

      if (!validateEmail(email) || !password) {
        throw new Error(
          "أدخل البريد الإلكتروني وكلمة المرور بصورة صحيحة."
        );
      }

      const { data, error } = await supabase.auth
        .signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      const profile = await getOrCreateProfile(data.user);

      if (!profile.profile_completed) {
        throw new Error(
          "يجب إكمال بيانات ملفك الشخصي أولاً."
        );
      }

      sessionStorage.removeItem("hanoon_pending_avatar");

      window.location.href = "profile.html";

    } catch (error) {
      console.error("Login error:", error);
      notify(errorMessage(error));

    } finally {
      state.busy = false;
      setBusy(button, false);
    }
  }

  async function resetPassword() {
    const email = $("#loginEmail").value
      .trim().toLowerCase();

    if (!validateEmail(email)) {
      notify("اكتب بريدك الإلكتروني أولاً.");
      return;
    }

    try {
      const { error } = await supabase.auth
        .resetPasswordForEmail(email, {
          redirectTo: window.location.origin +
            window.location.pathname
        });

      if (error) throw error;

      notify(
        "إذا كان البريد مسجلاً، سيصلك رابط استعادة كلمة المرور.",
        "success"
      );

    } catch (error) {
      notify(errorMessage(error));
    }
  }

  function bindEvents() {
    elements.loginTab.addEventListener("click", showLogin);
    elements.registerTab.addEventListener("click", showRegister);

    $("#nextStep1").addEventListener("click", () => {
      if (validateStepOne()) goToStep(2);
    });

    $("#nextStep2").addEventListener("click", () => {
      if (validateStepTwo()) goToStep(3);
    });

    $("#backStep2").addEventListener("click", () => goToStep(1));
    $("#backStep3").addEventListener("click", () => goToStep(2));

    $("#profilePhoto").addEventListener("change", event => {
      const file = event.target.files?.[0];

      if (!file) return;

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

      image.onload = () => URL.revokeObjectURL(url);

      preview.appendChild(image);
      clearMessage();
    });

    elements.loginForm.addEventListener("submit", login);
    elements.registerForm.addEventListener("submit", register);

    $("#forgotPassword").addEventListener("click", event => {
      event.preventDefault();
      resetPassword();
    });
  }

  async function init() {
    bindEvents();

    const { data } = await supabase.auth.getSession();

    if (data.session) {
      const user = data.session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id,profile_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.profile_completed) {
        window.location.href = "profile.html";
      }
    }
  }

  init();

})();
