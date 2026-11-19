(function () {
  "use strict";

  const html = document.documentElement;

  // Theme
  const themeToggle = document.getElementById("themeToggle");

  function setTheme(theme) {
    html.setAttribute("data-theme", theme);
    if (themeToggle) {
      themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
    }
    try {
      localStorage.setItem("theme", theme);
    } catch (_) {}
  }

  try {
    setTheme(localStorage.getItem("theme") || "dark");
  } catch (_) {
    setTheme("dark");
  }

  themeToggle?.addEventListener("click", function () {
    setTheme(
      html.getAttribute("data-theme") === "light" ? "dark" : "light"
    );
  });

  // Intro animation
  const intro = document.getElementById("intro");
  const introName = document.getElementById("introName");

  if (intro && introName) {
    "M.A.S.H".split("").forEach((letter, index) => {
      const span = document.createElement("span");
      span.className = "intro-letter";
      span.textContent = letter;
      span.style.animationDelay = `${0.4 + index * 0.12}s`;
      introName.appendChild(span);
    });

    window.setTimeout(() => {
      intro.classList.add("hide");
      window.setTimeout(() => {
        intro.style.display = "none";
      }, 1000);
    }, 4500);
  }

  // Mobile sidebar
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
    menuBtn?.setAttribute("aria-expanded", "false");
  }

  menuBtn?.addEventListener("click", () => {
    const opened = sidebar?.classList.toggle("open");
    overlay?.classList.toggle("show", Boolean(opened));
    menuBtn.setAttribute("aria-expanded", String(Boolean(opened)));
  });

  overlay?.addEventListener("click", closeSidebar);

  // Navigation
  const allowedPages = ["home", "about", "skills", "projects", "contact"];
  const navButtons = document.querySelectorAll(".nav-btn");

  function showPage(pageId) {
    if (!allowedPages.includes(pageId)) return;

    const target = document.getElementById(`page-${pageId}`);
    if (!target) return;

    document.querySelectorAll(".page").forEach(page => {
      page.classList.remove("active");
    });

    target.classList.add("active");

    navButtons.forEach(button => {
      const active = button.dataset.page === pageId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "skills") {
      target.querySelectorAll(".skill-bar-fill").forEach((bar, index) => {
        bar.style.transform = "scaleX(0)";
        window.setTimeout(() => {
          bar.style.transform = "scaleX(1)";
        }, 100 + index * 100);
      });
    }
  }

  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  // Contact information
  const CONTACT = Object.freeze({
    email: "minadeveloper43@gmail.com",
    phone: "+201554416094",
    whatsapp: "201554416094"
  });

  let lastContactAction = 0;

  function allowContact() {
    const now = Date.now();
    if (now - lastContactAction < 1500) return false;
    lastContactAction = now;
    return true;
  }

  function handleWhatsApp() {
    if (!allowContact()) return;

    const message = encodeURIComponent(
      "السلام عليكم، عايز أتكلم معاك في مشروع"
    );

    const url = `https://wa.me/${CONTACT.whatsapp}?text=${message}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handlePhone() {
    if (!allowContact()) return;
    window.location.href = `tel:${CONTACT.phone}`;
  }

  function handleEmail() {
    if (!allowContact()) return;
    window.location.href = `mailto:${CONTACT.email}`;
  }

  // Modals
  function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.toggle("show", show);
  }

  const actions = {
    "open-report": () => toggleModal("reportModal", true),
    "close-report": () => toggleModal("reportModal", false),
    "open-recon": () => toggleModal("reconModal", true),
    "close-recon": () => toggleModal("reconModal", false),
    whatsapp: handleWhatsApp,
    phone: handlePhone,
    email: handleEmail
  };

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = actions[button.dataset.action];
    if (typeof action === "function") action();
  });

  ["reportModal", "reconModal"].forEach(id => {
    const modal = document.getElementById(id);
    modal?.addEventListener("click", event => {
      if (event.target === modal) toggleModal(id, false);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      toggleModal("reportModal", false);
      toggleModal("reconModal", false);
      closeSidebar();
    }
  });

  // Reveal animations
  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px"
    });

    revealElements.forEach(element => observer.observe(element));
  } else {
    revealElements.forEach(element => {
      element.classList.add("visible");
    });
  }

  // Image fallback
  document.querySelectorAll("img[data-fallback]").forEach(img => {
    function fallback() {
      if (img.dataset.fallback === "initials") {
        img.style.display = "none";
        if (img.parentElement) {
          img.parentElement.textContent = "M.A.S.H";
        }
      } else {
        img.style.display = "none";
      }
    }

    img.addEventListener("error", fallback);

    if (img.complete && img.naturalWidth === 0) {
      fallback();
    }
  });

})();
