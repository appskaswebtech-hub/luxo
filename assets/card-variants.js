/* Product card variant selection: picking a value updates the price, the
   variant that gets added to the cart, and which values are sold out. */
if (!customElements.get('card-variants')) {
  class CardVariants extends HTMLElement {
    connectedCallback() {
      const data = this.querySelector('[data-card-variants]');
      if (!data) return;

      this.variants = JSON.parse(data.textContent);
      this.selected = JSON.parse(this.dataset.selected || '[]');
      this.idInput = this.querySelector('[data-card-variant-id]');
      this.button = this.querySelector('button[name="add"]');
      this.label = this.querySelector('[data-card-button-label]');
      this.price = this.querySelector('[data-card-price]');

      this.addEventListener('click', this.onClick);
      this.updateAvailability();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
    }

    onClick = (event) => {
      const more = event.target.closest('[data-show-more]');
      if (more && this.contains(more)) {
        const group = more.parentElement;
        group.querySelectorAll('[data-option-value][hidden]').forEach((button) => (button.hidden = false));
        group.querySelector('[data-option-value]:not([aria-pressed="true"])')?.focus();
        more.remove();
        return;
      }

      const option = event.target.closest('[data-option-value]');
      if (!option || !this.contains(option)) return;

      const index = Number(option.dataset.optionIndex);
      this.selected[index] = option.dataset.optionValue;

      this.querySelectorAll(`[data-option-index="${index}"]`).forEach((button) => {
        button.setAttribute('aria-pressed', String(button === option));
      });
      const label = this.querySelector(`[data-selected-label="${index}"]`);
      if (label) label.textContent = option.dataset.optionValue;

      this.updateAvailability();
      this.update();
    };

    currentVariant() {
      return this.variants.find((variant) => variant.options.every((value, index) => value === this.selected[index]));
    }

    update() {
      const variant = this.currentVariant();
      const available = Boolean(variant?.available);

      if (variant) {
        if (this.idInput) this.idInput.value = variant.id;
        this.updatePrice(variant);
      }

      if (this.button) this.button.disabled = !available;
      if (this.label) {
        if (!variant) this.label.textContent = this.label.dataset.labelUnavailable;
        else this.label.textContent = available ? this.label.dataset.labelAdd : this.label.dataset.labelSoldOut;
      }
    }

    /* Updates the card's price tag through its data-price-* hooks */
    updatePrice(variant) {
      const tag = this.price?.querySelector('[data-price-tag]');
      if (!tag) return;

      const onSale = Boolean(variant.compare);
      tag.classList.toggle('is-on-sale', onSale);

      const now = tag.querySelector('[data-price-now]');
      if (now) now.textContent = variant.price;

      const was = tag.querySelector('[data-price-was]');
      if (was) {
        was.hidden = !onSale;
        const amount = was.querySelector('[data-price-was-amount]');
        if (amount) amount.textContent = variant.compare;
      }
    }

    /* Crosses out values with no in-stock variant for the other current choices */
    updateAvailability() {
      this.querySelectorAll('[data-option-value]').forEach((button) => {
        const index = Number(button.dataset.optionIndex);
        const value = button.dataset.optionValue;
        const available = this.variants.some(
          (variant) =>
            variant.available &&
            variant.options[index] === value &&
            variant.options.every((option, other) => other === index || option === this.selected[other])
        );
        button.classList.toggle('is-unavailable', !available);
      });
    }
  }

  customElements.define('card-variants', CardVariants);
}
