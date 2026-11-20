(() => {
  "use strict";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const API = {
    session: "/api/admin/session",
    messages: "/api/admin/messages",
    profile: "/api/admin/profile",
    skills: "/api/admin/skills",
    logout: "/api/admin/logout"
  };

  const state = {
    messages: [],
    skills: [],
    currentMessage: null,
    editingSkillId: null,
    deletingSkillId: null,
    activeSection: "overview",
    loadingSkills: false,
    loadingMessages: false,
    loadingProfile: false
  };

  const elements = {
    sidebar: $("#sidebar"),
    sidebarOverlay: $("#sidebarOverlay"),
    menuToggle: $("#menuToggle"),
    toast: $("#adminToast"),
    skillModal: $("#skillModal"),
    deleteSkillModal: $("#deleteSkillModal"),
    skillForm: $("#skillForm"),
    skillTableBody: $("#skillsTableBody"),
    messageModal: $("#messageModal"),
    messageModalBody: $("#messageModalBody"),
    messageModalActions: $("#messageModalActions")
  };

  // =========================================
  // API HELPER
  // =========================================

  async function api(url, options = {}) {
    const config = {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (
      (response.status === 401 || response.status === 403) &&
      url !== API.session
    ) {
      showToast(
        "انتهت الجلسة أو لا تملك صلاحية تنفيذ هذا الإجراء.",
        "error"
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Request failed: ${response.status}`
      );
    }

    return data;
  }

  // =========================================
  // GENERAL HELPERS
  // =========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[char];
    });
  }

  function showToast(message, type = "success") {
    const toast = elements.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.dataset.type = type;

    toast.classList.remove("success", "error");
    toast.classList.add(type);
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  function setButtonLoading(button, loading, loadingText = "جاري الحفظ...") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText !== undefined) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function setElementVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  // =========================================
  // SESSION
  // =========================================

  async function checkSession() {
    try {
      await api(API.session);
      return true;
    } catch (error) {
      console.error("Session check failed:", error);
      window.location.replace("/admin.html");
      return false;
    }
  }

  // =========================================
  // NAVIGATION
  // =========================================

  function activateSection(sectionName) {
    if (!sectionName) return;

    const target = $(`#section-${sectionName}`);
    if (!target) return;

    state.activeSection = sectionName;

    $$(".dashboard-section").forEach((section) => {
      section.classList.toggle(
        "active",
        section.id === `section-${sectionName}`
      );
    });

    $$(".nav-item").forEach((item) => {
      const active = item.dataset.section === sectionName;

      item.classList.toggle("active", active);

      if (active) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });

    closeSidebar();

    if (sectionName === "profile") loadProfile();
    if (sectionName === "skills") loadSkills();
    if (sectionName === "messages") loadMessages();
  }

  function openSidebar() {
    elements.sidebar?.classList.add("open");
    elements.sidebarOverlay?.classList.add("active");
    elements.sidebarOverlay?.classList.add("show");
    elements.menuToggle?.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    elements.sidebar?.classList.remove("open");
    elements.sidebarOverlay?.classList.remove("active");
    elements.sidebarOverlay?.classList.remove("show");
    elements.menuToggle?.setAttribute("aria-expanded", "false");
  }

  function initializeNavigation() {
    $$(".nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        activateSection(item.dataset.section);
      });
    });

    $$("[data-go-section]").forEach((button) => {
      button.addEventListener("click", () => {
        activateSection(button.dataset.goSection);
      });
    });

    elements.menuToggle?.addEventListener("click", openSidebar);
    elements.sidebarOverlay?.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
        closeSkillModal();
        closeDeleteSkillModal();
        closeMessageModal();
      }
    });
  }

  // =========================================
  // PROFILE
  // =========================================

  async function loadProfile() {
    const form = $("#profileForm");
    if (!form || state.loadingProfile) return;

    state.loadingProfile = true;

    const status = $("#profileFormStatus");

    if (status) {
      status.textContent = "جاري تحميل البيانات...";
    }

    try {
      const data = await api(API.profile);
      const profile = data.profile || data;

      const fields = {
        profileFullName: profile.full_name,
        profileJobTitle: profile.job_title,
        profileShortBio: profile.short_bio,
        profileAbout: profile.about,
        profileLocation: profile.location,
        profileEmail: profile.email,
        profileImage: profile.image
      };

      Object.entries(fields).forEach(([id, value]) => {
        const input = $(`#${id}`);

        if (input && value !== undefined && value !== null) {
          input.value = value;
        }
      });

      if (status) status.textContent = "";
    } catch (error) {
      console.error("Profile loading error:", error);

      if (status) {
        status.textContent = "تعذر تحميل بيانات الملف الشخصي.";
      }

      showToast("فشل تحميل الملف الشخصي.", "error");
    } finally {
      state.loadingProfile = false;
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const form = $("#profileForm");
    const button = $("#saveProfile");
    const status = $("#profileFormStatus");

    if (!form) return;

    const body = {
      full_name: $("#profileFullName")?.value.trim() || "",
      job_title: $("#profileJobTitle")?.value.trim() || "",
      short_bio: $("#profileShortBio")?.value.trim() || "",
      about: $("#profileAbout")?.value.trim() || "",
      location: $("#profileLocation")?.value.trim() || "",
      email: $("#profileEmail")?.value.trim() || "",
      image: $("#profileImage")?.value.trim() || ""
    };

    setButtonLoading(button, true);

    if (status) status.textContent = "جاري حفظ التغييرات...";

    try {
      await api(API.profile, {
        method: "POST",
        body
      });

      if (status) {
        status.textContent = "تم حفظ البيانات بنجاح.";
      }

      showToast("تم تحديث الملف الشخصي بنجاح.");
    } catch (error) {
      console.error("Profile save error:", error);

      if (status) status.textContent = error.message;

      showToast(error.message || "فشل حفظ البيانات.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // =========================================
  // SKILLS
  // =========================================

  function updateSkillsStatistics() {
    const total = state.skills.length;

    const visible = state.skills.filter(
      (skill) => skill.is_visible === true
    ).length;

    const hidden = total - visible;

    setText("#skillsTotalCount", total);
    setText("#skillsVisibleCount", visible);
    setText("#skillsHiddenCount", hidden);
    setText("#statSkills", total);
  }

  function getFilteredSkills() {
    const search = ($("#skillSearch")?.value || "")
      .trim()
      .toLowerCase();

    const filter = $("#skillVisibilityFilter")?.value || "all";

    return state.skills.filter((skill) => {
      const searchableText = [
        skill.name_ar,
        skill.name_en,
        skill.category,
        skill.icon
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(search);
      const isVisible = skill.is_visible === true;

      const matchesFilter =
        filter === "all" ||
        (filter === "visible" && isVisible) ||
        (filter === "hidden" && !isVisible);

      return matchesSearch && matchesFilter;
    });
  }

  function renderSkills() {
    const loading = $("#skillsLoading");
    const empty = $("#skillsEmpty");
    const error = $("#skillsError");
    const table = $("#skillsTableContainer");
    const noResults = $("#skillsNoResults");
    const tbody = elements.skillTableBody;

    if (!tbody) return;

    setElementVisible(loading, false);
    setElementVisible(error, false);

    updateSkillsStatistics();

    if (!state.skills.length) {
      setElementVisible(empty, true);
      setElementVisible(table, false);
      setElementVisible(noResults, false);
      return;
    }

    setElementVisible(empty, false);

    const filteredSkills = getFilteredSkills();

    if (!filteredSkills.length) {
      setElementVisible(table, false);
      setElementVisible(noResults, true);
      return;
    }

    setElementVisible(table, true);
    setElementVisible(noResults, false);

    tbody.innerHTML = filteredSkills.map((skill) => {
      const id = escapeHTML(skill.id);
      const nameAr = escapeHTML(skill.name_ar);
      const nameEn = escapeHTML(skill.name_en);
      const category = escapeHTML(skill.category || "بدون تصنيف");
      const icon = escapeHTML(skill.icon || "⌘");

      const progress = Math.min(
        100,
        Math.max(0, Number(skill.progress) || 0)
      );

      const visible = skill.is_visible === true;

      return `
        <tr data-skill-id="${id}">
          <td>
            <div class="skill-name-cell">
              <span class="skill-icon">${icon}</span>
              <div>
                <strong>${nameAr}</strong>
                <small>${nameEn}</small>
              </div>
            </div>
          </td>

          <td>${category}</td>

          <td>
            <div class="skill-progress-cell">
              <div class="skill-progress-track">
                <span style="width:${progress}%"></span>
              </div>
              <small>${progress}%</small>
            </div>
          </td>

          <td>${escapeHTML(skill.sort_order ?? 0)}</td>

          <td>
            <span class="status-badge ${visible ? "status-visible" : "status-hidden"}">
              ${visible ? "ظاهرة" : "مخفية"}
            </span>
          </td>

          <td>
            <div class="table-actions">
              <button
                type="button"
                class="table-action edit-skill-button"
                data-id="${id}"
                title="تعديل"
              >✎</button>

              <button
                type="button"
                class="table-action toggle-skill-button"
                data-id="${id}"
                data-visible="${visible}"
                title="${visible ? "إخفاء" : "إظهار"}"
              >${visible ? "◉" : "◎"}</button>

              <button
                type="button"
                class="table-action delete-skill-button"
                data-id="${id}"
                title="حذف"
              >×</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadSkills() {
    if (state.loadingSkills) return;

    state.loadingSkills = true;

    const loading = $("#skillsLoading");
    const errorBox = $("#skillsError");
    const errorMessage = $("#skillsErrorMessage");
    const table = $("#skillsTableContainer");
    const empty = $("#skillsEmpty");

    setElementVisible(loading, true);
    setElementVisible(errorBox, false);
    setElementVisible(table, false);
    setElementVisible(empty, false);

    try {
      const data = await api(API.skills);

      state.skills = Array.isArray(data.skills)
        ? data.skills
        : [];

      renderSkills();
    } catch (error) {
      console.error("Skills loading error:", error);

      setElementVisible(loading, false);
      setElementVisible(errorBox, true);

      if (errorMessage) {
        errorMessage.textContent =
          error.message || "حدث خطأ أثناء تحميل المهارات.";
      }
    } finally {
      state.loadingSkills = false;
    }
  }

  function openSkillModal(skill = null) {
    const form = elements.skillForm;
    if (!form) return;

    form.reset();

    state.editingSkillId = skill ? skill.id : null;

    $("#skillId").value = skill?.id ?? "";
    $("#skillNameAr").value = skill?.name_ar ?? "";
    $("#skillNameEn").value = skill?.name_en ?? "";
    $("#skillIcon").value = skill?.icon ?? "";
    $("#skillCategory").value = skill?.category ?? "";
    $("#skillProgress").value = skill?.progress ?? 0;
    $("#skillSortOrder").value = skill?.sort_order ?? 0;
    $("#skillIsVisible").checked = skill
      ? skill.is_visible === true
      : true;

    const title = $("#skillModalTitle");
    const saveButton = $("#saveSkillButton");
    const status = $("#skillFormStatus");

    if (title) {
      title.textContent = skill
        ? "تعديل المهارة"
        : "إضافة مهارة جديدة";
    }

    if (saveButton) {
      saveButton.textContent = skill
        ? "حفظ التعديلات"
        : "حفظ المهارة";
    }

    if (status) status.textContent = "";

    setElementVisible(elements.skillModal, true);
  }

  function closeSkillModal() {
    setElementVisible(elements.skillModal, false);
    state.editingSkillId = null;
  }

  async function saveSkill(event) {
    event.preventDefault();

    const button = $("#saveSkillButton");
    const status = $("#skillFormStatus");

    const nameAr = $("#skillNameAr")?.value.trim() || "";
    const nameEn = $("#skillNameEn")?.value.trim() || "";

    if (!nameAr || !nameEn) {
      if (status) {
        status.textContent =
          "يرجى إدخال اسم المهارة بالعربية والإنجليزية.";
      }

      return;
    }

    const progress = Number($("#skillProgress")?.value);
    const sortOrder = Number($("#skillSortOrder")?.value);

    if (
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100
    ) {
      if (status) {
        status.textContent =
          "مستوى التقدم يجب أن يكون بين 0 و100.";
      }

      return;
    }

    if (!Number.isInteger(sortOrder)) {
      if (status) {
        status.textContent =
          "ترتيب الظهور يجب أن يكون رقمًا صحيحًا.";
      }

      return;
    }

    const body = {
      name_ar: nameAr,
      name_en: nameEn,
      icon: $("#skillIcon")?.value.trim() || "",
      category: $("#skillCategory")?.value.trim() || "",
      progress,
      sort_order: sortOrder,
      is_visible: $("#skillIsVisible")?.checked === true
    };

    const editing = state.editingSkillId !== null;

    if (editing) {
      body.id = state.editingSkillId;
    }

    setButtonLoading(button, true);

    if (status) status.textContent = "جاري حفظ البيانات...";

    try {
      await api(API.skills, {
        method: editing ? "PATCH" : "POST",
        body
      });

      closeSkillModal();
      await loadSkills();

      showToast(
        editing
          ? "تم تحديث المهارة بنجاح."
          : "تمت إضافة المهارة بنجاح."
      );
    } catch (error) {
      console.error("Skill save error:", error);

      if (status) status.textContent = error.message;

      showToast(error.message || "تعذر حفظ المهارة.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function toggleSkillVisibility(id, currentVisibility) {
    const skill = state.skills.find(
      (item) => String(item.id) === String(id)
    );

    if (!skill) return;

    try {
      await api(API.skills, {
        method: "PATCH",
        body: {
          id: skill.id,
          is_visible: !currentVisibility
        }
      });

      await loadSkills();

      showToast(
        currentVisibility
          ? "تم إخفاء المهارة."
          : "تم إظهار المهارة."
      );
    } catch (error) {
      console.error("Skill visibility error:", error);

      showToast(
        error.message || "تعذر تغيير حالة المهارة.",
        "error"
      );
    }
  }

  function openDeleteSkillModal(id) {
    state.deletingSkillId = id;

    const input = $("#deleteSkillId");
    if (input) input.value = id;

    setElementVisible(elements.deleteSkillModal, true);
  }

  function closeDeleteSkillModal() {
    setElementVisible(elements.deleteSkillModal, false);
    state.deletingSkillId = null;
  }

  async function deleteSkill() {
    const button = $("#confirmDeleteSkill");
    const id = state.deletingSkillId;

    if (!id) return;

    setButtonLoading(button, true, "جاري الحذف...");

    try {
      await api(API.skills, {
        method: "DELETE",
        body: { id }
      });

      closeDeleteSkillModal();
      await loadSkills();

      showToast("تم حذف المهارة بنجاح.");
    } catch (error) {
      console.error("Skill delete error:", error);

      showToast(error.message || "تعذر حذف المهارة.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function initializeSkills() {
    $("#addSkillButton")?.addEventListener("click", () => {
      openSkillModal();
    });

    $("#addFirstSkillButton")?.addEventListener("click", () => {
      openSkillModal();
    });

    $("#refreshSkillsButton")?.addEventListener("click", loadSkills);
    $("#retrySkillsButton")?.addEventListener("click", loadSkills);

    $("#skillSearch")?.addEventListener("input", renderSkills);

    $("#skillVisibilityFilter")?.addEventListener(
      "change",
      renderSkills
    );

    elements.skillForm?.addEventListener("submit", saveSkill);

    $("#closeSkillModal")?.addEventListener(
      "click",
      closeSkillModal
    );

    $("#cancelSkillForm")?.addEventListener(
      "click",
      closeSkillModal
    );

    $("#closeDeleteSkillModal")?.addEventListener(
      "click",
      closeDeleteSkillModal
    );

    $("#cancelDeleteSkill")?.addEventListener(
      "click",
      closeDeleteSkillModal
    );

    $("#confirmDeleteSkill")?.addEventListener(
      "click",
      deleteSkill
    );

    elements.skillTableBody?.addEventListener("click", (event) => {
      const editButton = event.target.closest(".edit-skill-button");
      const toggleButton = event.target.closest(".toggle-skill-button");
      const deleteButton = event.target.closest(".delete-skill-button");

      if (editButton) {
        const skill = state.skills.find(
          (item) => String(item.id) === String(editButton.dataset.id)
        );

        if (skill) openSkillModal(skill);
      }

      if (toggleButton) {
        toggleSkillVisibility(
          toggleButton.dataset.id,
          toggleButton.dataset.visible === "true"
        );
      }

      if (deleteButton) {
        openDeleteSkillModal(deleteButton.dataset.id);
      }
    });

    elements.skillModal?.addEventListener("click", (event) => {
      if (event.target === elements.skillModal) {
        closeSkillModal();
      }
    });

    elements.deleteSkillModal?.addEventListener("click", (event) => {
      if (event.target === elements.deleteSkillModal) {
        closeDeleteSkillModal();
      }
    });
  }

  // =========================================
  // MESSAGES
  // =========================================

  const statusLabels = {
    new: "جديدة",
    read: "مقروءة",
    replied: "تم الرد",
    archived: "مؤرشفة"
  };

  function getMessageDate(message) {
    return (
      message.created_at ||
      message.createdAt ||
      message.date ||
      null
    );
  }

  function getFilteredMessages() {
    const search = ($("#messageSearch")?.value || "")
      .trim()
      .toLowerCase();

    const filter = $("#messageStatusFilter")?.value || "all";

    return state.messages.filter((message) => {
      const searchableText = [
        message.name,
        message.email,
        message.subject,
        message.message
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(search);
      const status = message.status || "new";

      const matchesStatus =
        filter === "all" || status === filter;

      return matchesSearch && matchesStatus;
    });
  }

  function renderMessages() {
    const rows = getFilteredMessages();

    const overviewBody = $("#dashboardMessages");
    const messagesBody = $("#messagesTableBody");

    const renderRow = (message, compact = false) => {
      const id = escapeHTML(message.id);
      const name = escapeHTML(message.name || "بدون اسم");
      const email = escapeHTML(message.email || "—");
      const subject = escapeHTML(message.subject || "بدون موضوع");
      const status = message.status || "new";
      const statusLabel = statusLabels[status] || status;
      const date = formatDate(getMessageDate(message));

      if (compact) {
        return `
          <tr>
            <td>${name}</td>
            <td>${email}</td>
            <td>${subject}</td>
            <td>
              <span class="status-badge status-${escapeHTML(status)}">
                ${escapeHTML(statusLabel)}
              </span>
            </td>
            <td>${date}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${name}</td>
          <td>${email}</td>
          <td>${subject}</td>
          <td>
            <span class="status-badge status-${escapeHTML(status)}">
              ${escapeHTML(statusLabel)}
            </span>
          </td>
          <td>${date}</td>
          <td>
            <button
              type="button"
              class="table-action view-message-button"
              data-id="${id}"
              title="عرض الرسالة"
            >◉</button>
          </td>
        </tr>
      `;
    };

    if (overviewBody) {
      const latest = [...state.messages]
        .sort((a, b) => {
          return (
            new Date(getMessageDate(b) || 0) -
            new Date(getMessageDate(a) || 0)
          );
        })
        .slice(0, 5);

      overviewBody.innerHTML = latest.length
        ? latest.map((message) => renderRow(message, true)).join("")
        : '<tr><td colspan="5">لا توجد رسائل حاليًا.</td></tr>';
    }

    if (messagesBody) {
      messagesBody.innerHTML = rows.length
        ? rows.map((message) => renderRow(message)).join("")
        : '<tr><td colspan="6">لا توجد رسائل مطابقة.</td></tr>';
    }

    updateMessageStatistics();
  }

  function updateMessageStatistics() {
    const total = state.messages.length;

    const newMessages = state.messages.filter(
      (message) => (message.status || "new") === "new"
    ).length;

    setText("#statTotalMessages", total);
    setText("#statNewMessages", newMessages);
  }

  async function loadMessages() {
    if (state.loadingMessages) return;

    state.loadingMessages = true;

    try {
      const data = await api(API.messages);

      state.messages = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data)
          ? data
          : [];

      renderMessages();
    } catch (error) {
      console.error("Messages loading error:", error);

      const overviewBody = $("#dashboardMessages");
      const messagesBody = $("#messagesTableBody");

      if (overviewBody) {
        overviewBody.innerHTML =
          '<tr><td colspan="5">تعذر تحميل الرسائل.</td></tr>';
      }

      if (messagesBody) {
        messagesBody.innerHTML =
          '<tr><td colspan="6">تعذر تحميل الرسائل.</td></tr>';
      }

      showToast("تعذر تحميل الرسائل.", "error");
    } finally {
      state.loadingMessages = false;
    }
  }

  function openMessage(message) {
    if (!message) return;

    state.currentMessage = message;

    const body = elements.messageModalBody;
    const actions = elements.messageModalActions;

    if (!body || !actions) return;

    body.innerHTML = `
      <div class="message-detail">
        <p><strong>الاسم:</strong> ${escapeHTML(message.name || "—")}</p>
        <p><strong>البريد:</strong> ${escapeHTML(message.email || "—")}</p>
        <p><strong>الموضوع:</strong> ${escapeHTML(message.subject || "—")}</p>
        <p><strong>التاريخ:</strong> ${formatDate(getMessageDate(message))}</p>
        <div class="message-detail-content">
          <strong>محتوى الرسالة:</strong>
          <p>${escapeHTML(message.message || "")}</p>
        </div>
      </div>
    `;

    actions.innerHTML = `
      <button type="button" class="secondary-button" id="closeMessageAction">
        إغلاق
      </button>

      <button type="button" class="secondary-button" data-message-status="read">
        تحديد كمقروءة
      </button>

      <button type="button" class="primary-button" data-message-status="replied">
        تم الرد
      </button>

      <button type="button" class="secondary-button" data-message-status="archived">
        أرشفة
      </button>
    `;

    setElementVisible(elements.messageModal, true);

    $("#closeMessageAction")?.addEventListener(
      "click",
      closeMessageModal
    );

    $$("[data-message-status]", actions).forEach((button) => {
      button.addEventListener("click", () => {
        updateMessageStatus(button.dataset.messageStatus);
      });
    });
  }

  function closeMessageModal() {
    setElementVisible(elements.messageModal, false);
    state.currentMessage = null;
  }

  async function updateMessageStatus(status) {
    const message = state.currentMessage;
    if (!message) return;

    try {
      await api(API.messages, {
        method: "PATCH",
        body: {
          id: message.id,
          status
        }
      });

      closeMessageModal();
      await loadMessages();

      showToast("تم تحديث حالة الرسالة.");
    } catch (error) {
      console.error("Message update error:", error);

      showToast(
        error.message || "تعذر تحديث الرسالة.",
        "error"
      );
    }
  }

  function initializeMessages() {
    $("#messageSearch")?.addEventListener("input", renderMessages);

    $("#messageStatusFilter")?.addEventListener(
      "change",
      renderMessages
    );

    $("#closeMessageModal")?.addEventListener(
      "click",
      closeMessageModal
    );

    elements.messageModal?.addEventListener("click", (event) => {
      if (event.target === elements.messageModal) {
        closeMessageModal();
      }
    });

    $("#messagesTableBody")?.addEventListener("click", (event) => {
      const button = event.target.closest(".view-message-button");
      if (!button) return;

      const message = state.messages.find(
        (item) => String(item.id) === String(button.dataset.id)
      );

      if (message) openMessage(message);
    });
  }

  // =========================================
  // DASHBOARD STATISTICS
  // =========================================

  async function updateStatistics() {
    updateMessageStatistics();

    const projects = $("#statProjects");

    if (projects && projects.textContent.trim() === "") {
      projects.textContent = "—";
    }

    if (state.skills.length) {
      updateSkillsStatistics();
    }
  }

  async function refreshDashboard() {
    await Promise.all([
      loadMessages(),
      loadSkills()
    ]);

    showToast("تم تحديث بيانات لوحة التحكم.");
  }

  // =========================================
  // LOGOUT
  // =========================================

  async function logout() {
    const button = $("#logoutButton");

    if (button) button.disabled = true;

    try {
      await api(API.logout, {
        method: "POST",
        body: {}
      });
    } catch (error) {
      console.error("Logout request:", error);
    } finally {
      window.location.replace("/admin.html");
    }
  }

  // =========================================
  // INITIALIZATION
  // =========================================

  async function initializeDashboard() {
    const authenticated = await checkSession();

    if (!authenticated) return;

    initializeNavigation();
    initializeSkills();
    initializeMessages();

    $("#profileForm")?.addEventListener(
      "submit",
      saveProfile
    );

    $("#reloadProfile")?.addEventListener(
      "click",
      loadProfile
    );

    $("#refreshDashboard")?.addEventListener(
      "click",
      refreshDashboard
    );

    $("#logoutButton")?.addEventListener(
      "click",
      logout
    );

    const year = $("#currentYear");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    await Promise.all([
      loadMessages(),
      updateStatistics()
    ]);

    activateSection(state.activeSection);
  }

  initializeDashboard().catch((error) => {
    console.error("Dashboard initialization error:", error);
    showToast("حدث خطأ أثناء تشغيل لوحة التحكم.", "error");
  });

})();
