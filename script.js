// ================================================
// M.A.S.H CYVEX — Main JavaScript
// Navigation / Theme / Language / Modals / Contact
// ================================================

(function () {
  "use strict";

  const html = document.documentElement;
  const body = document.body;

  const themeToggle = document.getElementById("themeToggle");
  const languageToggle = document.getElementById("languageToggle");

  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  const allowedPages = [
    "home",
    "about",
    "skills",
    "projects",
    "contact"
  ];

  const CONTACT = Object.freeze({
    phone: "201554416094",
    email: "minadeveloper43@gmail.com",
    whatsapp: "201554416094"
  });

  let currentLanguage = "ar";
  let previousFocus = null;
  let lastContactAction = 0;
  let revealObserver = null;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  // ================================================
  // Translation Dictionary
  // ================================================

  const translations = {
    ar: {
      brandCaption: "DEVELOPER PORTFOLIO",
      profileRole: "مطور ويب وباحث أمن سيبراني",
      available: "متاح للمشاريع",

      navHome: "الرئيسية",
      navAbout: "من أنا",
      navSkills: "المهارات",
      navProjects: "المشاريع",
      navContact: "تواصل معي",
      downloadCV: "تحميل السيرة الذاتية",

      heroLabel: "مرحباً بك في مساحتي التقنية",
      heroGreeting: "أهلاً، أنا",
      heroSubtitle: "مطور واجهات ويب وباحث في الأمن السيبراني",
      heroDescription: "أعمل على بناء تجارب ويب حديثة، وأهتم بأمن التطبيقات والشبكات واكتشاف الثغرات ومعالجتها.",
      viewProjects: "استكشف مشاريعي",
      contactMe: "تواصل معي",
      location: "سوهاج، مصر",
      englishLevel: "الإنجليزية: متوسط",

      statOne: "ثغرات تم اكتشافها",
      statTwo: "مشاركة في Bug Bounty",
      statThree: "مشاريع تقنية",

      focusKicker: "مجالات العمل",
      focusTitle: "ما الذي أركز عليه؟",
      focusWebTitle: "تطوير الويب",
      focusWebText: "تصميم وتطوير واجهات ويب حديثة ومتجاوبة.",
      focusSecurityTitle: "الأمن السيبراني",
      focusSecurityText: "فهم المخاطر الأمنية واكتشاف نقاط الضعف ومعالجتها.",
      focusNetworkTitle: "أمن الشبكات",
      focusNetworkText: "تحليل الشبكات وتحسين إعدادات الحماية.",

      aboutKicker: "تعرف عليّ",
      aboutTitle: "من أنا؟",
      aboutSubtitle: "نبذة عن اهتماماتي ومجالات عملي التقنية.",
      aboutHello: "مرحباً، أنا M.A.S.H CYVEX",
      aboutTextOne: "مطور ويب مهتم ببناء واجهات مستخدم عملية وحديثة، مع اهتمام بالأداء وتجربة المستخدم والتوافق مع مختلف الأجهزة.",
      aboutTextTwo: "أهتم أيضاً بالأمن السيبراني، وأعمل على تعلم وتحليل أمن التطبيقات والشبكات واكتشاف الثغرات الأمنية والتعامل معها بطريقة مسؤولة.",
      aboutTextThree: "أطور مهاراتي باستمرار من خلال التعلم والتطبيق العملي وبناء المشاريع التقنية.",

      detailName: "الاسم",
      detailRole: "المجال",
      detailRoleValue: "تطوير الويب والأمن السيبراني",
      detailLocation: "الموقع",
      detailLanguage: "اللغة الإنجليزية",
      detailAvailability: "الحالة",

      valueOneTitle: "التعلم المستمر",
      valueOneText: "تطوير المعرفة والمهارات التقنية باستمرار.",
      valueTwoTitle: "التطبيق العملي",
      valueTwoText: "تحويل الأفكار إلى مشاريع وتجارب عملية.",
      valueThreeTitle: "الأمان والمسؤولية",
      valueThreeText: "الاهتمام ببناء حلول أكثر أماناً وموثوقية.",

      skillsKicker: "قدراتي التقنية",
      skillsTitle: "المهارات",
      skillsSubtitle: "التقنيات والأدوات التي أتعلمها وأستخدمها في مشاريعي.",
      skillNetwork: "أمن الشبكات",
      skillWebSecurity: "أمن تطبيقات الويب",
      skillVulnerability: "اكتشاف ومعالجة الثغرات",
      skillsNote: "مستويات التقدم المعروضة تقديرية وتعبر عن تقييم ذاتي للمهارات، وليست شهادات أو اختبارات رسمية.",

      projectsKicker: "أعمالي التقنية",
      projectsTitle: "المشاريع",
      projectsSubtitle: "مجموعة من المشاريع والتجارب التي عملت عليها.",
      projectReportTitle: "تقرير تقييم أمني",
      projectReportText: "نموذج تقرير يعرض نتائج تقييم أمني وملاحظات حول نقاط الضعف والتوصيات.",
      viewDetails: "عرض التفاصيل",
      projectMalwareText: "مشروع لتحليل الملفات بشكل ثابت والمساعدة في فحص خصائصها ومؤشراتها.",
      viewGithub: "عرض على GitHub",
      projectReconText: "أداة لاستكشاف المعلومات وجمع البيانات الأولية ضمن نطاقات اختبار مصرح بها.",
      projectAwidaTitle: "مطعم عويضة الجمهورية",
      projectAwidaText: "موقع ويب تعريفي لمطعم يعرض معلوماته وخدماته.",
      projectLetsGoText: "موقع ويب تعريفي لمقهى بتصميم متجاوب.",
      liveDemo: "الموقع المباشر",

      contactKicker: "لنتواصل",
      contactTitle: "تواصل معي",
      contactSubtitle: "للاستفسارات أو مناقشة مشروع أو تعاون تقني.",
      contactHeadline: "هل لديك فكرة أو مشروع؟",
      contactText: "يمكنك التواصل معي من خلال إحدى الوسائل التالية.",
      whatsappLabel: "ابدأ محادثة",
      phoneTitle: "الهاتف",
      contactFooterTitle: "شكراً لزيارتك",
      contactFooterText: "أقدّر وقتك واهتمامك باستكشاف أعمالي.",

      formSuccess: "تم إرسال رسالتك بنجاح.",
      formError: "تعذر إرسال الرسالة. حاول مرة أخرى.",
      formInvalid: "يرجى التأكد من صحة البيانات المدخلة.",
      formSending: "جارٍ إرسال رسالتك...",
      formNetworkError: "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.",

      rights: "جميع الحقوق محفوظة.",
      footerMade: "صُنع باهتمام بالتفاصيل.",

      reportModalKicker: "مشروع أمني",
      reportModalTitle: "تقرير التقييم الأمني",
      reportModalIntro: "عرض توضيحي لطريقة تنظيم نتائج التقييم الأمني وتوثيق الملاحظات.",
      reportScopeTitle: "نطاق العمل",
      reportScopeText: "تقييم أمني ضمن نطاق محدد ومصرح به.",
      reportMethodTitle: "المنهجية",
      reportMethodText: "جمع المعلومات، مراجعة النتائج، وتوثيق الملاحظات.",
      reportOutputTitle: "المخرجات",
      reportOutputText: "ملخص للملاحظات الأمنية وتوصيات المعالجة.",

      reconModalIntro: "مشروع لاستكشاف المعلومات الأولية وتنظيم نتائج الاستطلاع الأمني.",
      reconPurposeTitle: "الهدف",
      reconPurposeText: "المساعدة في تنظيم عملية الاستطلاع وجمع المعلومات العامة.",
      reconUsageTitle: "الاستخدام",
      reconUsageText: "يُستخدم فقط على الأنظمة والنطاقات التي يوجد تصريح باختبارها.",
      reconTechTitle: "التقنيات",

      menuOpen: "فتح القائمة",
      menuClose: "إغلاق القائمة",
      themeLight: "تفعيل الوضع الفاتح",
      themeDark: "تفعيل الوضع الداكن",
      languageSwitch: "Switch language",
      modalClose: "إغلاق",
      whatsappMessage: "مرحباً، أود التواصل معك بخصوص مشروع أو استفسار تقني."
    },

    en: {
      brandCaption: "DEVELOPER PORTFOLIO",
      profileRole: "Web Developer & Cybersecurity Researcher",
      available: "Available for projects",

      navHome: "Home",
      navAbout: "About",
      navSkills: "Skills",
      navProjects: "Projects",
      navContact: "Contact",
      downloadCV: "Download CV",

      heroLabel: "Welcome to my technical space",
      heroGreeting: "Hello, I'm",
      heroSubtitle: "Web Developer & Cybersecurity Researcher",
      heroDescription: "I build modern web experiences and focus on application security, network security, vulnerability discovery, and remediation.",
      viewProjects: "Explore Projects",
      contactMe: "Contact Me",
      location: "Sohag, Egypt",
      englishLevel: "English: Intermediate",

      statOne: "Vulnerabilities Discovered",
      statTwo: "Bug Bounty Participation",
      statThree: "Technical Projects",

      focusKicker: "What I Do",
      focusTitle: "My Main Focus",
      focusWebTitle: "Web Development",
      focusWebText: "Building modern and responsive web interfaces.",
      focusSecurityTitle: "Cybersecurity",
      focusSecurityText: "Understanding security risks and identifying weaknesses responsibly.",
      focusNetworkTitle: "Network Security",
      focusNetworkText: "Analyzing networks and improving security configurations.",

      aboutKicker: "Get to Know Me",
      aboutTitle: "About Me",
      aboutSubtitle: "A brief overview of my interests and technical work.",
      aboutHello: "Hello, I'm M.A.S.H CYVEX",
      aboutTextOne: "I'm a web developer interested in building practical, modern user interfaces, with a focus on performance, user experience, and device compatibility.",
      aboutTextTwo: "I'm also interested in cybersecurity, learning and analyzing application and network security, discovering vulnerabilities, and handling them responsibly.",
      aboutTextThree: "I continuously develop my skills through learning, practical work, and building technical projects.",

      detailName: "Name",
      detailRole: "Field",
      detailRoleValue: "Web Development & Cybersecurity",
      detailLocation: "Location",
      detailLanguage: "English",
      detailAvailability: "Status",

      valueOneTitle: "Continuous Learning",
      valueOneText: "Continuously improving technical knowledge and skills.",
      valueTwoTitle: "Practical Experience",
      valueTwoText: "Turning ideas into practical projects and experiments.",
      valueThreeTitle: "Security & Responsibility",
      valueThreeText: "Building solutions with better security and reliability.",

      skillsKicker: "Technical Abilities",
      skillsTitle: "Skills",
      skillsSubtitle: "Technologies and tools I learn and use in my projects.",
      skillNetwork: "Network Security",
      skillWebSecurity: "Web Application Security",
      skillVulnerability: "Vulnerability Discovery & Remediation",
      skillsNote: "The displayed progress levels are estimates based on self-assessment. They are not official certifications or test results.",

      projectsKicker: "My Technical Work",
      projectsTitle: "Projects",
      projectsSubtitle: "A collection of projects and experiments I've worked on.",
      projectReportTitle: "Security Assessment Report",
      projectReportText: "A sample report presenting security assessment findings, observations, and recommendations.",
      viewDetails: "View Details",
      projectMalwareText: "A static file analysis project designed to inspect file properties and indicators.",
      viewGithub: "View on GitHub",
      projectReconText: "An information discovery tool for gathering initial data within authorized testing scopes.",
      projectAwidaTitle: "Awida Republic Restaurant",
      projectAwidaText: "A restaurant website presenting its information and services.",
      projectLetsGoText: "A responsive website for a cafe.",
      liveDemo: "Live Website",

      contactKicker: "Get in Touch",
      contactTitle: "Contact Me",
      contactSubtitle: "For inquiries, project discussions, or technical collaboration.",
      contactHeadline: "Have an idea or a project?",
      contactText: "You can contact me through one of the following channels.",
      whatsappLabel: "Start a conversation",
      phoneTitle: "Phone",
      contactFooterTitle: "Thanks for Visiting",
      contactFooterText: "I appreciate your time and interest in exploring my work.",

      formSuccess: "Your message was sent successfully.",
      formError: "Your message could not be sent. Please try again.",
      formInvalid: "Please check the information you entered.",
      formSending: "Sending your message...",
      formNetworkError: "Unable to connect to the server. Check your internet connection.",

      rights: "All rights reserved.",
      footerMade: "Built with attention to detail.",

      reportModalKicker: "Security Project",
      reportModalTitle: "Security Assessment Report",
      reportModalIntro: "A demonstration of how security assessment findings and observations can be organized.",
      reportScopeTitle: "Scope",
      reportScopeText: "A security assessment within a defined and authorized scope.",
      reportMethodTitle: "Methodology",
      reportMethodText: "Information gathering, reviewing findings, and documenting observations.",
      reportOutputTitle: "Deliverables",
      reportOutputText: "A summary of security observations and remediation recommendations.",

      reconModalIntro: "A project for initial information discovery and organizing reconnaissance findings.",
      reconPurposeTitle: "Purpose",
      reconPurposeText: "Helping organize reconnaissance and collect publicly available information.",
      reconUsageTitle: "Usage",
      reconUsageText: "Only use on systems and domains you are authorized to test.",
      reconTechTitle: "Technologies",

      menuOpen: "Open menu",
      menuClose: "Close menu",
      themeLight: "Enable light mode",
      themeDark: "Enable dark mode",
      languageSwitch: "تغيير اللغة",
      modalClose: "Close",
      whatsappMessage: "Hello, I would like to contact you about a project or technical inquiry."
    }
  };

  // ================================================
  // Safe Storage Helpers
  // ================================================

  function readStorage(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage may be unavailable.
    }
  }

  // ================================================
  // Theme
  // ================================================

  function setTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";

    html.setAttribute("data-theme", selectedTheme);

    if (themeToggle) {
      themeToggle.textContent =
        selectedTheme === "light" ? "☀️" : "🌙";

      const label = translations[currentLanguage][
        selectedTheme === "light" ? "themeDark" : "themeLight"
      ];

      themeToggle.setAttribute("aria-label", label);
      themeToggle.setAttribute("title", label);
    }

    writeStorage("theme", selectedTheme);
  }

  setTheme(readStorage("theme", "dark"));

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const currentTheme = html.getAttribute("data-theme") || "dark";
      setTheme(currentTheme === "dark" ? "light" : "dark");
    });
  }

  // ================================================
  // Language
  // ================================================

  function translatePage(language) {
    currentLanguage = language === "en" ? "en" : "ar";

    html.lang = currentLanguage;
    html.dir = currentLanguage === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.getAttribute("data-i18n");
      const translatedText = translations[currentLanguage][key];

      if (typeof translatedText === "string") {
        element.textContent = translatedText;
      }
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (element) {
      const entries = element.getAttribute("data-i18n-attr");

      if (!entries) return;

      entries.split(";").forEach(function (entry) {
        const parts = entry.split(":");
        const attribute = parts[0];
        const key = parts[1];

        if (!attribute || !key) return;

        const translatedValue = translations[currentLanguage][key];

        if (typeof translatedValue === "string") {
          element.setAttribute(attribute, translatedValue);
        }
      });
    });

    if (languageToggle) {
      languageToggle.textContent = currentLanguage === "ar" ? "EN" : "عربي";

      const label = translations[currentLanguage].languageSwitch;

      languageToggle.setAttribute("aria-label", label);
      languageToggle.setAttribute("title", label);
    }

    if (menuBtn) {
      const menuIsOpen = sidebar && sidebar.classList.contains("open");

      menuBtn.setAttribute(
        "aria-label",
        translations[currentLanguage][menuIsOpen ? "menuClose" : "menuOpen"]
      );
    }

    if (themeToggle) {
      const activeTheme = html.getAttribute("data-theme") || "dark";

      const label = translations[currentLanguage][
        activeTheme === "light" ? "themeDark" : "themeLight"
      ];

      themeToggle.setAttribute("aria-label", label);
      themeToggle.setAttribute("title", label);
    }

    document.querySelectorAll(".modal-close").forEach(function (button) {
      button.setAttribute(
        "aria-label",
        translations[currentLanguage].modalClose
      );
    });

    writeStorage("language", currentLanguage);
  }

  translatePage(readStorage("language", "ar"));

  if (languageToggle) {
    languageToggle.addEventListener("click", function () {
      translatePage(currentLanguage === "ar" ? "en" : "ar");
    });
  }

  // ================================================
  // Navigation
  // ================================================

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute(
        "aria-label",
        translations[currentLanguage].menuOpen
      );
    }

    body.classList.remove("sidebar-open");
  }

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("show");

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute(
        "aria-label",
        translations[currentLanguage].menuClose
      );
    }

    body.classList.add("sidebar-open");
  }

  function showPage(pageId) {
    if (!allowedPages.includes(pageId)) return;

    const targetPage = document.getElementById(pageId);

    if (!targetPage || !targetPage.classList.contains("page")) return;

    document.querySelectorAll(".page").forEach(function (page) {
      page.classList.remove("active");
    });

    targetPage.classList.add("active");

    document.querySelectorAll("[data-page]").forEach(function (link) {
      const isActive = link.getAttribute("data-page") === pageId;

      link.classList.toggle("active", isActive);

      if (link.classList.contains("nav-link")) {
        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      }
    });

    closeSidebar();

    window.scrollTo({
      top: 0,
      behavior: reducedMotion.matches ? "auto" : "smooth"
    });

    observeRevealElements();
  }

  document.addEventListener("click", function (event) {
    const pageLink = event.target.closest("[data-page]");

    if (!pageLink) return;

    const pageId = pageLink.getAttribute("data-page");

    if (!allowedPages.includes(pageId)) return;

    event.preventDefault();
    showPage(pageId);

    if (window.location.hash !== "#" + pageId) {
      history.replaceState(null, "", "#" + pageId);
    }
  });

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      const isOpen = sidebar && sidebar.classList.contains("open");

      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  const initialHash = window.location.hash.replace("#", "");

  showPage(
    allowedPages.includes(initialHash) ? initialHash : "home"
  );

  // ================================================
  // Animated Background
  // ================================================

  function initializeBackground() {
    const background = document.querySelector(".bg-anim");

    if (!background) return;

    if (reducedMotion.matches) {
      background.classList.add("motion-reduced");
      return;
    }

    background.classList.remove("motion-reduced");
    background.classList.add("background-ready");
  }

  initializeBackground();

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", initializeBackground);
  }

  // ================================================
  // Modals
  // ================================================

  function getVisibleModal() {
    return document.querySelector(".modal.show");
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) return;

    previousFocus = document.activeElement;

    document.querySelectorAll(".modal.show").forEach(function (item) {
      item.classList.remove("show");
      item.setAttribute("aria-hidden", "true");
    });

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    body.style.overflow = "hidden";

    const closeButton = modal.querySelector(".modal-close");

    if (closeButton) closeButton.focus();
  }

  function closeModal(modal) {
    const targetModal = modal || getVisibleModal();

    if (!targetModal) return;

    targetModal.classList.remove("show");
    targetModal.setAttribute("aria-hidden", "true");

    if (!getVisibleModal()) {
      body.style.overflow = "";

      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }

      previousFocus = null;
    }
  }

  document.addEventListener("click", function (event) {
    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) return;

    const action = actionElement.getAttribute("data-action");

    switch (action) {
      case "open-report":
        openModal("reportModal");
        break;

      case "open-recon":
        openModal("reconModal");
        break;

      case "close-modal":
        closeModal(actionElement.closest(".modal"));
        break;

      case "whatsapp":
        openWhatsApp();
        break;

      case "phone":
        openPhone();
        break;

      case "email":
        openEmail();
        break;

      default:
        break;
    }
  });

  document.querySelectorAll(".modal").forEach(function (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal(modal);
    });
  });

  // ================================================
  // Keyboard Accessibility
  // ================================================

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      const visibleModal = getVisibleModal();

      if (visibleModal) {
        closeModal(visibleModal);
        return;
      }

      closeSidebar();
    }

    if (event.key === "Tab") {
      const modal = getVisibleModal();

      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });

  // ================================================
  // Contact Actions
  // ================================================

  function allowContactAction() {
    const now = Date.now();

    if (now - lastContactAction < 1500) return false;

    lastContactAction = now;
    return true;
  }

  function openWhatsApp() {
    if (!allowContactAction()) return;

    const message = encodeURIComponent(
      translations[currentLanguage].whatsappMessage
    );

    const url =
      "https://wa.me/" + CONTACT.whatsapp + "?text=" + message;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openPhone() {
    if (!allowContactAction()) return;

    window.location.href = "tel:+" + CONTACT.phone;
  }

  function openEmail() {
    if (!allowContactAction()) return;

    const subject = encodeURIComponent(
      currentLanguage === "ar"
        ? "تواصل من خلال الموقع"
        : "Contact from portfolio website"
    );

    const bodyText = encodeURIComponent(
      currentLanguage === "ar"
        ? "مرحباً، أود التواصل معك."
        : "Hello, I would like to contact you."
    );

    window.location.href =
      "mailto:" + CONTACT.email +
      "?subject=" + subject +
      "&body=" + bodyText;
  }

  // ================================================
  // Reveal on Scroll
  // ================================================

  function observeRevealElements() {
    const elements = document.querySelectorAll(
      ".page.active .reveal:not(.visible)"
    );

    if (!elements.length) return;

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      elements.forEach(function (element) {
        element.classList.add("visible");
      });

      return;
    }

    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    elements.forEach(function (element) {
      revealObserver.observe(element);
    });
  }

  observeRevealElements();

  // ================================================
  // Image Fallback
  // ================================================

  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      if (img.classList.contains("profile-image")) {
        img.style.display = "none";

        const fallback = img.nextElementSibling;

        if (fallback && fallback.classList.contains("profile-fallback")) {
          fallback.style.display = "flex";
        }
      } else if (img.closest(".project-image")) {
        img.closest(".project-image").style.display = "none";
      }
    });
  });

  // ================================================
  // Hash Navigation
  // ================================================

  window.addEventListener("hashchange", function () {
    const pageId = window.location.hash.replace("#", "");

    if (allowedPages.includes(pageId)) {
      showPage(pageId);
    }
  });

  // ================================================
  // Initial Accessibility State
  // ================================================

  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", "false");
  }

  document.querySelectorAll(".modal").forEach(function (modal) {
    modal.setAttribute("aria-hidden", "true");
  });

})();
