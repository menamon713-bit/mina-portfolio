(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const API = {
    session: "/api/admin/session",
    messages: "/api/admin/messages",
    profile: "/api/admin/profile",
    skills: "/api/admin/skills",
    pages: "/api/admin/pages",
    logout: "/api/admin/logout"
  };

  const state = {
    messages: [],
    skills: [],
    pages: [],
    currentMessage: null,
    editingSkillId: null,
    deletingSkillId: null,
    editingPageId: null,
    activeSection: "overview",
    loadingMessages: false,
    loadingSkills: false,
    loadingPages: false,
    redirectingToLogin: false
  };

  const STATUS_LABELS = Object.freeze({
    new: "جديدة",
    read: "مقروءة",
    replied: "تم الرد",
    archived: "مؤرشفة"
  });

  const STATUS_CLASSES = Object.freeze({
    new: "status-new",
    read: "status-read",
    replied: "status-replied",
    archived: "status-archived"
  });

  function redirectToLogin() {
    if (state.redirectingToLogin) return;
    state.redirectingToLogin = true;
    window.location.replace("/admin.html");
  }

  async function api(url, options = {}) {
    const requestHeaders = { Accept: "application/json" };

    if (options.body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
    }

    if (options.headers) {
      Object.assign(requestHeaders, options.headers);
    }

    let response;

    try {
      response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        headers: requestHeaders
      });
    } catch {
      throw new Error("تعذر الاتصال بالسيرفر. تحقق من اتصال الإنترنت.");
    }

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      if (!url.includes("/logout")) redirectToLogin();
      throw new Error("انتهت الجلسة أو لم يتم تسجيل الدخول.");
    }

    if (response.status === 403) {
      throw new Error(data.error || "تم رفض الطلب بسبب عدم امتلاك الصلاحية.");
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "حدث خطأ أثناء الاتصال بالسيرفر."
      );
    }

    return data;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function showToast(message, type = "success") {
    const toast = $("#adminToast");
    if (!toast) return;

    toast.textContent = String(message ?? "");
    toast.className = `admin-toast show ${type === "error" ? "error" : "success"}`;
    toast.hidden = false;

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
      toast.hidden = true;
    }, 3500);
  }

  function setButtonLoading(button, loading, text = "جاري الحفظ...") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;

      if (button.dataset.originalText !== undefined) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function setVisible(element, visible) {
    if (element) element.hidden = !visible;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || "غير معروف";
  }

  function getStatusClass(status) {
    return STATUS_CLASSES[status] || "";
  }

  // ==========================================
  // DASHBOARD STATISTICS
  // ==========================================

  function updateDashboardStats() {
    const total = $("#statTotalMessages");
    const unread = $("#statNewMessages");
    const skills = $("#statSkills");

    if (total) total.textContent = String(state.messages.length);

    if (unread) {
      unread.textContent = String(
        state.messages.filter((message) => message.status === "new").length
      );
    }

    if (skills) skills.textContent = String(state.skills.length);
  }

  // ==========================================
  // NAVIGATION & SIDEBAR
  // ==========================================

  function activateSection(sectionName) {
    const target = $(`#section-${sectionName}`);
    if (!target) return;

    state.activeSection = sectionName;

    $$(".dashboard-section").forEach((section) => {
      section.classList.toggle("active", section.id === `section-${sectionName}`);
    });

    $$(".nav-item[data-section]").forEach((button) => {
      const active = button.dataset.section === sectionName;
      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    closeSidebar();
  }

  function openSidebar() {
    $("#sidebar")?.classList.add("active");
    $("#sidebarOverlay")?.classList.add("active");
    $("#menuToggle")?.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    $("#sidebar")?.classList.remove("active");
    $("#sidebarOverlay")?.classList.remove("active");
    $("#menuToggle")?.setAttribute("aria-expanded", "false");
  }

  function initializeNavigation() {
    $$(".nav-item[data-section]").forEach((button) => {
      button.addEventListener("click", () => {
        activateSection(button.dataset.section);
      });
    });

    $$("[data-go-section]").forEach((button) => {
      button.addEventListener("click", () => {
        activateSection(button.dataset.goSection);
      });
    });

    $("#menuToggle")?.addEventListener("click", openSidebar);
    $("#sidebarOverlay")?.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
        closeSkillModal();
        closeDeleteSkillModal();
        closeMessageModal();
      }
    });
  }

  // ==========================================
  // AUTHENTICATION & LOGOUT
  // ==========================================

  async function checkSession() {
    try {
      const data = await api(API.session);

      if (data.authenticated !== true) {
        redirectToLogin();
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    const button = $("#logoutButton");
    if (button?.disabled) return;

    setButtonLoading(button, true, "جاري الخروج...");

    try {
      await api(API.logout, { method: "POST" });
      redirectToLogin();
    } catch (error) {
      showToast(error.message, "error");
      setButtonLoading(button, false);
    }
  }

  // ==========================================
  // PROFILE MANAGEMENT
  // ==========================================

  function fillProfileForm(profile) {
    const fields = {
      profileFullName: profile.full_name,
      profileJobTitle: profile.job_title,
      profileLocation: profile.location,
      profileImage: profile.image,
      profileShortBio: profile.short_bio,
      profileAbout: profile.about
    };

    for (const [id, value] of Object.entries(fields)) {
      const element = $(`#${id}`);
      if (element) element.value = value ?? "";
    }
  }

  async function loadProfile() {
    const status = $("#profileFormStatus");
    if (status) status.textContent = "جاري تحميل البيانات...";

    try {
      const data = await api(API.profile);

      if (!data.profile) {
        throw new Error("لم يتم العثور على بيانات الملف الشخصي.");
      }

      fillProfileForm(data.profile);
      if (status) status.textContent = "";
    } catch (error) {
      if (status) status.textContent = error.message;
      if (!state.redirectingToLogin) showToast(error.message, "error");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const form = $("#profileForm");
    const button = $("#saveProfile");
    const status = $("#profileFormStatus");

    if (!form || button?.disabled) return;

    const payload = {
      full_name: $("#profileFullName")?.value.trim() || "",
      job_title: $("#profileJobTitle")?.value.trim() || "",
      location: $("#profileLocation")?.value.trim() || "",
      image: $("#profileImage")?.value.trim() || "",
      short_bio: $("#profileShortBio")?.value.trim() || "",
      about: $("#profileAbout")?.value.trim() || ""
    };

    setButtonLoading(button, true);

    if (status) status.textContent = "جاري الحفظ...";

    try {
      const data = await api(API.profile, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (data.profile) fillProfileForm(data.profile);

      if (status) status.textContent = "تم حفظ البيانات بنجاح.";
      showToast("تم تحديث الملف الشخصي.");
    } catch (error) {
      if (status) status.textContent = error.message;
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // ==========================================
  // SKILLS MANAGEMENT
  // ==========================================

  function updateSkillStats() {
    const total = state.skills.length;
    const visible = state.skills.filter((skill) => skill.is_visible === true).length;

    if ($("#skillsTotalCount")) $("#skillsTotalCount").textContent = String(total);
    if ($("#skillsVisibleCount")) $("#skillsVisibleCount").textContent = String(visible);
    if ($("#skillsHiddenCount")) $("#skillsHiddenCount").textContent = String(total - visible);
    if ($("#statSkills")) $("#statSkills").textContent = String(total);

    updateDashboardStats();
  }

  function renderSkills() {
    const tbody = $("#skillsTableBody");
    if (!tbody) return;

    const search = ($("#skillSearch")?.value || "").trim().toLowerCase();
    const filter = $("#skillVisibilityFilter")?.value || "all";

    const filtered = state.skills.filter((skill) => {
      const searchable = [
        skill.name_ar,
        skill.name_en,
        skill.category
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);
      const matchesVisibility =
        filter === "all" ||
        (filter === "visible" && skill.is_visible === true) ||
        (filter === "hidden" && skill.is_visible === false);

      return matchesSearch && matchesVisibility;
    });

    setVisible($("#skillsLoading"), false);
    setVisible($("#skillsError"), false);
    setVisible($("#skillsEmpty"), state.skills.length === 0);
    setVisible($("#skillsTableContainer"), state.skills.length > 0 && filtered.length > 0);
    setVisible($("#skillsNoResults"), state.skills.length > 0 && filtered.length === 0);

    if (filtered.length === 0) {
      tbody.replaceChildren();
      return;
    }

    tbody.innerHTML = filtered.map((skill) => {
      const visible = skill.is_visible === true;
      const progress = Math.max(0, Math.min(100, Number(skill.progress) || 0));

      return `
        <tr data-skill-id="${escapeHTML(skill.id)}">
          <td>
            <div class="skill-name-cell">
              <span class="skill-icon">${escapeHTML(skill.icon || "◇")}</span>
              <div>
                <strong>${escapeHTML(skill.name_ar)}</strong>
                <small>${escapeHTML(skill.name_en)}</small>
              </div>
            </div>
          </td>
          <td>${escapeHTML(skill.category || "—")}</td>
          <td>
            <div class="skill-progress">
              <span>${escapeHTML(skill.progress ?? 0)}%</span>
              <div class="progress-track">
                <span data-progress="${progress}"></span>
              </div>
            </div>
          </td>
          <td>${escapeHTML(skill.sort_order ?? 0)}</td>
          <td>
            <span class="status-badge ${visible ? "status-visible" : "status-hidden"}">
              ${visible ? "ظاهر" : "مخفي"}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="action-button" data-skill-edit="${escapeHTML(skill.id)}">تعديل</button>
              <button type="button" class="action-button" data-skill-toggle="${escapeHTML(skill.id)}">${visible ? "إخفاء" : "إظهار"}</button>
              <button type="button" class="action-button danger-button" data-skill-delete="${escapeHTML(skill.id)}">حذف</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-progress]", tbody).forEach((element) => {
      element.style.width = `${element.dataset.progress}%`;
    });

    $$("[data-skill-edit]", tbody).forEach((button) => {
      button.addEventListener("click", () => editSkill(button.dataset.skillEdit));
    });

    $$("[data-skill-toggle]", tbody).forEach((button) => {
      button.addEventListener("click", () => {
        toggleSkillVisibility(button.dataset.skillToggle, button);
      });
    });

    $$("[data-skill-delete]", tbody).forEach((button) => {
      button.addEventListener("click", () => {
        openDeleteSkillModal(button.dataset.skillDelete);
      });
    });
  }

  async function loadSkills() {
    if (state.loadingSkills || state.redirectingToLogin) return;

    state.loadingSkills = true;

    setVisible($("#skillsLoading"), true);
    setVisible($("#skillsError"), false);
    setVisible($("#skillsTableContainer"), false);

    try {
      const data = await api(API.skills);
      state.skills = getArray(data.skills || data.data);

      state.skills.sort((a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        Number(a.id || 0) - Number(b.id || 0)
      );

      renderSkills();
      updateSkillStats();
    } catch (error) {
      setVisible($("#skillsLoading"), false);
      setVisible($("#skillsError"), true);

      const message = $("#skillsErrorMessage");
      if (message) message.textContent = error.message;
    } finally {
      state.loadingSkills = false;
      setVisible($("#skillsLoading"), false);
    }
  }

  function openSkillModal(skill = null) {
    const modal = $("#skillModal");
    const form = $("#skillForm");

    if (!modal || !form) return;

    state.editingSkillId = skill ? skill.id : null;
    form.reset();

    $("#skillId").value = skill?.id ?? "";
    $("#skillNameAr").value = skill?.name_ar ?? "";
    $("#skillNameEn").value = skill?.name_en ?? "";
    $("#skillIcon").value = skill?.icon ?? "";
    $("#skillCategory").value = skill?.category ?? "";
    $("#skillProgress").value = skill?.progress ?? 0;
    $("#skillSortOrder").value = skill?.sort_order ?? 0;
    $("#skillIsVisible").checked = skill ? skill.is_visible === true : true;

    $("#skillModalTitle").textContent = skill ? "تعديل المهارة" : "إضافة مهارة جديدة";
    $("#skillFormStatus").textContent = "";

    setVisible(modal, true);
    modal.classList.add("active");
  }

  function closeSkillModal() {
    const modal = $("#skillModal");
    if (!modal) return;

    modal.classList.remove("active");
    setVisible(modal, false);
    state.editingSkillId = null;
  }

  function editSkill(id) {
    const skill = state.skills.find((item) => String(item.id) === String(id));

    if (!skill) {
      showToast("المهارة غير موجودة.", "error");
      return;
    }

    openSkillModal(skill);
  }

  async function saveSkill(event) {
    event.preventDefault();

    const button = $("#saveSkillButton");
    const status = $("#skillFormStatus");

    if (button?.disabled) return;

    const id = $("#skillId")?.value;

    const payload = {
      name_ar: $("#skillNameAr")?.value.trim() || "",
      name_en: $("#skillNameEn")?.value.trim() || "",
      icon: $("#skillIcon")?.value.trim() || "",
      category: $("#skillCategory")?.value.trim() || "",
      progress: Number($("#skillProgress")?.value),
      sort_order: Number($("#skillSortOrder")?.value),
      is_visible: $("#skillIsVisible")?.checked === true
    };

    if (!Number.isInteger(payload.progress) || payload.progress < 0 || payload.progress > 100) {
      if (status) status.textContent = "قيمة التقدم يجب أن تكون بين 0 و100.";
      return;
    }

    if (!Number.isSafeInteger(payload.sort_order) || payload.sort_order < 0) {
      if (status) status.textContent = "قيمة الترتيب غير صحيحة.";
      return;
    }

    setButtonLoading(button, true);

    if (status) status.textContent = "جاري الحفظ...";

    try {
      const editing = Boolean(id);

      await api(API.skills, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(editing ? { ...payload, id } : payload)
      });

      closeSkillModal();
      await loadSkills();

      showToast(editing ? "تم تحديث المهارة بنجاح." : "تمت إضافة المهارة بنجاح.");
    } catch (error) {
      if (status) status.textContent = error.message;
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function toggleSkillVisibility(id, button) {
    const skill = state.skills.find((item) => String(item.id) === String(id));

    if (!skill || button?.disabled) return;

    if (button) button.disabled = true;

    try {
      await api(API.skills, {
        method: "PATCH",
        body: JSON.stringify({
          id: skill.id,
          is_visible: !skill.is_visible
        })
      });

      await loadSkills();
      showToast("تم تحديث حالة ظهور المهارة.");
    } catch (error) {
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openDeleteSkillModal(id) {
    const skill = state.skills.find((item) => String(item.id) === String(id));
    if (!skill) return;

    state.deletingSkillId = skill.id;
    $("#deleteSkillTitle").textContent = skill.name_ar || skill.name_en || "هذه المهارة";
    $("#deleteSkillId").value = skill.id;

    const modal = $("#deleteSkillModal");

    setVisible(modal, true);
    modal?.classList.add("active");
  }

  function closeDeleteSkillModal() {
    const modal = $("#deleteSkillModal");
    if (!modal) return;

    modal.classList.remove("active");
    setVisible(modal, false);
    state.deletingSkillId = null;
  }

  async function confirmDeleteSkill() {
    if (!state.deletingSkillId) return;

    const button = $("#confirmDeleteSkill");
    if (button?.disabled) return;

    setButtonLoading(button, true, "جاري الحذف...");

    try {
      await api(API.skills, {
        method: "DELETE",
        body: JSON.stringify({ id: state.deletingSkillId })
      });

      closeDeleteSkillModal();
      await loadSkills();

      showToast("تم حذف المهارة.");
    } catch (error) {
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // ==========================================
  // PAGES MANAGEMENT
  // ==========================================

  function resetPageForm() {
    const form = $("#pageForm");
    if (!form) return;

    form.reset();

    const pageId = $("#pageId");
    const title = $("#pageFormTitle");
    const saveButton = $("#savePageButton");
    const status = $("#pageFormStatus");

    if (pageId) pageId.value = "";
    if (title) title.textContent = "إضافة صفحة جديدة";
    if (saveButton) saveButton.textContent = "حفظ الصفحة";
    if (status) status.textContent = "";

    setVisible($("#cancelPageEdit"), false);
    state.editingPageId = null;
  }

  function renderPages() {
    const tbody = $("#pagesTableBody");
    if (!tbody) return;

    const search = ($("#pageSearch")?.value || "").trim().toLowerCase();

    const filtered = state.pages.filter((page) => {
      const searchable = [
        page.title_ar,
        page.title_en,
        page.slug
      ].join(" ").toLowerCase();

      return searchable.includes(search);
    });

    setVisible($("#pagesLoading"), false);
    setVisible($("#pagesError"), false);
    setVisible($("#pagesTableContainer"), filtered.length > 0);
    setVisible($("#pagesEmpty"), state.pages.length === 0);

    if (state.pages.length > 0 && filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">لا توجد صفحات مطابقة لبحثك.</td></tr>';
      setVisible($("#pagesTableContainer"), true);
    } else if (filtered.length === 0) {
      tbody.replaceChildren();
    } else {
      tbody.innerHTML = filtered.map((page) => {
        const published = page.is_published === true;

        return `
          <tr>
            <td>
              <strong>${escapeHTML(page.title_ar)}</strong>
              <small>${escapeHTML(page.title_en)}</small>
            </td>
            <td>${escapeHTML(page.slug)}</td>
            <td>
              <span class="status-badge ${published ? "status-visible" : "status-hidden"}">
                ${published ? "منشورة" : "مسودة"}
              </span>
            </td>
            <td>${escapeHTML(formatDate(page.updated_at))}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="action-button" data-page-edit="${escapeHTML(page.id)}">تعديل</button>
                <button type="button" class="action-button" data-page-toggle="${escapeHTML(page.id)}">${published ? "إلغاء النشر" : "نشر"}</button>
                <button type="button" class="action-button danger-button" data-page-delete="${escapeHTML(page.id)}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    const count = $("#pagesCount");
    if (count) count.textContent = `عدد الصفحات: ${state.pages.length}`;

    $$("[data-page-edit]", tbody).forEach((button) => {
      button.addEventListener("click", () => editPage(button.dataset.pageEdit));
    });

    $$("[data-page-toggle]", tbody).forEach((button) => {
      button.addEventListener("click", () => {
        togglePagePublication(button.dataset.pageToggle, button);
      });
    });

    $$("[data-page-delete]", tbody).forEach((button) => {
      button.addEventListener("click", () => {
        deletePage(button.dataset.pageDelete, button);
      });
    });
  }

  async function loadPages() {
    if (state.loadingPages || state.redirectingToLogin) return false;

    state.loadingPages = true;

    setVisible($("#pagesLoading"), true);
    setVisible($("#pagesError"), false);
    setVisible($("#pagesTableContainer"), false);
    setVisible($("#pagesEmpty"), false);

    try {
      const data = await api(API.pages);

      if (!Array.isArray(data.pages)) {
        throw new Error("استجابة السيرفر غير صحيحة أثناء تحميل الصفحات.");
      }

      state.pages = data.pages;
      renderPages();

      return true;
    } catch (error) {
      setVisible($("#pagesLoading"), false);
      setVisible($("#pagesError"), true);
      setVisible($("#pagesTableContainer"), false);
      setVisible($("#pagesEmpty"), false);

      const message = $("#pagesErrorMessage");
      if (message) message.textContent = error.message;

      if (!state.redirectingToLogin) {
        showToast(error.message, "error");
      }

      return false;
    } finally {
      state.loadingPages = false;
      setVisible($("#pagesLoading"), false);
    }
  }

  function editPage(id) {
    const page = state.pages.find((item) => String(item.id) === String(id));

    if (!page) {
      showToast("الصفحة غير موجودة.", "error");
      return;
    }

    state.editingPageId = page.id;

    $("#pageId").value = page.id;
    $("#pageSlug").value = page.slug || "";
    $("#pageTitleAr").value = page.title_ar || "";
    $("#pageTitleEn").value = page.title_en || "";
    $("#pageContentAr").value = page.content_ar || "";
    $("#pageContentEn").value = page.content_en || "";
    $("#pagePublished").checked = page.is_published === true;

    $("#pageFormTitle").textContent = "تعديل الصفحة";
    $("#savePageButton").textContent = "حفظ التعديلات";
    $("#pageFormStatus").textContent = "";

    setVisible($("#cancelPageEdit"), true);

    activateSection("pages");
    $("#pageSlug")?.focus();
  }

  async function savePage(event) {
    event.preventDefault();

    const button = $("#savePageButton");
    const status = $("#pageFormStatus");

    if (button?.disabled) return;

    const id = $("#pageId")?.value;

    const payload = {
      slug: $("#pageSlug")?.value.trim() || "",
      title_ar: $("#pageTitleAr")?.value.trim() || "",
      title_en: $("#pageTitleEn")?.value.trim() || "",
      content_ar: $("#pageContentAr")?.value || "",
      content_en: $("#pageContentEn")?.value || "",
      is_published: $("#pagePublished")?.checked === true
    };

    if (!/^[a-zA-Z0-9_-]+$/.test(payload.slug)) {
      if (status) {
        status.textContent = "معرّف الصفحة يقبل الحروف الإنجليزية والأرقام والشرطة فقط.";
      }
      return;
    }

    if (!payload.title_ar || !payload.title_en) {
      if (status) status.textContent = "اكتب عنوان الصفحة بالعربية والإنجليزية.";
      return;
    }

    if (payload.slug.length > 150) {
      if (status) status.textContent = "معرّف الصفحة طويل جدًا.";
      return;
    }

    if (payload.title_ar.length > 500 || payload.title_en.length > 500) {
      if (status) status.textContent = "عنوان الصفحة تجاوز الحد المسموح.";
      return;
    }

    if (payload.content_ar.length > 30000 || payload.content_en.length > 30000) {
      if (status) status.textContent = "محتوى الصفحة تجاوز الحد المسموح.";
      return;
    }

    setButtonLoading(button, true);

    if (status) status.textContent = "جاري حفظ الصفحة...";

    try {
      const editing = Boolean(id);

      await api(API.pages, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(editing ? { ...payload, id } : payload)
      });

      resetPageForm();

      const refreshed = await loadPages();

      if (refreshed) {
        showToast(
          editing ? "تم تحديث الصفحة بنجاح." : "تمت إضافة الصفحة بنجاح."
        );
      } else {
        showToast(
          "تم حفظ الصفحة، لكن تعذر تحديث القائمة. اضغط تحديث الصفحات.",
          "error"
        );
      }
    } catch (error) {
      if (status) status.textContent = error.message;

      if (!state.redirectingToLogin) {
        showToast(error.message, "error");
      }
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function togglePagePublication(id, button) {
    const page = state.pages.find((item) => String(item.id) === String(id));

    if (!page || button?.disabled) return;

    if (button) button.disabled = true;

    try {
      await api(API.pages, {
        method: "PATCH",
        body: JSON.stringify({
          id: page.id,
          is_published: !page.is_published
        })
      });

      const refreshed = await loadPages();

      if (refreshed) {
        showToast("تم تحديث حالة نشر الصفحة.");
      } else {
        showToast("تم تحديث الحالة، لكن تعذر تحديث القائمة.", "error");
      }
    } catch (error) {
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function deletePage(id, button) {
    const page = state.pages.find((item) => String(item.id) === String(id));

    if (!page || button?.disabled) return;

    const title = page.title_ar || page.slug || "هذه الصفحة";

    if (!window.confirm(`هل أنت متأكد من حذف صفحة "${title}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    if (button) button.disabled = true;

    try {
      await api(API.pages, {
        method: "DELETE",
        body: JSON.stringify({ id: page.id })
      });

      if (String(state.editingPageId) === String(page.id)) {
        resetPageForm();
      }

      const refreshed = await loadPages();

      if (refreshed) {
        showToast("تم حذف الصفحة.");
      } else {
        showToast("تم الحذف، لكن تعذر تحديث القائمة.", "error");
      }
    } catch (error) {
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  // ==========================================
  // MESSAGES MANAGEMENT
  // ==========================================

  function renderRecentMessages() {
    const tbody = $("#dashboardMessages");
    if (!tbody) return;

    const recent = state.messages.slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">لا توجد رسائل حتى الآن.</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map((message) => `
      <tr>
        <td>${escapeHTML(message.name)}</td>
        <td>${escapeHTML(message.email)}</td>
        <td>${escapeHTML(message.subject || "بدون موضوع")}</td>
        <td>
          <span class="status-badge ${getStatusClass(message.status)}">
            ${escapeHTML(getStatusLabel(message.status))}
          </span>
        </td>
        <td>${escapeHTML(formatDate(message.created_at))}</td>
      </tr>
    `).join("");
  }

  function renderMessages() {
    const tbody = $("#messagesTableBody");
    if (!tbody) return;

    const search = ($("#messageSearch")?.value || "").trim().toLowerCase();
    const filter = $("#messageStatusFilter")?.value || "all";

    const filtered = state.messages.filter((message) => {
      const searchable = [
        message.name,
        message.email,
        message.subject,
        message.message
      ].join(" ").toLowerCase();

      return searchable.includes(search) &&
        (filter === "all" || message.status === filter);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-search-result">لا توجد رسائل مطابقة.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((message) => `
      <tr data-message-id="${escapeHTML(message.id)}">
        <td>${escapeHTML(message.name)}</td>
        <td>${escapeHTML(message.email)}</td>
        <td>${escapeHTML(message.subject || "بدون موضوع")}</td>
        <td>
          <span class="status-badge ${getStatusClass(message.status)}">
            ${escapeHTML(getStatusLabel(message.status))}
          </span>
        </td>
        <td>${escapeHTML(formatDate(message.created_at))}</td>
        <td>
          <button type="button" class="action-button" data-message-open="${escapeHTML(message.id)}">عرض</button>
        </td>
      </tr>
    `).join("");

    $$("[data-message-open]", tbody).forEach((button) => {
      button.addEventListener("click", () => openMessage(button.dataset.messageOpen));
    });
  }

  async function loadMessages() {
    if (state.loadingMessages || state.redirectingToLogin) return;

    state.loadingMessages = true;

    try {
      const data = await api(API.messages);
      state.messages = getArray(data.messages);

      renderMessages();
      renderRecentMessages();
      updateDashboardStats();
    } catch (error) {
      const tbody = $("#messagesTableBody");

      if (tbody) {
        tbody.textContent = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = error.message;

        row.appendChild(cell);
        tbody.appendChild(row);
      }

      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      state.loadingMessages = false;
    }
  }

  function openMessage(id) {
    const message = state.messages.find((item) => String(item.id) === String(id));
    if (!message) return;

    state.currentMessage = message;

    const body = $("#messageModalBody");
    const actions = $("#messageModalActions");

    if (!body) return;

    body.innerHTML = `
      <div class="message-detail">
        <strong>الاسم</strong>
        <p>${escapeHTML(message.name)}</p>
      </div>
      <div class="message-detail">
        <strong>البريد الإلكتروني</strong>
        <p>${escapeHTML(message.email)}</p>
      </div>
      <div class="message-detail">
        <strong>الموضوع</strong>
        <p>${escapeHTML(message.subject || "بدون موضوع")}</p>
      </div>
      <div class="message-detail">
        <strong>الرسالة</strong>
        <p>${escapeHTML(message.message)}</p>
      </div>
      <div class="message-detail">
        <strong>تاريخ الإرسال</strong>
        <p>${escapeHTML(formatDate(message.created_at))}</p>
      </div>
      <div class="message-detail">
        <strong>الحالة</strong>
        <p>${escapeHTML(getStatusLabel(message.status))}</p>
      </div>
    `;

    if (actions) {
      actions.innerHTML = `
        <label for="messageStatusSelect">حالة الرسالة</label>
        <select id="messageStatusSelect">
          <option value="new" ${message.status === "new" ? "selected" : ""}>جديدة</option>
          <option value="read" ${message.status === "read" ? "selected" : ""}>مقروءة</option>
          <option value="replied" ${message.status === "replied" ? "selected" : ""}>تم الرد</option>
          <option value="archived" ${message.status === "archived" ? "selected" : ""}>مؤرشفة</option>
        </select>
        <button type="button" id="saveMessageStatus">حفظ الحالة</button>
      `;

      $("#saveMessageStatus")?.addEventListener("click", updateMessageStatus);
    }

    const modal = $("#messageModal");

    setVisible(modal, true);
    modal?.classList.add("active");
  }

  function closeMessageModal() {
    const modal = $("#messageModal");
    if (!modal) return;

    modal.classList.remove("active");
    setVisible(modal, false);
    state.currentMessage = null;
  }

  async function updateMessageStatus() {
    const message = state.currentMessage;
    const select = $("#messageStatusSelect");
    const button = $("#saveMessageStatus");

    if (!message || !select || button?.disabled) return;

    const status = select.value;

    if (!Object.hasOwn(STATUS_LABELS, status)) {
      showToast("حالة الرسالة غير صحيحة.", "error");
      return;
    }

    setButtonLoading(button, true);

    try {
      await api(API.messages, {
        method: "PATCH",
        body: JSON.stringify({ id: message.id, status })
      });

      closeMessageModal();
      await loadMessages();

      showToast("تم تحديث حالة الرسالة.");
    } catch (error) {
      if (!state.redirectingToLogin) showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  function initializeEvents() {
    $("#logoutButton")?.addEventListener("click", logout);

    $("#profileForm")?.addEventListener("submit", saveProfile);
    $("#reloadProfile")?.addEventListener("click", loadProfile);

    $("#pageForm")?.addEventListener("submit", savePage);
    $("#cancelPageEdit")?.addEventListener("click", resetPageForm);
    $("#refreshPagesButton")?.addEventListener("click", loadPages);
    $("#retryPagesButton")?.addEventListener("click", loadPages);
    $("#pageSearch")?.addEventListener("input", renderPages);

    $("#addSkillButton")?.addEventListener("click", () => openSkillModal());
    $("#addFirstSkillButton")?.addEventListener("click", () => openSkillModal());
    $("#skillForm")?.addEventListener("submit", saveSkill);
    $("#closeSkillModal")?.addEventListener("click", closeSkillModal);
    $("#cancelSkillForm")?.addEventListener("click", closeSkillModal);
    $("#closeDeleteSkillModal")?.addEventListener("click", closeDeleteSkillModal);
    $("#cancelDeleteSkill")?.addEventListener("click", closeDeleteSkillModal);
    $("#confirmDeleteSkill")?.addEventListener("click", confirmDeleteSkill);
    $("#refreshSkillsButton")?.addEventListener("click", loadSkills);
    $("#retrySkillsButton")?.addEventListener("click", loadSkills);
    $("#skillSearch")?.addEventListener("input", renderSkills);
    $("#skillVisibilityFilter")?.addEventListener("change", renderSkills);

    $("#messageSearch")?.addEventListener("input", renderMessages);
    $("#messageStatusFilter")?.addEventListener("change", renderMessages);
    $("#refreshDashboard")?.addEventListener("click", refreshDashboard);
    $("#closeMessageModal")?.addEventListener("click", closeMessageModal);

    [
      "#skillModal",
      "#deleteSkillModal",
      "#messageModal"
    ].forEach((selector) => {
      const modal = $(selector);

      modal?.addEventListener("click", (event) => {
        if (event.target !== modal) return;

        if (selector === "#skillModal") {
          closeSkillModal();
        } else if (selector === "#deleteSkillModal") {
          closeDeleteSkillModal();
        } else {
          closeMessageModal();
        }
      });
    });
  }

  // ==========================================
  // DASHBOARD REFRESH
  // ==========================================

  async function refreshDashboard() {
    if (state.redirectingToLogin) return;

    await Promise.all([
      loadMessages(),
      loadSkills()
    ]);
  }

  // ==========================================
  // APPLICATION INITIALIZATION
  // ==========================================

  async function init() {
    const authenticated = await checkSession();

    if (!authenticated || state.redirectingToLogin) return;

    const year = $("#currentYear");
    if (year) year.textContent = String(new Date().getFullYear());

    initializeNavigation();
    initializeEvents();
    activateSection("overview");

    await Promise.all([
      loadMessages(),
      loadSkills(),
      loadProfile(),
      loadPages()
    ]);
  }

  init();
})();
