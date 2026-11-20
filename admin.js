(() => {
"use strict";

const $ = (selector) => document.querySelector(selector);

const loginForm = $("#loginForm");
const adminPassword = $("#adminPassword");
const loginButton = $("#loginButton");
const loginError = $("#loginError");

const API = {
login: "/api/admin/login",
session: "/api/admin/session"
};

let isSubmitting = false;

async function apiRequest(url, options = {}) {
const response = await fetch(url, {
credentials: "same-origin",
cache: "no-store",
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
    "حدث خطأ أثناء الاتصال بالسيرفر"
  );
}

return data;

}

function showError(message) {
if (!loginError) return;

loginError.textContent = message;
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
  loginButton.dataset.originalText =
    loginButton.textContent;

  loginButton.textContent = "جاري تسجيل الدخول...";
} else {
  loginButton.textContent =
    loginButton.dataset.originalText ||
    "تسجيل الدخول ←";

  delete loginButton.dataset.originalText;
}

}

function redirectToDashboard() {
window.location.replace("dashboard.html");
}

async function checkSession() {
try {
const data = await apiRequest(API.session);

  if (data.authenticated === true) {
    redirectToDashboard();
  }
} catch {
  // لا توجد جلسة صالحة، نظل في صفحة تسجيل الدخول.
}

}

async function login(password) {
if (isSubmitting) return;

isSubmitting = true;
hideError();
setLoading(true);

try {
  await apiRequest(API.login, {
    method: "POST",
    body: JSON.stringify({ password })
  });

  if (adminPassword) {
    adminPassword.value = "";
  }

  redirectToDashboard();

} catch (error) {
  showError(error.message);
  setLoading(false);
  isSubmitting = false;
}

}

loginForm?.addEventListener("submit", (event) => {
event.preventDefault();

const password = adminPassword?.value || "";

if (!password.trim()) {
  showError("من فضلك أدخل كلمة المرور");
  adminPassword?.focus();
  return;
}

login(password);

});

adminPassword?.addEventListener("input", hideError);

checkSession();

})();
