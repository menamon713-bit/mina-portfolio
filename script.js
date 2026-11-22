/* =====================================================
   M.A.S.H CYVEX — Main JavaScript
   Navigation / Sidebar / Modals
   Language / Theme / Projects API / WhatsApp
===================================================== */

(() => {
  "use strict";

  /* HELPERS */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

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
      skillsSubtitle:
        "التقنيات والأدوات التي أتعلمها وأستخدمها في مشاريعي.",
      skillNetwork: "أمن الشبكات",
      skillWebSecurity: "أمن تطبيقات الويب",
      skillVulnerability: "اكتشاف ومعالجة الثغرات",
      skillsNote:
        "مستويات التقدم المعروضة تقديرية وتعبر عن تقييم ذاتي للمهارات، وليست شهادات أو اختبارات رسمية.",

      projectsKicker: "أعمالي التقنية",
      projectsTitle: "المشاريع",
      projectsSubtitle:
        "مجموعة من المشاريع والتجارب التي عملت عليها.",
      viewDetails: "عرض التفاصيل",
      liveDemo: "الموقع المباشر",
      github: "مستودع GitHub",
      noProjects: "لا توجد مشاريع منشورة حالياً.",
      projectsLoading: "جارٍ تحميل المشاريع...",
      projectsError: "تعذر تحميل المشاريع حالياً.",
      retry: "إعادة المحاولة",

      contactKicker: "لنتواصل",
      contactTitle: "تواصل معي",
      contactSubtitle:
        "للاستفسارات أو مناقشة مشروع أو تعاون تقني.",
      contactHeadline: "هل لديك فكرة أو مشروع؟",
      contactText:
        "يمكنك إرسال رسالة مباشرة من خلال النموذج.",

      formSubmit: "إرسال الرسالة",
      formSending: "جارٍ إرسال الرسالة...",
      formSuccess: "تم إرسال رسالتك بنجاح.",
      formError:
        "تعذر إرسال الرسالة. حاول مرة أخرى لاحقاً.",
      formInvalid:
        "تأكد من إدخال البيانات بشكل صحيح.",
      formRateLimit:
        "تم الوصول إلى حد الإرسال. حاول مرة أخرى لاحقاً.",
      nameLabel: "الاسم",
      emailLabel: "البريد الإلكتروني",
      subjectLabel: "الموضوع",
      messageLabel: "الرسالة",

      contactFooterTitle: "شكراً لزيارتك",
      contactFooterText:
        "أقدّر وقتك واهتمامك باستكشاف أعمالي.",
      rights: "جميع الحقوق محفوظة.",
      footerMade: "صُنع باهتمام بالتفاصيل.",

      closeMenu: "إغلاق القائمة",
      openMenu: "فتح القائمة",
      changeTheme: "تغيير المظهر",
      switchLanguage: "تغيير اللغة",
      close: "إغلاق"
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
      focusWebText:
        "Building modern and responsive web interfaces.",
      focusSecurityTitle: "Cybersecurity",
      focusSecurityText:
        "Understanding security risks, identifying weaknesses, and addressing them.",
      focusNetworkTitle: "Network Security",
      focusNetworkText:
        "Analyzing networks and improving security configurations.",

      aboutKicker: "Get to Know Me",
      aboutTitle: "About Me",
      aboutSubtitle:
        "An overview of my interests and technical work.",
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
      valueOneText:
        "Continuously improving technical knowledge and skills.",
      valueTwoTitle: "Practical Experience",
      valueTwoText:
        "Turning ideas into practical projects and experiences.",
      valueThreeTitle: "Security & Responsibility",
      valueThreeText:
        "Building safer and more reliable solutions.",

      skillsKicker: "Technical Abilities",
      skillsTitle: "Skills",
      skillsSubtitle:
        "Technologies and tools I learn and use in my projects.",
      skillNetwork: "Network Security",
      skillWebSecurity: "Web Application Security",
      skillVulnerability:
        "Vulnerability Discovery & Remediation",
      skillsNote:
        "The displayed progress levels are estimates based on self-assessment, not official certificates or test results.",

      projectsKicker: "My Work",
      projectsTitle: "Projects",
      projectsSubtitle:
        "A collection of projects and experiments I have worked on.",
      viewDetails: "View Details",
      liveDemo: "Live Demo",
      github: "GitHub Repository",
      noProjects: "There are no published projects yet.",
      projectsLoading: "Loading projects...",
      projectsError:
        "Unable to load projects. Please try again.",
      retry: "Retry",

      contactKicker: "Get in Touch",
      contactTitle: "Contact Me",
      contactSubtitle:
        "For inquiries, project discussions, or technical collaboration.",
      contactHeadline: "Have an Idea or a Project?",
      contactText:
        "You can send a message directly through the form.",

      formSubmit: "Send Message",
      formSending: "Sending message...",
      formSuccess: "Your message was sent successfully.",
      formError:
        "Unable to send your message. Please try again later.",
      formInvalid:
        "Please check your information and try again.",
      formRateLimit:
        "The sending limit has been reached. Try again later.",
      nameLabel: "Name",
      emailLabel: "Email",
      subjectLabel: "Subject",
      messageLabel: "Message",

      contactFooterTitle: "Thanks for Visiting",
      contactFooterText:
        "I appreciate your time and interest in exploring my work.",
      rights: "All rights reserved.",
      footerMade: "Made with attention to detail.",

      closeMenu: "Close menu",
      openMenu: "Open menu",
      changeTheme: "Change appearance",
      switchLanguage: "Switch language",
      close: "Close"
    }
  };

  /* PROJECTS STATE */

  const projectsGrid = $("#projectsGrid");
  const projectsStatus = $("#projectsStatus");

  let projectsData = [];
  let projectsLoaded = false;
  let projectsLoading = false;

  function currentDictionary() {
    return translations[html.lang] || translations.ar;
  }

  function currentProjectText(project, arValue, enValue) {
    return html.lang === "ar"
      ? (project[arValue] || project[enValue] || "")
      : (project[enValue] || project[arValue] || "");
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function safeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }

    try {
      const url = new URL(value, window.location.origin);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      if (url.username || url.password) {
        return "";
      }

      if (
        url.origin !== window.location.origin &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function safeImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }

    try {
      const url = new URL(value, window.location.origin);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      if (url.origin !== window.location.origin) {
        return "";
      }

      if (url.username || url.password) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function makeProjectVisual(project) {
    const imageUrl = safeImageUrl(project.image_url);

    if (imageUrl) {
             const wrapper = makeElement("div", "project-image");
      const image = document.createElement("img");

      image.src = imageUrl;
      image.alt = currentProjectText(
        project,
        "title_ar",
        "title_en"
      );
      image.loading = "lazy";
      image.onerror = () => wrapper.remove();

      wrapper.appendChild(image);

      return wrapper;
    }

    const visualClass =
      typeof project.visual_style === "string" &&
      /^[a-z0-9_-]{1,60}$/i.test(project.visual_style)
        ? project.visual_style
        : "project-visual-default";

    const visual = makeElement(
      "div",
      `project-visual ${visualClass}`
    );

    const icon = makeElement(
      "span",
      "project-visual-icon",
      "⌘"
    );

    icon.setAttribute("aria-hidden", "true");

    const category = makeElement(
      "span",
      "project-category",
      currentProjectText(
        project,
        "category_ar",
        "category_en"
      )
    );

    visual.append(icon, category);

    return visual;
  }

  function makeProjectActions(project) {
    const actions = makeElement("div", "project-actions");

    const liveUrl = safeHttpUrl(project.live_url);
    const githubUrl = safeHttpUrl(project.github_url);
    const dictionary = currentDictionary();

    if (liveUrl) {
      const link = makeElement("a", "project-link");

      link.href = liveUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const label = makeElement(
        "span",
        "",
        dictionary.liveDemo
      );

      const arrow = makeElement("span", "", "↗");
      arrow.setAttribute("aria-hidden", "true");

      link.append(label, arrow);
      actions.appendChild(link);
    }

    if (githubUrl) {
      const link = makeElement("a", "project-link");

      link.href = githubUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const label = makeElement(
        "span",
        "",
        dictionary.github
      );

      const arrow = makeElement("span", "", "↗");
      arrow.setAttribute("aria-hidden", "true");

      link.append(label, arrow);
      actions.appendChild(link);
    }

    return actions;
  }

  function openProjectDetails(project) {
    const modal = $("#projectModal");
    const title = $("#projectModalTitle");
    const category = $("#projectModalCategory");
    const intro = $("#projectModalIntro");
    const details = $("#projectModalDetails");
    const actions = $("#projectModalActions");

    if (
      !modal ||
      !title ||
      !category ||
      !intro ||
      !details ||
      !actions
    ) {
      return;
    }

    const ar = html.lang === "ar";

    title.textContent = currentProjectText(
      project,
      "title_ar",
      "title_en"
    );

    category.textContent = currentProjectText(
      project,
      "category_ar",
      "category_en"
    );

    intro.textContent = currentProjectText(
      project,
      "description_ar",
      "description_en"
    );

    details.replaceChildren();
    actions.replaceChildren();

    const rawDetails = ar
      ? project.details_ar
      : project.details_en;

    const detailObject =
      rawDetails &&
      typeof rawDetails === "object" &&
      !Array.isArray(rawDetails)
        ? rawDetails
        : {};

    Object.entries(detailObject).forEach(([key, value]) => {
      if (key === "intro") return;

      let heading = "";
      let description = "";

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        heading =
          typeof value.title === "string"
            ? value.title
            : "";

        description =
          typeof value.text === "string"
            ? value.text
            : "";
      } else if (typeof value === "string") {
        description = value;
      }

      if (!heading && !description) return;

      const item = makeElement("div", "modal-detail");

      if (heading) {
        item.appendChild(
          makeElement("strong", "", heading)
        );
      }

      if (description) {
        item.appendChild(
          makeElement("p", "", description)
        );
      }

      details.appendChild(item);
    });

    const projectActions = makeProjectActions(project);

    actions.replaceChildren(
      ...projectActions.childNodes
    );

    openModal("projectModal");
  }

  function showProjectsStatus(message, allowRetry = false) {
    if (!projectsGrid) return;

    const status = makeElement(
      "p",
      "projects-status",
      message
    );

    if (allowRetry) {
      const button = makeElement(
        "button",
        "project-link projects-retry",
        currentDictionary().retry
      );

      button.type = "button";
      button.dataset.projectsRetry = "true";

      status.appendChild(document.createTextNode(" "));
      status.appendChild(button);
    }

    projectsGrid.replaceChildren(status);
  }

  function renderProjects() {
    if (!projectsGrid) return;

    projectsGrid.replaceChildren();

    if (!projectsData.length) {
      projectsGrid.appendChild(
        makeElement(
          "p",
          "projects-status",
          currentDictionary().noProjects
        )
      );

      return;
    }

    projectsData.forEach(project => {
      const card = makeElement(
        "article",
        "project-card reveal"
      );

      const visual = makeProjectVisual(project);
      const content = makeElement(
        "div",
        "project-content"
      );

      const title = makeElement(
        "h2",
        "",
        currentProjectText(
          project,
          "title_ar",
          "title_en"
        )
      );

      const description = makeElement(
        "p",
        "",
        currentProjectText(
          project,
          "description_ar",
          "description_en"
        )
      );

      const categoryText = currentProjectText(
        project,
        "category_ar",
        "category_en"
      );

      if (categoryText) {
        const tags = makeElement(
          "div",
          "project-tags"
        );

        tags.appendChild(
          makeElement("span", "", categoryText)
        );

        content.appendChild(tags);
      }

      content.append(title, description);

      const detailsType = String(
        project.details_type || ""
      ).toLowerCase();

      if (detailsType === "modal") {
        const button = makeElement(
          "button",
          "project-link",
          currentDictionary().viewDetails
        );

        button.type = "button";
        button.dataset.projectId = String(project.id);
        button.dataset.projectAction = "details";

        const arrow = makeElement("span", "", "↗");
        arrow.setAttribute("aria-hidden", "true");

        button.appendChild(arrow);
        content.appendChild(button);
      } else {
        const actions = makeProjectActions(project);

        if (actions.childNodes.length) {
          content.appendChild(actions);
        }
      }

      card.append(visual, content);
      projectsGrid.appendChild(card);
    });

    refreshReveal();
  }

  async function loadProjects(forceRetry = false) {
    if (!projectsGrid || projectsLoading) return;

    if (projectsLoaded && !forceRetry) {
      renderProjects();
      return;
    }

    projectsLoading = true;

    showProjectsStatus(
      currentDictionary().projectsLoading
    );

    try {
      const response = await fetch(
        "/api/health?resource=projects",
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Projects request failed: ${response.status}`
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("Invalid response content type.");
      }

      const result = await response.json();

      if (
        !result ||
        result.success !== true ||
        !Array.isArray(result.projects)
      ) {
        throw new Error("Invalid projects response.");
      }

      projectsData = result.projects.filter(project =>
        project &&
        typeof project === "object" &&
        !Array.isArray(project) &&
        project.is_visible !== false
      );

      projectsLoaded = true;

      renderProjects();

    } catch (error) {
      console.error("Projects loading error:", error);

      projectsLoaded = false;

      showProjectsStatus(
        currentDictionary().projectsError,
        true
      );

    } finally {
      projectsLoading = false;
    }
  }

   /* LANGUAGE */

  const languageToggle = $("#languageToggle");
  const themeToggle = $("#themeToggle");

  function translateElement(element, value) {
    if (!element || typeof value !== "string") return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT
    );

    let firstTextNode = null;
    let node;

    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;

      if (!firstTextNode) {
        firstTextNode = node;
      } else {
        node.nodeValue = "";
      }
    }

    if (firstTextNode) {
      firstTextNode.nodeValue = value;
    } else if (!element.children.length) {
      element.textContent = value;
    } else {
      element.insertBefore(
        document.createTextNode(value),
        element.firstChild
      );
    }
  }

  function updateMenuAccessibility() {
    const menuBtn = $("#menuBtn");

    if (!menuBtn) return;

    const isOpen = body.classList.contains("menu-open");
    const dictionary = currentDictionary();

    menuBtn.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    menuBtn.setAttribute(
      "aria-label",
      isOpen
        ? dictionary.closeMenu
        : dictionary.openMenu
    );
  }

  function setLanguage(language) {
    const lang = translations[language]
      ? language
      : "ar";

    const dictionary = translations[lang];

    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";

    $$("[data-i18n]").forEach(element => {
      const key = element.dataset.i18n;

      if (
        Object.prototype.hasOwnProperty.call(
          dictionary,
          key
        )
      ) {
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

      if (label) {
        label.textContent = value;
      }
    });

    const contactText = $(".contact-intro p");

    if (contactText) {
      contactText.textContent = dictionary.contactText;
    }

    if (languageToggle) {
      languageToggle.textContent =
        lang === "ar" ? "EN" : "عربي";

      languageToggle.setAttribute(
        "aria-label",
        dictionary.switchLanguage
      );

      languageToggle.title =
        dictionary.switchLanguage;

      languageToggle.setAttribute(
        "aria-pressed",
        String(lang === "en")
      );
    }

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        dictionary.changeTheme
      );

      themeToggle.title = dictionary.changeTheme;
    }

    updateMenuAccessibility();

    document.title = lang === "ar"
      ? "M.A.S.H CYVEX | مطور ويب وباحث أمن سيبراني"
      : "M.A.S.H CYVEX | Web Developer & Cybersecurity Researcher";

    const description = $(
      'meta[name="description"]'
    );

    if (description) {
      description.content = lang === "ar"
        ? "M.A.S.H CYVEX — مطور واجهات ويب وباحث في الأمن السيبراني. استكشف المشاريع والمهارات والأعمال التقنية."
        : "M.A.S.H CYVEX — Web Developer & Cybersecurity Researcher. Explore projects, skills, and technical work.";
    }

    const ogLocale = $(
      'meta[property="og:locale"]'
    );

    if (ogLocale) {
      ogLocale.content =
        lang === "ar" ? "ar_EG" : "en_US";
    }

    safeStorage.set("mash-language", lang);

    if (projectsLoaded) {
      renderProjects();
    } else if (projectsLoading) {
      showProjectsStatus(
        dictionary.projectsLoading
      );
    } else if (
      projectsGrid &&
      projectsGrid.querySelector("[data-projects-retry]")
    ) {
      showProjectsStatus(
        dictionary.projectsError,
        true
      );
    }
  }

  languageToggle?.addEventListener("click", () => {
    setLanguage(
      html.lang === "ar" ? "en" : "ar"
    );
  });

  /* THEME */

  function setTheme(theme) {
    const selectedTheme =
      theme === "light" ? "light" : "dark";

    html.dataset.theme = selectedTheme;

    if (themeToggle) {
      themeToggle.textContent =
        selectedTheme === "dark" ? "☀️" : "🌙";

      const dictionary = currentDictionary();

      themeToggle.setAttribute(
        "aria-label",
        dictionary.changeTheme
      );

      themeToggle.title = dictionary.changeTheme;

      themeToggle.setAttribute(
        "aria-pressed",
        String(selectedTheme === "light")
      );
    }

    safeStorage.set("mash-theme", selectedTheme);
  }

  themeToggle?.addEventListener("click", () => {
    setTheme(
      html.dataset.theme === "dark"
        ? "light"
        : "dark"
    );
  });

  /* SIDEBAR */

  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

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

    if (
      !target ||
      !target.classList.contains("page")
    ) {
      return;
    }

    pages.forEach(page => {
      page.classList.toggle(
        "active",
        page.id === pageId
      );
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
      const nextUrl = `#${encodeURIComponent(pageId)}`;

      if (window.location.hash !== nextUrl) {
        history.pushState(
          { page: pageId },
          "",
          nextUrl
        );
      }
    }

    closeSidebar();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    refreshReveal();
    animateSkills(target);

    if (pageId === "projects") {
      loadProjects();
    }
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
    let pageId = "";

    try {
      pageId = decodeURIComponent(
        window.location.hash.slice(1)
      );
    } catch {
      pageId = "";
    }

    const validPage = pages.some(
      page => page.id === pageId
    );

    showPage(
      validPage ? pageId : "home",
      false
    );
  }

  window.addEventListener(
    "hashchange",
    handleHashNavigation
  );

  window.addEventListener(
    "popstate",
    handleHashNavigation
  );

   /* MODALS */

  let previousFocus = null;

  function getModals() {
    return $$(".modal");
  }

  function getFocusableElements(container) {
    return $$(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        '[tabindex]:not([tabindex="-1"])'
      ].join(","),
      container
    ).filter(element =>
      element.offsetParent !== null &&
      !element.hasAttribute("hidden")
    );
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (
      !modal ||
      !modal.classList.contains("modal")
    ) {
      return;
    }

    previousFocus = document.activeElement;

    getModals().forEach(item => {
      item.classList.remove("active", "show");
      item.setAttribute("aria-hidden", "true");
    });

    modal.classList.add("show", "active");
    modal.setAttribute("aria-hidden", "false");

    body.classList.add("modal-open");

    const closeButton = $(
      '[data-action="close-modal"]',
      modal
    );

    const firstFocusable =
      getFocusableElements(modal)[0];

    (closeButton || firstFocusable || modal).focus();
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active", "show");
    modal.setAttribute("aria-hidden", "true");

    const anotherOpen = getModals().some(item =>
      item.classList.contains("active") ||
      item.classList.contains("show")
    );

    if (!anotherOpen) {
      body.classList.remove("modal-open");

      if (
        previousFocus &&
        typeof previousFocus.focus === "function" &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      }

      previousFocus = null;
    }
  }

  function closeAllModals() {
    const activeModal = getModals().find(modal =>
      modal.classList.contains("active") ||
      modal.classList.contains("show")
    );

    if (activeModal) {
      closeModal(activeModal);
    }
  }

  /* ACTIONS — EVENT DELEGATION */

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const retryButton = target.closest(
      "[data-projects-retry]"
    );

    if (retryButton) {
      loadProjects(true);
      return;
    }

    const closeButton = target.closest(
      '[data-action="close-modal"]'
    );

    if (closeButton) {
      closeModal(closeButton.closest(".modal"));
      return;
    }

    const projectButton = target.closest(
      '[data-project-action="details"]'
    );

    if (projectButton) {
      const project = projectsData.find(item =>
        String(item.id) ===
        projectButton.dataset.projectId
      );

      if (project) {
        openProjectDetails(project);
      }
    }
  });

  getModals().forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  /* KEYBOARD ACCESSIBILITY */

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
      closeSidebar();
      return;
    }

    if (
      event.key !== "Tab" ||
      !body.classList.contains("modal-open")
    ) {
      return;
    }

    const activeModal = getModals().find(modal =>
      modal.classList.contains("active")
    );

    if (!activeModal) return;

    const focusable =
      getFocusableElements(activeModal);

    if (!focusable.length) {
      event.preventDefault();
      activeModal.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();

    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  });

  /* WHATSAPP APP SELECTION */

  const whatsappFloat = $("#whatsappFloat");
  const whatsappModal = $("#whatsappModal");

  const whatsappAppButtons = $$(
    "[data-whatsapp-app]"
  );

  whatsappFloat?.addEventListener("click", () => {
    openModal("whatsappModal");
  });

  whatsappAppButtons.forEach(button => {
    button.addEventListener("click", () => {
      const app = button.dataset.whatsappApp;

      if (
        app !== "business" &&
        app !== "messenger"
      ) {
        return;
      }

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
      elements.forEach(element => {
        element.classList.add("visible");
      });

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

      const progress = Number(
        skill.dataset.progress
      );

      if (!Number.isFinite(progress)) return;

      const safeProgress = Math.min(
        100,
        Math.max(0, progress)
      );

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

    profileImage.addEventListener(
      "error",
      showFallback
    );

    if (
      profileImage.complete &&
      profileImage.naturalWidth === 0
    ) {
      showFallback();
    }
  }

  /* INITIALIZATION */

  function initialize() {
    const savedLanguage = safeStorage.get(
      "mash-language",
      "ar"
    );

    const savedTheme = safeStorage.get(
      "mash-theme",
      html.dataset.theme || "dark"
    );

    setTheme(savedTheme);
    setLanguage(savedLanguage);

    const initialPage = (() => {
      try {
        return decodeURIComponent(
          window.location.hash.slice(1)
        );
      } catch {
        return "";
      }
    })();

    const pageExists = pages.some(
      page => page.id === initialPage
    );

    const selectedPage = pageExists
      ? initialPage
      : "home";

    showPage(selectedPage, false);

    refreshReveal();
    animateSkills(document);

    if (selectedPage === "projects") {
      loadProjects();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
