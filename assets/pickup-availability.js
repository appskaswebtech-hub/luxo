if (!customElements.get('pickup-availability')) {
  class PickupAvailability extends HTMLElement {
    connectedCallback() {
      this.onVariantChange = (event) => {
        const variant = event.detail?.variant;
        if (!variant || String(variant.id) === this.dataset.variantId) return;
        if (!this.closest('.shopify-section')?.contains(event.target)) return;
        this.dataset.variantId = variant.id;
        this.refresh(variant.id);
      };
      document.addEventListener('variant:change', this.onVariantChange);
    }

    disconnectedCallback() {
      document.removeEventListener('variant:change', this.onVariantChange);
    }

    async refresh(variantId) {
      try {
        const response = await fetch(`${this.dataset.productUrl}?variant=${variantId}&section_id=pickup-availability`);
        if (!response.ok) throw new Error(`Pickup availability failed with status ${response.status}`);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = doc.querySelector('.shopify-section');
        this.innerHTML = content ? content.innerHTML : '';
      } catch (error) {
        console.error(error);
      }
    }
  }

  customElements.define('pickup-availability', PickupAvailability);
}
