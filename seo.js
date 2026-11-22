(() => {
  "use strict";

  const API = "/api/admin/content?resource=seo";
  const $ = (selector) => document.querySelector(selector);

  const form = $("#seoForm");
  const tableBody = $("#seoTableBody");
  const status = $("#seoFormStatus");
  const saveButton = $("#saveSeoButton");

  let records = [];
  let loading = false;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function toast(message, type = "success") {
    const element = $("#adminToast");
    if (!element) return;

    element.textContent = message;
    element.className = `admin-toast show ${type}`;
    element.hidden = false;

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove("show");
      element.hidden = true;
    }, 3500);
  }

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
      // Empty response.
    }

    if (response.status === 401) {
      window.location.replace("/admin.html");
      throw new Error("انتهت الجلسة.");
    }

    if (!response.ok) {
      throw new Error(data.error || "حدث خطأ أثناء تنفيذ الطلب.");
    }

    return data;
  }

  function setStatus(message, error = false) {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error-text", error);
  }

  function resetForm() {
    form?.reset();

    $("#seoRecordId").value = "";
    $("#seoPageSlug").disabled = false;
    $("#seoFormTitle").textContent = "إضافة إعدادات صفحة";
    $("#cancelSeoEdit").hidden = true;

    setStatus("");
  }

  function fillForm(item) {
    $("#seoRecordId").value = item.id;
    $("#seoPageSlug").value = item.page_slug || "";
    $("#seoPageSlug").disabled = true;

    $("#seoTitleAr").value = item.title_ar || "";
    $("#seoTitleEn").value = item.title_en || "";
    $("#seoDescriptionAr").value = item.description_ar || "";
    $("#seoDescriptionEn").value = item.description_en || "";
    $("#seoKeywordsAr").value = item.keywords_ar || "";
    $("#seoKeywordsEn").value = item.keywords_en || "";
    $("#seoOgImage").value = item.og_image || "";
    $("#seoCanonical").value = item.canonical_url || "";

    $("#seoFormTitle").textContent = `تعديل SEO: ${item.page_slug}`;
    $("#cancelSeoEdit").hidden = false;

    setStatus("");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderTable() {
    if (!tableBody) return;

    if (!records.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4">لا توجد إعدادات SEO محفوظة حتى الآن.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = records.map((item) => `
      <tr>
        <td>
          <strong>${escapeHTML(item.page_slug)}</strong>
        </td>
        <td>${escapeHTML(item.title_ar)}</td>
        <td>${escapeHTML(item.title_en)}</td>
        <td>
          <div class="table-actions">
            <button
              type="button"
              class="action-button"
              data-seo-edit="${escapeHTML(item.id)}"
            >تعديل</button>

            <button
              type="button"
              class="action-button danger-button"
              data-seo-delete="${escapeHTML(item.id)}"
            >حذف</button>
          </div>
        </td>
      </tr>
    `).join("");

    tableBody.querySelectorAll("[data-seo-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = records.find(
          (record) => String(record.id) === button.dataset.seoEdit
        );

        if (item) fillForm(item);
      });
    });

    tableBody.querySelectorAll("[data-seo-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        deleteRecord(button.dataset.seoDelete, button);
      });
    });
  }

  async function loadSeo() {
    if (loading) return;

    loading = true;

    const loadingElement = $("#seoLoading");
    const errorElement = $("#seoError");
    const tableElement = $("#seoTableContainer");

    if (loadingElement) loadingElement.hidden = false;
    if (errorElement) errorElement.hidden = true;
    if (tableElement) tableElement.hidden = true;

    try {
      const data = await request();

      if (!Array.isArray(data.seo)) {
        throw new Error("استجابة SEO من السيرفر غير صحيحة.");
      }

      records = data.seo;
      renderTable();

      if (tableElement) tableElement.hidden = false;

      const count = $("#seoRecordsCount");
      if (count) count.textContent = String(records.length);
    } catch (error) {
      if (errorElement) {
        errorElement.hidden = false;
        errorElement.textContent = error.message;
      }

      toast(error.message, "error");
    } finally {
      loading = false;
      if (loadingElement) loadingElement.hidden = true;
    }
  }

  async function saveSeo(event) {
    event.preventDefault();

    if (saveButton?.disabled) return;

    const payload = {
      page_slug: $("#seoPageSlug").value.trim(),
      title_ar: $("#seoTitleAr").value.trim(),
      title_en: $("#seoTitleEn").value.trim(),
      description_ar: $("#seoDescriptionAr").value.trim(),
      description_en: $("#seoDescriptionEn").value.trim(),
      keywords_ar: $("#seoKeywordsAr").value.trim(),
      keywords_en: $("#seoKeywordsEn").value.trim(),
      og_image: $("#seoOgImage").value.trim(),
      canonical_url: $("#seoCanonical").value.trim()
    };

    if (!/^[a-zA-Z0-9_-]+$/.test(payload.page_slug)) {
      setStatus("معرّف الصفحة يقبل الحروف الإنجليزية والأرقام والشرطة فقط.", true);
      return;
    }

    if (!payload.title_ar || !payload.title_en) {
      setStatus("عنوان الصفحة بالعربية والإنجليزية مطلوب.", true);
      return;
    }

    if (payload.canonical_url && !isHttpUrl(payload.canonical_url)) {
      setStatus("رابط Canonical غير صحيح.", true);
      return;
    }

    if (payload.og_image && !isHttpUrl(payload.og_image)) {
      setStatus("رابط صورة Open Graph غير صحيح.", true);
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "جاري الحفظ...";
    setStatus("جاري حفظ إعدادات SEO...");

    try {
      await request("POST", payload);

      resetForm();
      await loadSeo();

      toast("تم حفظ إعدادات SEO بنجاح.");
    } catch (error) {
      setStatus(error.message, true);
      toast(error.message, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "حفظ إعدادات SEO";
    }
  }

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  async function deleteRecord(id, button) {
    const item = records.find(
      (record) => String(record.id) === String(id)
    );

    if (!item || button.disabled) return;

    if (!confirm(`هل تريد حذف إعدادات SEO للصفحة "${item.page_slug}"؟`)) {
      return;
    }

    button.disabled = true;

    try {
      await request("DELETE", { id: item.id });

      if (String($("#seoRecordId").value) === String(item.id)) {
        resetForm();
      }

      await loadSeo();
      toast("تم حذف إعدادات SEO.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  $("#seoForm")?.addEventListener("submit", saveSeo);
  $("#cancelSeoEdit")?.addEventListener("click", resetForm);
  $("#refreshSeoButton")?.addEventListener("click", loadSeo);
  $("#retrySeoButton")?.addEventListener("click", loadSeo);

  loadSeo();
})();
