(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  const submitButton = document.getElementById("contactSubmit");
  const html = document.documentElement;

  if (!form || !status || !submitButton) return;

  const MAX_LENGTHS = {
    name: 100,
    email: 254,
    subject: 200,
    message: 5000
  };

  const messages = {
    ar: {
      nameRequired: "اكتب اسمك.",
      nameLong: "الاسم طويل جدًا.",
      emailRequired: "اكتب بريدك الإلكتروني.",
      emailInvalid: "البريد الإلكتروني غير صحيح.",
      subjectLong: "عنوان الرسالة طويل جدًا.",
      messageShort: "الرسالة يجب ألا تقل عن 10 أحرف.",
      messageLong: "الرسالة طويلة جدًا.",
      loading: "جارٍ إرسال رسالتك...",
      sending: "جارٍ الإرسال...",
      success: "تم إرسال رسالتك بنجاح.",
      tooMany: "تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
      unavailable: "خدمة الإرسال غير متاحة مؤقتًا. حاول لاحقًا.",
      connection: "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.",
      failed: "تعذر إرسال الرسالة. حاول مرة أخرى.",
      submit: "إرسال الرسالة"
    },

    en: {
      nameRequired: "Please enter your name.",
      nameLong: "Your name is too long.",
      emailRequired: "Please enter your email address.",
      emailInvalid: "Please enter a valid email address.",
      subjectLong: "The subject is too long.",
      messageShort: "Your message must contain at least 10 characters.",
      messageLong: "Your message is too long.",
      loading: "Sending your message...",
      sending: "Sending...",
      success: "Your message was sent successfully.",
      tooMany: "Too many requests. Please wait and try again.",
      unavailable: "The sending service is temporarily unavailable. Try again later.",
      connection: "Could not connect to the server. Check your internet connection.",
      failed: "Could not send your message. Please try again.",
      submit: "Send Message"
    }
  };

  let isSubmitting = false;

  function getLanguage() {
    return html.lang === "en" ? "en" : "ar";
  }

  function t(key) {
    return messages[getLanguage()][key];
  }

  function showStatus(message, type) {
    status.textContent = message;

    status.classList.remove(
      "error",
      "loading",
      "success"
    );

    status.classList.add(type);

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
    if (!data.name) return t("nameRequired");

    if (data.name.length > MAX_LENGTHS.name) {
      return t("nameLong");
    }

    if (!data.email) return t("emailRequired");

    if (
      data.email.length > MAX_LENGTHS.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      return t("emailInvalid");
    }

    if (data.subject.length > MAX_LENGTHS.subject) {
      return t("subjectLong");
    }

    if (!data.message || data.message.length < 10) {
      return t("messageShort");
    }

    if (data.message.length > MAX_LENGTHS.message) {
      return t("messageLong");
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

      submitButton.textContent = t("sending");
    } else {
      submitButton.textContent = t("submit");

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
    showStatus(t("loading"), "loading");

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
        throw new Error(t("tooMany"));
      }

      if (response.status === 503) {
        throw new Error(t("unavailable"));
      }

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : t("failed")
        );
      }

      showStatus(t("success"), "success");
      form.reset();

    } catch (error) {
      showStatus(
        error instanceof TypeError
          ? t("connection")
          : error.message || t("failed"),
        "error"
      );

    } finally {
      setSubmitting(false);
    }
  });

  // Update the submit button when the site language changes.
  const observer = new MutationObserver(function () {
    if (!isSubmitting) {
      submitButton.textContent = t("submit");
    }
  });

  observer.observe(html, {
    attributes: true,
    attributeFilter: ["lang"]
  });

})();
