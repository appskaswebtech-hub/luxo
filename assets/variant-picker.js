if (!customElements.get('variant-picker')) {
  const formatMoney = (cents, format) => {
    const placeholder = /\{\{\s*(\w+)\s*\}\}/;
    const match = format.match(placeholder);
    if (!match) return format;

    const group = (value, decimals, thousands, decimal) => {
      const [whole, fraction] = (value / 100).toFixed(decimals).split('.');
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return fraction ? `${grouped}${decimal}${fraction}` : grouped;
    };

    const amounts = {
      amount: () => group(cents, 2, ',', '.'),
      amount_no_decimals: () => group(cents, 0, ',', '.'),
      amount_with_comma_separator: () => group(cents, 2, '.', ','),
      amount_no_decimals_with_comma_separator: () => group(cents, 0, '.', ','),
      amount_with_apostrophe_separator: () => group(cents, 2, "'", '.'),
      amount_no_decimals_with_space_separator: () => group(cents, 0, ' ', '.'),
      amount_with_space_separator: () => group(cents, 2, ' ', ','),
      amount_with_period_and_space_separator: () => group(cents, 2, ' ', '.'),
    };

    const amount = (amounts[match[1]] || amounts.amount)();
    return format.replace(placeholder, amount);
  };

  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.variants = JSON.parse(this.querySelector('[data-variants]').textContent);
      this.groups = [...this.querySelectorAll('[data-option]')];
      this.addEventListener('change', this.onChange);
      this.updateAvailability();

      /* Color names the browser can't paint, like "bronze", show their name instead */
      this.querySelectorAll('[data-color-name]').forEach((swatch) => {
        if (!CSS.supports('color', swatch.dataset.colorName)) swatch.classList.add('variant-picker__swatch--text');
      });
    }

    disconnectedCallback() {
      this.removeEventListener('change', this.onChange);
    }

    selectedOptions() {
      return this.groups.map((group) => {
        const select = group.querySelector('select');
        if (select) return select.value;
        return group.querySelector('input:checked')?.value;
      });
    }

    onChange = (event) => {
      const label = event.target.closest('[data-option]')?.querySelector('[data-selected-value]');
      if (label) label.textContent = event.target.value;

      const options = this.selectedOptions();
      const variant = this.variants.find((item) => item.options.every((value, index) => value === options[index]));

      this.updateAvailability();
      this.update(variant);
    };

    /* A value is available when an in-stock variant has it together with the other current choices */
    updateAvailability() {
      const selected = this.selectedOptions();

      this.groups.forEach((group, index) => {
        const isAvailable = (value) =>
          this.variants.some(
            (variant) =>
              variant.available &&
              variant.options[index] === value &&
              variant.options.every((option, other) => other === index || option === selected[other])
          );

        group.querySelectorAll('input').forEach((input) => {
          const label = input.nextElementSibling;
          if (!label) return;
          const available = isAvailable(input.value);
          label.classList.toggle('is-unavailable', !available);
          const note = label.querySelector('[data-unavailable-text]');
          if (note) note.hidden = available;
        });

        group.querySelectorAll('option').forEach((option) => {
          option.classList.toggle('is-unavailable', !isAvailable(option.value));
        });
      });
    }

    update(variant) {
      /* Looked up on every change, since the form can live in a block after the picker */
      const formId = this.dataset.form;
      const form = document.getElementById(formId);
      const buttons = [
        ...(form ? form.querySelectorAll('[type="submit"][name="add"]') : []),
        ...document.querySelectorAll(`[type="submit"][name="add"][form="${formId}"]`),
      ];

      if (!variant) {
        buttons.forEach((button) => (button.disabled = true));
        return;
      }

      const idInput = form?.querySelector('input[type="hidden"][name="id"]');
      if (idInput) {
        idInput.value = variant.id;
        /* Shop Pay Installments and other Shopify widgets follow this field */
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const formError = form?.querySelector('[data-form-error]');
      if (formError) formError.hidden = true;

      buttons.forEach((button) => {
        button.disabled = !variant.available;
        const label = button.querySelector('[data-variant-button-label]');
        if (label) label.textContent = variant.available ? label.dataset.labelAdd : label.dataset.labelSoldOut;
      });

      const format = this.dataset.moneyFormat || '{{amount}}';
      const price = formatMoney(variant.price, format);
      const hasCompare = variant.compare_at_price > variant.price;
      const compare = hasCompare ? formatMoney(variant.compare_at_price, format) : '';
      const scope = (name) => document.querySelectorAll(`[data-variant-${name}="${formId}"]`);

      const savings = hasCompare ? formatMoney(variant.compare_at_price - variant.price, format) : '';
      document.querySelectorAll(`[data-price-for="${formId}"]`).forEach((tag) => {
        tag.classList.toggle('is-on-sale', hasCompare);

        const now = tag.querySelector('[data-price-now]');
        if (now) now.textContent = price;

        const was = tag.querySelector('[data-price-was]');
        if (was) {
          was.hidden = !hasCompare;
          const amount = was.querySelector('[data-price-was-amount]');
          if (amount) amount.textContent = compare;
        }

        const save = tag.querySelector('[data-price-save]');
        if (save) {
          save.hidden = !hasCompare;
          save.textContent = hasCompare ? save.dataset.template.replace('[amount]', savings) : '';
        }

        const unit = tag.querySelector('[data-price-unit]');
        if (unit) {
          const measure = variant.unit_price_measurement;
          unit.hidden = !measure;
          if (measure) {
            const reference = measure.reference_value === 1 ? '' : measure.reference_value;
            unit.textContent = unit.dataset.template
              .replace('[price]', formatMoney(variant.unit_price, format))
              .replace('[unit]', `${reference}${measure.reference_unit}`);
          }
        }
      });

      scope('sku').forEach((element) => {
        element.textContent = variant.sku || '';
        const holder = element.parentElement;
        if (holder) holder.hidden = !variant.sku;
      });

      scope('title').forEach((element) => {
        element.textContent = variant.title;
      });

      /* Shows the variant's own image; variants without one keep the current image */
      const imageSrc = variant.featured_image?.src;
      if (imageSrc) {
        scope('image').forEach((image) => {
          const url = new URL(imageSrc, window.location.origin);
          url.searchParams.set('width', image.width * 2);
          url.searchParams.set('height', image.height * 2);
          url.searchParams.set('crop', 'center');
          image.src = url.toString();
        });
      }

      window.history.replaceState({}, '', `${this.dataset.url}?variant=${variant.id}`);
      this.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variant, price, compare } }));
    }
  }

  customElements.define('variant-picker', VariantPicker);
}
