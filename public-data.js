"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  let websiteData = null;

  const SOCIAL_PLATFORMS = {
    github: {
      label: "GitHub",
      paths: [
        "M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.71c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.15-4.56-5.1 0-1.13.39-2.05 1.03-2.78-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.06a9.3 9.3 0 0 1 5 0c1.91-1.34 2.75-1.06 2.75-1.06.55 1.43.2 2.49.1 2.75.64.73 1.03 1.65 1.03 2.78 0 3.96-2.34 4.83-4.57 5.09.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      ]
    },

    gmail: {
      label: "Gmail",
      paths: [
        "M3 5.5 12 12l9-6.5",
        "M3 5.5v13h18v-13",
        "M3 5.5 12 12l9-6.5"
      ]
    },

    facebook: {
      label: "Facebook",
      paths: [
        "M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4v2H7v3.1h2.9v8h3.6Z"
      ]
    },

    tiktok: {
      label: "TikTok",
      paths: [
        "M19.6 7.1a5.4 5.4 0 0 1-3.3-1.1v7.4a6.1 6.1 0 1 1-6.1-6.1c.4 0 .8 0 1.2.1v3.4a2.8 2.8 0 1 0 1.9 2.7V2h3.3a5.4 5.4 0 0 0 3 4.1v1Z"
      ]
    }
  };

  function currentLanguage() {
    return document.documentElement.lang === "en" ? "en" : "ar";
  }

  function textValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getLocalizedAbout(value, language) {
    const content = textValue(value);

    if (!content) return "";

    const match = content.match(
      /\[AR\]\s*([\s\S]*?)\s*\[EN\]\s*([\s\S]*)$/i
    );

    if (!match) return content;

    const arabic = textValue(match[1]);
    const english = textValue(match[2]);

    return language === "en"
      ? english || arabic
      : arabic || english;
  }

  function applyProfile(profile) {
    if (!profile) return;

    const name = textValue(profile.full_name);
    const role = textValue(profile.job_title);
    const bio = textValue(profile.short_bio);
    const about = getLocalizedAbout(
      profile.about,
      currentLanguage()
    );

    if (name) {
      const element = $(".profile-name");
      if (element) element.textContent = name;
    }

    if (role) {
      const element = $(".profile-role");
      if (element) element.textContent = role;
    }

    if (bio) {
      const element = $(".hero-description");
      if (element) element.textContent = bio;
    }

    if (about) {
      const element = $(".about-main p");
      if (element) element.textContent = about;
    }
  }

  function animateSkillBars(container) {
    const bars = container.querySelectorAll(".skill-progress");

    bars.forEach((bar) => {
      const progress = Number(bar.dataset.progress);

      if (!Number.isFinite(progress)) return;

      bar.style.width = "0%";

      requestAnimationFrame(() => {
        bar.style.width = `${progress}%`;
      });
    });
  }

  function renderSkills(skills) {
    const container = $(".skills-grid");

    if (
      !container ||
      !Array.isArray(skills) ||
      skills.length === 0
    ) {
      return;
    }

    const language = currentLanguage();
    const fragment = document.createDocumentFragment();

    skills.forEach((skill) => {
      if (!skill || typeof skill !== "object") return;

      const name =
        textValue(language === "ar" ? skill.name_ar : skill.name_en) ||
        textValue(skill.name_en) ||
        textValue(skill.name_ar);

      if (!name) return;

      const progress = Number(skill.progress);

      const safeProgress = Number.isFinite(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0;

      const card = document.createElement("article");
      card.className = "skill-card reveal";

      const top = document.createElement("div");
      top.className = "skill-top";

      const icon = document.createElement("span");
      icon.className = "skill-icon";
      icon.textContent = textValue(skill.icon) || "⌘";

      const title = document.createElement("span");
      title.className = "skill-name";
      title.textContent = name;

      top.append(icon, title);

      const track = document.createElement("div");
      track.className = "skill-track";

      const bar = document.createElement("span");
      bar.className = "skill-progress";
      bar.dataset.progress = String(safeProgress);

      track.appendChild(bar);
      card.append(top, track);

      fragment.appendChild(card);
    });

    if (!fragment.childNodes.length) return;

    container.replaceChildren(fragment);

    animateSkillBars(container);

    if (typeof window.refreshReveal === "function") {
      window.refreshReveal();
    }
  }

  function createSocialIcon(platform) {
    const config = SOCIAL_PLATFORMS[platform];

    if (!config) return null;

    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    config.paths.forEach((pathData) => {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      path.setAttribute("d", pathData);

      if (platform === "gmail") {
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
      } else {
        path.setAttribute("fill", "currentColor");
      }

      svg.appendChild(path);
    });

    return svg;
  }

  function safeSocialUrl(value, platform) {
    const rawUrl = textValue(value);

    if (!rawUrl || rawUrl.length > 2048) return "";

    // Gmail يسمح برابط mailto فقط.
    if (platform === "gmail") {
      if (!rawUrl.toLowerCase().startsWith("mailto:")) {
        return "";
      }

      const email = rawUrl.slice(7).split("?")[0].trim();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return "";
      }

      return `mailto:${email}`;
    }

    // باقي المنصات تسمح بروابط HTTPS فقط.
    try {
      const parsed = new URL(rawUrl);

      if (parsed.protocol !== "https:") return "";

      return parsed.href;
    } catch {
      return "";
    }
  }

  function renderSocialLinks(socialLinks) {
    const container = $("#contactSocialLinks");

    if (!container) return;

    const fragment = document.createDocumentFragment();

    if (Array.isArray(socialLinks)) {
      socialLinks.forEach((item) => {
        if (!item || typeof item !== "object") return;

        const platform = textValue(item.platform).toLowerCase();
        const config = SOCIAL_PLATFORMS[platform];

        if (!config) return;

        const url = safeSocialUrl(item.url, platform);

        if (!url) return;

        const link = document.createElement("a");

        link.className = `contact-social-link contact-social-${platform}`;
        link.href = url;

        if (platform !== "gmail") {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }

        link.setAttribute(
          "aria-label",
          `Open ${config.label}`
        );
        link.title = config.label;

        const icon = createSocialIcon(platform);

        if (!icon) return;

        link.appendChild(icon);
        fragment.appendChild(link);
      });
    }

    container.replaceChildren(fragment);
  }

  function applyWebsiteData() {
    if (!websiteData) return;

    applyProfile(websiteData.profile);
    renderSkills(websiteData.skills);
    renderSocialLinks(websiteData.socialLinks);
  }

  async function loadWebsiteData() {
    try {
      const response = await fetch(
        "/api/health?resource=site-data",
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Website data request failed: ${response.status}`
        );
      }

      const result = await response.json();

      if (
        !result ||
        result.success !== true ||
        !result.data ||
        typeof result.data !== "object"
      ) {
        throw new Error("Invalid website data response.");
      }

      websiteData = result.data;
      applyWebsiteData();

    } catch (error) {
      console.error("Website data loading error:", error);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    loadWebsiteData,
    { once: true }
  );

  const languageButton = $("#languageToggle");

  languageButton?.addEventListener("click", () => {
    requestAnimationFrame(applyWebsiteData);
  });
})();
