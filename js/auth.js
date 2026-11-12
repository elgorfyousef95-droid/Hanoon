
/* =====================================================
   HANOON AUTHENTICATION
   Supabase Phone Login / Registration / Profile
   Egyptian phone numbers only
===================================================== */

(async () => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  const state = {
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

  let supabase;

  /* انتظار اتصال Supabase */
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

      if (window.HANOON?.supabase) onReady();
    });
  }

  /* الرسائل */
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

  /* تحويل رقم الهاتف المصري إلى E.164 */
  function normalizeEgyptianPhone(value) {
    let phone = String(value || "")
      .trim()
      .replace(/[\s\-().]/g, "");

    // قبول الأرقام العربية
    phone = phone.replace(/[٠-٩]/g, digit =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );

    // قبول الأرقام الفارسية
    phone = phone.replace(/[۰-۹]/g, digit =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );

    // حذف علامة الاتصال الدولية 00
    if (phone.startsWith("00")) {
      phone = "+" + phone.slice(2);
    }

    // الرقم المحلي المصري: 01xxxxxxxxx
    if (/^01[0125]\d{8}$/.test(phone)) {
      return "+20" + phone.slice(1);
    }

    // الصيغة الدولية: +201xxxxxxxxx
    if (/^\+201[0125]\d{8}$/.test(phone)) {
      return phone;
    }

    // قبول 20 بدون علامة +
    if (/^201[0125]\d{8}$/.test(phone)) {
      return "+" + phone;
    }

    throw new Error(
      "رقم الهاتف غير صحيح. أدخل رقمًا مصريًا يبدأ بـ 010 أو 011 أو 012 أو 015."
    );
  }

  /* رسائل أخطاء Supabase */
  function errorMessage(error) {
    const message = error?.message || "";

    const messages = [
      [
        "Invalid login credentials",
        "رقم الهاتف أو كلمة المرور غير صحيحة."
      ],
      [
        "User already registered",
        "رقم الهاتف مسجل بالفعل. جرّب تسجيل الدخول."
      ],
      [
        "Phone not confirmed",
        "يجب تأكيد رقم الهاتف أولاً باستخدام كود الرسالة."
      ],
      [
        "Invalid phone number",
        "رقم الهاتف غير صحيح."
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
        "Invalid OTP",
        "كود التحقق غير صحيح أو انتهت صلاحيته."
      ],
      [
        "Token has expired",
        "انتهت صلاحية كود التحقق. اطلب كودًا جديدًا."
      ],
      [
        "SMS provider",
        "خدمة الرسائل النصية غير مضبوطة في Supabase."
      ],
      [
        "phone_provider_disabled",
        "تسجيل الدخول برقم الهاتف غير مفعّل في Supabase."
      ]
    ];

    for (const [key, value] of messages) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
  }

  /* التنقل بين التسجيل والدخول */
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
    elements.steps.forEach((step, index) => {
      step.classList.toggle("active", index + 1 === number);
    });

    elements.dots.forEach((dot, index) => {
      dot.classList.toggle("active", index < number);
    });

    clearMessage();
  }

  /* التحقق من بيانات الخطوة الأولى */
  function validateStepOne() {
    let phone;

    try {
      phone = normalizeEgyptianPhone($("#registerPhone").value);
    } catch (error) {
      notify(error.message);
      return false;
    }

    const password = $("#registerPassword").value;
    const confirm = $("#confirmPassword").value;

    if (!phone) {
      notify("أدخل رقم الهاتف.");
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

  /* التحقق من بيانات الملف الشخصي */
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

  /* ضغط الصورة */
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
        image.onerror = () => reject(new Error("تعذر قراءة الصورة."));
        image.src = url;
      });

      const size = 512;
      const canvas = document.createElement("canvas");

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("تعذر تجهيز الصورة.");

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

      if (!blob) throw new Error("تعذر تجهيز الصورة.");

      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* حفظ الصورة مؤقتًا */
  function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error("تعذر تجهيز الصورة.")
      );

      reader.readAsDataURL(blob);
    });
  }

  async function saveTemporaryPhoto(blob) {
    const data = await readAsDataURL(blob);
    sessionStorage.setItem("hanoon_pending_avatar", data);
  }

  async function getPendingPhoto() {
    const data = sessionStorage.getItem("hanoon_pending_avatar");

    if (!data) return null;

    const response = await fetch(data);
    return await response.blob();
  }

  /* رفع الصورة */
  async function uploadAvatar(userId, blob) {
    if (!blob) throw new Error("الصورة الشخصية مطلوبة.");

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

  /* إنشاء ملف العضو */
  async function createProfile(user, photoBlob) {
    const metadata = user.user_metadata || {};

    const name = String(metadata.full_name || "").trim();
    const username = String(metadata.username || "")
      .trim()
      .toLowerCase();

    if (!name || !username) {
      throw new Error("بيانات الملف الشخصي غير مكتملة.");
    }

    const avatarPath = await uploadAvatar(user.id, photoBlob);

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
        reading_interests: Array.isArray(metadata.reading_interests)
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

  /* جلب الملف أو استكمال إنشائه */
  async function getOrCreateProfile(user) {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (existing) return existing;

    let photoBlob = state.compressedPhoto;

    if (!photoBlob) {
      photoBlob = await getPendingPhoto();
    }

    if (!photoBlob) {
      throw new Error(
        "حسابك موجود، لكن ملفك الشخصي يحتاج صورة. أعد اختيار الصورة لإكمال الحساب."
      );
    }

    const profile = await createProfile(user, photoBlob);

    sessionStorage.removeItem("hanoon_pending_avatar");

    return profile;
  }

  /* حماية النصوص */
  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  /* بطاقة الهوية ورمز QR */
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
      background:rgba(5,8,18,.94);
      backdrop-filter:blur(12px);
      font-family:Cairo,sans-serif;
      overflow-y:auto;
    `;

    const avatarURL = profile.avatar_path
      ? supabase.storage.from("avatars")
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
      `member.html?user=${encodeURIComponent(profile.username)}`,
      window.location.href
    ).href;

    function createQR() {
      if (!window.QRCode) return;

      new QRCode($("#hanoonQR"), {
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
      const qr = document.createElement("script");

      qr.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

      qr.onload = createQR;

      qr.onerror = () => {
        $("#hanoonQR").textContent =
          "تعذر تحميل رمز QR حاليًا.";
      };

      document.head.appendChild(qr);
    }

    $("#hanoonContinue").addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }

  /* إدخال كود SMS */
  async function requestVerificationCode() {
    const code = window.prompt(
      "أدخل كود التحقق الذي وصلك في رسالة SMS:"
    );

    if (code === null) {
      throw new Error(
        "تم إلغاء التحقق. يمكنك تسجيل الدخول بعد إكمال التحقق من رقم الهاتف."
      );
    }

    const token = code.trim();

    if (!/^\d{6}$/.test(token)) {
      throw new Error("كود التحقق يجب أن يتكون من 6 أرقام.");
    }

    return token;
  }

  /* إنشاء الحساب */
  async function register(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#createAccountButton");
    state.busy = true;

    setBusy(button, true, "جارٍ إنشاء الحساب...");

    try {
      if (!validateStepOne() || !validateStepTwo()) return;

      const phone = normalizeEgyptianPhone(
        $("#registerPhone").value
      );

      const password = $("#registerPassword").value;
      const name = $("#displayName").value.trim();

      const username = $("#username").value
        .trim()
        .toLowerCase();

      const hobbies = $("#hobbies").value
        .split(/[،,]/)
        .map(value => value.trim())
        .filter(Boolean);

      const readingInterests = $("#readingInterests").value
        .split(/[،,]/)
        .map(value => value.trim())
        .filter(Boolean);

      const bio = $("#bio").value.trim();

      state.compressedPhoto = await compressImage(state.photo);

      await saveTemporaryPhoto(state.compressedPhoto);

      const { data, error } = await supabase.auth.signUp({
        phone,
        password,
        options: {
          data: {
            full_name: name,
            username,
            hobbies,
            reading_interests: readingInterests,
            bio
          }
        }
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("لم يتم إنشاء الحساب.");
      }

      let user = data.user;

      // إذا كان تأكيد الهاتف مفعّلًا، نتحقق من كود SMS
      if (!data.session) {
        notify("تم إرسال كود التحقق إلى هاتفك.", "success");

        const token = await requestVerificationCode();

        const { data: verified, error: verifyError } =
          await supabase.auth.verifyOtp({
            phone,
            token,
            type: "sms"
          });

        if (verifyError) throw verifyError;

        if (!verified.user || !verified.session) {
          throw new Error("لم يكتمل التحقق من رقم الهاتف.");
        }

        user = verified.user;
      }

      const profile = await createProfile(
        user,
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

  /* تسجيل الدخول برقم الهاتف وكلمة المرور */
  async function login(event) {
    event.preventDefault();

    if (state.busy) return;

    const button = $("#loginButton");
    state.busy = true;

    setBusy(button, true, "جارٍ تسجيل الدخول...");

    try {
      const phone = normalizeEgyptianPhone(
        $("#loginPhone").value
      );

      const password = $("#loginPassword").value;

      if (!password) {
        throw new Error("أدخل كلمة المرور.");
      }

      const { data, error } = await supabase.auth
        .signInWithPassword({
          phone,
          password
        });

      if (error) throw error;

      const profile = await getOrCreateProfile(data.user);

      if (!profile.profile_completed) {
        throw new Error(
          "يجب إكمال بيانات ملفك الشخصي أولاً."
        );
      }

      window.location.href = "profile.html";

    } catch (error) {
      console.error("Login error:", error);
      notify(errorMessage(error));

    } finally {
      state.busy = false;
      setBusy(button, false);
    }
  }

  /* استعادة كلمة المرور عن طريق الهاتف */
  async function resetPassword() {
    let phone;

    try {
      phone = normalizeEgyptianPhone($("#loginPhone").value);
    } catch (error) {
      notify("اكتب رقم هاتفك المصري أولاً.");
      return;
    }

    const button = $("#forgotPassword");

    button.style.pointerEvents = "none";
    button.style.opacity = ".6";

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) throw error;

      const token = await requestVerificationCode();

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms"
      });

      if (verifyError) throw verifyError;

      const newPassword = window.prompt(
        "تم التحقق من رقمك. أدخل كلمة المرور الجديدة (8 أحرف على الأقل):"
      );

      if (newPassword === null) {
        notify(
          "تم التحقق من رقمك. يمكنك تغيير كلمة المرور لاحقًا من إعدادات الحساب.",
          "success"
        );
        return;
      }

      if (newPassword.length < 8) {
        throw new Error(
          "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل."
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      notify("تم تغيير كلمة المرور بنجاح.", "success");

    } catch (error) {
      console.error("Password recovery error:", error);
      notify(errorMessage(error));

    } finally {
      button.style.pointerEvents = "";
      button.style.opacity = "";
    }
  }

  /* ربط الأزرار */
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

    $("#forgotPassword").addEventListener("click", event => {
      event.preventDefault();
      resetPassword();
    });
  }

  /* تشغيل الصفحة */
  async function init() {
    bindEvents();

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session) {
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
      }
    }
  }

  try {
    supabase = await waitForSupabase();
    await init();

    console.info("HANOON: Phone authentication is ready.");

  } catch (error) {
    console.error("HANOON initialization error:", error);
    notify(errorMessage(error));
  }

})();
