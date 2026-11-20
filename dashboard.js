(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const authLoading = $("#authLoading");
  const adminApp = $("#adminApp");
  const sidebar = $("#sidebar");
  const sidebarOverlay = $("#sidebarOverlay");

  const dashboardMessages = $("#dashboardMessages");
  const recentMessages = $("#recentMessages");

  let allMessages = [];
  let currentMessage = null;

  const statusLabels = {
    new: "جديدة",
    read: "تمت قراءتها",
    replied: "تم الرد",
    archived: "مؤرشفة"
  };

  const statusClasses = {
    new: "new",
    read: "read",
    replied: "replied",
    archived: "archived"
  };

  const sectionTitles = {
    overview: "نظرة عامة",
    profile: "الملف الشخصي",
    skills: "المهارات",
    projects: "المشاريع",
    messages: "رسائل التواصل",
    social: "روابط التواصل",
    pages: "إدارة الصفحات",
    seo: "تحسين محركات البحث",
    security: "الأمان",
    settings: "الإعدادات"
  };

  /* API */

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = response.status === 401
        ? "انتهت الجلسة. سجل الدخول مرة أخرى."
        : data.error || "حدث خطأ أثناء تنفيذ الطلب.";

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  /* Toast */

  let toastTimer;

  function showToast(message, type = "success") {
    const toast = $("#adminToast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden", "error");

    if (type === "error") {
      toast.classList.add("error");
    }

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3500);
  }

  /* Formatting */

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getStatusLabel(status) {
    return statusLabels[status] || status || "غير محددة";
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  /* Dashboard visibility */

  function showDashboard() {
    if (authLoading) authLoading.classList.add("hidden");
    if (adminApp) adminApp.classList.remove("hidden");
  }

  function redirectToLogin() {
    window.location.replace("admin.html");
  }

  /* Authentication */

  async function checkSession() {
    try {
      const data = await api("/api/admin/session");

      if (!data.authenticated) {
        redirectToLogin();
        return false;
      }

      showDashboard();
      return true;
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return false;
      }

      if (authLoading) {
        authLoading.textContent =
          "تعذر التحقق من الجلسة. تحقق من اتصالك ثم أعد تحميل الصفحة.";
      }

      return false;
    }
  }

  /* Sidebar */

  function openSidebar() {
    sidebar?.classList.add("open");
    sidebarOverlay?.classList.add("show");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
  }

  $("#menuToggle")?.addEventListener("click", openSidebar);
  $("#sidebarClose")?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  /* Navigation */

  function activateSection(sectionName) {
    if (!sectionTitles[sectionName]) return;

    document.querySelectorAll(".dashboard-section").forEach((section) => {
      section.classList.toggle(
        "active",
        section.id === `section-${sectionName}`
      );
    });

    document.querySelectorAll("[data-section]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.section === sectionName
      );
    });

    const title = $("#currentPageTitle");

    if (title) {
      title.textContent = sectionTitles[sectionName];
    }

    closeSidebar();

    if (sectionName === "profile") {
      loadProfile();
    }
  }

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      activateSection(button.dataset.section);
    });
  });

  /* Statistics */

  function updateStatistics() {
    const total = allMessages.length;

    const newCount = allMessages.filter(
      (message) => message.status === "new"
    ).length;

    const totalElement = $("#statTotalMessages");
    const newElement = $("#statNewMessages");
    const projectsElement = $("#statProjects");
    const skillsElement = $("#statSkills");
    const badge = $("#newMessagesBadge");

    if (totalElement) totalElement.textContent = total;
    if (newElement) newElement.textContent = newCount;

    if (projectsElement) projectsElement.textContent = "—";
    if (skillsElement) skillsElement.textContent = "—";

    if (badge) {
      badge.textContent = newCount;
      badge.classList.toggle("hidden", newCount === 0);
    }

    const databaseStatus = $("#databaseStatus");

    if (databaseStatus) {
      databaseStatus.textContent = "متاحة";
    }
  }

  /* Message table */

  function renderMessages(messages) {
    if (!dashboardMessages) return;

    dashboardMessages.replaceChildren();

    if (!messages.length) {
      const row = createElement("tr");
      const cell = createElement(
        "td",
        "empty-state",
        "لا توجد رسائل مطابقة."
      );

      cell.colSpan = 6;
      row.appendChild(cell);
      dashboardMessages.appendChild(row);
      return;
    }

    messages.forEach((message) => {
      const row = document.createElement("tr");

      const nameCell = createElement("td", "", message.name || "بدون اسم");
      const emailCell = createElement("td", "", message.email || "—");
      const subjectCell = createElement("td", "", message.subject || "بدون موضوع");
      const dateCell = createElement("td", "", formatDate(message.created_at));

      const statusCell = createElement("td");
      const statusBadge = createElement(
        "span",
        `message-status ${statusClasses[message.status] || ""}`,
        getStatusLabel(message.status)
      );

      statusCell.appendChild(statusBadge);

      const actionCell = createElement("td");
      const actionButton = createElement(
        "button",
        "table-action",
        "عرض التفاصيل"
      );

      actionButton.type = "button";
      actionButton.addEventListener("click", () => {
        openMessageModal(message);
      });

      actionCell.appendChild(actionButton);

      row.append(
        nameCell,
        emailCell,
        subjectCell,
        dateCell,
        statusCell,
        actionCell
      );

      dashboardMessages.appendChild(row);
    });
  }

  /* Recent messages */

  function renderRecentMessages() {
    if (!recentMessages) return;

    recentMessages.replaceChildren();

    const recent = allMessages.slice(0, 5);

    if (!recent.length) {
      recentMessages.appendChild(
        createElement("p", "empty-state", "لا توجد رسائل حتى الآن.")
      );
      return;
    }

    recent.forEach((message) => {
      const item = createElement("div", "recent-message-item");
      const info = createElement("div", "recent-message-info");

      info.append(
        createElement("strong", "", message.name || "بدون اسم"),
        createElement("span", "", message.subject || "بدون موضوع"),
        createElement("small", "", formatDate(message.created_at))
      );

      const badge = createElement(
        "span",
        `message-status ${statusClasses[message.status] || ""}`,
        getStatusLabel(message.status)
      );

      item.append(info, badge);

      item.addEventListener("click", () => {
        openMessageModal(message);
      });

      recentMessages.appendChild(item);
    });
  }

  /* Load messages */

  async function loadMessages() {
    try {
      const data = await api("/api/admin/messages");

      if (!Array.isArray(data.messages)) {
        throw new Error("صيغة بيانات الرسائل غير متوقعة.");
      }

      allMessages = data.messages;

      updateStatistics();
      renderMessages(allMessages);
      renderRecentMessages();

      const sessionStatus = $("#sessionStatus");

      if (sessionStatus) {
        sessionStatus.textContent = "نشطة";
      }

      return true;
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return false;
      }

      showToast(error.message, "error");

      const databaseStatus = $("#databaseStatus");

      if (databaseStatus) {
        databaseStatus.textContent = "غير متاحة";
      }

      return false;
    }
  }

  /* Search and filter */

  function getFilteredMessages() {
    const searchValue = ($("#messageSearch")?.value || "")
      .trim()
      .toLowerCase();

    const statusValue = $("#messageStatusFilter")?.value || "all";

    return allMessages.filter((message) => {
      const searchableText = [
        message.name,
        message.email,
        message.subject,
        message.message
      ].join(" ").toLowerCase();

      return searchableText.includes(searchValue) &&
        (statusValue === "all" || message.status === statusValue);
    });
  }

  function filterMessages() {
    renderMessages(getFilteredMessages());
  }

  $("#messageSearch")?.addEventListener("input", filterMessages);
  $("#messageStatusFilter")?.addEventListener("change", filterMessages);

  /* Message modal */

  function openMessageModal(message) {
    currentMessage = message;

    const modal = $("#messageModal");

    if (!modal) return;

    $("#modalName").textContent = message.name || "—";
    $("#modalEmail").textContent = message.email || "—";
    $("#modalSubject").textContent = message.subject || "—";
    $("#modalDate").textContent = formatDate(message.created_at);
    $("#modalMessage").textContent = message.message || "—";

    const statusSelect = $("#modalStatus");

    if (statusSelect) {
      statusSelect.value = message.status || "new";
    }

    modal.classList.remove("hidden");
  }

  function closeMessageModal() {
    $("#messageModal")?.classList.add("hidden");
    currentMessage = null;
  }

  $("#closeMessageModal")?.addEventListener("click", closeMessageModal);
  $("#cancelMessageModal")?.addEventListener("click", closeMessageModal);

  $("#messageModal")?.addEventListener("click", (event) => {
    if (event.target.id === "messageModal") {
      closeMessageModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMessageModal();
      closeSidebar();
    }
  });

  /* Update message status */

  $("#saveMessageStatus")?.addEventListener("click", async () => {
    if (!currentMessage) return;

    const statusSelect = $("#modalStatus");
    const saveButton = $("#saveMessageStatus");

    const newStatus = statusSelect?.value;

    if (!["new", "read", "replied", "archived"].includes(newStatus)) {
      showToast("حالة الرسالة غير صحيحة.", "error");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "جارٍ الحفظ...";

    try {
      await api("/api/admin/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: currentMessage.id,
          status: newStatus
        })
      });

      currentMessage.status = newStatus;

      const messageIndex = allMessages.findIndex(
        (message) => message.id === currentMessage.id
      );

      if (messageIndex !== -1) {
        allMessages[messageIndex].status = newStatus;
      }

      updateStatistics();
      renderMessages(getFilteredMessages());
      renderRecentMessages();

      closeMessageModal();
      showToast("تم تحديث حالة الرسالة.");
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return;
      }

      showToast(error.message, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "حفظ التغييرات";
    }
  });

  /* Profile Management */

  const profileFields = {
    full_name: "#profileFullName",
    job_title: "#profileJobTitle",
    short_bio: "#profileShortBio",
    about: "#profileAbout",
    location: "#profileLocation",
    email: "#profileEmail",
    profile_image: "#profileImage"
  };

  function setProfileStatus(message, type = "success") {
    const status = $("#profileFormStatus");

    if (!status) return;

    status.textContent = message;
    status.dataset.type = type;
  }

  function fillProfileForm(profile) {
    for (const [field, selector] of Object.entries(profileFields)) {
      const input = $(selector);

      if (input) {
        input.value = profile[field] || "";
      }
    }

    const name = profile.full_name || "Administrator";
    const sidebarName = $("#sidebarAdminName");
    const avatar = $("#adminAvatar");

    if (sidebarName) {
      sidebarName.textContent = name;
    }

    if (avatar) {
      avatar.textContent = name.charAt(0).toUpperCase();
    }
  }

  async function loadProfile() {
    const reloadButton = $("#reloadProfile");

    if (reloadButton) {
      reloadButton.disabled = true;
    }

    setProfileStatus("جاري تحميل البيانات...");

    try {
      const data = await api("/api/admin/profile");

      if (!data.profile) {
        throw new Error("بيانات الملف الشخصي غير متاحة.");
      }

      fillProfileForm(data.profile);
      setProfileStatus("تم تحميل بيانات الملف الشخصي.");
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return;
      }

      setProfileStatus(error.message, "error");
    } finally {
      if (reloadButton) {
        reloadButton.disabled = false;
      }
    }
  }

  $("#reloadProfile")?.addEventListener("click", loadProfile);

  $("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const saveButton = $("#saveProfile");

    if (!saveButton || saveButton.disabled) return;

    const profile = {};

    for (const [field, selector] of Object.entries(profileFields)) {
      const input = $(selector);
      profile[field] = input ? input.value.trim() : "";
    }

    if (!profile.full_name) {
      setProfileStatus("الاسم الكامل مطلوب.", "error");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "جاري الحفظ...";

    try {
      const data = await api("/api/admin/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });

      if (!data.profile) {
        throw new Error("لم يتم استلام البيانات المحفوظة.");
      }

      fillProfileForm(data.profile);
      setProfileStatus("تم حفظ بيانات الملف الشخصي بنجاح.");
      showToast("تم تحديث الملف الشخصي.");
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return;
      }

      setProfileStatus(error.message, "error");
      showToast(error.message, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "حفظ التغييرات";
    }
  });

  /* Refresh */

  $("#refreshDashboard")?.addEventListener("click", async () => {
    const button = $("#refreshDashboard");

    if (button) button.disabled = true;

    await loadMessages();

    if (button) button.disabled = false;
  });

  /* Logout */

  $("#logoutButton")?.addEventListener("click", async () => {
    const button = $("#logoutButton");

    if (button) {
      button.disabled = true;
    }

    try {
      await api("/api/admin/logout", {
        method: "POST"
      });

      window.location.replace("admin.html");
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return;
      }

      showToast(error.message, "error");

      if (button) {
        button.disabled = false;
      }
    }
  });

  /* Current year */

  const currentYear = $("#currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  /* Start dashboard */

  async function initializeDashboard() {
    const authenticated = await checkSession();

    if (!authenticated) return;

    await loadMessages();
  }

  initializeDashboard();

})();
