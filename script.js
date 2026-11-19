// ================================================
// M.A.S.H CYVEX — Main JavaScript
// Navigation / Theme / Language / Modals / Contact
// ================================================

(function () {
  "use strict";

  const html = document.documentElement;
  const body = document.body;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const themeToggle = $("#themeToggle");
  const languageToggle = $("#languageToggle");
  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

  // ================================================
  // TRANSLATIONS
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
      liveDemo: "الموقع المباشر",
      projectLetsGoText: "موقع ويب تعريفي لمقهى بتصميم متجاوب.",

      contactKicker: "لنتواصل",
      contactTitle: "تواصل معي",
      contactSubtitle: "للاستفسارات أو مناقشة مشروع أو تعاون تقني.",
      contactHeadline: "هل لديك فكرة أو مشروع؟",
      contactText: "يمكنك التواصل معي من خلال إحدى الوسائل التالية.",
      formSubmit: "إرسال الرسالة",
      whatsappLabel: "ابدأ محادثة",
      phoneTitle: "الهاتف",
      contactFooterTitle: "شكراً لزيارتك",
      contactFooterText: "أقدّر وقتك واهتمامك باستكشاف أعمالي.",

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
      reconTechTitle: "التقنيات"
    },

    en: {
      brandCaption: "DEVELOPER PORTFOLIO",
      profileRole: "Web Developer & Cybersecurity Researcher",
      available: "Available for Projects",

      navHome: "Home",
      navAbout: "About Me",
      navSkills: "Skills",
      navProjects: "Projects",
      navContact: "Contact",
      downloadCV: "Download CV",

      heroLabel: "Welcome to My Tech Space",
      heroGreeting: "Hello, I'm",
      heroSubtitle: "Web Developer & Cybersecurity Researcher",
      heroDescription: "I build modern web experiences and focus on application security, network security, vulnerability discovery, and remediation.",
      viewProjects: "Explore My Projects",
      contactMe: "Contact Me",
      location: "Sohag, Egypt",
      englishLevel: "English: Intermediate",

      statOne: "Vulnerabilities Discovered",
      statTwo: "Bug Bounty Participation",
      statThree: "Technical Projects",

      focusKicker: "Areas of Work",
      focusTitle: "What Do I Focus On?",
      focusWebTitle: "Web Development",
      focusWebText: "Designing and developing modern, responsive web interfaces.",
      focusSecurityTitle: "Cybersecurity",
      focusSecurityText: "Understanding security risks, discovering vulnerabilities, and addressing them.",
      focusNetworkTitle: "Network Security",
      focusNetworkText: "Analyzing networks and improving security configurations.",

      aboutKicker: "Get to Know Me",
      aboutTitle: "About Me",
      aboutSubtitle: "An overview of my interests and technical fields.",
      aboutHello: "Hello, I'm M.A.S.H CYVEX",
      aboutTextOne: "A web developer interested in building practical, modern user interfaces, with a focus on performance, user experience, and cross-device compatibility.",
      aboutTextTwo: "I'm also interested in cybersecurity, learning and analyzing application and network security, discovering vulnerabilities, and handling them responsibly.",
      aboutTextThree: "I continuously develop my skills through learning, practical work, and building technical projects.",

      detailName: "Name",
      detailRole: "Field",
      detailRoleValue: "Web Development & Cybersecurity",
      detailLocation: "Location",
      detailLanguage: "English Language",
      detailAvailability: "Availability",

      valueOneTitle: "Continuous Learning",
      valueOneText: "Continuously developing technical knowledge and skills.",
      valueTwoTitle: "Practical Application",
      valueTwoText: "Turning ideas into practical projects and experiences.",
      valueThreeTitle: "Security & Responsibility",
      valueThreeText: "Building more secure and reliable solutions.",

      skillsKicker: "Technical Abilities",
      skillsTitle: "Skills",
      skillsSubtitle: "Technologies and tools I learn and use in my projects.",
      skillNetwork: "Network Security",
      skillWebSecurity: "Web Application Security",
      skillVulnerability: "Vulnerability Discovery & Remediation",
      skillsNote: "The progress levels shown are estimates based on self-assessment. They are not official certifications or test results.",

      projectsKicker: "My Technical Work",
      projectsTitle: "Projects",
      projectsSubtitle: "A collection of projects and experiments I have worked on.",
      projectReportTitle: "Security Assessment Report",
      projectReportText: "A sample report presenting security assessment findings, vulnerability observations, and recommendations.",
      viewDetails: "View Details",
      projectMalwareText: "A project for static file analysis and examining file properties and indicators.",
      viewGithub: "View on GitHub",
      projectReconText: "An information discovery tool for collecting initial data within authorized testing scopes.",
      projectAwidaTitle: "Awida Republic Restaurant",
      projectAwidaText: "An informational website presenting a restaurant and its services.",
      liveDemo: "Live Website",
      projectLetsGoText: "A responsive informational website for a cafe.",

      contactKicker: "Get in Touch",
      contactTitle: "Contact Me",
      contactSubtitle: "For inquiries, project discussions, or technical collaboration.",
      contactHeadline: "Have an Idea or a Project?",
      contactText: "You can contact me through one of the following methods.",
      formSubmit: "Send Message",
      whatsappLabel: "Start a Conversation",
      phoneTitle: "Phone",
      contactFooterTitle: "Thank You for Visiting",
      contactFooterText: "I appreciate your time and interest in exploring my work.",

      rights: "All rights reserved.",
      footerMade: "Made with attention to detail.",

      reportModalKicker: "SECURITY PROJECT",
      reportModalTitle: "Security Assessment Report",
      reportModalIntro: "A demonstration of how security assessment findings and observations are organized.",
      reportScopeTitle: "Scope",
      reportScopeText: "A security assessment within a defined and authorized scope.",
      reportMethodTitle: "Methodology",
      reportMethodText: "Information gathering, reviewing results, and documenting observations.",
      reportOutputTitle: "Deliverables",
      reportOutputText: "A summary of security findings and remediation recommendations.",

      reconModalIntro: "A project for discovering initial information and organizing security reconnaissance results.",
      reconPurposeTitle: "Purpose",
      reconPurposeText: "Helping organize reconnaissance and collect publicly available information.",
      reconUsageTitle: "Usage",
      reconUsageText: "Used only on systems and domains where testing is authorized.",
      reconTechTitle: "Technologies"
    }
  };

  // ================================================
  // STORAGE
  // ================================================

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  // ================================================
  // LANGUAGE
  // ================================================

  function translateElement(element, value) {
    // Preserve nested icons and decorative spans.
    const textNode = [...element.childNodes].find(
      node => node.nodeType === Node.TEXT_NODE &&
      node.textContent.trim().length > 0
    );

    if (textNode) {
      textNode.textContent = " " + value + " ";
    } else if (!element.children.length) {
      element.textContent = value;
    } else {
      element.textContent = value;
    }
  }

  function setLanguage(language) {
    const lang = language === "en" ? "en" : "ar";
    const dictionary = translations[lang];

    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";

    $$("[data-i18n]").forEach(element => {
      const key = element.dataset.i18n;

      if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
        translateElement(element, dictionary[key]);
      }
    });

    // Contact form labels
    const labels = {
      contactName: lang === "ar" ? "الاسم" : "Name",
      contactEmail: lang === "ar" ? "البريد الإلكتروني" : "Email",
      contactSubject: lang === "ar" ? "الموضوع" : "Subject",
      contactMessage: lang === "ar" ? "الرسالة" : "Message"
    };

    Object.entries(labels).forEach(([id, value]) => {
      const label = $(`label[for="${id}"]`);
      if (label) label.textContent = value;
    });

    // Honeypot label
    const honeypotLabel = $('label[for="contactWebsite"]');
    if (honeypotLabel) {
      honeypotLabel.textContent = "Website";
    }

    // Language button
    if (languageToggle) {
      languageToggle.textContent = lang === "ar" ? "EN" : "عربي";
      languageToggle.setAttribute(
        "aria-label",
        lang === "ar" ? "Switch language" : "تغيير اللغة"
      );
      languageToggle.title =
        lang === "ar" ? "Switch language" : "تغيير اللغة";
    }

    // Accessibility labels
    if (menuBtn) {
      menuBtn.setAttribute(
        "aria-label",
        lang === "ar" ? "فتح القائمة" : "Open Menu"
      );
    }

    $$("[data-action='close-modal']").forEach(button => {
      button.setAttribute(
        "aria-label",
        lang === "ar" ? "إغلاق" : "Close"
      );
    });

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        lang === "ar" ? "تغيير المظهر" : "Change Theme"
      );
    }

    // Document metadata
    document.title = lang === "ar"
      ? "M.A.S.H CYVEX | مطور ويب وباحث أمن سيبراني"
      : "M.A.S.H CYVEX | Web Developer & Cybersecurity Researcher";

    const description = $('meta[name="description"]');

    if (description) {
      description.content = lang === "ar"
        ? "M.A.S.H CYVEX — مطور واجهات ويب وباحث في الأمن السيبراني من سوهاج، مصر."
        : "M.A.S.H CYVEX — Web Developer and Cybersecurity Researcher from Sohag, Egypt.";
    }

    storageSet("mash-language", lang);
  }

  // ================================================
  // THEME
  // ================================================

  function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";

    html.dataset.theme = nextTheme;

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        html.lang === "ar" ? "تغيير المظهر" : "Change Theme"
      );

      themeToggle.setAttribute(
        "aria-pressed",
        String(nextTheme === "dark")
      );

      themeToggle.textContent =
        nextTheme === "dark" ? "☀️" : "🌙";
    }

    storageSet("mash-theme", nextTheme);
  }

  // ================================================
  // SIDEBAR
  // ================================================

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

    if (isOpen) closeSidebar();
    else openSidebar();
  });

  overlay?.addEventListener("click", closeSidebar);

  // ================================================
  // NAVIGATION
  // ================================================

  const pageLinks = $$("[data-page]");
  const pages = $$(".page");

  function showPage(pageId, updateHistory = true) {
    const target = document.getElementById(pageId);

    if (!target || !target.classList.contains("page")) return;

    pages.forEach(page => {
      const active = page.id === pageId;
      page.classList.toggle("active", active);
      page.setAttribute("aria-hidden", String(!active));
    });

    pageLinks.forEach(link => {
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
        history.pushState({ page: pageId }, "", `#${pageId}`);
      } catch (_) {}
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  pageLinks.forEach(link => {
    link.addEventListener("click", event => {
      const pageId = link.dataset.page;
      if (!pageId) return;

      event.preventDefault();
      showPage(pageId);
    });
  });

  window.addEventListener("popstate", () => {
    const pageId = location.hash.replace("#", "");
    if (pageId) showPage(pageId, false);
  });

  // ================================================
  // MODALS
  // ================================================

  const modals = $$(".modal");

  function openModal(modal) {
    if (!modal) return;

    modal.classList.add("active", "show");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");

    $("[data-action='close-modal']", modal)?.focus();
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active", "show");
    modal.setAttribute("aria-hidden", "true");

    const stillOpen = modals.some(item =>
      item.classList.contains("active") ||
      item.classList.contains("show")
    );

    if (!stillOpen) {
      body.classList.remove("modal-open");
    }
  }

  $$("[data-action]").forEach(element => {
    element.addEventListener("click", event => {
      const action = element.dataset.action;

      if (action === "open-report") {
        event.preventDefault();
        openModal($("#reportModal"));
      }

      if (action === "open-recon") {
        event.preventDefault();
        openModal($("#reconModal"));
      }

      if (action === "close-modal") {
        event.preventDefault();
        closeModal(element.closest(".modal"));
      }

      if (action === "whatsapp") {
        const number = "201554416094";

        window.open(
          `https://wa.me/${number}`,
          "_blank",
          "noopener,noreferrer"
        );
      }

      if (action === "phone") {
        location.href = "tel:+201554416094";
      }

      if (action === "email") {
        location.href = "mailto:minadeveloper43@gmail.com";
      }
    });
  });

  modals.forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSidebar();
      modals.forEach(closeModal);
    }
  });

  // ================================================
  // SKILL PROGRESS
  // ================================================

  $$("[data-progress]").forEach(bar => {
    const rawValue = Number(bar.dataset.progress);

    const value = Number.isFinite(rawValue)
      ? Math.min(100, Math.max(0, rawValue))
      : 0;

    bar.style.setProperty("--progress", `${value}%`);
    bar.style.width = `${value}%`;

    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(value));
  });

  // ================================================
  // SCROLL REVEAL
  // ================================================

  const revealItems = $$(".reveal, [data-reveal]");

  if ("IntersectionObserver" in window && revealItems.length) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible", "revealed");
            currentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => {
      item.classList.add("visible", "revealed");
    });
  }

  // ================================================
  // IMAGE FALLBACK
  // ================================================

  $$("img").forEach(img => {
    img.addEventListener("error", () => {
      img.classList.add("image-load-failed");

      const wrapper = img.closest(
        ".profile-image-wrap, .profile-image, .image-wrapper, .avatar"
      );

      wrapper?.classList.add("profile-image-failed");
    }, { once: true });
  });

  // ================================================
  // INITIALIZATION
  // ================================================

  const savedLanguage = storageGet("mash-language") || "ar";
  const savedTheme = storageGet("mash-theme") || html.dataset.theme || "dark";

  setLanguage(savedLanguage);
  setTheme(savedTheme);

  const initialPage = location.hash.replace("#", "");

  if (
    initialPage &&
    document.getElementById(initialPage)?.classList.contains("page")
  ) {
    showPage(initialPage, false);
  } else {
    const activePage = $(".page.active") || $("#home");
    if (activePage) showPage(activePage.id, false);
  }

})();
