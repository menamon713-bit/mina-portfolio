(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  const submitButton = document.getElementById("contactSubmit");

  if (!form || !status || !submitButton) return;

  const MAX_LENGTHS = {
    name: 100,
    email: 254,
    subject: 200,
    message: 5000
  };

  let isSubmitting = false;

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `contact-status ${type}`;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  }

  function getField(name) {
    const field = form.elements.namedItem(name);
    return field && typeof field.value === "string"
      ? field.value.trim()
      : "";
  }

  function validateForm(data) {
    if (!data.name) return "اكتب اسمك.";
    if (data.name.length > MAX_LENGTHS.name) {
      return "الاسم طويل جدًا.";
    }

    if (!data.email) return "اكتب بريدك الإلكتروني.";
    if (
      data.email.length > MAX_LENGTHS.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      return "البريد الإلكتروني غير صحيح.";
    }

    if (data.subject.length > MAX_LENGTHS.subject) {
      return "عنوان الرسالة طويل جدًا.";
    }

    if (!data.message || data.message.length < 10) {
      return "الرسالة يجب ألا تقل عن 10 أحرف.";
    }

    if (data.message.length > MAX_LENGTHS.message) {
      return "الرسالة طويلة جدًا.";
    }

    return null;
  }

  function setSubmitting(value) {
    isSubmitting = value;
    submitButton.disabled = value;
    submitButton.setAttribute("aria-busy", String(value));

    if (value) {
      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent = "جارٍ الإرسال...";
    } else {
      submitButton.textContent =
        submitButton.dataset.originalText ||
        "إرسال الرسالة";

      delete submitButton.dataset.originalText;
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isSubmitting) return;

    const data = {
      name: getField("name"),
      email: getField("email"),
      subject: getField("subject"),
      message: getField("message"),
      website: getField("website")
    };

    const validationError = validateForm(data);

    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    setSubmitting(true);
    showStatus("جارٍ إرسال رسالتك...", "loading");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(data),
        credentials: "same-origin"
      });

      let result = {};

      try {
        result = await response.json();
      } catch (_) {
        result = {};
      }

      if (response.status === 429) {
        throw new Error(
          "تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى."
        );
      }

      if (response.status === 503) {
        throw new Error(
          "خدمة الإرسال غير متاحة مؤقتًا. حاول لاحقًا."
        );
      }

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "تعذر إرسال الرسالة. حاول مرة أخرى."
        );
      }

      showStatus(
        "تم إرسال رسالتك بنجاح.",
        "success"
      );

      form.reset();

    } catch (error) {
      showStatus(
        error instanceof TypeError
          ? "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى."
          : error.message || "حدث خطأ أثناء الإرسال.",
        "error"
      );

    } finally {
      setSubmitting(false);
    }
  });

})();
