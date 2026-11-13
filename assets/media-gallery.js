if (!customElements.get('media-gallery')) {
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.items = [...this.querySelectorAll('[data-media-id]')];
      this.thumbs = [...this.querySelectorAll('[data-media-target]')];
      this.counter = this.querySelector('[data-media-index]');

      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => this.show(thumb.dataset.mediaTarget));
      });

      /* Switches to the selected variant's image */
      this.onVariantChange = (event) => {
        const mediaId = event.detail?.variant?.featured_media?.id;
        if (mediaId && this.closest('.shopify-section')?.contains(event.target)) this.show(String(mediaId));
      };
      document.addEventListener('variant:change', this.onVariantChange);

      if (this.querySelector('model-viewer')) this.loadModelViewer();
    }

    disconnectedCallback() {
      document.removeEventListener('variant:change', this.onVariantChange);
    }

    show(mediaId) {
      const target = this.items.find((item) => item.dataset.mediaId === mediaId);
      if (!target) return;

      this.items.forEach((item) => {
        const active = item === target;
        if (!active && !item.hidden) this.pause(item);
        item.hidden = !active;
      });

      this.thumbs.forEach((thumb) => {
        const active = thumb.dataset.mediaTarget === mediaId;
        thumb.classList.toggle('is-active', active);
        if (active) thumb.setAttribute('aria-current', 'true');
        else thumb.removeAttribute('aria-current');
      });

      if (this.counter) this.counter.textContent = this.items.indexOf(target) + 1;
    }

    pause(item) {
      item.querySelectorAll('video').forEach((video) => video.pause());
      item.querySelectorAll('iframe').forEach((frame) => {
        const message = frame.src.includes('youtube')
          ? '{"event":"command","func":"pauseVideo","args":""}'
          : '{"method":"pause"}';
        frame.contentWindow?.postMessage(message, '*');
      });
      item.querySelectorAll('model-viewer').forEach((model) => model.pause?.());
    }

    loadModelViewer() {
      window.Shopify?.loadFeatures?.([
        {
          name: 'model-viewer-ui',
          version: '1.0',
          onLoad: (error) => {
            if (error) return console.error(error);
            this.querySelectorAll('model-viewer').forEach((model) => new window.Shopify.ModelViewerUI(model));
          },
        },
      ]);
    }
  }

  customElements.define('media-gallery', MediaGallery);
}
