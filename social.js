(() => {
  "use strict";

  const API = "/api/admin/social";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const state = {
    links: [],
    editingId: null,
    loading: false,
    saving: false,
    initialized: false
  };

  // ==============================
  // HELPERS
  // ==============================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value));

      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        url.username ||
        url.password
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function toast(message, type = "success") {
    const element = $("#adminToast");

    if (!element) return;

    element.textContent = message;
    element.className =
      `admin-toast show ${type === "error" ? "error" : "success"}`;

    element.hidden = false;

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      element.classList.remove("show");
      element.hidden = true;
    }, 3500);
  }

  function setStatus(message, isError = false) {
    const element = $("#socialFormStatus");

    if (!element) return;

    element.textContent = message;
    element.style.color = isError
      ? "var(--danger)"
      : "var(--success)";
  }

  // ==============================
  // API REQUEST
  // ==============================

  async function request(method = "GET", body) {
    let response;

    try {
      response = await fetch(API, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {})
        },
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {})
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
      throw new Error("انتهت جلسة الإدارة.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || "حدث خطأ أثناء تنفيذ الطلب."
      );
    }

    return data;
  }

  // ==============================
  // INTERFACE
  // ==============================

  function buildInterface() {
    const panel = $("#section-social .panel-card");

    if (!panel) return false;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>إدارة روابط التواصل</h2>
          <p>إضافة وتعديل وإخفاء روابط حساباتك.</p>
        </div>

        <button
          type="button"
          class="secondary-button"
          id="refreshSocialButton"
        >
          ↻ تحديث
        </button>
      </div>

      <form id="socialForm" novalidate>

        <div class="profile-form-grid">

          <div class="form-field">
            <label for="socialPlatform">اسم المنصة *</label>
            <input
              id="socialPlatform"
              type="text"
              maxlength="50"
              placeholder="github"
              required
            >
          </div>

          <div class="form-field">
            <label for="socialIcon">الأيقونة</label>
            <input
              id="socialIcon"
              type="text"
              maxlength="100"
              placeholder="github"
            >
          </div>

          <div class="form-field">
            <label for="socialLabelAr">الاسم بالعربية *</label>
            <input
              id="socialLabelAr"
              type="text"
              maxlength="120"
              placeholder="جيت هاب"
              required
            >
          </div>

          <div class="form-field">
            <label for="socialLabelEn">الاسم بالإنجليزية *</label>
            <input
              id="socialLabelEn"
              type="text"
              maxlength="120"
              placeholder="GitHub"
              required
            >
          </div>

          <div class="form-field">
            <label for="socialValue">اسم المستخدم أو القيمة</label>
            <input
              id="socialValue"
              type="text"
              maxlength="500"
              placeholder="@username"
            >
          </div>

          <div class="form-field">
            <label for="socialUrl">رابط الحساب *</label>
            <input
              id="socialUrl"
              type="url"
              maxlength="2048"
              placeholder="https://example.com/username"
              required
            >
          </div>

          <div class="form-field">
            <label for="socialSortOrder">ترتيب الظهور</label>
            <input
              id="socialSortOrder"
              type="number"
              min="0"
              step="1"
              value="0"
            >
          </div>

          <div class="form-field">
            <label class="checkbox-field" for="socialVisible">
              <input
                id="socialVisible"
                type="checkbox"
                checked
              >
              <span>إظهار الرابط</span>
            </label>
          </div>

        </div>

        <div class="form-footer">

          <p
            id="socialFormStatus"
            class="form-status"
            aria-live="polite"
          ></p>

          <div class="modal-actions">

            <button
              type="button"
              class="secondary-button"
              id="cancelSocialEdit"
              hidden
            >
              إلغاء التعديل
            </button>

            <button
              type="submit"
              class="primary-button"
              id="saveSocialButton"
            >
              إضافة الرابط
            </button>

          </div>

        </div>

      </form>

      <div class="divider"></div>

      <div class="panel-header">
        <div>
          <h2>الروابط الحالية</h2>
          <p id="socialCount">جاري التحميل...</p>
        </div>
      </div>

      <div
        id="socialLoading"
        class="section-placeholder"
      >
        <h2>جاري تحميل الروابط...</h2>
      </div>

      <div
        id="socialError"
        class="section-placeholder"
        hidden
      >
        <h2>تعذر تحميل الروابط</h2>
        <p id="socialErrorMessage"></p>

        <button
          type="button"
          class="secondary-button"
          id="retrySocialButton"
        >
          إعادة المحاولة
        </button>
      </div>

      <div
        id="socialEmpty"
        class="section-placeholder"
        hidden
      >
        <h2>لا توجد روابط تواصل</h2>
        <p>يمكنك إضافة أول رابط من النموذج أعلاه.</p>
      </div>

      <div
        class="table-container"
        id="socialTableContainer"
        hidden
      >
        <table class="admin-table">

          <thead>
            <tr>
              <th>المنصة</th>
              <th>القيمة</th>
              <th>الرابط</th>
              <th>الترتيب</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>

          <tbody id="socialTableBody"></tbody>

        </table>
      </div>
    `;

    return true;
  }

  // ==============================
  // FORM
  // ==============================

  function resetForm() {
    const form = $("#socialForm");

    if (!form) return;

    form.reset();

    state.editingId = null;

    $("#socialSortOrder").value = "0";
    $("#socialVisible").checked = true;

    $("#saveSocialButton").textContent = "إضافة الرابط";
    $("#cancelSocialEdit").hidden = true;

    setStatus("");
  }

  function getPayload() {
    return {
      platform: $("#socialPlatform").value.trim(),
      icon: $("#socialIcon").value.trim(),
      label_ar: $("#socialLabelAr").value.trim(),
      label_en: $("#socialLabelEn").value.trim(),
      value: $("#socialValue").value.trim(),
      url: $("#socialUrl").value.trim(),
      sort_order: Number($("#socialSortOrder").value),
      is_visible: $("#socialVisible").checked
    };
  }

  function validatePayload(payload) {
    if (
      !payload.platform ||
      !payload.label_ar ||
      !payload.label_en ||
      !payload.url
    ) {
      return "أكمل الحقول المطلوبة.";
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(payload.platform)) {
      return "اسم المنصة غير صحيح.";
    }

    if (
      !Number.isSafeInteger(payload.sort_order) ||
      payload.sort_order < 0
    ) {
      return "قيمة ترتيب الظهور غير صحيحة.";
    }

    if (!safeExternalUrl(payload.url)) {
      return "أدخل رابط HTTPS صحيحًا.";
    }

    return null;
  }

  // ==============================
  // RENDER
  // ==============================

  function renderLinks() {
    const tbody = $("#socialTableBody");

    if (!tbody) return;

    const links = [...state.links].sort((a, b) =>
      Number(a.sort_order || 0) -
      Number(b.sort_order || 0) ||
      Number(a.id || 0) -
      Number(b.id || 0)
    );

    $("#socialCount").textContent =
      `إجمالي الروابط: ${links.length}`;

    $("#socialLoading").hidden = true;
    $("#socialError").hidden = true;
    $("#socialEmpty").hidden = links.length !== 0;
    $("#socialTableContainer").hidden = links.length === 0;

    if (links.length === 0) {
      tbody.replaceChildren();
      return;
    }

    tbody.innerHTML = links.map(link => {
      const visible = link.is_visible === true;
      const safeUrl = safeExternalUrl(link.url);

      return `
        <tr>

          <td>
            <strong>${escapeHTML(link.label_ar)}</strong>
            <small>${escapeHTML(link.label_en)}</small>
            <small>${escapeHTML(link.platform)}</small>
          </td>

          <td>${escapeHTML(link.value || "—")}</td>

          <td>
            ${
              safeUrl
                ? `<a
                    href="${escapeHTML(safeUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >فتح الرابط</a>`
                : "رابط غير صالح"
            }
          </td>

          <td>${escapeHTML(link.sort_order ?? 0)}</td>

          <td>
            <span class="status-badge ${
              visible ? "status-visible" : "status-hidden"
            }">
              ${visible ? "ظاهر" : "مخفي"}
            </span>
          </td>

          <td>
            <div class="table-actions">

              <button
                type="button"
                class="secondary-button"
                data-social-edit="${escapeHTML(link.id)}"
              >
                تعديل
              </button>

              <button
                type="button"
                class="secondary-button"
                data-social-toggle="${escapeHTML(link.id)}"
              >
                ${visible ? "إخفاء" : "إظهار"}
              </button>

              <button
                type="button"
                class="danger-button"
                data-social-delete="${escapeHTML(link.id)}"
              >
                حذف
              </button>

            </div>
          </td>

        </tr>
      `;
    }).join("");

    $$("[data-social-edit]", tbody).forEach(button => {
      button.addEventListener("click", () => {
        editLink(button.dataset.socialEdit);
      });
    });

    $$("[data-social-toggle]", tbody).forEach(button => {
      button.addEventListener("click", () => {
        toggleVisibility(button.dataset.socialToggle, button);
      });
    });

    $$("[data-social-delete]", tbody).forEach(button => {
      button.addEventListener("click", () => {
        deleteLink(button.dataset.socialDelete, button);
      });
    });
  }

  // ==============================
  // LOAD
  // ==============================

  async function loadLinks() {
    if (state.loading) return;

    state.loading = true;

    $("#socialLoading").hidden = false;
    $("#socialError").hidden = true;
    $("#socialTableContainer").hidden = true;
    $("#socialEmpty").hidden = true;

    try {
      const data = await request("GET");

      if (!Array.isArray(data.socialLinks)) {
        throw new Error("استجابة السيرفر غير صحيحة.");
      }

      state.links = data.socialLinks;

      renderLinks();

    } catch (error) {
      $("#socialLoading").hidden = true;
      $("#socialError").hidden = false;
      $("#socialErrorMessage").textContent = error.message;

      toast(error.message, "error");

    } finally {
      state.loading = false;
      $("#socialLoading").hidden = true;
    }
  }

  // ==============================
  // EDIT
  // ==============================

  function editLink(id) {
    const link = state.links.find(
      item => String(item.id) === String(id)
    );

    if (!link) {
      toast("الرابط غير موجود.", "error");
      return;
    }

    state.editingId = link.id;

    $("#socialPlatform").value = link.platform || "";
    $("#socialIcon").value = link.icon || "";
    $("#socialLabelAr").value = link.label_ar || "";
    $("#socialLabelEn").value = link.label_en || "";
    $("#socialValue").value = link.value || "";
    $("#socialUrl").value = link.url || "";
    $("#socialSortOrder").value = link.sort_order ?? 0;
    $("#socialVisible").checked = link.is_visible === true;

    $("#saveSocialButton").textContent = "حفظ التعديلات";
    $("#cancelSocialEdit").hidden = false;

    setStatus("");

    $("#socialPlatform").focus();

    window.scrollTo({
      top:
        $("#socialForm").getBoundingClientRect().top +
        window.scrollY - 100,
      behavior: "smooth"
    });
  }

  // ==============================
  // SAVE
  // ==============================

  async function saveLink(event) {
    event.preventDefault();

    if (state.saving) return;

    const payload = getPayload();
    const validationError = validatePayload(payload);

    if (validationError) {
      setStatus(validationError, true);
      return;
    }

    const editing = state.editingId !== null;
    const button = $("#saveSocialButton");

    state.saving = true;

    button.disabled = true;
    button.textContent = "جاري الحفظ...";

    setStatus("جاري حفظ الرابط...");

    try {
      await request(
        editing ? "PATCH" : "POST",
        editing
          ? { ...payload, id: state.editingId }
          : payload
      );

      resetForm();

      await loadLinks();

      toast(
        editing
          ? "تم تحديث الرابط بنجاح."
          : "تمت إضافة الرابط بنجاح."
      );

    } catch (error) {
      setStatus(error.message, true);
      toast(error.message, "error");

    } finally {
      state.saving = false;

      button.disabled = false;

      button.textContent = state.editingId !== null
        ? "حفظ التعديلات"
        : "إضافة الرابط";
    }
  }

  // ==============================
  // VISIBILITY
  // ==============================

  async function toggleVisibility(id, button) {
    const link = state.links.find(
      item => String(item.id) === String(id)
    );

    if (!link || button.disabled) return;

    button.disabled = true;

    try {
      await request("PATCH", {
        id: link.id,
        is_visible: !link.is_visible
      });

      await loadLinks();

      toast("تم تحديث حالة ظهور الرابط.");

    } catch (error) {
      toast(error.message, "error");

    } finally {
      button.disabled = false;
    }
  }

  // ==============================
  // DELETE
  // ==============================

  async function deleteLink(id, button) {
    const link = state.links.find(
      item => String(item.id) === String(id)
    );

    if (!link || button.disabled) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف رابط ${link.label_ar}؟ لا يمكن التراجع عن هذا الإجراء.`
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
      await request("DELETE", {
        id: link.id
      });

      if (
        state.editingId !== null &&
        String(state.editingId) === String(link.id)
      ) {
        resetForm();
      }

      await loadLinks();

      toast("تم حذف الرابط.");

    } catch (error) {
      toast(error.message, "error");

    } finally {
      button.disabled = false;
    }
  }

  // ==============================
  // INITIALIZATION
  // ==============================

  function initialize() {
    if (state.initialized) return;

    if (!buildInterface()) return;

    state.initialized = true;

    $("#socialForm").addEventListener(
      "submit",
      saveLink
    );

    $("#cancelSocialEdit").addEventListener(
      "click",
      resetForm
    );

    $("#refreshSocialButton").addEventListener(
      "click",
      loadLinks
    );

    $("#retrySocialButton").addEventListener(
      "click",
      loadLinks
    );

    loadLinks();
  }

  // Start when the social section is opened.
  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const navigationButton = target.closest(
      '.nav-item[data-section="social"]'
    );

    const shortcutButton = target.closest(
      '[data-go-section="social"]'
    );

    if (navigationButton || shortcutButton) {
      initialize();
    }
  });

})();
