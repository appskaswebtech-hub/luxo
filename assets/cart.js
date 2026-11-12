/* Header cart count and total */
function syncCartIcons(sections = {}) {
  const parser = new DOMParser();

  for (const html of Object.values(sections)) {
    if (!html) continue;

    const source = parser.parseFromString(html, 'text/html').querySelector('cart-items[data-cart-count-value]');
    if (!source) continue;

    const count = Number(source.dataset.cartCountValue);
    document.querySelectorAll('[data-cart-count]').forEach((element) => {
      element.textContent = count;
      element.hidden = count === 0;
    });
    document.querySelectorAll('[data-cart-total]').forEach((element) => {
      element.textContent = source.dataset.cartTotalValue;
    });
    return;
  }
}

/* Re-renders a cart section, using sections from a cart response when given */
async function refreshCartSection(container, sectionId, sections) {
  try {
    if (!sections?.[sectionId]) {
      const root = window.Shopify?.routes?.root ?? '/';
      const response = await fetch(`${root}?sections=${sectionId}`);
      sections = await response.json();
    }

    container.querySelector('cart-items')?.render(sections);
    syncCartIcons(sections);
  } catch (error) {
    console.error(`Cart refresh failed for ${sectionId}:`, error);
  }
}

/* Add to cart: stays on the page and opens the drawer or popup when one is enabled */
document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!new URL(form.action, window.location.href).pathname.endsWith('/cart/add')) return;

  const cart = document.querySelector('cart-drawer, cart-popup');
  if (!cart) return;

  event.preventDefault();
  if (form.hasAttribute('aria-busy')) return;

  const sectionIds = new Set([cart.localName]);
  document.querySelectorAll('cart-items[data-section]').forEach((element) => sectionIds.add(element.dataset.section));

  const body = new FormData(form);
  body.append('sections', [...sectionIds].join(','));
  body.append('sections_url', window.location.pathname);

  form.setAttribute('aria-busy', 'true');

  try {
    const root = window.Shopify?.routes?.root ?? '/';
    const response = await fetch(`${root}cart/add.js`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body,
    });
    const data = await response.json();

    if (!response.ok || data.status) {
      console.error('Add to cart failed:', data.description || data.message || response.statusText);
      return;
    }

    document.dispatchEvent(new CustomEvent('cart:added', { detail: { item: data } }));
    document.dispatchEvent(new CustomEvent('cart:open', { detail: { sections: data.sections } }));
  } catch (error) {
    console.error('Add to cart failed:', error);
  } finally {
    form.removeAttribute('aria-busy');
  }
});

/* Quantity input */
if (!customElements.get('quantity-input')) {
  customElements.define(
    'quantity-input',
    class QuantityInput extends HTMLElement {
      connectedCallback() {
        this.input = this.querySelector('input');
        this.addEventListener('click', this.onButtonClick);
        this.input.addEventListener('change', this.syncButtons);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onButtonClick);
      }

      onButtonClick = (event) => {
        const button = event.target.closest('[data-step]');
        if (!button || button.disabled) return;

        const previous = this.input.value;
        button.dataset.step === 'up' ? this.input.stepUp() : this.input.stepDown();

        if (this.input.value !== previous) {
          this.input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      syncButtons = () => {
        const value = Number(this.input.value);
        const min = Number(this.input.min || 0);
        const max = this.input.max ? Number(this.input.max) : Infinity;

        this.querySelector('[data-step="down"]').disabled = value <= min;
        this.querySelector('[data-step="up"]').disabled = value >= max;
      };
    }
  );
}

/* Line item */
if (!customElements.get('cart-items')) {
  customElements.define(
    'cart-items',
    class CartItems extends HTMLElement {
      timers = new Map();
      queue = Promise.resolve();

      connectedCallback() {
        this.addEventListener('change', this.onChange);
        this.addEventListener('click', this.onClick);
      }

      disconnectedCallback() {
        this.removeEventListener('change', this.onChange);
        this.removeEventListener('click', this.onClick);
      }

      onChange = (event) => {
        const input = event.target;

        if (input.dataset.key) {
          this.debounce(input.dataset.key, () => this.changeLine(input.dataset.key, Number(input.value), input));
        } else if (input.name === 'note') {
          this.debounce('note', () => this.saveNote(input.value), 500);
        }
      };

      onClick = (event) => {
        const remove = event.target.closest('[data-cart-remove]');
        if (!remove) return;

        event.preventDefault();
        this.changeLine(remove.dataset.cartRemove, 0);
      };

      debounce(id, callback, delay = 300) {
        clearTimeout(this.timers.get(id));
        this.timers.set(id, setTimeout(callback, delay));
      }

      changeLine(key, quantity, input) {
        this.queue = this.queue.then(() => this.request(key, quantity, input));
      }

      async request(key, quantity, input) {
        const sections = this.sectionIds();
        this.setAttribute('aria-busy', 'true');

        try {
          const response = await fetch(`${window.Shopify?.routes?.root ?? '/'}cart/change.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ id: key, quantity, sections, sections_url: window.location.pathname }),
          });
          const data = await response.json();

          if (!response.ok || data.status) {
            console.error('Cart update failed:', data.description || data.message || response.statusText);
            if (input) input.value = input.defaultValue;
            return;
          }

          this.render(data.sections);
          this.announce();
          document.querySelectorAll('[data-cart-count]').forEach((count) => {
            count.textContent = data.item_count;
            count.hidden = data.item_count === 0;
          });
          syncCartIcons(data.sections);
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: data } }));
        } catch (error) {
          console.error('Cart update failed:', error);
          if (input) input.value = input.defaultValue;
        } finally {
          this.removeAttribute('aria-busy');
        }
      }

      async saveNote(note) {
        try {
          await fetch(`${window.Shopify?.routes?.root ?? '/'}cart/update.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ note }),
          });
        } catch (error) {
          console.error('Order note was not saved:', error);
        }
      }

      sectionIds() {
        return [...document.querySelectorAll('cart-items[data-section]')].map((element) => element.dataset.section);
      }

      render(sections = {}) {
        const focusedKey = document.activeElement?.dataset?.key;
        const parser = new DOMParser();

        document.querySelectorAll('cart-items[data-section]').forEach((element) => {
          const html = sections[element.dataset.section];
          if (!html) return;

          const next = parser
            .parseFromString(html, 'text/html')
            .querySelector(`cart-items[data-section="${element.dataset.section}"]`);
          if (!next) return;

          const regions = element.querySelectorAll('[data-cart-region]');
          const keepsLayout = regions.length > 0 && !next.hasAttribute('data-empty') && !element.hasAttribute('data-empty');

          if (keepsLayout) {
            regions.forEach((region) => {
              const replacement = next.querySelector(`[data-cart-region="${region.dataset.cartRegion}"]`);
              if (replacement) region.innerHTML = replacement.innerHTML;
            });
          } else {
            element.innerHTML = next.innerHTML;
            element.toggleAttribute('data-empty', next.hasAttribute('data-empty'));
          }
        });

        if (focusedKey) {
          this.querySelector(`input[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
        }
      }

      announce() {
        const status = document.getElementById(`CartStatus-${this.dataset.section}`);
        if (!status) return;

        status.textContent = '';
        setTimeout(() => {
          status.textContent = status.dataset.message;
        }, 100);
      }
    }
  );
}

/* Popup */
if (!customElements.get('cart-popup')) {
  customElements.define(
    'cart-popup',
    class CartPopup extends HTMLElement {
      connectedCallback() {
        this.toggle = this.querySelector('.cart-icon');
        this.panel = this.querySelector('.cart-popup__panel');
        this.hoverMode = this.dataset.trigger === 'hover' && window.matchMedia('(hover: hover)').matches;

        if (this.hoverMode) {
          this.addEventListener('mouseenter', this.open);
          this.addEventListener('mouseleave', this.scheduleClose);
        } else {
          this.toggle.addEventListener('click', this.onToggleClick);
        }

        document.addEventListener('keydown', this.onKeydown);
        document.addEventListener('click', this.onDocumentClick);
        document.addEventListener('cart:open', this.onCartOpen);
      }

      disconnectedCallback() {
        document.removeEventListener('keydown', this.onKeydown);
        document.removeEventListener('click', this.onDocumentClick);
        document.removeEventListener('cart:open', this.onCartOpen);
      }

      get isOpen() {
        return !this.panel.hidden;
      }

      open = () => {
        clearTimeout(this.closeTimer);
        this.panel.hidden = false;
        this.toggle.setAttribute('aria-expanded', 'true');
      };

      close = () => {
        clearTimeout(this.closeTimer);
        this.panel.hidden = true;
        this.toggle.setAttribute('aria-expanded', 'false');
      };

      scheduleClose = () => {
        clearTimeout(this.closeTimer);
        this.closeTimer = setTimeout(this.close, 200);
      };

      onToggleClick = (event) => {
        event.preventDefault();

        if (this.isOpen) {
          this.close();
        } else {
          this.open();
          this.panel.querySelector('a:not([tabindex="-1"]), button')?.focus();
        }
      };

      onKeydown = (event) => {
        if (event.key !== 'Escape' || !this.isOpen) return;

        this.close();
        this.toggle.focus();
      };

      onDocumentClick = (event) => {
        if (this.isOpen && !this.contains(event.target)) this.close();
      };

      onCartOpen = async (event) => {
        await refreshCartSection(this, 'cart-popup', event.detail?.sections);
        this.open();
      };
    }
  );
}

/* Drawer */
if (!customElements.get('cart-drawer')) {
  customElements.define(
    'cart-drawer',
    class CartDrawer extends HTMLElement {
      connectedCallback() {
        this.toggle = this.querySelector('.cart-icon');
        this.dialog = this.querySelector('dialog');

        this.toggle.addEventListener('click', this.onToggleClick);
        this.dialog.addEventListener('click', this.onDialogClick);
        this.dialog.addEventListener('close', this.onClose);
        this.dialog.addEventListener('cancel', this.onCancel);
        this.dialog.addEventListener('animationend', this.onAnimationEnd);
        document.addEventListener('cart:open', this.onCartOpen);
      }

      disconnectedCallback() {
        document.removeEventListener('cart:open', this.onCartOpen);
      }

      open() {
        this.dialog.classList.remove('is-closing');
        if (this.dialog.open) return;

        this.dialog.showModal();
        this.toggle.setAttribute('aria-expanded', 'true');
      }

      /* Plays the slide-out animation before closing, unless reduced motion is on */
      close() {
        if (!this.dialog.open || this.dialog.classList.contains('is-closing')) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.dialog.close();
          return;
        }

        this.dialog.classList.add('is-closing');
      }

      onAnimationEnd = (event) => {
        if (event.target !== this.dialog || !event.animationName.startsWith('cart-drawer-out')) return;

        this.dialog.classList.remove('is-closing');
        this.dialog.close();
      };

      onCancel = (event) => {
        event.preventDefault();
        this.close();
      };

      onToggleClick = (event) => {
        event.preventDefault();
        this.open();
      };

      onDialogClick = (event) => {
        if (event.target === this.dialog || event.target.closest('[data-cart-drawer-close]')) {
          this.close();
        }
      };

      onClose = () => {
        this.toggle.setAttribute('aria-expanded', 'false');
      };

      onCartOpen = async (event) => {
        await refreshCartSection(this, 'cart-drawer', event.detail?.sections);
        this.open();
      };
    }
  );
}
