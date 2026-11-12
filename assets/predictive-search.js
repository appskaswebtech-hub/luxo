if (!customElements.get('predictive-search')) {
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.typeSelect = this.querySelector('select[name="type"]');
      this.results = this.querySelector('[data-predictive-results]');
      this.status = this.querySelector('[data-predictive-status]');
      this.clearButton = this.querySelector('[data-predictive-clear]');
      this.cache = new Map();
      this.selected = null;

      this.input.addEventListener('input', () => {
        this.toggleClear();
        this.queue();
      });
      this.input.addEventListener('keydown', (event) => this.onKeydown(event));
      this.input.addEventListener('focus', () => {
        if (this.term() && this.results.childElementCount) this.open();
      });
      this.typeSelect?.addEventListener('change', () => this.queue(0));
      this.clearButton?.addEventListener('click', () => this.clear());
      this.toggleClear();
      this.results.addEventListener('mousedown', (event) => event.preventDefault());
      this.addEventListener('focusout', (event) => {
        if (!this.contains(event.relatedTarget)) this.close();
      });
    }

    toggleClear() {
      if (this.clearButton) this.clearButton.hidden = !this.input.value;
    }

    clear() {
      this.input.value = '';
      this.toggleClear();
      this.search();
      this.input.focus();
    }

    term() {
      return this.input.value.trim();
    }

    queue(delay = 300) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.search(), delay);
    }

    async search() {
      const term = this.term();
      this.controller?.abort();

      if (!term) {
        this.results.innerHTML = '';
        this.status.textContent = '';
        this.close();
        return;
      }

      const types = this.typeSelect?.value || 'query,collection,product,article,page';
      const key = `${types}|${term.toLowerCase()}`;
      if (this.cache.has(key)) {
        this.render(this.cache.get(key));
        return;
      }

      const params = new URLSearchParams({
        q: term,
        section_id: 'predictive-search',
        'resources[type]': types,
        'resources[limit]': '4',
        'resources[options][unavailable_products]': 'last',
      });

      this.controller = new AbortController();
      this.setAttribute('loading', '');

      try {
        const response = await fetch(`${this.dataset.url}?${params}`, { signal: this.controller.signal });
        if (!response.ok) throw new Error(`Predictive search failed with status ${response.status}`);

        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = doc.querySelector('[data-predictive-content]');
        const html = content ? content.outerHTML : '';

        this.cache.set(key, html);
        this.render(html);
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        this.close();
      } finally {
        this.removeAttribute('loading');
      }
    }

    render(html) {
      this.results.innerHTML = html;
      this.scopeIds();
      this.select(null);
      this.status.textContent = this.results.firstElementChild?.dataset.status || '';
      if (html && this.input === document.activeElement) this.open();
    }

    /* Keeps ids unique when the header and the search page both show results */
    scopeIds() {
      const prefix = this.results.id;
      this.results.querySelectorAll('[id]').forEach((element) => {
        element.id = `${prefix}-${element.id}`;
      });
      this.results.querySelectorAll('[aria-labelledby]').forEach((element) => {
        element.setAttribute('aria-labelledby', `${prefix}-${element.getAttribute('aria-labelledby')}`);
      });
    }

    open() {
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }

    close() {
      this.results.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.select(null);
    }

    select(option) {
      this.selected?.setAttribute('aria-selected', 'false');
      this.selected = option;

      if (!option) {
        this.input.removeAttribute('aria-activedescendant');
        return;
      }

      option.setAttribute('aria-selected', 'true');
      option.scrollIntoView({ block: 'nearest' });
      this.input.setAttribute('aria-activedescendant', option.id);
    }

    move(step) {
      const options = [...this.results.querySelectorAll('[role="option"]')];
      if (!options.length) return;

      const index = options.indexOf(this.selected) + step;
      const next = index < 0 ? options.length - 1 : index % options.length;
      this.select(options[next]);
    }

    onKeydown(event) {
      if (event.key === 'Escape') {
        if (this.results.hidden) return;
        event.preventDefault();
        this.close();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (this.results.hidden) return;
        event.preventDefault();
        this.move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      if (event.key === 'Enter' && this.selected) {
        const link = this.selected.querySelector('a');
        if (!link) return;
        event.preventDefault();
        link.click();
      }
    }
  }

  customElements.define('predictive-search', PredictiveSearch);
}
