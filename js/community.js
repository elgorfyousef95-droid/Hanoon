
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const ui = {
    app: $("#communityApp"),
    authNotice: $("#authNotice"),
    groupList: $("#groupList"),
    groupSearch: $("#groupSearch"),
    groupPanel: $("#groupPanel"),
    groupForm: $("#groupForm"),
    groupName: $("#groupName"),
    groupDescription: $("#groupDescription"),
    groupMembers: $("#groupMembers"),
    newGroupBtn: $("#newGroupBtn"),
    refreshGroupsBtn: $("#refreshGroupsBtn"),
    cancelGroupBtn: $("#cancelGroupBtn"),
    notice: $("#globalNotice")
  };

  const state = {
    supabase: null,
    user: null,
    groups: [],
    memberships: new Set(),
    busy: false
  };

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showNotice(message, type = "") {
    if (!ui.notice) return;

    ui.notice.textContent = message;
    ui.notice.className = `notice ${type}`;
    ui.notice.classList.remove("hidden");

    clearTimeout(showNotice.timer);

    showNotice.timer = setTimeout(() => {
      ui.notice.classList.add("hidden");
    }, 4500);
  }

  function errorMessage(error) {
    console.error("HANOON groups:", error);

    const message = error?.message || "";

    if (message.includes("Failed to fetch")) {
      return "تعذر الاتصال بالإنترنت. حاول مرة أخرى.";
    }

    if (message.includes("row-level security")) {
      return "العملية مرفوضة بسبب صلاحيات قاعدة البيانات.";
    }

    if (message.includes("PGRST205")) {
      return "جدول المجموعات غير متاح. تحقق من إعدادات قاعدة البيانات.";
    }

    return message || "حدث خطأ غير متوقع.";
  }

  function setBusy(button, busy, label = "جارٍ التنفيذ...") {
    if (!button) return;

    if (busy) {
      button.dataset.previousText = button.textContent;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.textContent =
        button.dataset.previousText || button.textContent;
      button.disabled = false;
    }
  }

  function groupIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    `;
  }

  function getFilteredGroups() {
    const query = (ui.groupSearch?.value || "")
      .trim()
      .toLowerCase();

    if (!query) return state.groups;

    return state.groups.filter(group => {
      const text = [
        group.title,
        group.description
      ].join(" ").toLowerCase();

      return text.includes(query);
    });
  }

  async function loadGroups() {
    if (!state.supabase || !state.user) return;

    ui.groupList.innerHTML =
      `<div class="empty-state">جارٍ تحميل المجموعات...</div>`;

    try {
      const { data: groups, error } = await state.supabase
        .from("conversations")
        .select("id,title,description,created_by,created_at,conversation_type")
        .eq("conversation_type", "group")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      state.groups = groups || [];

      if (state.groups.length) {
        const ids = state.groups.map(group => group.id);

        const { data: memberships, error: membershipError } =
          await state.supabase
            .from("conversation_members")
            .select("conversation_id,user_id")
            .eq("user_id", state.user.id)
            .in("conversation_id", ids);

        if (membershipError) throw membershipError;

        state.memberships = new Set(
          (memberships || []).map(item => item.conversation_id)
        );
      } else {
        state.memberships = new Set();
      }

      await renderGroups();

    } catch (error) {
      ui.groupList.innerHTML = `
        <div class="empty-state">
          ${escapeHTML(errorMessage(error))}
        </div>
      `;
    }
  }

  async function renderGroups() {
    const groups = getFilteredGroups();

    if (!groups.length) {
      ui.groupList.innerHTML = `
        <div class="empty-state">
          ${state.groups.length
            ? "لا توجد مجموعات تطابق بحثك."
            : "لا توجد مجموعات حتى الآن. كن أول من ينشئ مجموعة في هنون."}
        </div>
      `;
      return;
    }

    const ids = groups.map(group => group.id);
    const counts = {};

    const { data: members, error } = await state.supabase
      .from("conversation_members")
      .select("conversation_id")
      .in("conversation_id", ids);

    if (error) {
      console.warn("Group member counts:", error);
    } else {
      (members || []).forEach(member => {
        counts[member.conversation_id] =
          (counts[member.conversation_id] || 0) + 1;
      });
    }

    ui.groupList.innerHTML = groups.map(group => {
      const joined = state.memberships.has(group.id);
      const isOwner = group.created_by === state.user.id;

      let actionLabel = "الانضمام للمجموعة";

      if (joined) actionLabel = "أنت عضو بالفعل";

      return `
        <article class="group-card">
          <div class="group-cover">
            <div class="group-icon">${groupIcon()}</div>
          </div>

          <div class="group-info">
            <div class="group-name">
              ${escapeHTML(group.title || "مجموعة هنون")}
            </div>

            <div class="group-description">
              ${escapeHTML(group.description || "مجموعة جديدة في مجتمع هنون.")}
            </div>

            <div class="group-meta">
              <span>${counts[group.id] || 0} أعضاء</span>
              <span>${isOwner ? "مجموعتك" : "مجموعة هنون"}</span>
            </div>

            <div class="group-actions">
              <button
                class="btn ${joined ? "secondary" : ""}"
                type="button"
                data-join-group="${escapeHTML(group.id)}"
                ${joined ? "disabled" : ""}
              >
                ${actionLabel}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    ui.groupList
      .querySelectorAll("[data-join-group]")
      .forEach(button => {
        button.addEventListener("click", () => {
          joinGroup(button.dataset.joinGroup, button);
        });
      });
  }

  async function joinGroup(groupId, button) {
    if (!state.user || !groupId) return;

    if (state.memberships.has(groupId)) {
      showNotice("أنت عضو بالفعل في هذه المجموعة.");
      return;
    }

    setBusy(button, true, "جارٍ الانضمام...");

    try {
      const { error } = await state.supabase
        .from("conversation_members")
        .insert({
          conversation_id: groupId,
          user_id: state.user.id,
          member_role: "member"
        });

      if (error) {
        if (error.code === "23505") {
          state.memberships.add(groupId);
          await renderGroups();
          showNotice("أنت عضو بالفعل في هذه المجموعة.");
          return;
        }

        throw error;
      }

      state.memberships.add(groupId);

      showNotice("تم انضمامك إلى المجموعة بنجاح.", "success");

      await renderGroups();

    } catch (error) {
      showNotice(errorMessage(error), "error");
    } finally {
      setBusy(button, false);
    }
  }

  function showCreatePanel() {
    ui.groupPanel.classList.remove("hidden");

    ui.groupPanel.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    ui.groupName.focus();
  }

  function hideCreatePanel() {
    ui.groupPanel.classList.add("hidden");
    ui.groupForm.reset();
  }

  async function findGroupMembers(value) {
    const terms = [...new Set(
      value.split(",")
        .map(item => item.trim())
        .filter(Boolean)
    )];

    const found = new Map();

    for (const term of terms) {
      const safeTerm = term.replace(/[,%()]/g, " ").trim();

      if (!safeTerm) continue;

      const { data, error } = await state.supabase
        .from("member_directory")
        .select("id,username,member_code")
        .or(
          `username.eq.${safeTerm},member_code.eq.${safeTerm}`
        )
        .limit(10);

      if (error) throw error;

      (data || []).forEach(member => {
        if (member.id !== state.user.id) {
          found.set(member.id, member);
        }
      });
    }

    return [...found.values()];
  }

  async function createGroup(event) {
    event.preventDefault();

    if (state.busy) return;

    const name = ui.groupName.value.trim();
    const description = ui.groupDescription.value.trim();
    const membersText = ui.groupMembers.value.trim();

    if (!name) {
      showNotice("اكتب اسم المجموعة أولاً.", "error");
      return;
    }

    const submit = ui.groupForm.querySelector(
      "button[type='submit']"
    );

    state.busy = true;
    setBusy(submit, true, "جارٍ إنشاء المجموعة...");

    try {
      const selectedMembers = await findGroupMembers(membersText);

      const { data: group, error } = await state.supabase
        .from("conversations")
        .insert({
          conversation_type: "group",
          title: name,
          description: description || null,
          created_by: state.user.id
        })
        .select("id,title,description,created_by,created_at,conversation_type")
        .single();

      if (error) throw error;

      const memberRows = [
        {
          conversation_id: group.id,
          user_id: state.user.id,
          member_role: "owner"
        },
        ...selectedMembers.map(member => ({
          conversation_id: group.id,
          user_id: member.id,
          member_role: "member"
        }))
      ];

      const { error: membersError } = await state.supabase
        .from("conversation_members")
        .insert(memberRows);

      if (membersError) {
        console.error(
          "Group created but adding members failed:",
          membersError
        );

        showNotice(
          "تم إنشاء المجموعة، لكن تعذرت إضافة بعض الأعضاء. راجع صلاحيات قاعدة البيانات.",
          "error"
        );
      } else {
        showNotice("تم إنشاء المجموعة بنجاح.", "success");
      }

      hideCreatePanel();
      await loadGroups();

    } catch (error) {
      showNotice(errorMessage(error), "error");
    } finally {
      state.busy = false;
      setBusy(submit, false);
    }
  }

  function connectEvents() {
    ui.newGroupBtn?.addEventListener("click", showCreatePanel);

    ui.cancelGroupBtn?.addEventListener("click", hideCreatePanel);

    ui.groupForm?.addEventListener("submit", createGroup);

    ui.refreshGroupsBtn?.addEventListener("click", loadGroups);

    ui.groupSearch?.addEventListener("input", renderGroups);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.user) {
        loadGroups();
      }
    });
  }

  async function initialize() {
    state.supabase = window.HANOON?.supabase;

    if (!state.supabase) {
      ui.authNotice.classList.remove("hidden");
      ui.authNotice.textContent =
        "تعذر تشغيل الاتصال بقاعدة البيانات. أعد تحميل الصفحة.";
      return;
    }

    try {
      const { data, error } = await state.supabase.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        ui.authNotice.classList.remove("hidden");
        ui.app.classList.add("hidden");
        return;
      }

      state.user = data.user;

      ui.authNotice.classList.add("hidden");
      ui.app.classList.remove("hidden");

      connectEvents();
      await loadGroups();

    } catch (error) {
      ui.authNotice.classList.remove("hidden");
      ui.authNotice.textContent = errorMessage(error);
      ui.app.classList.add("hidden");
    }
  }

  function startWhenReady() {
    if (window.HANOON?.supabase) {
      initialize();
      return;
    }

    window.addEventListener(
      "hanoon:supabase-ready",
      initialize,
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady, {
      once: true
    });
  } else {
    startWhenReady();
  }

})();
