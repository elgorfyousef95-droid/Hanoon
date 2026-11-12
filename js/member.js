
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elements = {
    loading: $("loading"),
    error: $("error"),
    content: $("memberContent"),
    avatar: $("avatar"),
    name: $("name"),
    username: $("username"),
    bio: $("bio"),
    code: $("memberCode"),
    hobbies: $("hobbies"),
    reading: $("reading")
  };

  function showError(message) {
    elements.loading.hidden = true;
    elements.content.hidden = true;
    elements.error.textContent = message;
    elements.error.classList.add("show");
  }

  function showLoading(message) {
    elements.loading.hidden = false;
    elements.loading.textContent = message;
    elements.error.classList.remove("show");
    elements.content.hidden = true;
  }

  function showContent() {
    elements.loading.hidden = true;
    elements.error.classList.remove("show");
    elements.content.hidden = false;
  }

  async function waitForSupabase() {
    if (window.HANOON?.supabase) {
      return window.HANOON.supabase;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("hanoon:supabase-ready", ready);
        reject(new Error("تعذر الاتصال بقاعدة البيانات"));
      }, 12000);

      function ready() {
        clearTimeout(timeout);

        if (window.HANOON?.supabase) {
          resolve(window.HANOON.supabase);
        } else {
          reject(new Error("لم يتم تجهيز اتصال قاعدة البيانات"));
        }
      }

      window.addEventListener("hanoon:supabase-ready", ready, {
        once: true
      });
    });
  }

  function getSearchValue() {
    const params = new URLSearchParams(window.location.search);

    return {
      id: (params.get("id") || "").trim(),
      code: (params.get("code") || "").trim().toUpperCase(),
      user: (params.get("user") || params.get("username") || "")
        .trim()
        .replace(/^@/, "")
        .toLowerCase()
    };
  }

  async function findMember(supabase, search) {
    let query;

    if (search.code) {
      if (!/^HN-[A-F0-9]{10}$/.test(search.code)) {
        throw new Error("كود العضو غير صحيح");
      }

      query = supabase
        .from("member_directory")
        .select("id, username, member_code, full_name, avatar_path, bio, hobbies, reading_interests, created_at")
        .eq("member_code", search.code);
    } else if (search.id) {
      query = supabase
        .from("member_directory")
        .select("id, username, member_code, full_name, avatar_path, bio, hobbies, reading_interests, created_at")
        .eq("id", search.id);
    } else if (search.user) {
      query = supabase
        .from("member_directory")
        .select("id, username, member_code, full_name, avatar_path, bio, hobbies, reading_interests, created_at")
        .eq("username", search.user);
    } else {
      throw new Error("رابط الملف الشخصي لا يحتوي على ID أو كود أو اسم مستخدم");
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Member lookup error:", error);
      throw new Error("حدث خطأ أثناء البحث عن العضو");
    }

    if (!data) {
      throw new Error("لم نعثر على هذا العضو. تأكد من الكود أو اسم المستخدم");
    }

    return data;
  }

  function renderTags(container, values, emptyMessage) {
    container.replaceChildren();

    const list = Array.isArray(values)
      ? values.filter(value => typeof value === "string" && value.trim())
      : [];

    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    list.forEach(value => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      container.appendChild(tag);
    });
  }

  function getAvatarUrl(supabase, path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const { data } = supabase
      .storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function renderMember(supabase, member) {
    elements.name.textContent = member.full_name || "عضو هنون";
    elements.username.textContent = member.username
      ? "@" + member.username
      : "";

    elements.bio.textContent = member.bio || "لم يضف العضو نبذة شخصية بعد";

    elements.code.textContent = member.member_code
      ? "HANOON ID: " + member.member_code
      : "عضو في مجتمع هنون";

    const avatarUrl = getAvatarUrl(supabase, member.avatar_path);

    elements.avatar.replaceChildren();

    if (avatarUrl) {
      const image = document.createElement("img");
      image.src = avatarUrl;
      image.alt = member.full_name || "صورة العضو";
      image.loading = "lazy";

      image.onerror = () => {
        elements.avatar.textContent =
          (member.full_name || "H").trim().charAt(0) || "H";
      };

      elements.avatar.appendChild(image);
    } else {
      elements.avatar.textContent =
        (member.full_name || "H").trim().charAt(0) || "H";
    }

    renderTags(
      elements.hobbies,
      member.hobbies,
      "لم يضف العضو هواياته بعد"
    );

    renderTags(
      elements.reading,
      member.reading_interests,
      "لم يحدد اهتماماته القرائية بعد"
    );

    document.title =
      (member.full_name || "عضو هنون") + " | HANOON";

    showContent();
  }

  async function init() {
    try {
      const search = getSearchValue();

      showLoading("جارٍ الاتصال بقاعدة البيانات...");

      const supabase = await waitForSupabase();

      showLoading("جارٍ البحث عن العضو...");

      const member = await findMember(supabase, search);

      renderMember(supabase, member);

    } catch (error) {
      console.error("HANOON member page:", error);

      showError(
        error.message || "تعذر عرض الملف الشخصي حاليًا"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
