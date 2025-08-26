/* ==========================================================
   RouterHaus — Post.js (2025)
   Runs on individual blog post pages
   ========================================================== */

(() => {
  // -------- Utilities --------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.error("Copy failed:", e);
      return false;
    }
  };

  // -------- Code block copy buttons --------
  function enhanceCodeBlocks() {
    $$(".post-body pre code").forEach((block) => {
      const pre = block.parentElement;
      if (pre.querySelector(".copy-btn")) return; // already wired

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost copy-btn";
      btn.textContent = "Copy";

      btn.addEventListener("click", async () => {
        const ok = await copyToClipboard(block.innerText);
        btn.textContent = ok ? "Copied!" : "Error";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });

      const wrapper = document.createElement("div");
      wrapper.className = "code-wrapper";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      wrapper.appendChild(btn);
    });
  }

  // -------- Newsletter form --------
  function wireNewsletter() {
    const form = $("#newsletterForm");
    if (!form) return;
    const input = $("#nlEmail");
    const msg = $("#nlMsg");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = (input.value || "").trim();
      if (!val) {
        msg.textContent = "Please enter an email.";
        return;
      }
      // Stub: send to backend / service
      msg.textContent = "Subscribed! 🎉";
      form.reset();
    });
  }

  // -------- Social share --------
  function wireShare() {
    const container = $(".post-share");
    if (!container) return;

    const url = encodeURIComponent(location.href);
    const title = encodeURIComponent(document.title);

    container.innerHTML = `
      <span>Share:</span>
      <a class="btn ghost" target="_blank" rel="noopener"
         href="https://twitter.com/intent/tweet?url=${url}&text=${title}">Twitter</a>
      <a class="btn ghost" target="_blank" rel="noopener"
         href="https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}">LinkedIn</a>
      <a class="btn ghost" target="_blank" rel="noopener"
         href="mailto:?subject=${title}&body=${url}">Email</a>
    `;
  }

  // -------- Table of Contents highlight --------
  function wireTOC() {
    const headings = $$("article.post-body h2, article.post-body h3");
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (!id) return;
          const link = $(`.toc a[href="#${id}"]`);
          if (link) link.classList.toggle("active", entry.isIntersecting);
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );

    headings.forEach((h) => {
      if (!h.id) h.id = h.textContent.toLowerCase().replace(/\s+/g, "-");
      observer.observe(h);
    });
  }

  // -------- Reveal on scroll --------
  function wireReveal() {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    $$(".post-body > *").forEach((el) => io.observe(el));
  }

  // -------- Init --------
  document.addEventListener("DOMContentLoaded", () => {
    enhanceCodeBlocks();
    wireNewsletter();
    wireShare();
    wireTOC();
    wireReveal();
  });
})();
