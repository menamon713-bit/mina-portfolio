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

  function applyProfile(profile) {
    if (!profile) return;

    const name = textValue(profile.full_name);
    const role = textValue(profile.job_title);
    const bio = textValue(profile.short_bio);
    const about = textValue(profile.about);

    if (name) {
      const nameElement = $(".profile-name");
      if (nameElement) nameElement.textContent = name;
    }

    if (role) {
      const roleElement = $(".profile-role");
      if (roleElement) roleElement.textContent = role;
    }

    if (bio) {
      const bioElement = $(".hero-description");
      if (bioElement) bioElement.textContent = bio;
    }

    if (about) {
      const aboutElement = $(".about-main p");
      if (aboutElement) aboutElement.textContent = about;
    }
  }

  function renderSkills(skills) {
    const container = $(".skills-grid");

    if (!container || !Array.isArray(skills) || !skills.length) {
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
      card.className = "skill-card";

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
      bar.style.width = `${safeProgress}%`;

      track.appendChild(bar);
      card.append(top, track);

      fragment.appendChild(card);
    });

    if (fragment.childNodes.length) {
      container.replaceChildren(fragment);
    }
  }

  function applyWebsiteData() {
    if (!websiteData) return;

    applyProfile(websiteData.profile);
    renderSkills(websiteData.skills);
  }

  async function loadWebsiteData() {
    try {
      const response = await fetch("/api/health?resource=site-data", {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error(`Website data request failed: ${response.status}`);
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

  document.addEventListener("DOMContentLoaded", loadWebsiteData, {
    once: true
  });

  const languageButton = $("#languageToggle");

  languageButton?.addEventListener("click", () => {
    requestAnimationFrame(applyWebsiteData);
  });
})();
