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
    activeSection: "overview"
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

  /* ==============================
     API
  ============================== */

  async function api(url, options = {}) {
    const config = {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      ...options
    };

    const response = await fetch(url, config);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message =
        data.message ||
        data.error ||
        `حدث خطأ (${response.status})`;

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        if (!url.includes("/session")) {
          window.location.href = "/admin.html";
        }
      }

      throw new Error(message);
    }

    return data;
  }

  /* ==============================
     HELPERS
  ============================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showToast(message, type = "success") {
    const toast = elements.toast;

    if (!toast) return;

    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
      toast.classList.remove("show");

      setTimeout(() => {
        toast.hidden = true;
      }, 250);
    }, 3000);
  }

  function setButtonLoading(button, loading, text = "جاري الحفظ...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function setElementVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
  }

  function formatDate(value) {
    if (!value) return "غير محدد";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getErrorMessage(error) {
    return error?.message || "حدث خطأ غير متوقع";
  }

  function getArray(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  /* ==============================
     SIDEBAR
  ============================== */

  function openSidebar() {
    elements.sidebar?.classList.add("open");
    elements.sidebarOverlay?.classList.add("active");
  }

  function closeSidebar() {
    elements.sidebar?.classList.remove("open");
    elements.sidebarOverlay?.classList.remove("active");
  }

  function toggleSidebar() {
    if (elements.sidebar?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ==============================
     NAVIGATION
  ============================== */

  function activateSection(sectionName) {
    const target = $(`#section-${sectionName}`);

    if (!target) return;

    state.activeSection = sectionName;

    $$(".dashboard-section").forEach(section => {
      section.classList.toggle(
        "active",
        section.id === `section-${sectionName}`
      );
    });

    $$(".nav-item").forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.section === sectionName
      );
    });

    closeSidebar();

    if (sectionName === "profile") {
      loadProfile();
    }

    if (sectionName === "skills") {
      loadSkills();
    }

    if (sectionName === "messages") {
      loadMessages();
    }
  }

  function initializeNavigation() {
    $$(".nav-item[data-section]").forEach(item => {
      item.addEventListener("click", () => {
        activateSection(item.dataset.section);
      });
    });

    $$("[data-go-section]").forEach(button => {
      button.addEventListener("click", () => {
        activateSection(button.dataset.goSection);
      });
    });

    elements.menuToggle?.addEventListener(
      "click",
      toggleSidebar
    );

    elements.sidebarOverlay?.addEventListener(
      "click",
      closeSidebar
    );
  }

  /* ==============================
     SESSION
  ============================== */

  async function checkSession() {
    try {
      await api(API.session);
      return true;
    } catch {
      window.location.replace("/admin.html");
      return false;
    }
  }

  /* ==============================
     PROFILE
  ============================== */

  async function loadProfile() {
    try {
      const data = await api(API.profile);
      const profile = data.profile || data.data || data;

      const fields = {
        profileFullName: profile.full_name,
        profileJobTitle: profile.job_title,
        profileLocation: profile.location,
        profileEmail: profile.email,
        profileImage: profile.image,
        profileShortBio: profile.short_bio,
        profileAbout: profile.about
      };

      Object.entries(fields).forEach(([id, value]) => {
        const element = $(`#${id}`);

        if (element && value !== undefined && value !== null) {
          element.value = value;
        }
      });
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const form = $("#profileForm");
    const button = $("#saveProfile");
    const status = $("#profileFormStatus");

    if (!form) return;

    const payload = {
      full_name: $("#profileFullName")?.value.trim() || "",
      job_title: $("#profileJobTitle")?.value.trim() || "",
      location: $("#profileLocation")?.value.trim() || "",
      email: $("#profileEmail")?.value.trim() || "",
      image: $("#profileImage")?.value.trim() || "",
      short_bio: $("#profileShortBio")?.value.trim() || "",
      about: $("#profileAbout")?.value.trim() || ""
    };

    setButtonLoading(button, true);

    if (status) {
      status.textContent = "";
      status.dataset.type = "";
    }

    try {
      await api(API.profile, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (status) {
        status.textContent = "تم حفظ البيانات بنجاح";
        status.dataset.type = "success";
      }

      showToast("تم تحديث الملف الشخصي");
    } catch (error) {
      if (status) {
        status.textContent = getErrorMessage(error);
        status.dataset.type = "error";
      }

      showToast(getErrorMessage(error), "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  /* ==============================
     SKILLS
  ============================== */

  async function loadSkills() {
    const loading = $("#skillsLoading");
    const empty = $("#skillsEmpty");
    const errorBox = $("#skillsError");
    const tableContainer = $("#skillsTableContainer");
    const noResults = $("#skillsNoResults");

    setElementVisible(loading, true);
    setElementVisible(empty, false);
    setElementVisible(errorBox, false);
    setElementVisible(tableContainer, false);
    setElementVisible(noResults, false);

    try {
      const data = await api(API.skills);

      state.skills = getArray(data, "skills");

      renderSkills();
      updateSkillStats();
    } catch (error) {
      setElementVisible(loading, false);
      setElementVisible(errorBox, true);

      const message = $("#skillsErrorMessage");

      if (message) {
        message.textContent = getErrorMessage(error);
      }
    }
  }

  function updateSkillStats() {
    const total = state.skills.length;
    const visible = state.skills.filter(skill =>
      Boolean(skill.is_visible)
    ).length;

    const totalElement = $("#skillsTotalCount");
    const visibleElement = $("#skillsVisibleCount");
    const hiddenElement = $("#skillsHiddenCount");

    if (totalElement) totalElement.textContent = total;
    if (visibleElement) visibleElement.textContent = visible;
    if (hiddenElement) hiddenElement.textContent = total - visible;
  }

  function renderSkills() {
    const tbody = elements.skillTableBody;
    const loading = $("#skillsLoading");
    const empty = $("#skillsEmpty");
    const errorBox = $("#skillsError");
    const container = $("#skillsTableContainer");
    const noResults = $("#skillsNoResults");

    if (!tbody) return;

    setElementVisible(loading, false);
    setElementVisible(errorBox, false);

    const search = (
      $("#skillSearch")?.value || ""
    ).trim().toLowerCase();

    const filter = $("#skillVisibilityFilter")?.value || "all";

    const filtered = state.skills.filter(skill => {
      const name = [
        skill.name_ar,
        skill.name_en,
        skill.category
      ].join(" ").toLowerCase();

      const matchesSearch = name.includes(search);

      const visible = Boolean(skill.is_visible);

      const matchesFilter =
        filter === "all" ||
        (filter === "visible" && visible) ||
        (filter === "hidden" && !visible);

      return matchesSearch && matchesFilter;
    });

    tbody.innerHTML = "";

    if (state.skills.length === 0) {
      setElementVisible(empty, true);
      setElementVisible(container, false);
      setElementVisible(noResults, false);
      return;
    }

    setElementVisible(empty, false);

    if (filtered.length === 0) {
      setElementVisible(container, false);
      setElementVisible(noResults, true);
      return;
    }

    setElementVisible(container, true);
    setElementVisible(noResults, false);

    tbody.innerHTML = filtered.map(skill => {
      const id = escapeHTML(skill.id);
      const nameAr = escapeHTML(skill.name_ar);
      const nameEn = escapeHTML(skill.name_en || "");
      const icon = escapeHTML(skill.icon || "⚡");
      const category = escapeHTML(skill.category || "عام");
      const progress = Math.min(
        100,
        Math.max(0, Number(skill.progress) || 0)
      );

      const visible = Boolean(skill.is_visible);

      return `
        <tr>
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

          <td>
            <span class="status-badge ${
              visible ? "status-visible" : "status-hidden"
            }">
              ${visible ? "ظاهرة" : "مخفية"}
            </span>
          </td>

          <td>
            <div class="table-actions">
              <button
                type="button"
                class="table-action"
                data-skill-edit="${id}"
                title="تعديل"
              >✎</button>

              <button
                type="button"
                class="table-action"
                data-skill-toggle="${id}"
                title="${visible ? "إخفاء" : "إظهار"}"
              >${visible ? "◉" : "○"}</button>

              <button
                type="button"
                class="table-action delete-skill-button"
                data-skill-delete="${id}"
                title="حذف"
              >×</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-skill-edit]").forEach(button => {
      button.addEventListener("click", () => {
        openSkillModal(button.dataset.skillEdit);
      });
    });

    tbody.querySelectorAll("[data-skill-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        toggleSkillVisibility(button.dataset.skillToggle);
      });
    });

    tbody.querySelectorAll("[data-skill-delete]").forEach(button => {
      button.addEventListener("click", () => {
        openDeleteSkillModal(button.dataset.skillDelete);
      });
    });
  }

  function openSkillModal(skillId = null) {
    const modal = elements.skillModal;
    const form = elements.skillForm;

    if (!modal || !form) return;

    state.editingSkillId = skillId;

    form.reset();

    const skill = skillId
      ? state.skills.find(item => String(item.id) === String(skillId))
      : null;

    $("#skillId").value = skill?.id || "";

    $("#skillModalTitle").textContent = skill
      ? "تعديل المهارة"
      : "إضافة مهارة جديدة";

    $("#skillNameAr").value = skill?.name_ar || "";
    $("#skillNameEn").value = skill?.name_en || "";
    $("#skillIcon").value = skill?.icon || "";
    $("#skillCategory").value = skill?.category || "";
    $("#skillProgress").value = skill?.progress ?? 50;
    $("#skillSortOrder").value = skill?.sort_order ?? 0;
    $("#skillIsVisible").checked = skill
      ? Boolean(skill.is_visible)
      : true;

    const status = $("#skillFormStatus");

    if (status) status.textContent = "";

    setElementVisible(modal, true);
  }

  function closeSkillModal() {
    setElementVisible(elements.skillModal, false);
    state.editingSkillId = null;
  }

  async function saveSkill(event) {
    event.preventDefault();

    const button = $("#saveSkillButton");
    const status = $("#skillFormStatus");

    const skillId = $("#skillId")?.value;

    const payload = {
      name_ar: $("#skillNameAr")?.value.trim() || "",
      name_en: $("#skillNameEn")?.value.trim() || "",
      icon: $("#skillIcon")?.value.trim() || "",
      category: $("#skillCategory")?.value || "",
      progress: Number($("#skillProgress")?.value || 0),
      sort_order: Number($("#skillSortOrder")?.value || 0),
      is_visible: Boolean($("#skillIsVisible")?.checked)
    };

    if (!payload.name_ar) {
      if (status) status.textContent = "اسم المهارة بالعربية مطلوب";
      return;
    }

    setButtonLoading(button, true);

    if (status) status.textContent = "";

    try {
      await api(API.skills, {
        method: skillId ? "PATCH" : "POST",
        body: JSON.stringify(
          skillId ? { ...payload, id: skillId } : payload
        )
      });

      closeSkillModal();
      await loadSkills();

      showToast(
        skillId
          ? "تم تحديث المهارة بنجاح"
          : "تمت إضافة المهارة بنجاح"
      );
    } catch (error) {
      if (status) status.textContent = getErrorMessage(error);
      showToast(getErrorMessage(error), "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function toggleSkillVisibility(skillId) {
    const skill = state.skills.find(
      item => String(item.id) === String(skillId)
    );

    if (!skill) return;

    try {
      await api(API.skills, {
        method: "PATCH",
        body: JSON.stringify({
          id: skillId,
          is_visible: !Boolean(skill.is_visible)
        })
      });

      await loadSkills();
      showToast("تم تحديث حالة المهارة");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  function openDeleteSkillModal(skillId) {
    const skill = state.skills.find(
      item => String(item.id) === String(skillId)
    );

    if (!skill) return;

    state.deletingSkillId = skillId;

    const title = $("#deleteSkillTitle");
    const idField = $("#deleteSkillId");

    if (title) title.textContent = skill.name_ar;
    if (idField) idField.value = skillId;

    setElementVisible(elements.deleteSkillModal, true);
  }

  function closeDeleteSkillModal() {
    setElementVisible(elements.deleteSkillModal, false);
    state.deletingSkillId = null;
  }

  async function confirmDeleteSkill() {
    const skillId =
      $("#deleteSkillId")?.value || state.deletingSkillId;

    const button = $("#confirmDeleteSkill");

    if (!skillId) return;

    setButtonLoading(button, true, "جاري الحذف...");

    try {
      await api(API.skills, {
        method: "DELETE",
        body: JSON.stringify({ id: skillId })
      });

      closeDeleteSkillModal();
      await loadSkills();

      showToast("تم حذف المهارة");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  /* ==============================
     MESSAGES
  ============================== */

  async function loadMessages() {
    const tbody = $("#messagesTableBody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty">جاري تحميل الرسائل...</td>
        </tr>
      `;
    }

    try {
      const data = await api(API.messages);

      state.messages = getArray(data, "messages");

      renderMessages();
      updateDashboardStats();
    } catch (error) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty">
              ${escapeHTML(getErrorMessage(error))}
            </td>
          </tr>
        `;
      }

      showToast(getErrorMessage(error), "error");
    }
  }

  function getMessageStatusLabel(status) {
    const labels = {
      new: "جديدة",
      read: "مقروءة",
      replied: "تم الرد",
      archived: "مؤرشفة"
    };

    return labels[status] || status || "غير محددة";
  }

  function renderMessages() {
    const tbody = $("#messagesTableBody");

    if (!tbody) return;

    const search = (
      $("#messageSearch")?.value || ""
    ).trim().toLowerCase();

    const statusFilter =
      $("#messageStatusFilter")?.value || "all";

    const filtered = state.messages.filter(message => {
      const content = [
        message.name,
        message.email,
        message.subject,
        message.message
      ].join(" ").toLowerCase();

      const matchesSearch = content.includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        message.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty">
            لا توجد رسائل لعرضها
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(message => {
      const id = escapeHTML(message.id);
      const name = escapeHTML(message.name || "بدون اسم");
      const email = escapeHTML(message.email || "");
      const subject = escapeHTML(message.subject || "بدون موضوع");
      const date = escapeHTML(formatDate(message.created_at));
      const status = escapeHTML(message.status || "new");

      return `
        <tr>
          <td>${name}</td>
          <td>${email}</td>
          <td>${subject}</td>
          <td>${date}</td>
          <td>
            <span class="status-badge status-${status}">
              ${escapeHTML(getMessageStatusLabel(status))}
            </span>
          </td>
          <td>
            <button
              type="button"
              class="table-action"
              data-message-open="${id}"
              title="عرض الرسالة"
            >↗</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-message-open]").forEach(button => {
      button.addEventListener("click", () => {
        openMessageModal(button.dataset.messageOpen);
      });
    });
  }

  function openMessageModal(messageId) {
    const message = state.messages.find(
      item => String(item.id) === String(messageId)
    );

    if (!message) return;

    state.currentMessage = message;

    if (elements.messageModalBody) {
      elements.messageModalBody.innerHTML = `
        <div class="message-detail">
          <p><strong>الاسم:</strong> ${escapeHTML(message.name || "—")}</p>
          <p><strong>البريد:</strong> ${escapeHTML(message.email || "—")}</p>
          <p><strong>الموضوع:</strong> ${escapeHTML(message.subject || "—")}</p>
          <p><strong>التاريخ:</strong> ${escapeHTML(formatDate(message.created_at))}</p>

          <div class="message-detail-content">
            <strong>محتوى الرسالة</strong>
            <p>${escapeHTML(message.message || "")}</p>
          </div>
        </div>
      `;
    }

    if (elements.messageModalActions) {
      elements.messageModalActions.innerHTML = `
        <button
          type="button"
          class="secondary-button"
          data-message-status="read"
        >تحديد كمقروءة</button>

        <button
          type="button"
          class="primary-button"
          data-message-status="replied"
        >تم الرد</button>

        <button
          type="button"
          class="secondary-button"
          data-message-status="archived"
        >أرشفة</button>
      `;

      elements.messageModalActions
        .querySelectorAll("[data-message-status]")
        .forEach(button => {
          button.addEventListener("click", () => {
            updateMessageStatus(
              message.id,
              button.dataset.messageStatus
            );
          });
        });
    }

    setElementVisible(elements.messageModal, true);
  }

  function closeMessageModal() {
    setElementVisible(elements.messageModal, false);
    state.currentMessage = null;
  }

  async function updateMessageStatus(messageId, status) {
    try {
      await api(API.messages, {
        method: "PATCH",
        body: JSON.stringify({
          id: messageId,
          status
        })
      });

      closeMessageModal();
      await loadMessages();

      showToast("تم تحديث حالة الرسالة");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  /* ==============================
     DASHBOARD STATS
  ============================== */

  function updateDashboardStats() {
    const total = state.messages.length;

    const newMessages = state.messages.filter(
      message => message.status === "new"
    ).length;

    const totalElement = $("#statTotalMessages");
    const newElement = $("#statNewMessages");

    if (totalElement) totalElement.textContent = total;
    if (newElement) newElement.textContent = newMessages;

    const projectsElement = $("#statProjects");
    const skillsElement = $("#statSkills");

    if (projectsElement && projectsElement.textContent.trim() === "") {
      projectsElement.textContent = "0";
    }

    if (skillsElement) {
      skillsElement.textContent = state.skills.length;
    }

    renderRecentMessages();
  }

  function renderRecentMessages() {
    const container = $("#dashboardMessages");

    if (!container) return;

    const recent = [...state.messages]
      .sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="panel-empty">لا توجد رسائل حتى الآن</div>
      `;
      return;
    }

    container.innerHTML = recent.map(message => `
      <div class="message-detail">
        <strong>${escapeHTML(message.name || "بدون اسم")}</strong>
        <p>${escapeHTML(message.subject || message.message || "")}</p>
        <small>${escapeHTML(formatDate(message.created_at))}</small>
      </div>
    `).join("");
  }

  async function refreshDashboard() {
    try {
      await Promise.all([
        loadMessages(),
        loadSkills()
      ]);

      showToast("تم تحديث لوحة التحكم");
    } catch {
      showToast("تعذر تحديث بعض البيانات", "error");
    }
  }

  /* ==============================
     LOGOUT
  ============================== */

  async function logout() {
    const button = $("#logoutButton");

    setButtonLoading(button, true, "جاري تسجيل الخروج...");

    try {
      await api(API.logout, {
        method: "POST"
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.replace("/admin.html");
    }
  }

  /* ==============================
     EVENT LISTENERS
  ============================== */

  function initializeEvents() {
    $("#profileForm")?.addEventListener(
      "submit",
      saveProfile
    );

    $("#reloadProfile")?.addEventListener(
      "click",
      loadProfile
    );

    $("#addSkillButton")?.addEventListener(
      "click",
      () => openSkillModal()
    );

    $("#addFirstSkillButton")?.addEventListener(
      "click",
      () => openSkillModal()
    );

    $("#refreshSkillsButton")?.addEventListener(
      "click",
      loadSkills
    );

    $("#retrySkillsButton")?.addEventListener(
      "click",
      loadSkills
    );

    $("#skillSearch")?.addEventListener(
      "input",
      renderSkills
    );

    $("#skillVisibilityFilter")?.addEventListener(
      "change",
      renderSkills
    );

    elements.skillForm?.addEventListener(
      "submit",
      saveSkill
    );

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
      confirmDeleteSkill
    );

    $("#messageSearch")?.addEventListener(
      "input",
      renderMessages
    );

    $("#messageStatusFilter")?.addEventListener(
      "change",
      renderMessages
    );

    $("#closeMessageModal")?.addEventListener(
      "click",
      closeMessageModal
    );

    $("#refreshDashboard")?.addEventListener(
      "click",
      refreshDashboard
    );

    $("#logoutButton")?.addEventListener(
      "click",
      logout
    );

    [
      elements.skillModal,
      elements.deleteSkillModal,
      elements.messageModal
    ].forEach(modal => {
      modal?.addEventListener("click", event => {
        if (event.target !== modal) return;

        setElementVisible(modal, false);
      });
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      closeSidebar();
      closeSkillModal();
      closeDeleteSkillModal();
      closeMessageModal();
    });
  }

  /* ==============================
     INITIALIZATION
  ============================== */

  async function init() {
    const authenticated = await checkSession();

    if (!authenticated) return;

    initializeNavigation();
    initializeEvents();

    const year = $("#currentYear");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    await Promise.all([
      loadMessages(),
      loadSkills()
    ]);

    activateSection("overview");
  }

  document.addEventListener("DOMContentLoaded", init);

})();
