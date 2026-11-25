(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const loginForm = $("#loginForm");
  const adminPassword = $("#adminPassword");
  const totpCode = $("#totpCode");
  const loginButton = $("#loginButton");
  const loginError = $("#loginError");

  const API = Object.freeze({
    login: "/api/admin/login",
    session: "/api/admin/session"
  });

  let isSubmitting = false;

  const currentYear = $("#currentYear");

  if (currentYear) {
    currentYear.textContent = String(
      new Date().getFullYear()
    );
  }

  async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      mode: "same-origin",
      redirect: "error",
      headers
    });

    let data = {};

    try {
      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      }
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "حدث خطأ أثناء الاتصال بالسيرفر"
      );
    }

    return data;
  }

  function showError(message) {
    if (!loginError) return;

    loginError.textContent = String(
      message || "حدث خطأ غير متوقع."
    );

    loginError.classList.remove("hidden");
  }

  function hideError() {
    if (!loginError) return;

    loginError.textContent = "";
    loginError.classList.add("hidden");
  }

  function setLoading(loading) {
    if (!loginButton) return;

    loginButton.disabled = loading;

    if (loading) {
      if (!loginButton.dataset.originalText) {
        loginButton.dataset.originalText =
          loginButton.textContent;
      }

      loginButton.textContent = "جاري التحقق...";
    } else {
      loginButton.textContent =
        loginButton.dataset.originalText ||
        "تسجيل الدخول ←";

      delete loginButton.dataset.originalText;
    }
  }

  function redirectToDashboard() {
    window.location.replace("/dashboard.html");
  }

  async function checkSession() {
    try {
      const data = await apiRequest(API.session);

      if (data.authenticated === true) {
        redirectToDashboard();
      }
    } catch {
      // No valid session.
    }
  }

  async function login(password, code) {
    if (isSubmitting) return;

    isSubmitting = true;

    hideError();
    setLoading(true);

    try {
      await apiRequest(API.login, {
        method: "POST",
        body: JSON.stringify({
          password,
          totpCode: code
        })
      });

      if (adminPassword) adminPassword.value = "";
      if (totpCode) totpCode.value = "";

      redirectToDashboard();

    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "تعذر تسجيل الدخول. حاول مرة أخرى."
      );

      setLoading(false);
      isSubmitting = false;

      totpCode?.focus();
    }
  }

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const password = adminPassword?.value || "";
    const code = totpCode?.value || "";

    if (!password.trim()) {
      showError("من فضلك أدخل كلمة المرور.");
      adminPassword?.focus();
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      showError("أدخل رمز المصادقة المكوّن من 6 أرقام.");
      totpCode?.focus();
      return;
    }

    login(password, code);
  });

  adminPassword?.addEventListener("input", hideError);
  totpCode?.addEventListener("input", () => {
    totpCode.value = totpCode.value.replace(/\D/g, "").slice(0, 6);
    hideError();
  });

  checkSession();

})();
