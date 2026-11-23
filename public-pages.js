"use strict";

(() => {
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const SITE_NAME = "M.A.S.H CYVEX";
  const MAX_CONTENT_LENGTH = 30000;
  const SLUG_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

  let pages = [];
  let seoEntries = [];
  let currentSlug = "";
  let loaded = false;

  const language = () =>
    document.documentElement.lang === "en" ? "en" : "ar";

  const safeText = (value) =>
    typeof value === "string" ? value.trim() : "";

  function getPageTitle(page, lang = language()) {
    return (
      safeText(lang === "en" ? page.title_en : page.title_ar) ||
      safeText(page.title_en) ||
      safeText(page.title_ar) ||
      page.slug
    );
  }

  function getPageContent(page, lang = language()) {
    return (
      safeText(lang === "en" ? page.content_en : page.content_ar) ||
      safeText(page.content_en) ||
      safeText(page.content_ar)
    );
  }

  function getSeo(slug) {
    return seoEntries.find(
      item => item && item.page_slug === slug
    ) || null;
  }

  function setMeta(selector, attribute, value) {
    if (!value) return;

    let element = $(selector);

    if (!element) {
      const match = selector.match(
        /meta\[(name|property)="([^"]+)"\]/
      );

      if (!match) return;

      element = document.createElement("meta");
      element.setAttribute(match[1], match[2]);
      document.head.appendChild(element);
    }

    element.setAttribute(attribute, value);
  }

  function updateSeo(page) {
    const lang = language();
    const seo = getSeo(page.slug);

    const title =
      safeText(seo && (lang === "en" ? seo.title_en : seo.title_ar)) ||
      getPageTitle(page, lang);

    const description =
      safeText(
        seo && (lang === "en"
          ? seo.description_en
          : seo.description_ar)
      ) ||
      getPageContent(page, lang)
        .replace(/[#*_\[\]()>`]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 155);

    const keywords = safeText(
      seo && (lang === "en" ? seo.keywords_en : seo.keywords_ar)
    );

    document.title = `${title} | ${SITE_NAME}`;

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[name="keywords"]', "content", keywords);

    setMeta('meta[property="og:type"]', "content", "article");
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:site_name"]', "content", SITE_NAME);
    setMeta('meta[property="og:url"]', "content", location.href);

    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);

    const canonical = $("link[rel='canonical']");

    if (canonical) {
      let canonicalUrl = location.href;
      const supplied = safeText(seo && seo.canonical_url);

      if (supplied) {
        try {
          const parsed = new URL(supplied);

          if (parsed.protocol === "https:") {
            canonicalUrl = parsed.href;
          }
        } catch {
          // Ignore invalid canonical URLs.
        }
      }

      canonical.href = canonicalUrl;
    }

    const suppliedImage = safeText(seo && seo.og_image);

    if (suppliedImage) {
      try {
        const parsed = new URL(suppliedImage);

        if (parsed.protocol === "https:") {
          setMeta(
            'meta[property="og:image"]',
            "content",
            parsed.href
          );
        }
      } catch {
        // Ignore invalid image URLs.
      }
    }
  }

  function appendInlineText(parent, value) {
    const pattern =
      /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parent.appendChild(
          document.createTextNode(
            value.slice(lastIndex, match.index)
          )
        );
      }

      const token = match[0];

      if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else if (token.startsWith("*")) {
        const italic = document.createElement("em");
        italic.textContent = token.slice(1, -1);
        parent.appendChild(italic);
      } else {
        const linkMatch = token.match(
          /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/
        );

        if (linkMatch) {
          try {
            const url = new URL(linkMatch[2]);

            if (url.protocol === "https:") {
              const link = document.createElement("a");
              link.href = url.href;
              link.textContent = linkMatch[1];
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              parent.appendChild(link);
            }
          } catch {
            parent.appendChild(
              document.createTextNode(linkMatch[1])
            );
          }
        }
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < value.length) {
      parent.appendChild(
        document.createTextNode(value.slice(lastIndex))
      );
    }
  }

  function renderMarkdown(container, rawContent) {
    const content = safeText(rawContent).slice(
      0,
      MAX_CONTENT_LENGTH
    );

    const lines = content.replace(/\r/g, "").split("\n");

    let paragraph = [];
    let list = null;
    let listType = "";

    function flushParagraph() {
      if (!paragraph.length) return;

      const element = document.createElement("p");
      appendInlineText(element, paragraph.join(" "));
      container.appendChild(element);
      paragraph = [];
    }

    function flushList() {
      if (!list) return;

      container.appendChild(list);
      list = null;
      listType = "";
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);

      if (heading) {
        flushParagraph();
        flushList();

        const element = document.createElement(
          `h${heading[1].length + 1}`
        );

        appendInlineText(element, heading[2]);
        container.appendChild(element);
        continue;
      }

      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);

      if (unordered || ordered) {
        flushParagraph();

        const type = ordered ? "ol" : "ul";

        if (!list || listType !== type) {
          flushList();
          list = document.createElement(type);
          listType = type;
        }

        const item = document.createElement("li");

        appendInlineText(
          item,
          (unordered || ordered)[1]
        );

        list.appendChild(item);
        continue;
      }

      if (line.startsWith(">")) {
        flushParagraph();
        flushList();

        const quote = document.createElement("blockquote");

        appendInlineText(
          quote,
          line.replace(/^>\s?/, "")
        );

        container.appendChild(quote);
        continue;
      }

      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
  }

  function createFooterLinks() {
    const container = $("#publicPageLinks");

    if (!container) return;

    const lang = language();
    const fragment = document.createDocumentFragment();

    pages.forEach(page => {
      if (!page || !SLUG_PATTERN.test(page.slug || "")) {
        return;
      }

      const link = document.createElement("a");
      link.href = `/${encodeURIComponent(page.slug)}`;
      link.textContent = getPageTitle(page, lang);
      link.className = "public-page-link";

      fragment.appendChild(link);
    });

    container.replaceChildren(fragment);
    container.dir = lang === "ar" ? "rtl" : "ltr";
  }

  function createHomeLink() {
    const link = document.createElement("a");

    link.href = "/";
    link.className = "public-page-home-link";
    link.textContent =
      language() === "ar"
        ? "العودة للرئيسية"
        : "Back to Home";

    return link;
  }

  function showMessage(title, message) {
    const root = $("#publicPageView");
    const main = $("#mainContent");

    if (!root || !main) return;

    main.hidden = true;
    root.hidden = false;
    root.replaceChildren();

    const wrapper = document.createElement("section");
    wrapper.className = "public-page-container";

    const heading = document.createElement("h1");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    wrapper.append(heading, paragraph, createHomeLink());
    root.appendChild(wrapper);
  }

  function renderCurrentPage() {
    const root = $("#publicPageView");
    const main = $("#mainContent");

    if (!root || !main || !currentSlug) return;

    const page = pages.find(
      item => item.slug === currentSlug
    );

    if (!page) {
      showMessage(
        language() === "ar"
          ? "الصفحة غير موجودة"
          : "Page Not Found",
        language() === "ar"
          ? "الصفحة غير متاحة أو لم يتم نشرها."
          : "This page is unavailable or has not been published."
      );

      document.title =
        language() === "ar"
          ? `الصفحة غير موجودة | ${SITE_NAME}`
          : `Page Not Found | ${SITE_NAME}`;

      return;
    }

    main.hidden = true;
    root.hidden = false;
    root.replaceChildren();

    const lang = language();
    root.dir = lang === "ar" ? "rtl" : "ltr";

    const wrapper = document.createElement("article");
    wrapper.className = "public-page-container";

    const top = document.createElement("div");
    top.className = "public-page-top";

    const brand = document.createElement("a");
    brand.href = "/";
    brand.className = "public-page-brand";
    brand.textContent = SITE_NAME;

    top.appendChild(brand);

    const title = document.createElement("h1");
    title.className = "public-page-title";
    title.textContent = getPageTitle(page, lang);

    const content = document.createElement("div");
    content.className = "public-page-content";

    renderMarkdown(content, getPageContent(page, lang));

    const bottom = document.createElement("div");
    bottom.className = "public-page-bottom";
    bottom.appendChild(createHomeLink());

    const footer = document.createElement("footer");
    footer.className = "public-page-footer";

    const copyright = document.createElement("p");
    copyright.textContent =
      `© ${new Date().getFullYear()} ${SITE_NAME}`;

    const links = document.createElement("nav");
    links.className = "public-page-footer-links";
    links.setAttribute(
      "aria-label",
      lang === "ar" ? "صفحات الموقع" : "Website pages"
    );

    pages.forEach(item => {
      const link = document.createElement("a");
      link.href = `/${encodeURIComponent(item.slug)}`;
      link.textContent = getPageTitle(item, lang);
      links.appendChild(link);
    });

    footer.append(copyright, links);
    wrapper.append(top, title, content, bottom, footer);
    root.appendChild(wrapper);

    updateSeo(page);
  }

  function getCurrentSlug() {
    let path;

    try {
      path = decodeURIComponent(location.pathname);
    } catch {
      return "";
    }

    path = path.replace(/\/+$/, "");

    if (!path || path === "/index.html") {
      return "";
    }

    const match = path.match(/^\/([^/]+)$/);

    if (!match || !SLUG_PATTERN.test(match[1])) {
      return "";
    }

    return match[1];
  }

  async function loadPublicPages() {
    const root = $("#publicPageView");
    const main = $("#mainContent");

    if (!root || !main || loaded) return;

    currentSlug = getCurrentSlug();

    try {
      const response = await fetch(
        "/api/health?resource=site-data",
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          credentials: "same-origin",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error("Public pages request failed.");
      }

      const result = await response.json();

      if (
        !result ||
        result.success !== true ||
        !result.data ||
        !Array.isArray(result.data.pages)
      ) {
        throw new Error("Invalid public pages response.");
      }

      pages = result.data.pages.filter(page =>
        page &&
        typeof page === "object" &&
        SLUG_PATTERN.test(page.slug || "")
      );

      seoEntries = Array.isArray(result.data.seo)
        ? result.data.seo
        : [];

      loaded = true;

      // Links are loaded on the home page too.
      createFooterLinks();

      if (currentSlug) {
        renderCurrentPage();
      } else {
        root.hidden = true;
        main.hidden = false;
      }
    } catch (error) {
      console.error("Public pages error:", error);

      if (currentSlug) {
        showMessage(
          language() === "ar"
            ? "تعذر تحميل الصفحة"
            : "Unable to Load Page",
          language() === "ar"
            ? "حدث خطأ أثناء تحميل المحتوى. حاول مرة أخرى لاحقًا."
            : "An error occurred while loading this content. Please try again later."
        );
      }
    }
  }

  function refreshLanguageContent() {
    requestAnimationFrame(() => {
      createFooterLinks();

      if (currentSlug && loaded) {
        renderCurrentPage();
      }
    });
  }

  document.addEventListener(
    "DOMContentLoaded",
    loadPublicPages,
    { once: true }
  );

  $("#languageToggle")?.addEventListener(
    "click",
    refreshLanguageContent
  );
})();
