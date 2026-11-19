(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const loginForm = $("#loginForm");
  const adminPassword = $("#adminPassword");
  const loginButton = $("#loginButton");
  const loginError = $("#loginError");

  const dashboard = $("#dashboard");
  const sidebar = $("#sidebar");
  const mobileOverlay = $("#mobileOverlay");

  const menuButton = $("#menuButton");
  const refreshButton = $("#refreshButton");
  const refreshNav = $("#refreshNav");
  const logoutButton = $("#logoutButton");

  const overviewNav = $("#overviewNav");
  const messagesNav = $("#messagesNav");

  const totalCount = $("#totalCount");
  const newCount = $("#newCount");
  const readCount = $("#readCount");
  const repliedCount = $("#repliedCount");

  const messagesSection = $("#messagesSection");
  const searchInput = $("#searchInput");
  const statusFilter = $("#statusFilter");
  const messagesTable = $("#messagesTable");

  const messageModal = $("#messageModal");
  const closeModal = $("#closeModal");

  const detailName = $("#detailName");
  const detailEmail = $("#detailEmail");
  const detailSubject = $("#detailSubject");
  const detailDate = $("#detailDate");
  const detailMessage = $("#detailMessage");
  const detailStatus = $("#detailStatus");
  const saveStatusButton = $("#saveStatusButton");

  const toast = $("#toast");

  let messages = [];
  let selectedMessage = null;
  let toastTimeout = null;

  const API = {
    login: "/api/admin/login",
    session: "/api/admin/session",
    messages: "/api/admin/messages",
    updateStatus: "/api/admin/update-status",
    logout: "/api/admin/logout"
  };

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || "حدث خطأ في الاتصال بالسيرفر");
    }

    return data;
  }

  function showToast(message, duration = 3000) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

  function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "جاري التنفيذ..." : originalText;
  }

  function showLogin() {
    if (loginForm) loginForm.closest(".login-container")?.classList.remove("hidden");
    if (dashboard) dashboard.classList.add("hidden");
  }

  function showDashboard() {
    if (loginForm) loginForm.closest(".login-container")?.classList.add("hidden");
    if (dashboard) dashboard.classList.remove("hidden");
  }

  function normalizeMessages(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data?.messages)) return data.data.messages;

    return [];
  }

  async function login(password) {
    if (loginError) {
      loginError.textContent = "";
      loginError.classList.add("hidden");
    }

    setLoading(loginButton, true, "تسجيل الدخول ←");

    try {
      await apiRequest(API.login, {
        method: "POST",
        body: JSON.stringify({ password })
      });

      showDashboard();
      await loadMessages();

      if (adminPassword) adminPassword.value = "";

      showToast("تم تسجيل الدخول بنجاح");
    } catch (error) {
      if (loginError) {
        loginError.textContent = error.message;
        loginError.classList.remove("hidden");
      }
    } finally {
      setLoading(loginButton, false, "تسجيل الدخول ←");
    }
  }

  async function checkSession() {
    try {
      await apiRequest(API.session);
      showDashboard();
      await loadMessages();
    } catch {
      showLogin();
    }
  }

  async function loadMessages() {
    if (messagesTable) {
      messagesTable.innerHTML = `
        <tbody>
          <tr>
            <td colspan="6" class="empty-state">جاري تحميل الرسائل...</td>
          </tr>
        </tbody>
      `;
    }

    try {
      const data = await apiRequest(API.messages);

      messages = normalizeMessages(data);

      updateStats();
      renderMessages();
    } catch (error) {
      showToast(error.message);

      if (messagesTable) {
        messagesTable.innerHTML = `
          <tbody>
            <tr>
              <td colspan="6" class="empty-state">
                تعذر تحميل الرسائل. حاول تحديث البيانات.
              </td>
            </tr>
          </tbody>
        `;
      }
    }
  }

  function updateStats() {
    const total = messages.length;
    const newMessages = messages.filter(m => m.status === "new").length;
    const readMessages = messages.filter(m => m.status === "read").length;
    const repliedMessages = messages.filter(m => m.status === "replied").length;

    if (totalCount) totalCount.textContent = total;
    if (newCount) newCount.textContent = newMessages;
    if (readCount) readCount.textContent = readMessages;
    if (repliedCount) repliedCount.textContent = repliedMessages;
  }

  function getStatusLabel(status) {
    const labels = {
      new: "جديدة",
      read: "مقروءة",
      replied: "تم الرد",
      archived: "مؤرشفة"
    };

    return labels[status] || "غير محدد";
  }

  function getStatusClass(status) {
    const classes = {
      new: "status-new",
      read: "status-read",
      replied: "status-replied",
      archived: "status-archived"
    };

    return classes[status] || "";
  }

  function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text ?? "—";
    return cell;
  }

  function renderMessages() {
    if (!messagesTable) return;

    const search = (searchInput?.value || "").trim().toLowerCase();
    const selectedStatus = statusFilter?.value || "all";

    const filteredMessages = messages.filter(message => {
      const searchable = [
        message.name,
        message.email,
        message.subject,
        message.message
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);
      const matchesStatus =
        selectedStatus === "all" || message.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    const tbody = document.createElement("tbody");

    if (filteredMessages.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.className = "empty-state";
      cell.textContent = "لا توجد رسائل مطابقة";

      row.appendChild(cell);
      tbody.appendChild(row);
    } else {
      filteredMessages.forEach(message => {
        const row = document.createElement("tr");

        row.appendChild(createCell(message.name));
        row.appendChild(createCell(message.email));
        row.appendChild(createCell(message.subject));
        row.appendChild(createCell(formatDate(message.created_at)));

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = `status-badge ${getStatusClass(message.status)}`;
        badge.textContent = getStatusLabel(message.status);

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        const viewButton = document.createElement("button");

        viewButton.type = "button";
        viewButton.className = "view-button";
        viewButton.textContent = "عرض الرسالة";

        viewButton.addEventListener("click", () => {
          openMessage(message);
        });

        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);

        tbody.appendChild(row);
      });
    }

    messagesTable.replaceChildren(tbody);
  }

  function openMessage(message) {
    selectedMessage = message;

    if (detailName) detailName.textContent = message.name || "—";
    if (detailEmail) detailEmail.textContent = message.email || "—";
    if (detailSubject) detailSubject.textContent = message.subject || "—";
    if (detailDate) detailDate.textContent = formatDate(message.created_at);
    if (detailMessage) detailMessage.textContent = message.message || "—";

    if (detailStatus) {
      detailStatus.value = message.status || "new";
    }

    if (messageModal) {
      messageModal.classList.remove("hidden");
    }
  }

  function closeMessageModal() {
    if (messageModal) {
      messageModal.classList.add("hidden");
    }

    selectedMessage = null;
  }

  async function updateMessageStatus() {
    if (!selectedMessage || !detailStatus) return;

    const id = selectedMessage.id;
    const status = detailStatus.value;

    if (!id || !["new", "read", "replied", "archived"].includes(status)) {
      showToast("بيانات الحالة غير صحيحة");
      return;
    }

    setLoading(saveStatusButton, true, "حفظ التغييرات");

    try {
      await apiRequest(API.updateStatus, {
        method: "POST",
        body: JSON.stringify({ id, status })
      });

      selectedMessage.status = status;

      const existing = messages.find(message => message.id === id);
      if (existing) existing.status = status;

      updateStats();
      renderMessages();
      closeMessageModal();

      showToast("تم تحديث حالة الرسالة");
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(saveStatusButton, false, "حفظ التغييرات");
    }
  }

  async function logout() {
    if (logoutButton) logoutButton.disabled = true;

    try {
      await apiRequest(API.logout, {
        method: "POST",
        body: JSON.stringify({})
      });
    } catch (error) {
      showToast(error.message);
    } finally {
      messages = [];
      selectedMessage = null;

      showLogin();
      closeMessageModal();

      if (logoutButton) logoutButton.disabled = false;

      showToast("تم تسجيل الخروج");
    }
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    mobileOverlay?.classList.remove("show");
  }

  function toggleSidebar() {
    sidebar?.classList.toggle("open");
    mobileOverlay?.classList.toggle("show");
  }

  function showSection(section) {
    if (section === "messages") {
      messagesSection?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      messagesNav?.classList.add("active");
      overviewNav?.classList.remove("active");
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      overviewNav?.classList.add("active");
      messagesNav?.classList.remove("active");
    }

    closeSidebar();
  }

  // Events

  loginForm?.addEventListener("submit", event => {
    event.preventDefault();

    const password = adminPassword?.value || "";

    if (!password.trim()) {
      if (loginError) {
        loginError.textContent = "أدخل كلمة المرور";
        loginError.classList.remove("hidden");
      }
      return;
    }

    login(password);
  });

  refreshButton?.addEventListener("click", loadMessages);
  refreshNav?.addEventListener("click", loadMessages);
  logoutButton?.addEventListener("click", logout);

  overviewNav?.addEventListener("click", () => {
    showSection("overview");
  });

  messagesNav?.addEventListener("click", () => {
    showSection("messages");
  });

  searchInput?.addEventListener("input", renderMessages);
  statusFilter?.addEventListener("change", renderMessages);

  closeModal?.addEventListener("click", closeMessageModal);

  messageModal?.addEventListener("click", event => {
    if (event.target === messageModal) {
      closeMessageModal();
    }
  });

  saveStatusButton?.addEventListener("click", updateMessageStatus);

  menuButton?.addEventListener("click", toggleSidebar);
  mobileOverlay?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMessageModal();
      closeSidebar();
    }
  });

  // Start

  checkSession();

})();
