/* Reveal on scroll: fades sections in as they enter the screen.
   Sections already on screen at load stay visible, so nothing above the fold is hidden. */
(() => {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.Shopify?.designMode) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px' }
  );

  document.querySelectorAll('#MainContent > .shopify-section, .shopify-section-group-footer-group').forEach((section) => {
    if (section.getBoundingClientRect().top < window.innerHeight) return;
    section.classList.add('reveal');
    observer.observe(section);
  });
})();
