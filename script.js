/* =====================================================
   M.A.S.H CYVEX — Main JavaScript
   Navigation / Sidebar / Modals
   Language / Theme / Contact / WhatsApp / Animations
===================================================== */

(() => {
  "use strict";

  /* HELPERS */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const html = document.documentElement;
  const body = document.body;

  const safeStorage = {
    get(key, fallback = null) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage may be unavailable.
      }
    }
  };

  /* TRANSLATIONS */
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

      heroLabel: "مرحباً بك في مساحتي التقنية",
      heroGreeting: "أهلاً، أنا",
      heroSubtitle: "مطور واجهات ويب وباحث في الأمن السيبراني",
      heroDescription:
        "أعمل على بناء تجارب ويب حديثة، وأهتم بأمن التطبيقات والشبكات واكتشاف الثغرات ومعالجتها.",
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
      focusSecurityText:
        "فهم المخاطر الأمنية واكتشاف نقاط الضعف ومعالجتها.",
      focusNetworkTitle: "أمن الشبكات",
      focusNetworkText: "تحليل الشبكات وتحسين إعدادات الحماية.",

      aboutKicker: "تعرف عليّ",
      aboutTitle: "من أنا؟",
      aboutSubtitle: "نبذة عن اهتماماتي ومجالات عملي التقنية.",
      aboutHello: "مرحباً، أنا M.A.S.H CYVEX",
      aboutTextOne:
        "مطور ويب مهتم ببناء واجهات مستخدم عملية وحديثة، مع اهتمام بالأداء وتجربة المستخدم والتوافق مع مختلف الأجهزة.",
      aboutTextTwo:
        "أهتم أيضاً بالأمن السيبراني، وأعمل على تعلم وتحليل أمن التطبيقات والشبكات واكتشاف الثغرات الأمنية والتعامل معها بطريقة مسؤولة.",
      aboutTextThree:
        "أطور مهاراتي باستمرار من خلال التعلم والتطبيق العملي وبناء المشاريع التقنية.",

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
      skillsNote:
        "مستويات التقدم المعروضة تقديرية وتعبر عن تقييم ذاتي للمهارات، وليست شهادات أو اختبارات رسمية.",

      projectsKicker: "أعمالي التقنية",
      projectsTitle: "المشاريع",
      projectsSubtitle: "مجموعة من المشاريع والتجارب التي عملت عليها.",
      viewDetails: "عرض التفاصيل",
      liveDemo: "الموقع المباشر",

      projectReportTitle: "تقرير تقييم أمني",
      projectReportText:
        "نموذج تقرير يعرض نتائج تقييم أمني وملاحظات حول نقاط الضعف والتوصيات.",
      projectMalwareText:
        "مشروع لتحليل الملفات بشكل ثابت والمساعدة في فحص خصائصها ومؤشراتها.",
      projectReconText:
        "أداة لاستكشاف المعلومات وجمع البيانات الأولية ضمن نطاقات اختبار مصرح بها.",
      projectAwidaTitle: "مطعم عويضة الجمهورية",
      projectAwidaText: "موقع ويب تعريفي لمطعم يعرض معلوماته وخدماته.",
      projectLetsGoText: "موقع ويب تعريفي لمقهى بتصميم متجاوب.",

      contactKicker: "لنتواصل",
      contactTitle: "تواصل معي",
      contactSubtitle: "للاستفسارات أو مناقشة مشروع أو تعاون تقني.",
      contactHeadline: "هل لديك فكرة أو مشروع؟",
      contactText: "يمكنك إرسال رسالة مباشرة من خلال النموذج.",

      formSubmit: "إرسال الرسالة",
      formSending: "جارٍ إرسال الرسالة...",
      formSuccess: "تم إرسال رسالتك بنجاح.",
      formError: "تعذر إرسال الرسالة. حاول مرة أخرى لاحقاً.",
      formInvalid: "تأكد من إدخال البيانات بشكل صحيح.",
      formRateLimit: "تم الوصول إلى حد الإرسال. حاول مرة أخرى لاحقاً.",
      nameLabel: "الاسم",
      emailLabel: "البريد الإلكتروني",
      subjectLabel: "الموضوع",
      messageLabel: "الرسالة",

      contactFooterTitle: "شكراً لزيارتك",
      contactFooterText: "أقدّر وقتك واهتمامك باستكشاف أعمالي.",
      rights: "جميع الحقوق محفوظة.",
      footerMade: "صُنع باهتمام بالتفاصيل.",

      reportModalKicker: "مشروع أمني",
      reportModalTitle: "تقرير التقييم الأمني",
      reportModalIntro:
        "عرض توضيحي لطريقة تنظيم نتائج التقييم الأمني وتوثيق الملاحظات.",
      reportScopeTitle: "نطاق العمل",
      reportScopeText: "تقييم أمني ضمن نطاق محدد ومصرح به.",
      reportMethodTitle: "المنهجية",
      reportMethodText: "جمع المعلومات، مراجعة النتائج، وتوثيق الملاحظات.",
      reportOutputTitle: "المخرجات",
      reportOutputText: "ملخص للملاحظات الأمنية وتوصيات المعالجة.",

      reconModalIntro:
        "مشروع لاستكشاف المعلومات الأولية وتنظيم نتائج الاستطلاع الأمني.",
      reconPurposeTitle: "الهدف",
      reconPurposeText:
        "المساعدة في تنظيم عملية الاستطلاع وجمع المعلومات العامة.",
      reconUsageTitle: "الاستخدام",
      reconUsageText:
        "يُستخدم فقط على الأنظمة والنطاقات التي يوجد تصريح باختبارها.",
      reconTechTitle: "التقنيات",

      closeMenu: "إغلاق القائمة",
      openMenu: "فتح القائمة",
      changeTheme: "تغيير المظهر",
      switchLanguage: "تغيير اللغة"
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

      heroLabel: "Welcome to my tech space",
      heroGreeting: "Hello, I'm",
      heroSubtitle: "Web Developer & Cybersecurity Researcher",
      heroDescription:
        "I build modern web experiences and focus on application security, network security, vulnerability discovery, and remediation.",
      viewProjects: "Explore My Projects",
      contactMe: "Contact Me",
      location: "Sohag, Egypt",
      englishLevel: "English: Intermediate",

      statOne: "Vulnerabilities Discovered",
      statTwo: "Bug Bounty Participation",
      statThree: "Technical Projects",

      focusKicker: "What I Do",
      focusTitle: "What Do I Focus On?",
      focusWebTitle: "Web Development",
      focusWebText: "Building modern and responsive web interfaces.",
      focusSecurityTitle: "Cybersecurity",
      focusSecurityText:
        "Understanding security risks, identifying weaknesses, and addressing them.",
      focusNetworkTitle: "Network Security",
      focusNetworkText: "Analyzing networks and improving security configurations.",

      aboutKicker: "Get to Know Me",
      aboutTitle: "About Me",
      aboutSubtitle: "An overview of my interests and technical work.",
      aboutHello: "Hello, I'm M.A.S.H CYVEX",
      aboutTextOne:
        "A web developer interested in building practical and modern user interfaces, with a focus on performance, user experience, and cross-device compatibility.",
      aboutTextTwo:
        "I'm also interested in cybersecurity, learning and analyzing application and network security, discovering vulnerabilities, and handling them responsibly.",
      aboutTextThree:
        "I continuously develop my skills through learning, hands-on practice, and building technical projects.",

      detailName: "Name",
      detailRole: "Field",
      detailRoleValue: "Web Development & Cybersecurity",
      detailLocation: "Location",
      detailLanguage: "English",
      detailAvailability: "Status",

      valueOneTitle: "Continuous Learning",
      valueOneText: "Continuously improving technical knowledge and skills.",
      valueTwoTitle: "Practical Experience",
      valueTwoText: "Turning ideas into practical projects and experiences.",
      valueThreeTitle: "Security & Responsibility",
      valueThreeText: "Building safer and more reliable solutions.",

      skillsKicker: "Technical Abilities",
      skillsTitle: "Skills",
      skillsSubtitle: "Technologies and tools I learn and use in my projects.",
      skillNetwork: "Network Security",
      skillWebSecurity: "Web Application Security",
      skillVulnerability: "Vulnerability Discovery & Remediation",
      skillsNote:
        "The displayed progress levels are estimates based on self-assessment, not official certificates or test results.",

      projectsKicker: "My Work",
      projectsTitle: "Projects",
      projectsSubtitle: "A collection of projects and experiments I have worked on.",
      viewDetails: "View Details",
      liveDemo: "Live Demo",

      projectReportTitle: "Security Assessment Report",
      projectReportText:
        "A sample report presenting security assessment findings, weaknesses, and recommendations.",
      projectMalwareText:
        "A static file analysis project that helps inspect file properties and indicators.",
      projectReconText:
        "An information-gathering tool for authorized testing scopes.",
      projectAwidaTitle: "Awida Republic Restaurant",
      projectAwidaText:
        "An informational restaurant website presenting its details and services.",
      projectLetsGoText: "A responsive informational website for a cafe.",

      contactKicker: "Get in Touch",
      contactTitle: "Contact Me",
      contactSubtitle: "For inquiries, project discussions, or technical collaboration.",
      contactHeadline: "Have an Idea or a Project?",
      contactText: "You can send a message directly through the form.",

      formSubmit: "Send Message",
      formSending: "Sending message...",
      formSuccess: "Your message was sent successfully.",
      formError: "Unable to send your message. Please try again later.",
      formInvalid: "Please check your information and try again.",
      formRateLimit: "The sending limit has been reached. Try again later.",
      nameLabel: "Name",
      emailLabel: "Email",
      subjectLabel: "Subject",
      messageLabel: "Message",

      contactFooterTitle: "Thanks for Visiting",
      contactFooterText: "I appreciate your time and interest in exploring my work.",
      rights: "All rights reserved.",
      footerMade: "Made with attention to detail.",

      reportModalKicker: "SECURITY PROJECT",
      reportModalTitle: "Security Assessment Report",
      reportModalIntro:
        "A demonstration of how security assessment findings and observations are organized.",
      reportScopeTitle: "Scope",
      reportScopeText: "A security assessment within a defined and authorized scope.",
      reportMethodTitle: "Methodology",
      reportMethodText: "Information gathering, reviewing results, and documenting findings.",
      reportOutputTitle: "Deliverables",
      reportOutputText: "A summary of security observations and remediation recommendations.",

      reconModalIntro:
        "A project for gathering initial information and organizing security reconnaissance results.",
      reconPurposeTitle: "Purpose",
      reconPurposeText:
        "Helping organize reconnaissance and collect publicly available information.",
      reconUsageTitle: "Usage",
      reconUsageText:
        "Used only on systems and domains where testing is authorized.",
      reconTechTitle: "Technologies",

      closeMenu: "Close menu",
      openMenu: "Open menu",
      changeTheme: "Change appearance",
      switchLanguage: "Switch language"
    }
  };

  /* LANGUAGE */
  const languageToggle = $("#languageToggle");

  function translateElement(element, value) {
    if (!element || typeof value !== "string") return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.nodeValue.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNode = walker.nextNode();

    if (textNode) {
      textNode.nodeValue = value;
    } else {
      element.textContent = value;
    }
  }

  function setLanguage(language) {
    const lang = translations[language] ? language : "ar";
    const dictionary = translations[lang];

    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";

    $$("[data-i18n]").forEach(element => {
      const key = element.dataset.i18n;

      if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
        translateElement(element, dictionary[key]);
      }
    });

    const formLabels = {
      contactName: dictionary.nameLabel,
      contactEmail: dictionary.emailLabel,
      contactSubject: dictionary.subjectLabel,
      contactMessage: dictionary.messageLabel
    };

    Object.entries(formLabels).forEach(([id, value]) => {
      const label = $(`label[for="${id}"]`);
      if (label) label.textContent = value;
    });

    const contactText = $(".contact-intro p");
    if (contactText) contactText.textContent = dictionary.contactText;

    if (languageToggle) {
      languageToggle.textContent = lang === "ar" ? "EN" : "عربي";
      languageToggle.setAttribute("aria-label", dictionary.switchLanguage);
      languageToggle.title = dictionary.switchLanguage;
    }

    if (themeToggle) {
      themeToggle.setAttribute("aria-label", dictionary.changeTheme);
      themeToggle.title = dictionary.changeTheme;
    }

    updateMenuAccessibility();

    document.title = lang === "ar"
      ? "M.A.S.H CYVEX | مطور ويب وباحث أمن سيبراني"
      : "M.A.S.H CYVEX | Web Developer & Cybersecurity Researcher";

    const description = $('meta[name="description"]');
    if (description) {
      description.content = lang === "ar"
        ? "M.A.S.H CYVEX — مطور واجهات ويب وباحث في الأمن السيبراني. استكشف المشاريع والمهارات والأعمال التقنية."
        : "M.A.S.H CYVEX — Web Developer & Cybersecurity Researcher. Explore projects, skills, and technical work.";
    }

    const ogLocale = $('meta[property="og:locale"]');
    if (ogLocale) {
      ogLocale.content = lang === "ar" ? "ar_EG" : "en_US";
    }

    safeStorage.set("mash-language", lang);
  }

  languageToggle?.addEventListener("click", () => {
    setLanguage(html.lang === "ar" ? "en" : "ar");
  });

  /* THEME */
  const themeToggle = $("#themeToggle");

  function setTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";
    html.dataset.theme = selectedTheme;

    if (themeToggle) {
      themeToggle.textContent = selectedTheme === "dark" ? "☀️" : "🌙";
      const label = translations[html.lang] || translations.ar;
      themeToggle.setAttribute("aria-label", label.changeTheme);
      themeToggle.title = label.changeTheme;
    }

    safeStorage.set("mash-theme", selectedTheme);
  }

  themeToggle?.addEventListener("click", () => {
    setTheme(html.dataset.theme === "dark" ? "light" : "dark");
  });

  /* SIDEBAR */
  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

  function updateMenuAccessibility() {
    if (!menuBtn) return;

    const isOpen = body.classList.contains("menu-open");
    const label = translations[html.lang] || translations.ar;

    menuBtn.setAttribute("aria-expanded", String(isOpen));
    menuBtn.setAttribute(
      "aria-label",
      isOpen ? label.closeMenu : label.openMenu
    );
  }

  function openSidebar() {
    body.classList.add("menu-open");
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
    updateMenuAccessibility();
  }

  function closeSidebar() {
    body.classList.remove("menu-open");
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
    updateMenuAccessibility();
  }

  menuBtn?.addEventListener("click", () => {
    body.classList.contains("menu-open")
      ? closeSidebar()
      : openSidebar();
  });

  overlay?.addEventListener("click", closeSidebar);

  /* NAVIGATION */
  const pages = $$(".page");
  const navLinks = $$(".nav-link");
  const pageLinks = $$("[data-page]");

  function showPage(pageId, updateHash = true) {
    const target = document.getElementById(pageId);

    if (!target || !target.classList.contains("page")) return;

    pages.forEach(page => {
      page.classList.toggle("active", page.id === pageId);
    });

    navLinks.forEach(link => {
      const active = link.dataset.page === pageId;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (updateHash) {
      history.replaceState(null, "", `#${pageId}`);
    }

    closeSidebar();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    refreshReveal();
    animateSkills(target);
  }

  pageLinks.forEach(link => {
    link.addEventListener("click", event => {
      const pageId = link.dataset.page;
      if (!pageId) return;

      event.preventDefault();
      showPage(pageId);
    });
  });

  function handleHashNavigation() {
    const pageId = window.location.hash.replace("#", "");
    const validPage = pages.some(page => page.id === pageId);

    showPage(validPage ? pageId : "home", false);
  }

  window.addEventListener("hashchange", handleHashNavigation);

  /* MODALS */
  const modals = $$(".modal");
  let previousFocus = null;

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains("modal")) return;

    previousFocus = document.activeElement;

    modals.forEach(item => {
      item.classList.remove("active", "show");
      item.setAttribute("aria-hidden", "true");
    });

    modal.classList.add("show", "active");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");

    $('[data-action="close-modal"]', modal)?.focus();
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active", "show");
    modal.setAttribute("aria-hidden", "true");

    const anotherOpen = modals.some(item =>
      item.classList.contains("active") ||
      item.classList.contains("show")
    );

    if (!anotherOpen) {
      body.classList.remove("modal-open");

      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }

      previousFocus = null;
    }
  }

  function closeAllModals() {
    modals.forEach(modal => {
      if (
        modal.classList.contains("active") ||
        modal.classList.contains("show")
      ) {
        closeModal(modal);
      }
    });
  }

  /* ACTION BUTTONS */
  $$("[data-action]").forEach(element => {
    element.addEventListener("click", () => {
      switch (element.dataset.action) {
        case "open-report":
          openModal("reportModal");
          break;

        case "open-recon":
          openModal("reconModal");
          break;

        case "close-modal":
          closeModal(element.closest(".modal"));
          break;

        default:
          break;
      }
    });
  });

  modals.forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal(modal);
    });
  });

  /* KEYBOARD ACCESSIBILITY */
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
      closeSidebar();
    }
  });

  /* CONTACT FORM */
  const contactForm = $("#contactForm");
  const contactStatus = $("#contactStatus");
  const contactSubmit = $("#contactSubmit");

  function setContactStatus(message, type = "") {
    if (!contactStatus) return;

    contactStatus.textContent = message;
    contactStatus.className = `form-status ${type}`.trim();
  }

  contactForm?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!contactForm.reportValidity()) return;

    const dictionary = translations[html.lang] || translations.ar;
    const formData = new FormData(contactForm);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim()
    };

    if (
      payload.name.length < 2 ||
      payload.name.length > 100 ||
      payload.email.length > 254 ||
      payload.message.length < 10 ||
      payload.message.length > 5000
    ) {
      setContactStatus(dictionary.formInvalid, "error");
      return;
    }

    if (contactSubmit) {
      contactSubmit.disabled = true;
      contactSubmit.setAttribute("aria-busy", "true");
      const buttonText = $("[data-i18n='formSubmit']", contactSubmit);
      if (buttonText) buttonText.textContent = dictionary.formSending;
    }

    setContactStatus("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let result = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok || result.success !== true) {
        if (response.status === 429) {
          throw new Error("RATE_LIMIT");
        }
        throw new Error("REQUEST_FAILED");
      }

      setContactStatus(dictionary.formSuccess, "success");
      contactForm.reset();
    } catch (error) {
      setContactStatus(
        error.message === "RATE_LIMIT"
          ? dictionary.formRateLimit
          : dictionary.formError,
        "error"
      );
    } finally {
      if (contactSubmit) {
        contactSubmit.disabled = false;
        contactSubmit.removeAttribute("aria-busy");

        const buttonText = $("[data-i18n='formSubmit']", contactSubmit);
        if (buttonText) buttonText.textContent = dictionary.formSubmit;
      }
    }
  });

  /* WHATSAPP APP SELECTION */
  const whatsappFloat = $("#whatsappFloat");
  const whatsappModal = $("#whatsappModal");
  const whatsappAppButtons = Array.from(
    document.querySelectorAll("[data-whatsapp-app]")
  );

  whatsappFloat?.addEventListener("click", () => {
    openModal("whatsappModal");
  });

  whatsappAppButtons.forEach(button => {
    button.addEventListener("click", () => {
      const app = button.dataset.whatsappApp;

      if (app !== "business" && app !== "messenger") return;

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      closeModal(whatsappModal);

      window.location.assign(
        `/api/health?app=${encodeURIComponent(app)}`
      );
    });
  });

  /* REVEAL ANIMATIONS */
  let revealObserver = null;

  function refreshReveal() {
    const elements = $$(".reveal");

    if (!("IntersectionObserver" in window)) {
      elements.forEach(element => element.classList.add("visible"));
      return;
    }

    revealObserver?.disconnect();

    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    elements.forEach(element => {
      if (!element.classList.contains("visible")) {
        revealObserver.observe(element);
      }
    });
  }

  /* SKILLS ANIMATION */
  const animatedSkills = new WeakSet();

  function animateSkills(container = document) {
    $$(".skill-progress", container).forEach(skill => {
      if (animatedSkills.has(skill)) return;

      const progress = Number(skill.dataset.progress);
      if (!Number.isFinite(progress)) return;

      const safeProgress = Math.min(100, Math.max(0, progress));

      skill.style.width = "0%";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          skill.style.width = `${safeProgress}%`;
        });
      });

      animatedSkills.add(skill);
    });
  }

  /* PROFILE IMAGE FALLBACK */
  const profileImage = $(".profile-image");
  const profileFallback = $(".profile-fallback");

  if (profileImage && profileFallback) {
    const showFallback = () => {
      profileImage.style.display = "none";
      profileFallback.style.display = "flex";
    };

    profileImage.addEventListener("error", showFallback);

    if (profileImage.complete && profileImage.naturalWidth === 0) {
      showFallback();
    }
  }

  /* INITIALIZATION */
  function initialize() {
    const savedLanguage = safeStorage.get("mash-language", "ar");
    const savedTheme = safeStorage.get(
      "mash-theme",
      html.dataset.theme || "dark"
    );

    setTheme(savedTheme);
    setLanguage(savedLanguage);

    const initialPage = window.location.hash.replace("#", "");
    const pageExists = pages.some(page => page.id === initialPage);

    showPage(pageExists ? initialPage : "home", false);

    refreshReveal();
    animateSkills(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
