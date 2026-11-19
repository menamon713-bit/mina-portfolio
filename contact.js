"use strict";

(function () {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  const submitButton = document.getElementById("contactSubmit");

  if (!form || !status || !submitButton) return;

  // منع تسجيل الحدث أكثر من مرة
  if (form.dataset.contactInitialized === "true") return;
  form.dataset.contactInitialized = "true";

  function isArabic() {
    return (document.documentElement.lang || "ar")
      .toLowerCase()
      .startsWith("ar");
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.classList.remove("success", "error");
    status.classList.add(type);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitButton.disabled) return;

    const arabic = isArabic();

    const originalButtonText = submitButton.textContent;

    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = arabic
      ? "جارٍ الإرسال..."
      : "Sending...";

    status.textContent = "";
    status.classList.remove("success", "error");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let result;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || !result || result.success !== true) {
        if (response.status === 429) {
          throw new Error("RATE_LIMIT");
        }

        throw new Error("REQUEST_FAILED");
      }

      form.reset();

      showStatus(
        arabic
          ? "تم إرسال رسالتك بنجاح."
          : "Your message was sent successfully.",
        "success"
      );

    } catch (error) {
      let message;

      if (error.message === "RATE_LIMIT") {
        message = arabic
          ? "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا."
          : "Too many attempts. Please try again later.";
      } else {
        message = arabic
          ? "تعذر إرسال الرسالة. تحقق من اتصالك وحاول مرة أخرى."
          : "Message could not be sent. Check your connection and try again.";
      }

      showStatus(message, "error");

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
})();
