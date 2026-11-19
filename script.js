// ================================================
// M.A.S.H CYVEX — Main JavaScript
// Navigation / Theme / Language / Modals / Contact
// ================================================

(function () {
  "use strict";

  const html = document.documentElement;
  const body = document.body;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const themeToggle = $("#themeToggle");
  const languageToggle = $("#languageToggle");
  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

  const translations = {
    ar: {
      "nav.home": "الرئيسية",
      "nav.about": "من أنا",
      "nav.skills": "المهارات",
      "nav.projects": "المشاريع",
      "nav.contact": "تواصل معي",
      "hero.greeting": "مرحباً، أنا",
      "hero.role": "مطور ويب ومهتم بالأمن السيبراني",
      "hero.description": "أبني تجارب رقمية حديثة وأهتم بتطوير الويب وأمن التطبيقات والشبكات.",
      "hero.projects": "استكشف أعمالي",
      "hero.contact": "تواصل معي",
      "about.title": "من أنا",
      "about.description": "مطور ويب ومهتم بالأمن السيبراني، أعمل على بناء واجهات وتجارب رقمية عملية مع الاهتمام بالأداء والأمان.",
      "skills.title": "المهارات",
      "projects.title": "المشاريع",
      "contact.title": "تواصل معي",
      "contact.name": "الاسم",
      "contact.email": "البريد الإلكتروني",
      "contact.subject": "الموضوع",
      "contact.message": "اكتب رسالتك",
      "contact.send": "إرسال الرسالة",
      "contact.sending": "جارٍ الإرسال...",
      "contact.success": "تم إرسال رسالتك بنجاح.",
      "contact.error": "تعذر إرسال الرسالة. حاول مرة أخرى.",
      "footer.rights": "جميع الحقوق محفوظة."
    },
    en: {
      "nav.home": "Home",
      "nav.about": "About",
      "nav.skills": "Skills",
      "nav.projects": "Projects",
      "nav.contact": "Contact",
      "hero.greeting": "Hello, I'm",
      "hero.role": "Web Developer & Cybersecurity Enthusiast",
      "hero.description": "I build modern digital experiences and focus on web development, application security, and networks.",
      "hero.projects": "Explore My Work",
      "hero.contact": "Contact Me",
      "about.title": "About Me",
      "about.description": "A web developer and cybersecurity enthusiast focused on practical digital experiences, performance, and security.",
      "skills.title": "Skills",
      "projects.title": "Projects",
      "contact.title": "Contact Me",
      "contact.name": "Name",
      "contact.email": "Email",
      "contact.subject": "Subject",
      "contact.message": "Write your message",
      "contact.send": "Send Message",
      "contact.sending": "Sending...",
      "contact.success": "Your message was sent successfully.",
      "contact.error": "Could not send your message. Please try again.",
      "footer.rights": "All rights reserved."
    }
  };

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";

    html.dataset.theme = nextTheme;

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        nextTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      );

      themeToggle.setAttribute(
        "aria-pressed",
        String(nextTheme === "dark")
      );
    }

    safeStorageSet("mash-theme", nextTheme);
  }

  function setLanguage(language) {
    const nextLanguage = language === "en" ? "en" : "ar";

    html.lang = nextLanguage;
    html.dir = nextLanguage === "ar" ? "rtl" : "ltr";

    $$("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      const value = translations[nextLanguage][key];

      if (typeof value === "string") {
        element.textContent = value;
      }
    });

    $$("[data-i18n-placeholder]").forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      const value = translations[nextLanguage][key];

      if (typeof value === "string") {
        element.setAttribute("placeholder", value);
      }
    });

    if (languageToggle) {
      languageToggle.textContent =
        nextLanguage === "ar" ? "EN" : "عربي";

      languageToggle.setAttribute(
        "aria-label",
        nextLanguage === "ar"
          ? "Switch language to English"
          : "تغيير اللغة إلى العربية"
      );
    }

    safeStorageSet("mash-language", nextLanguage);
  }

  setTheme(
    safeStorageGet("mash-theme") ||
    html.dataset.theme ||
    "dark"
  );

  setLanguage(
    safeStorageGet("mash-language") ||
    html.lang ||
    "ar"
  );

  themeToggle?.addEventListener("click", () => {
    setTheme(
      html.dataset.theme === "dark" ? "light" : "dark"
    );
  });

  languageToggle?.addEventListener("click", () => {
    setLanguage(html.lang === "ar" ? "en" : "ar");
  });

  // ---------------- Navigation ----------------

  const pageLinks = $$("[data-page]");
  const pages = $$(".page");

  function showPage(pageId, updateHistory = true) {
    const target = document.getElementById(pageId);

    if (!target || !target.classList.contains("page")) {
      return;
    }

    pages.forEach((page) => {
      const active = page.id === pageId;

      page.classList.toggle("active", active);
      page.setAttribute("aria-hidden", String(!active));
    });

    pageLinks.forEach((link) => {
      const active = link.dataset.page === pageId;

      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    closeSidebar();

    if (updateHistory) {
      try {
        history.pushState(
          { page: pageId },
          "",
          `#${pageId}`
        );
      } catch (_) {}
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  pageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const pageId = link.dataset.page;

      if (!pageId) return;

      event.preventDefault();
      showPage(pageId);
    });
  });

  window.addEventListener("popstate", () => {
    const pageId = location.hash.replace("#", "");

    if (pageId) {
      showPage(pageId, false);
    }
  });

  const initialPage = location.hash.replace("#", "");

  if (
    initialPage &&
    document.getElementById(initialPage)?.classList.contains("page")
  ) {
    showPage(initialPage, false);
  } else {
    const activePage = $(".page.active") || $("#home");

    if (activePage) {
      showPage(activePage.id, false);
    }
  }

  // ---------------- Mobile sidebar ----------------

  function openSidebar() {
    sidebar?.classList.add("open", "active");
    overlay?.classList.add("active", "show");

    menuBtn?.setAttribute("aria-expanded", "true");

    body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open", "active");
    overlay?.classList.remove("active", "show");

    menuBtn?.setAttribute("aria-expanded", "false");

    body.classList.remove("sidebar-open");
  }

  menuBtn?.addEventListener("click", () => {
    const isOpen =
      sidebar?.classList.contains("open") ||
      sidebar?.classList.contains("active");

    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay?.addEventListener("click", closeSidebar);

  // ---------------- Modals ----------------

  const modals = $$(".modal");

  function openModal(modal) {
    if (!modal) return;

    modal.classList.add("active", "show");
    modal.setAttribute("aria-hidden", "false");

    body.classList.add("modal-open");

    const closeButton = $(
      "[data-action='close-modal']",
      modal
    );

    closeButton?.focus();
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active", "show");
    modal.setAttribute("aria-hidden", "true");

    const anotherModalOpen = modals.some((item) =>
      item.classList.contains("active") ||
      item.classList.contains("show")
    );

    if (!anotherModalOpen) {
      body.classList.remove("modal-open");
    }
  }

  $$("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const action = element.dataset.action;

      if (action === "open-report") {
        event.preventDefault();
        openModal($("#reportModal"));

      } else if (action === "open-recon") {
        event.preventDefault();
        openModal($("#reconModal"));

      } else if (action === "close-modal") {
        event.preventDefault();

        closeModal(
          element.closest(".modal") ||
          element.closest("[role='dialog']")
        );

      } else if (action === "whatsapp") {
        const number = (
          element.dataset.phone || ""
        ).replace(/[^\d]/g, "");

        if (number) {
          window.open(
            `https://wa.me/${number}`,
            "_blank",
            "noopener,noreferrer"
          );
        }

      } else if (action === "phone") {
        const phone =
          element.dataset.phone ||
          element.getAttribute("href")?.replace(/^tel:/, "");

        if (phone) {
          location.href = `tel:${phone}`;
        }

      } else if (action === "email") {
        const email =
          element.dataset.email ||
          element.getAttribute("href")?.replace(/^mailto:/, "");

        if (email) {
          location.href = `mailto:${email}`;
        }
      }
    });
  });

  modals.forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
      modals.forEach(closeModal);
    }
  });

  // ---------------- Skill progress ----------------

  $$("[data-progress]").forEach((bar) => {
    const rawValue = Number(bar.dataset.progress);

    const value = Number.isFinite(rawValue)
      ? Math.min(100, Math.max(0, rawValue))
      : 0;

    bar.style.setProperty("--progress", `${value}%`);

    if (
      bar.classList.contains("skill-progress") ||
      bar.classList.contains("progress-fill")
    ) {
      bar.style.width = `${value}%`;
    }

    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(value));
  });

  // ---------------- Scroll reveal ----------------

  const revealItems = $$(".reveal, [data-reveal]");

  if (
    "IntersectionObserver" in window &&
    revealItems.length
  ) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(
              "visible",
              "revealed"
            );

            currentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item) => {
      observer.observe(item);
    });

  } else {
    revealItems.forEach((item) => {
      item.classList.add("visible", "revealed");
    });
  }

  // ---------------- Image fallback state ----------------

  $$("img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        img.classList.add("image-load-failed");

        const wrapper = img.closest(
          ".profile-image, .image-wrapper, .avatar"
        );

        wrapper?.classList.add("profile-image-failed");
      },
      { once: true }
    );
  });

  // ---------------- Contact shortcuts ----------------

  $$("[data-contact='whatsapp']").forEach((element) => {
    element.addEventListener("click", () => {
      const number = (
        element.dataset.phone || ""
      ).replace(/[^\d]/g, "");

      if (number) {
        window.open(
          `https://wa.me/${number}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    });
  });

  // Contact form submission is handled by contact.js.
  // This file does not make API requests.

})();
