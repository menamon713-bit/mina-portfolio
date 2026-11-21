(() => {
  "use strict";

  const API = "/api/admin/projects";
  const section = document.querySelector("#section-projects");

  if (!section) return;

  const panel = section.querySelector(".panel-card");
  if (!panel) return;

  const state = {
    projects: [],
    editingId: null,
    loading: false
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const toast = (message, type = "success") => {
    const element = document.querySelector("#adminToast");
    if (!element) return;

    element.textContent = message;
    element.className = `admin-toast ${type} show`;

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove("show");
    }, 3500);
  };

  async function request(method = "GET", body = null) {
    const response = await fetch(API, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401 || response.status === 403) {
      window.location.replace("/admin.html");
      throw new Error("انتهت الجلسة.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || data.message || "حدث خطأ أثناء تنفيذ الطلب."
      );
    }

    return data;
  }

  function render() {
    const search = document.querySelector("#projectSearch")?.value
      .trim().toLowerCase() || "";

    const filter = document.querySelector("#projectVisibility")?.value || "all";

    const projects = state.projects.filter((project) => {
      const searchable = [
        project.title_ar,
        project.title_en,
        project.category_ar,
        project.category_en
      ].join(" ").toLowerCase();

      return searchable.includes(search) &&
        (filter === "all" ||
          (filter === "visible" && project.is_visible) ||
          (filter === "hidden" && !project.is_visible));
    });

    const tbody = document.querySelector("#projectsTableBody");
    if (!tbody) return;

    if (!projects.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">لا توجد مشاريع مطابقة.</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = projects.map((project) => `
        <tr>
          <td>
            <strong>${escapeHTML(project.title_ar)}</strong>
            <br>
            <small>${escapeHTML(project.title_en)}</small>
          </td>
          <td>${escapeHTML(project.category_ar || "—")}</td>
          <td>
            <span class="status-badge ${
              project.is_visible ? "status-visible" : "status-hidden"
            }">
              ${project.is_visible ? "ظاهر" : "مخفي"}
            </span>
          </td>
          <td>${escapeHTML(project.sort_order ?? 0)}</td>
          <td>${Array.isArray(project.tags) ? project.tags.length : 0}</td>
          <td>
            <button
              type="button"
              class="secondary-button"
              data-edit="${escapeHTML(project.id)}"
            >تعديل</button>

            <button
              type="button"
              class="danger-button"
              data-delete="${escapeHTML(project.id)}"
            >حذف</button>
          </td>
        </tr>
      `).join("");
    }

    const count = document.querySelector("#statProjects");
    if (count) count.textContent = String(state.projects.length);
  }

  function showForm(project = null) {
    state.editingId = project ? project.id : null;

    const formPanel = document.querySelector("#projectFormPanel");
    const form = document.querySelector("#projectForm");

    if (!formPanel || !form) return;

    form.reset();

    const set = (id, value) => {
      const element = document.querySelector(`#${id}`);
      if (element) element.value = value ?? "";
    };

    set("projectTitleAr", project?.title_ar);
    set("projectTitleEn", project?.title_en);
    set("projectDescriptionAr", project?.description_ar);
    set("projectDescriptionEn", project?.description_en);
    set("projectCategoryAr", project?.category_ar);
    set("projectCategoryEn", project?.category_en);
    set("projectImage", project?.image_url);
    set("projectVisualStyle", project?.visual_style);
    set("projectLiveUrl", project?.live_url);
    set("projectGithubUrl", project?.github_url);
    set("projectDetailsType", project?.details_type || "none");
    set("projectDetailsAr", JSON.stringify(project?.details_ar || {}, null, 2));
    set("projectDetailsEn", JSON.stringify(project?.details_en || {}, null, 2));
    set("projectSortOrder", project?.sort_order ?? 0);

    const visible = document.querySelector("#projectVisible");
    if (visible) visible.checked = project ? Boolean(project.is_visible) : true;

    document.querySelector("#projectFormTitle").textContent =
      project ? "تعديل المشروع" : "إضافة مشروع جديد";

    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideForm() {
    const formPanel = document.querySelector("#projectFormPanel");
    if (formPanel) formPanel.hidden = true;
    state.editingId = null;
  }

  function parseDetails(value, fieldName) {
    let result;

    try {
      result = JSON.parse(value || "{}");
    } catch {
      throw new Error(`صيغة ${fieldName} غير صحيحة. استخدم JSON صالحًا.`);
    }

    if (
      result === null ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      throw new Error(`${fieldName} يجب أن يكون كائن JSON.`);
    }

    return result;
  }

  async function saveProject(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.querySelector("#saveProject");

    const value = (id) =>
      document.querySelector(`#${id}`)?.value.trim() || "";

    const titleAr = value("projectTitleAr");
    const titleEn = value("projectTitleEn");

    if (!titleAr || !titleEn) {
      toast("اكتب اسم المشروع بالعربية والإنجليزية.", "error");
      return;
    }

    let detailsAr;
    let detailsEn;

    try {
      detailsAr = parseDetails(value("projectDetailsAr"), "التفاصيل العربية");
      detailsEn = parseDetails(value("projectDetailsEn"), "التفاصيل الإنجليزية");
    } catch (error) {
      toast(error.message, "error");
      return;
    }

    const sortOrder = Number(value("projectSortOrder"));

    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
      toast("قيمة الترتيب غير صحيحة.", "error");
      return;
    }

    const payload = {
      title_ar: titleAr,
      title_en: titleEn,
      description_ar: value("projectDescriptionAr"),
      description_en: value("projectDescriptionEn"),
      category_ar: value("projectCategoryAr"),
      category_en: value("projectCategoryEn"),
      image_url: value("projectImage"),
      visual_style: value("projectVisualStyle"),
      live_url: value("projectLiveUrl"),
      github_url: value("projectGithubUrl"),
      details_type: value("projectDetailsType"),
      details_ar: detailsAr,
      details_en: detailsEn,
      is_visible: document.querySelector("#projectVisible").checked,
      sort_order: sortOrder
    };

    if (state.editingId !== null) {
      payload.id = state.editingId;
    }

    button.disabled = true;
    button.textContent = "جاري الحفظ...";

    try {
      await request(
        state.editingId !== null ? "PATCH" : "POST",
        payload
      );

      hideForm();
      await loadProjects();

      toast("تم حفظ المشروع بنجاح.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "حفظ المشروع";
    }
  }

  async function deleteProject(id) {
    const project = state.projects.find(
      (item) => String(item.id) === String(id)
    );

    if (!project) return;

    if (!window.confirm(
      `هل تريد حذف المشروع "${project.title_ar}" نهائيًا؟`
    )) return;

    try {
      await request("DELETE", { id });
      await loadProjects();
      toast("تم حذف المشروع.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function loadProjects() {
    if (state.loading) return;

    state.loading = true;

    const tbody = document.querySelector("#projectsTableBody");
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="6">جاري تحميل المشاريع...</td></tr>
      `;
    }

    try {
      const data = await request("GET");
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      render();
    } catch (error) {
      if (tbody) {
        tbody.innerHTML = `
          <tr><td colspan="6">${escapeHTML(error.message)}</td></tr>
        `;
      }
      toast(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  function buildInterface() {
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>قائمة المشاريع</h2>
          <p>إضافة المشاريع وتعديلها والتحكم في ظهورها.</p>
        </div>

        <button type="button" class="primary-button" id="addProject">
          + إضافة مشروع
        </button>
      </div>

      <div class="skills-toolbar">
        <div class="form-field">
          <label for="projectSearch">البحث عن مشروع</label>
          <input type="search" id="projectSearch"
            placeholder="ابحث باسم المشروع أو التصنيف">
        </div>

        <div class="form-field">
          <label for="projectVisibility">حالة الظهور</label>
          <select id="projectVisibility">
            <option value="all">كل المشاريع</option>
            <option value="visible">ظاهرة</option>
            <option value="hidden">مخفية</option>
          </select>
        </div>
      </div>

      <div class="panel-card" id="projectFormPanel" hidden>
        <div class="panel-header">
          <h2 id="projectFormTitle">إضافة مشروع جديد</h2>
          <button type="button" class="secondary-button" id="cancelProject">
            إلغاء
          </button>
        </div>

        <form id="projectForm">
          <div class="profile-form-grid">

            <div class="form-field">
              <label for="projectTitleAr">اسم المشروع بالعربية *</label>
              <input id="projectTitleAr" maxlength="200" required>
            </div>

            <div class="form-field">
              <label for="projectTitleEn">اسم المشروع بالإنجليزية *</label>
              <input id="projectTitleEn" maxlength="200" required>
            </div>

            <div class="form-field">
              <label for="projectCategoryAr">التصنيف بالعربية</label>
              <input id="projectCategoryAr" maxlength="100">
            </div>

            <div class="form-field">
              <label for="projectCategoryEn">التصنيف بالإنجليزية</label>
              <input id="projectCategoryEn" maxlength="100">
            </div>

            <div class="form-field full-width">
              <label for="projectDescriptionAr">الوصف بالعربية</label>
              <textarea id="projectDescriptionAr" rows="3" maxlength="20000"></textarea>
            </div>

            <div class="form-field full-width">
              <label for="projectDescriptionEn">الوصف بالإنجليزية</label>
              <textarea id="projectDescriptionEn" rows="3" maxlength="20000"></textarea>
            </div>

            <div class="form-field full-width">
              <label for="projectImage">رابط الصورة</label>
              <input id="projectImage" type="text" maxlength="2000"
                placeholder="/assets/project.png أو https://...">
            </div>

            <div class="form-field">
              <label for="projectLiveUrl">رابط المشروع</label>
              <input id="projectLiveUrl" type="url" maxlength="2000">
            </div>

            <div class="form-field">
              <label for="projectGithubUrl">رابط GitHub</label>
              <input id="projectGithubUrl" type="url" maxlength="2000">
            </div>

            <div class="form-field">
              <label for="projectVisualStyle">النمط البصري</label>
              <input id="projectVisualStyle" maxlength="100">
            </div>

            <div class="form-field">
              <label for="projectDetailsType">طريقة عرض التفاصيل</label>
              <select id="projectDetailsType">
                <option value="none">بدون تفاصيل إضافية</option>
                <option value="modal">نافذة تفاصيل</option>
                <option value="external">رابط خارجي</option>
              </select>
            </div>

            <div class="form-field full-width">
              <label for="projectDetailsAr">تفاصيل المشروع بالعربية (JSON)</label>
              <textarea id="projectDetailsAr" rows="5">{}</textarea>
            </div>

            <div class="form-field full-width">
              <label for="projectDetailsEn">تفاصيل المشروع بالإنجليزية (JSON)</label>
              <textarea id="projectDetailsEn" rows="5">{}</textarea>
            </div>

            <div class="form-field">
              <label for="projectSortOrder">ترتيب المشروع</label>
              <input id="projectSortOrder" type="number" min="0" step="1" value="0">
            </div>

            <div class="form-field">
              <label>
                <input id="projectVisible" type="checkbox" checked>
                إظهار المشروع على الموقع
              </label>
            </div>

          </div>

          <div class="form-footer">
            <button type="submit" class="primary-button" id="saveProject">
              حفظ المشروع
            </button>
            <button type="button" class="secondary-button" id="cancelProjectForm">
              إلغاء
            </button>
          </div>
        </form>
      </div>

      <div class="table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>المشروع</th>
              <th>التصنيف</th>
              <th>الظهور</th>
              <th>الترتيب</th>
              <th>الوسوم</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody id="projectsTableBody">
            <tr><td colspan="6">جاري تحميل المشاريع...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    document.querySelector("#addProject")
      ?.addEventListener("click", () => showForm());

    document.querySelector("#cancelProject")
      ?.addEventListener("click", hideForm);

    document.querySelector("#cancelProjectForm")
      ?.addEventListener("click", hideForm);

    document.querySelector("#projectForm")
      ?.addEventListener("submit", saveProject);

    document.querySelector("#projectSearch")
      ?.addEventListener("input", render);

    document.querySelector("#projectVisibility")
      ?.addEventListener("change", render);

    document.querySelector("#projectsTableBody")
      ?.addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-edit]");
        const deleteButton = event.target.closest("[data-delete]");

        if (editButton) {
          const project = state.projects.find(
            (item) => String(item.id) === editButton.dataset.edit
          );
          if (project) showForm(project);
        }

        if (deleteButton) {
          deleteProject(deleteButton.dataset.delete);
        }
      });
  }

  buildInterface();
  loadProjects();
})();
