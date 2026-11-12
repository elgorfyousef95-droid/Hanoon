
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const accountButton = $("accountButton");
  const profileLink = $("headerProfileLink");
  const profileInitial = $("headerProfileInitial");
  const profileImage = $("headerProfileImage");
  const profileName = $("headerProfileName");
  const profileMeta = $("headerProfileMeta");

  if (
    !accountButton ||
    !profileLink ||
    !profileInitial ||
    !profileImage ||
    !profileName ||
    !profileMeta
  ) {
    console.error("HANOON: header account elements are missing.");
    return;
  }

  let supabase = null;
  let requestNumber = 0;
  let authSubscription = null;
  let started = false;

  function showGuest() {
    accountButton.hidden = false;
    profileLink.hidden = true;

    profileImage.hidden = true;
    profileInitial.hidden = false;

    profileInitial.textContent = "م";
    profileName.textContent = "حسابي";
    profileMeta.textContent = "سجّل الدخول إلى هنون";

    profileImage.onload = null;
    profileImage.onerror = null;
    profileImage.removeAttribute("src");
  }

  function showUser(name, username, memberCode, avatarUrl) {
    accountButton.hidden = true;
    profileLink.hidden = false;

    const cleanName = String(name || "عضو هنون").trim();
    const cleanUsername = String(username || "")
      .trim()
      .replace(/^@/, "");

    profileName.textContent = cleanName;
    profileInitial.textContent = cleanName.charAt(0) || "م";

    profileMeta.textContent =
      (cleanUsername ? "@" + cleanUsername : "عضو هنون") +
      "  ·  ID: " +
      (memberCode || "قيد التحديث");

    profileImage.onload = () => {
      profileImage.hidden = false;
      profileInitial.hidden = true;
    };

    profileImage.onerror = () => {
      profileImage.hidden = true;
      profileInitial.hidden = false;
    };

    if (avatarUrl) {
      profileImage.hidden = false;
      profileInitial.hidden = true;
      profileImage.src = avatarUrl;
    } else {
      profileImage.removeAttribute("src");
      profileImage.hidden = true;
      profileInitial.hidden = false;
    }
  }

  async function updateAccount(user) {
    const currentRequest = ++requestNumber;

    if (!user) {
      showGuest();
      return;
    }

    const metadata = user.user_metadata || {};

    showUser(
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "عضو هنون",

      metadata.username ||
      metadata.user_name ||
      "",

      metadata.member_code || "",

      metadata.avatar_url ||
      metadata.picture ||
      ""
    );

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, username, member_code, avatar_path")
        .eq("id", user.id)
        .maybeSingle();

      if (currentRequest !== requestNumber) return;

      if (error) {
        console.warn(
          "HANOON profile header:",
          error.message
        );
        return;
      }

      let avatarUrl =
        metadata.avatar_url ||
        metadata.picture ||
        "";

      if (profile?.avatar_path) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(profile.avatar_path);

        avatarUrl = data?.publicUrl || avatarUrl;
      }

      if (currentRequest !== requestNumber) return;

      showUser(
        profile?.full_name ||
        metadata.full_name ||
        metadata.name ||
        user.email?.split("@")[0] ||
        "عضو هنون",

        profile?.username ||
        metadata.username ||
        metadata.user_name ||
        "",

        profile?.member_code ||
        metadata.member_code ||
        "",

        avatarUrl
      );

    } catch (error) {
      console.error(
        "HANOON account update:",
        error
      );
    }
  }

  async function start() {
    if (started) return;

    supabase = window.HANOON?.supabase;

    if (!supabase) return;

    started = true;

    try {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      await updateAccount(
        data?.session?.user || null
      );

      const { data: listener } =
        supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "SIGNED_OUT") {
              requestNumber++;
              showGuest();
              return;
            }

            if (
              event === "SIGNED_IN" ||
              event === "TOKEN_REFRESHED" ||
              event === "USER_UPDATED" ||
              event === "INITIAL_SESSION"
            ) {
              // نؤجل قراءة بيانات الحساب خارج callback المصادقة.
              window.setTimeout(() => {
                updateAccount(session?.user || null);
              }, 0);
            }
          }
        );

      authSubscription =
        listener?.subscription || null;

    } catch (error) {
      started = false;

      console.error(
        "HANOON header authentication:",
        error
      );

      showGuest();
    }
  }

  showGuest();

  if (window.HANOON?.supabase) {
    start();
  } else {
    window.addEventListener(
      "hanoon:supabase-ready",
      start,
      { once: true }
    );
  }

  window.addEventListener("pageshow", async () => {
    if (!supabase) return;

    try {
      const { data } = await supabase.auth.getSession();

      await updateAccount(
        data?.session?.user || null
      );
    } catch (error) {
      console.warn(
        "HANOON session refresh:",
        error
      );
    }
  });

  window.HANOON_HEADER_ACCOUNT = {
    refresh: async () => {
      if (!supabase) {
        await start();
        return;
      }

      const { data } = await supabase.auth.getSession();

      await updateAccount(
        data?.session?.user || null
      );
    },

    destroy() {
      authSubscription?.unsubscribe();
      authSubscription = null;
      started = false;
    }
  };
})();
