(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const state = {
    auditOffset: 0,
    auditLimit: 25,
    auditTotal: 0,
    auditLogs: [],
    auditLoading: false
  };

  const CONTENT_API = "/api/admin/content";

  async function request(url, options = {}) {
    let response;

    try {
      response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error("تعذر الاتصال بالسيرفر.");
    }

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      window.location.replace("/admin.html");
      throw new Error("انتهت جلسة المدير.");
    }

    if (!response.ok) {
      throw new Error(data.error || "حدث خطأ أثناء تنفيذ الطلب.");
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

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function setStatus(id, message, isError = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  function showToast(message, isError = false) {
    const toast = $("#adminToast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = `admin-toast show ${isError ? "error" : "success"}`;
    toast.hidden = false;

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
      toast.hidden = true;
    }, 3500);
  }

  function renderAuditLogs() {
    const body = $("#auditLogsBody");
    const search = ($("#auditSearch")?.value || "").trim().toLowerCase();

    if (!body) return;

    const filtered = state.auditLogs.filter((log) => {
      const content = [
        log.action,
        log.entity_type,
        log.description
      ].join(" ").toLowerCase();

      return content.includes(search);
    });

    $("#auditVisible").textContent = String(filtered.length);
    $("#auditTotal").textContent = String(state.auditTotal);

    if (!filtered.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4">لا توجد عمليات مطابقة في هذه الصفحة.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = filtered.map((log) => `
      <tr>
        <td>${escapeHTML(log.action)}</td>
        <td>${escapeHTML(log.entity_type)}</td>
        <td>${escapeHTML(log.description)}</td>
        <td>${escapeHTML(formatDate(log.created_at))}</td>
      </tr>
    `).join("");
  }

  async function loadAuditLogs() {
    if (state.auditLoading) return;

    state.auditLoading = true;
    setStatus("#auditStatus", "جاري تحميل السجل...");

    try {
      const params = new URLSearchParams({
        resource: "audit-logs",
        limit: String(state.auditLimit),
        offset: String(state.auditOffset)
      });

      const data = await request(
        `${CONTENT_API}?${params.toString()}`
      );

      state.auditLogs = Array.isArray(data.logs) ? data.logs : [];
      state.auditTotal = Number(data.total) || 0;

      renderAuditLogs();

      const page = Math.floor(state.auditOffset / state.auditLimit) + 1;
      const pages = Math.max(1, Math.ceil(state.auditTotal / state.auditLimit));

      $("#auditPageLabel").textContent = `صفحة ${page} من ${pages}`;

      $("#auditPrevious").disabled = state.auditOffset <= 0;
      $("#auditNext").disabled =
        state.auditOffset + state.auditLimit >= state.auditTotal;

      setStatus(
        "#auditStatus",
        state.auditTotal
          ? `تم تحميل ${state.auditLogs.length} عملية من أصل ${state.auditTotal}.`
          : "لا توجد عمليات مسجلة حتى الآن."
      );
    } catch (error) {
      setStatus("#auditStatus", error.message, true);

      $("#auditLogsBody").innerHTML = `
        <tr>
          <td colspan="4">${escapeHTML(error.message)}</td>
        </tr>
      `;
    } finally {
      state.auditLoading = false;
    }
  }

  async function loadSettings() {
    setStatus("#settingsStatus", "جاري تحميل الإعدادات...");

    try {
      const data = await request(
        `${CONTENT_API}?resource=settings`
      );

      const settings = data.settings || {};

      $("#settingSiteName").value = settings.site_name || "";
      $("#settingContactEmail").value = settings.contact_email || "";
      $("#settingMaintenance").checked =
        settings.maintenance_mode === true;

      setStatus("#settingsStatus", "تم تحميل الإعدادات.");
    } catch (error) {
      setStatus("#settingsStatus", error.message, true);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    const button = $("#saveSettingsButton");

    if (button.disabled) return;

    const payload = {
      site_name: $("#settingSiteName").value.trim(),
      contact_email: $("#settingContactEmail").value.trim(),
      maintenance_mode: $("#settingMaintenance").checked
    };

    button.disabled = true;
    button.textContent = "جاري الحفظ...";

    setStatus("#settingsStatus", "جاري حفظ الإعدادات...");

    try {
      const data = await request(
        `${CONTENT_API}?resource=settings`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

      setStatus("#settingsStatus", data.message || "تم الحفظ.");
      showToast("تم حفظ الإعدادات وتسجيل العملية.");
      await loadAuditLogs();
    } catch (error) {
      setStatus("#settingsStatus", error.message, true);
      showToast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "حفظ الإعدادات";
    }
  }

  function initialize() {
    $("#refreshAuditLogs")?.addEventListener("click", () => {
      loadAuditLogs();
    });

    $("#auditSearch")?.addEventListener("input", renderAuditLogs);

    $("#auditPrevious")?.addEventListener("click", () => {
      state.auditOffset = Math.max(
        0,
        state.auditOffset - state.auditLimit
      );

      loadAuditLogs();
    });

    $("#auditNext")?.addEventListener("click", () => {
      if (
        state.auditOffset + state.auditLimit >= state.auditTotal
      ) {
        return;
      }

      state.auditOffset += state.auditLimit;
      loadAuditLogs();
    });

    $("#reloadSettings")?.addEventListener("click", loadSettings);

    $("#siteSettingsForm")?.addEventListener(
      "submit",
      saveSettings
    );

    document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.section === "security") {
          loadAuditLogs();
        }

        if (button.dataset.section === "settings") {
          loadSettings();
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
