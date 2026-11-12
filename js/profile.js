
/* =====================================================
   HANOON - PROFILE SYSTEM
   Supabase Profile / Avatar / QR / Account
===================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let supabase = null;
  let currentUser = null;
  let currentProfile = null;
  let busy = false;

  function toast(message) {
    const element = $("toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => element.classList.remove("show"), 2600);
  }

  function showMessage(message, type = "error") {
    const element = $("profileMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `message show ${type}`;
  }

  function showPageError(message) {
    const element = $("pageError");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  function parseList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item === "string" && item.trim());
  }

  function listToText(value) {
    return parseList(value).join("، ");
  }

  function renderTags(container, items, emptyMessage) {
    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("span");
      empty.className = "empty-text";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item;
      container.appendChild(tag);
    });
  }

  function getAvatarURL(path) {
    if (!path) return "";

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function renderAvatar(path, name) {
    const container = $("profileAvatar");
    container.replaceChildren();

    const url = getAvatarURL(path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "الصورة الشخصية";
      image.loading = "lazy";

      image.onerror = () => {
        container.replaceChildren();
        container.textContent = (name || "H").charAt(0);
      };

      container.appendChild(image);
    } else {
      container.textContent = (name || "H").charAt(0);
    }
  }

  function renderQR(username) {
    const container = $("profileQR");
    container.replaceChildren();

    if (!window.QRCode) {
      container.textContent = "تعذر تحميل رمز QR";
      return;
    }

    const url = new URL(
      "profile.html",
      window.location.href
    );

    url.searchParams.set("user", username);

    new QRCode(container, {
      text: url.href,
      width: 150,
      height: 150,
      colorDark: "#111827",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function renderProfile(profile) {
    currentProfile = profile;

    $("profileName").textContent = profile.full_name || "عضو هنون";
    $("profileUsername").textContent = "@" + (profile.username || "");
    $("profileBio").textContent =
      profile.bio || "لم يضف العضو نبذة شخصية بعد.";

    $("memberCode").textContent = profile.member_code || "غير متاح";

    renderAvatar(profile.avatar_path, profile.full_name);

    renderTags(
      $("hobbiesList"),
      parseList(profile.hobbies),
      "لم تتم إضافة هوايات بعد."
    );

    renderTags(
      $("readingList"),
      parseList(profile.reading_interests),
      "لم تتم إضافة اهتمامات قرائية بعد."
    );

    $("editName").value = profile.full_name || "";
    $("editUsername").value = profile.username || "";
    $("editBio").value = profile.bio || "";
    $("editHobbies").value = listToText(profile.hobbies);
    $("editReading").value = listToText(profile.reading_interests);

    renderQR(profile.username);

    $("profileLoading").hidden = true;
    $("profileContent").hidden = false;
  }

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "لم نعثر على ملفك الشخصي. سجّل الدخول من جديد أو أكمل إنشاء حسابك."
      );
    }

    if (!data.profile_completed) {
      window.location.href = "auth.html";
      return;
    }

    renderProfile(data);
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("اختر صورة صحيحة.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
    }

    const image = new Image();
    const objectURL = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("تعذرت قراءة الصورة.")
        );
        image.src = objectURL;
      });

      const canvas = document.createElement("canvas");
      const size = 512;

      canvas.width = size;
      canvas.height = size;

      const cropSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      const x = (image.naturalWidth - cropSize) / 2;
      const y = (image.naturalHeight - cropSize) / 2;

      const context = canvas.getContext("2d");

      context.drawImage(
        image,
        x, y, cropSize, cropSize,
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
      URL.revokeObjectURL(objectURL);
    }
  }

  async function uploadAvatar(file) {
    const blob = await compressImage(file);
    const path = `${currentUser.id}/avatar.webp`;

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

  function splitInput(value) {
    return value
      .split(/[،,]/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (busy) return;

    const button = $("saveProfileButton");
    busy = true;
    button.disabled = true;
    button.textContent = "جارٍ الحفظ...";

    try {
      const fullName = $("editName").value.trim();
      const username = $("editUsername").value
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

      const bio = $("editBio").value.trim();

      if (fullName.length < 2 || fullName.length > 80) {
        throw new Error("الاسم يجب أن يكون بين حرفين و80 حرفًا.");
      }

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        throw new Error(
          "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _."
        );
      }

      const file = $("avatarInput").files?.[0];

      let avatarPath = currentProfile.avatar_path;

      if (file) {
        avatarPath = await uploadAvatar(file);
      }

      const updates = {
        full_name: fullName,
        username,
        bio,
        avatar_path: avatarPath,
        hobbies: splitInput($("editHobbies").value),
        reading_interests: splitInput($("editReading").value),
        interests: splitInput($("editHobbies").value),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id)
        .select("*")
        .single();

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("duplicate key")
        ) {
          throw new Error("اسم المستخدم مستخدم بالفعل.");
        }

        throw error;
      }

      $("avatarInput").value = "";

      renderProfile(data);
      showMessage("تم حفظ بياناتك بنجاح.", "success");
      toast("تم تحديث ملفك الشخصي.");

    } catch (error) {
      console.error("Profile save error:", error);
      showMessage(
        error.message || "تعذر حفظ التعديلات."
      );

    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "حفظ التعديلات";
    }
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      toast(successMessage);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";

      document.body.appendChild(input);
      input.select();

      const copied = document.execCommand("copy");
      input.remove();

      toast(
        copied ? successMessage : "تعذر النسخ من هذا المتصفح."
      );
    }
  }

  async function logout() {
    const confirmed = confirm("هل تريد تسجيل الخروج من هنون؟");
    if (!confirmed) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      toast("تعذر تسجيل الخروج.");
      return;
    }

    window.location.href = "auth.html";
  }

  function bindEvents() {
    $("profileForm").addEventListener("submit", saveProfile);

    $("logoutButton").addEventListener("click", logout);

    $("copyMemberCode").addEventListener("click", () => {
      copyText(
        currentProfile.member_code,
        "تم نسخ رقم العضوية."
      );
    });

    $("copyProfileLink").addEventListener("click", () => {
      const url = new URL(
        "profile.html",
        window.location.href
      );

      url.searchParams.set(
        "user",
        currentProfile.username
      );

      copyText(url.href, "تم نسخ رابط الملف الشخصي.");
    });
  }

  async function start() {
    try {
      const deadline = Date.now() + 12000;

      while (!window.HANOON?.supabase) {
        if (Date.now() > deadline) {
          throw new Error(
            "تعذر الاتصال بقاعدة البيانات. تأكد من وجود ملف supabase-client.js."
          );
        }

        await new Promise(resolve => {
          window.addEventListener(
            "hanoon:supabase-ready",
            resolve,
            { once: true }
          );

          setTimeout(resolve, 500);
        });
      }

      supabase = window.HANOON.supabase;

      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        window.location.href = "auth.html";
        return;
      }

      currentUser = data.session.user;

      bindEvents();
      await loadProfile();

    } catch (error) {
      console.error("HANOON profile error:", error);

      $("profileLoading").hidden = true;

      showPageError(
        error.message || "حدث خطأ أثناء تحميل الملف الشخصي."
      );
    }
  }

  start();

})();
