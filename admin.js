(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  // Login
  const loginScreen = $("#loginScreen");
  const loginForm = $("#loginForm");
  const adminPassword = $("#adminPassword");
  const loginButton = $("#loginButton");
  const loginError = $("#loginError");

  // Dashboard
  const dashboard = $("#dashboard");
  const sidebar = $("#sidebar");
  const mobileOverlay = $("#mobileOverlay");

  // Controls
  const menuButton = $("#menuButton");
  const refreshButton = $("#refreshButton");
  const refreshNav = $("#refreshNav");
  const logoutButton = $("#logoutButton");

  // Navigation
  const overviewNav = $("#overviewNav");
  const messagesNav = $("#messagesNav");

  // Statistics
  const totalCount = $("#totalCount");
  const newCount = $("#newCount");
  const readCount = $("#readCount");
  const repliedCount = $("#repliedCount");

  // Messages
  const messagesSection = $("#messagesSection");
  const searchInput = $("#searchInput");
  const statusFilter = $("#statusFilter");
  const messagesTable = $("#messagesTable");

  // Modal
  const messageModal = $("#messageModal");
  const closeModal = $("#closeModal");

  const detailName = $("#detailName");
  const detailEmail = $("#detailEmail");
  const detailSubject = $("#detailSubject");
  const detailDate = $("#detailDate");
  const detailMessage = $("#detailMessage");
  const detailStatus = $("#detailStatus");
  const saveStatusButton = $("#saveStatusButton");

  // Toast
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

  const VALID_STATUSES = ["new", "read", "replied", "archived"];

  // API
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
      throw new Error(
        data.error ||
        data.message ||
        "حدث خطأ في الاتصال بالسيرفر"
      );
    }

    return data;
  }

  // Notifications
  function showToast(message, duration = 3000) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

  // Loading state
  function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = "جاري التنفيذ...";
    } else {
      button.textContent =
        button.dataset.originalText || originalText;

      delete button.dataset.originalText;
    }
  }

  // Screens
  function showLogin() {
    loginScreen?.classList.remove("hidden");
    dashboard?.classList.add("hidden");

    closeSidebar();
    closeMessageModal();
  }

  function showDashboard() {
    loginScreen?.classList.add("hidden");
    dashboard?.classList.remove("hidden");
  }

  // Normalize API response
  function normalizeMessages(data) {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.messages)) {
      return data.messages;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.data?.messages)) {
      return data.data.messages;
    }

    return [];
  }

  // Login
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

      if (adminPassword) {
        adminPassword.value = "";
      }

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

  // Check admin session
  async function checkSession() {
    try {
      await apiRequest(API.session);

      showDashboard();
      await loadMessages();

    } catch {
      showLogin();
    }
  }

  // Load messages
  async function loadMessages() {
    if (messagesTable) {
      messagesTable.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            جاري تحميل الرسائل...
          </td>
        </tr>
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
          <tr>
            <td colspan="5" class="empty-state">
              تعذر تحميل الرسائل. حاول تحديث البيانات.
            </td>
          </tr>
        `;
      }
    }
  }

  // Statistics
  function updateStats() {
    const total = messages.length;

    const newMessages = messages.filter(
      message => message.status === "new"
    ).length;

    const readMessages = messages.filter(
      message => message.status === "read"
    ).length;

    const repliedMessages = messages.filter(
      message => message.status === "replied"
    ).length;

    if (totalCount) totalCount.textContent = total;
    if (newCount) newCount.textContent = newMessages;
    if (readCount) readCount.textContent = readMessages;
    if (repliedCount) repliedCount.textContent = repliedMessages;
  }

  // Status labels
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

  // Date formatting
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

  // Safe table cell
  function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    return cell;
  }

  // Render messages
  function renderMessages() {
    if (!messagesTable) return;

    const search = (searchInput?.value || "")
      .trim()
      .toLowerCase();

    const selectedStatus = statusFilter?.value || "all";

    const filteredMessages = messages.filter(message => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const searchable = [
        message.name,
        message.email,
        message.subject,
        message.message
      ]
        .map(value => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchable.includes(search);

      const matchesStatus =
        selectedStatus === "all" ||
        message.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    const rows = [];

    if (filteredMessages.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "empty-state";
      cell.textContent = "لا توجد رسائل مطابقة";

      row.appendChild(cell);
      rows.push(row);

    } else {
      filteredMessages.forEach(message => {
        const row = document.createElement("tr");

        // 1. Name
        row.appendChild(createCell(message.name));

        // 2. Subject
        row.appendChild(createCell(message.subject));

        // 3. Date
        row.appendChild(
          createCell(formatDate(message.created_at))
        );

        // 4. Status
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className =
          `status-badge ${getStatusClass(message.status)}`;

        badge.textContent = getStatusLabel(message.status);

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // 5. Action
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

        rows.push(row);
      });
    }

    // messagesTable is already a tbody.
    // Do not create another tbody inside it.
    messagesTable.replaceChildren(...rows);
  }

  // Open message details
  function openMessage(message) {
    if (!message) return;

    selectedMessage = message;

    if (detailName) {
      detailName.textContent = message.name || "—";
    }

    if (detailEmail) {
      detailEmail.textContent = message.email || "—";
    }

    if (detailSubject) {
      detailSubject.textContent = message.subject || "—";
    }

    if (detailDate) {
      detailDate.textContent = formatDate(message.created_at);
    }

    if (detailMessage) {
      detailMessage.textContent = message.message || "—";
    }

    if (detailStatus) {
      detailStatus.value = VALID_STATUSES.includes(message.status)
        ? message.status
        : "new";
    }

    messageModal?.classList.remove("hidden");
  }

  // Close modal
  function closeMessageModal() {
    messageModal?.classList.add("hidden");
    selectedMessage = null;
  }

  // Update message status
  async function updateMessageStatus() {
    if (!selectedMessage || !detailStatus) return;

    const id = selectedMessage.id;
    const status = detailStatus.value;

    if (
      id == null ||
      !VALID_STATUSES.includes(status)
    ) {
      showToast("بيانات الحالة غير صحيحة");
      return;
    }

    setLoading(
      saveStatusButton,
      true,
      "حفظ التغييرات"
    );

    try {
      await apiRequest(API.updateStatus, {
        method: "POST",
        body: JSON.stringify({ id, status })
      });

      const existing = messages.find(
        message => String(message.id) === String(id)
      );

      if (existing) {
        existing.status = status;
      }

      selectedMessage.status = status;

      updateStats();
      renderMessages();
      closeMessageModal();

      showToast("تم تحديث حالة الرسالة");

    } catch (error) {
      showToast(error.message);

    } finally {
      setLoading(
        saveStatusButton,
        false,
        "حفظ التغييرات"
      );
    }
  }

  // Logout
  async function logout() {
    if (logoutButton) {
      logoutButton.disabled = true;
    }

    try {
      await apiRequest(API.logout, {
        method: "POST",
        body: JSON.stringify({})
      });

      messages = [];
      selectedMessage = null;

      updateStats();
      showLogin();

      showToast("تم تسجيل الخروج");

    } catch (error) {
      showToast(error.message);

    } finally {
      if (logoutButton) {
        logoutButton.disabled = false;
      }
    }
  }

  // Mobile sidebar
  function closeSidebar() {
    sidebar?.classList.remove("open");
    mobileOverlay?.classList.remove("show");
  }

  function toggleSidebar() {
    sidebar?.classList.toggle("open");
    mobileOverlay?.classList.toggle("show");
  }

  // Navigation
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

  saveStatusButton?.addEventListener(
    "click",
    updateMessageStatus
  );

  menuButton?.addEventListener(
    "click",
    toggleSidebar
  );

  mobileOverlay?.addEventListener(
    "click",
    closeSidebar
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMessageModal();
      closeSidebar();
    }
  });

  // Start
  checkSession();

})();
