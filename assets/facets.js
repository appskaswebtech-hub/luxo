/* Filters: applies instantly or with the Apply button, then refreshes the results
   in place through the Section Rendering API and keeps the URL in sync. */

const facetsCache = new Map();

async function renderFacets(sectionId, url, { push = true } = {}) {
  const target = new URL(url, window.location.origin);
  const requestUrl = new URL(target);
  requestUrl.searchParams.set('section_id', sectionId);

  const updates = document.querySelectorAll('[data-facets-update]');
  updates.forEach((element) => element.setAttribute('aria-busy', 'true'));

  try {
    let html = facetsCache.get(requestUrl.toString());
    if (!html) {
      const response = await fetch(requestUrl);
      if (!response.ok) throw new Error(`Filtering failed with status ${response.status}`);
      html = await response.text();
      facetsCache.set(requestUrl.toString(), html);
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const focusedId = document.activeElement?.id;

    document.querySelectorAll('[data-facets-update]').forEach((element) => {
      const key = element.dataset.facetsUpdate;
      const fresh = doc.querySelector(`[data-facets-update="${CSS.escape(key)}"]`);
      if (!fresh) return;
      /* Keep groups the customer opened or closed as they were */
      element.querySelectorAll('details[id]').forEach((details) => {
        const twin = fresh.querySelector(`details[id="${CSS.escape(details.id)}"]`);
        if (twin) twin.open = details.open;
      });
      element.replaceWith(fresh);
    });

    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
    if (push) window.history.pushState({ facets: sectionId }, '', target.pathname + target.search);

    const status = document.querySelector('[data-facets-status]');
    const count = doc.querySelector('[data-facets-count]')?.dataset.facetsCount;
    if (status && count) status.textContent = count;
  } catch (error) {
    console.error(error);
    window.location.href = target.toString();
  } finally {
    document.querySelectorAll('[data-facets-update]').forEach((element) => element.removeAttribute('aria-busy'));
  }
}

window.addEventListener('popstate', (event) => {
  if (event.state?.facets) renderFacets(event.state.facets, window.location.href, { push: false });
});

if (!customElements.get('facets-form')) {
  customElements.define(
    'facets-form',
    class FacetsForm extends HTMLElement {
      connectedCallback() {
        this.form = this.querySelector('form');
        if (!this.form) return;
        this.instant = this.dataset.apply === 'instant';

        this.onChange = (event) => {
          if (!this.instant && event.target.name !== 'sort_by') return;
          clearTimeout(this.timer);
          const delay = event.target.type === 'number' || event.target.type === 'range' ? 700 : 0;
          this.timer = setTimeout(() => this.apply(), delay);
        };

        this.onSubmit = (event) => {
          event.preventDefault();
          this.apply();
        };

        this.onLinkClick = (event) => {
          const link = event.target.closest('[data-facets-link]');
          if (!link) return;
          event.preventDefault();
          renderFacets(this.dataset.section, link.href);
        };

        this.form.addEventListener('change', this.onChange);
        this.form.addEventListener('submit', this.onSubmit);
        this.addEventListener('click', this.onLinkClick);

        /* Fields outside the form that join it, such as a toolbar sort dropdown */
        this.linked = [...document.querySelectorAll(`[form="${this.form.id}"]`)];
        this.linked.forEach((field) => field.addEventListener('change', this.onChange));
      }

      disconnectedCallback() {
        this.form?.removeEventListener('change', this.onChange);
        this.form?.removeEventListener('submit', this.onSubmit);
        this.removeEventListener('click', this.onLinkClick);
        this.linked?.forEach((field) => field.removeEventListener('change', this.onChange));
      }

      apply() {
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(this.form)) {
          if (value !== '') params.append(key, value);
        }
        const action = new URL(this.form.action, window.location.origin);
        renderFacets(this.dataset.section, `${action.pathname}?${params.toString()}`);
      }
    }
  );
}

/* Two-handle price slider that stays in sync with the min and max fields */
if (!customElements.get('price-range')) {
  customElements.define(
    'price-range',
    class PriceRange extends HTMLElement {
      connectedCallback() {
        this.max = Number(this.dataset.max) || 0;
        this.rangeMin = this.querySelector('[data-range-min]');
        this.rangeMax = this.querySelector('[data-range-max]');
        this.fieldMin = this.querySelector('[data-price-min]');
        this.fieldMax = this.querySelector('[data-price-max]');
        this.fill = this.querySelector('[data-range-fill]');

        this.rangeMin.addEventListener('input', () => this.fromSlider('min'));
        this.rangeMax.addEventListener('input', () => this.fromSlider('max'));
        this.fieldMin.addEventListener('input', () => this.fromField());
        this.fieldMax.addEventListener('input', () => this.fromField());
        this.paint();
      }

      fromSlider(handle) {
        let low = Number(this.rangeMin.value);
        let high = Number(this.rangeMax.value);
        if (low > high) {
          if (handle === 'min') low = high;
          else high = low;
          this.rangeMin.value = low;
          this.rangeMax.value = high;
        }
        this.fieldMin.value = low > 0 ? low : '';
        this.fieldMax.value = high < this.max ? high : '';
        this.paint();
        /* Let the form react once the handle is released or moved by keyboard */
        this.fieldMax.dispatchEvent(new Event('change', { bubbles: true }));
      }

      fromField() {
        this.rangeMin.value = this.fieldMin.value || 0;
        this.rangeMax.value = this.fieldMax.value || this.max;
        this.paint();
      }

      paint() {
        if (!this.max) return;
        const low = (Number(this.rangeMin.value) / this.max) * 100;
        const high = (Number(this.rangeMax.value) / this.max) * 100;
        this.fill.style.left = `${low}%`;
        this.fill.style.right = `${100 - high}%`;
      }
    }
  );
}
