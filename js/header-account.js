
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
  ) return;

  let supabase = null;
  let requestNumber = 0;
  let authSubscription = null;

  function showGuest() {
    accountButton.hidden = false;
    profileLink.hidden = true;

    profileImage.hidden = true;
    profileInitial.hidden = false;

    profileInitial.textContent = "م";
    profileName.textContent = "حسابي";
    profileMeta.textContent = "سجّل الدخول إلى هنون";
    
    profileImage.removeAttribute("src");
  }

  function showUser(name, username, memberCode, avatarUrl) {
    accountButton.hidden = true;
    profileLink.hidden = false;

    const cleanName = String(name || "عضو هنون").trim();
    const cleanUsername = String(username || "").replace(/^@/, "");

    profileName.textContent = cleanName;
    profileInitial.textContent = cleanName.charAt(0) || "م";

    profileMeta.textContent =
      (cleanUsername ? "@" + cleanUsername : "عضو هنون") +
      "  ·  ID: " + (memberCode || "قيد التحديث");

    profileImage.onload = () => {
      profileImage.hidden = false;
      profileInitial.hidden = true;
    };

    profileImage.onerror = () => {
      profileImage.hidden = true;
      profileInitial.hidden = false;
    };

    if (avatarUrl) {
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

    // إظهار الحساب وإخفاء زر الدخول فور تأكيد الجلسة
    showUser(
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "عضو هنون",
      user.user_metadata?.username ||
      user.user_metadata?.user_name ||
      "",
      user.user_metadata?.member_code || "",
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
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
        console.warn("HANOON profile header:", error.message);
        return;
      }

      let avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        "";

      if (profile?.avatar_path) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(profile.avatar_path);

        avatarUrl = data?.publicUrl || avatarUrl;
      }

      showUser(
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0],
        profile?.username ||
        user.user_metadata?.username ||
        "",
        profile?.member_code ||
        user.user_metadata?.member_code ||
        "",
        avatarUrl
      );

    } catch (error) {
      console.error("HANOON account update:", error);
    }
  }

  async function start() {
    if (supabase) return;

    supabase = window.HANOON?.supabase;

    if (!supabase) return;

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      await updateAccount(data?.session?.user || null);

      const { data: listener } = supabase.auth.onAuthStateChange(
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
            updateAccount(session?.user || null);
          }
        }
      );

      authSubscription = listener?.subscription || null;

    } catch (error) {
      console.error("HANOON header authentication:", error);
      showGuest();
    }
  }

  showGuest();

  if (window.HANOON?.supabase) {
    start();
  } else {
    window.addEventListener("hanoon:supabase-ready", start);
  }

  window.addEventListener("pageshow", () => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        updateAccount(data?.session?.user || null);
      });
    }
  });

  window.HANOON_HEADER_ACCOUNT = {
    refresh: start,
    destroy() {
      authSubscription?.unsubscribe();
      authSubscription = null;
    }
  };
})();
