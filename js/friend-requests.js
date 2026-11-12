
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    db: null,
    user: null,
    incoming: [],
    sent: [],
    busy: new Set(),
    view: "incoming"
  };

  const ui = {
    app: $("requestsApp"),
    auth: $("authNotice"),
    incoming: $("incomingList"),
    sent: $("sentList"),
    count: $("requestsCount"),
    notice: $("globalNotice")
  };

  function showNotice(message, type = "") {
    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 4500);
  }

  function showEmpty(container, message) {
    const element = document.createElement("div");
    element.className = "empty";
    element.textContent = message;
    container.replaceChildren(element);
  }

  function nameOf(member) {
    return member?.full_name || member?.username || "عضو هنون";
  }

  function avatarURL(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    const { data } = state.db.storage
      .from("avatars")
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function createAvatar(member) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const url = avatarURL(member?.avatar_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = nameOf(member);
      image.loading = "lazy";

      image.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent = nameOf(member).charAt(0);
      };

      avatar.appendChild(image);
    } else {
      avatar.textContent = nameOf(member).charAt(0) || "هـ";
    }

    return avatar;
  }

  function createButton(label, className, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${className || ""}`;
    button.textContent = label;
    button.addEventListener("click", callback);
    return button;
  }

  function openProfile(member) {
    if (!member?.id) return;

    const params = new URLSearchParams();

    if (member.username) {
      params.set("user", member.username);
    } else if (member.member_code) {
      params.set("code", member.member_code);
    } else {
      params.set("id", member.id);
    }

    window.location.href = `member.html?${params.toString()}`;
  }

  async function loadRequests() {
    showEmpty(ui.incoming, "جارٍ تحميل الطلبات الواردة...");
    showEmpty(ui.sent, "جارٍ تحميل الطلبات المرسلة...");

    const { data, error } = await state.db
      .from("friend_requests")
      .select("id,sender_id,receiver_id,status")
      .eq("status", "pending")
      .or(
        `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
      );

    if (error) throw error;

    const requests = data || [];

    const incoming = requests.filter(
      item => item.receiver_id === state.user.id
    );

    const sent = requests.filter(
      item => item.sender_id === state.user.id
    );

    const memberIds = [
      ...new Set([
        ...incoming.map(item => item.sender_id),
        ...sent.map(item => item.receiver_id)
      ])
    ];

    let members = [];

    if (memberIds.length) {
      const { data: profiles, error: profileError } =
        await state.db
          .from("member_directory")
          .select("id,username,member_code,full_name,avatar_path,bio")
          .in("id", memberIds);

      if (profileError) throw profileError;

      members = profiles || [];
    }

    const memberMap = new Map(
      members.map(member => [member.id, member])
    );

    state.incoming = incoming.map(request => ({
      ...request,
      member: memberMap.get(request.sender_id)
    }));

    state.sent = sent.map(request => ({
      ...request,
      member: memberMap.get(request.receiver_id)
    }));

    renderRequests();
  }

  function renderRequests() {
    ui.count.textContent = `${state.incoming.length} طلب وارد`;

    renderIncoming();
    renderSent();
  }

  function renderIncoming() {
    ui.incoming.replaceChildren();

    if (!state.incoming.length) {
      showEmpty(ui.incoming, "لا توجد طلبات صداقة واردة حالياً.");
      return;
    }

    state.incoming.forEach(request => {
      const member = request.member;

      if (!member) return;

      const card = document.createElement("article");
      card.className = "request-card";

      const info = document.createElement("div");
      info.className = "info";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = nameOf(member);

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = [
        member.username ? `@${member.username}` : "",
        member.member_code || ""
      ].filter(Boolean).join(" · ") || "عضو هنون";

      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "actions";

      const accept = createButton(
        "قبول",
        "",
        () => updateRequest(request, "accepted")
      );

      const reject = createButton(
        "رفض",
        "danger",
        () => updateRequest(request, "rejected")
      );

      const profile = createButton(
        "الملف",
        "secondary",
        () => openProfile(member)
      );

      actions.append(accept, reject, profile);

      card.append(createAvatar(member), info, actions);

      card.addEventListener("click", event => {
        if (!event.target.closest("button")) {
          openProfile(member);
        }
      });

      ui.incoming.appendChild(card);
    });
  }

  function renderSent() {
    ui.sent.replaceChildren();

    if (!state.sent.length) {
      showEmpty(ui.sent, "لم ترسل أي طلبات صداقة معلّقة.");
      return;
    }

    state.sent.forEach(request => {
      const member = request.member;

      if (!member) return;

      const card = document.createElement("article");
      card.className = "request-card";

      const info = document.createElement("div");
      info.className = "info";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = nameOf(member);

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = member.username
        ? `@${member.username} · في انتظار الرد`
        : "في انتظار الرد";

      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "actions";

      const profile = createButton(
        "الملف",
        "secondary",
        () => openProfile(member)
      );

      const cancel = createButton(
        "إلغاء الطلب",
        "danger",
        () => cancelRequest(request)
      );

      actions.append(profile, cancel);

      card.append(createAvatar(member), info, actions);
      ui.sent.appendChild(card);
    });
  }

  async function updateRequest(request, newStatus) {
    if (state.busy.has(request.id)) return;

    state.busy.add(request.id);

    try {
      const { data, error } = await state.db
        .from("friend_requests")
        .update({ status: newStatus })
        .eq("id", request.id)
        .eq("receiver_id", state.user.id)
        .eq("status", "pending")
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error("لم يتم تحديث الطلب. ربما تم التعامل معه من قبل.");
      }

      showNotice(
        newStatus === "accepted"
          ? "تم قبول طلب الصداقة. أصبح العضو صديقك الآن."
          : "تم رفض طلب الصداقة.",
        "success"
      );

      await loadRequests();

    } catch (error) {
      console.error("HANOON update request:", error);
      showNotice(error.message || "تعذر تحديث الطلب.", "error");
    } finally {
      state.busy.delete(request.id);
    }
  }

  async function cancelRequest(request) {
    if (state.busy.has(request.id)) return;

    state.busy.add(request.id);

    try {
      const { data, error } = await state.db
        .from("friend_requests")
        .delete()
        .eq("id", request.id)
        .eq("sender_id", state.user.id)
        .eq("status", "pending")
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error("تعذر إلغاء الطلب. ربما تم التعامل معه بالفعل.");
      }

      showNotice("تم إلغاء طلب الصداقة المرسل.", "success");

      await loadRequests();

    } catch (error) {
      console.error("HANOON cancel request:", error);
      showNotice(error.message || "تعذر إلغاء الطلب.", "error");
    } finally {
      state.busy.delete(request.id);
    }
  }

  function switchView(view) {
    state.view = view;

    $("incomingView").classList.toggle(
      "hidden",
      view !== "incoming"
    );

    $("sentView").classList.toggle(
      "hidden",
      view !== "sent"
    );

    document.querySelectorAll("[data-request-view]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.requestView === view
      );
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-request-view]").forEach(button => {
      button.addEventListener("click", () => {
        switchView(button.dataset.requestView);
      });
    });

    $("refreshRequestsBtn")?.addEventListener("click", async () => {
      const button = $("refreshRequestsBtn");
      button.disabled = true;
      button.textContent = "جارٍ التحديث...";

      try {
        await loadRequests();
        showNotice("تم تحديث الطلبات.", "success");
      } catch (error) {
        showNotice(error.message || "تعذر تحديث الطلبات.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "تحديث الطلبات";
      }
    });
  }

  async function initialize() {
    try {
      if (!window.HANOON?.supabase) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("انتهت مهلة الاتصال بقاعدة البيانات."));
          }, 12000);

          window.addEventListener("hanoon:supabase-ready", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });

          window.addEventListener("hanoon:supabase-error", event => {
            clearTimeout(timer);
            reject(new Error(
              event.detail?.message || "تعذر الاتصال بقاعدة البيانات."
            ));
          }, { once: true });
        });
      }

      state.db = window.HANOON?.supabase;

      if (!state.db) {
        throw new Error("اتصال قاعدة البيانات غير جاهز.");
      }

      const { data, error } = await state.db.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        ui.app.classList.add("hidden");
        ui.auth.classList.remove("hidden");
        return;
      }

      state.user = data.user;

      ui.auth.classList.add("hidden");
      ui.app.classList.remove("hidden");

      bindEvents();
      await loadRequests();

    } catch (error) {
      console.error("HANOON friend requests:", error);

      ui.app.classList.add("hidden");
      ui.auth.classList.remove("hidden");

      showNotice(
        error.message || "تعذر تحميل طلبات الصداقة.",
        "error"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
