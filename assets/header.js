(function () {
  'use strict';

  var SELECTOR = '[data-header-main]';

  function initHeader(root) {
    if (!root || root.dataset.headerInitialized === 'true') return;
    root.dataset.headerInitialized = 'true';

    var burger  = root.querySelector('#HeaderBurger');
    var drawer  = root.querySelector('#HeaderMobile');
    var overlay = root.querySelector('#HeaderOverlay');
    var closeBtn = root.querySelector('#HeaderClose');

    function openDrawer() {
      drawer.classList.add('is-open');
      overlay.classList.add('is-active');
      burger.classList.add('is-active');
      burger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-active');
      burger.classList.remove('is-active');
      burger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (burger)   burger.addEventListener('click', function () {
      drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay)  overlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    root.querySelectorAll('[data-header-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sub = btn.nextElementSibling;
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (sub) sub.classList.toggle('is-open', !isOpen);
      });
    });

    var isSticky = root.classList.contains('header-wrapper--sticky');
    var hideScroll = root.classList.contains('header-wrapper--hide-scroll');
    if (isSticky) {
      var lastY = 0;
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          if (hideScroll) {
            if (y > 120 && y > lastY) {
              root.classList.add('is-hidden');
            } else if (y < lastY) {
              root.classList.remove('is-hidden');
            }
          }
          if (y > 20) {
            root.style.boxShadow = '0 12px 34px rgba(43,30,22,.15)';
          } else {
            root.style.boxShadow = '';
          }
          lastY = y;
          ticking = false;
        });
      }, { passive: true });
    }

    root.querySelectorAll('.header-mega-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (window.innerWidth <= 991) {
          var parent = link.parentElement;
          var panel = parent.querySelector('.header-mega-panel');
          if (panel) {
            e.preventDefault();
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
          }
        }
      });
    });

    var adjustMegaPanel = function () {
      root.querySelectorAll('.header-mega-panel').forEach(function (panel) {
        var list = panel.parentElement.parentElement;
        var rect = list.getBoundingClientRect();
        var vw = window.innerWidth;
        if (rect.left + panel.offsetWidth > vw - 20) {
          panel.style.left = 'auto';
          panel.style.right = '100%';
          panel.style.borderRadius = '14px 0 14px 14px';
        } else {
          panel.style.left = '100%';
          panel.style.right = 'auto';
          panel.style.borderRadius = '0 14px 14px 14px';
        }
      });
    };
    adjustMegaPanel();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(adjustMegaPanel, 150);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.header-cart-wrap')) {
        root.querySelectorAll('.header-mini-cart').forEach(function (mc) {
          mc.style.opacity = '';
          mc.style.visibility = '';
        });
      }
    });
  }

  function initAll() {
    document.querySelectorAll(SELECTOR).forEach(initHeader);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector(SELECTOR);
    if (section) {
      section.dataset.headerInitialized = 'false';
      initHeader(section);
    }
  });
})();