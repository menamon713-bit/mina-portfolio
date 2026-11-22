"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  let websiteData = null;

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

  function applyWebsiteData() {
    if (!websiteData) return;

    applyProfile(websiteData.profile);
    renderSkills(websiteData.skills);
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
