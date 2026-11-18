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
        if (this.dataset.variantSwitch === 'false') return;
        const mediaId = event.detail?.variant?.featured_media?.id;
        if (mediaId && this.closest('.shopify-section')?.contains(event.target)) this.show(String(mediaId));
      };
      document.addEventListener('variant:change', this.onVariantChange);

      if (this.querySelector('model-viewer')) this.loadModelViewer();

      this.zoomButton = this.querySelector('[data-media-zoom]');
      this.zoomButton?.addEventListener('click', () => this.openZoom());
      this.syncZoom();
      this.setupLoupe();
    }

    activeItem() {
      return this.items.find((item) => !item.hidden);
    }

    /* The zoom button only shows for images, not videos or 3D models */
    syncZoom() {
      if (this.zoomButton) this.zoomButton.hidden = !this.activeItem()?.dataset.zoomSrc;
    }

    /* Desktop: a round loupe follows the pointer over the main image */
    setupLoupe() {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const stage = this.zoomButton?.parentElement;
      if (!stage) return;

      const lens = document.createElement('div');
      lens.className = 'media-loupe';
      lens.setAttribute('aria-hidden', 'true');
      stage.append(lens);
      const power = Number(this.dataset.loupePower) || 2.5;
      const preload = new Map();

      const move = (event) => {
        const item = this.activeItem();
        const img = item?.querySelector('img');
        if (!item?.dataset.zoomSrc || !img) return hide();

        const src = item.dataset.zoomSrc;
        if (!preload.has(src)) {
          const probe = new Image();
          probe.src = src;
          preload.set(src, probe);
        }

        const box = img.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        if (x < 0 || y < 0 || x > box.width || y > box.height) return hide();

        /* Matches object-fit (cover or contain) so the lens shows exactly what sits under the pointer */
        const naturalW = img.naturalWidth || box.width;
        const naturalH = img.naturalHeight || box.height;
        const contain = getComputedStyle(img).objectFit === 'contain';
        const fit = contain
          ? Math.min(box.width / naturalW, box.height / naturalH)
          : Math.max(box.width / naturalW, box.height / naturalH);
        const shownW = naturalW * fit;
        const shownH = naturalH * fit;
        const offsetX = (box.width - shownW) / 2;
        const offsetY = (box.height - shownH) / 2;
        /* With contain, the empty bands around the photo get no lens */
        if (x < offsetX || y < offsetY || x > offsetX + shownW || y > offsetY + shownH) return hide();
        const size = lens.offsetWidth;

        lens.style.backgroundImage = `url("${src}")`;
        lens.style.backgroundSize = `${shownW * power}px ${shownH * power}px`;
        lens.style.backgroundPosition = `${-((x - offsetX) * power - size / 2)}px ${-((y - offsetY) * power - size / 2)}px`;

        const stageBox = stage.getBoundingClientRect();
        lens.style.transform = `translate(${event.clientX - stageBox.left - size / 2}px, ${event.clientY - stageBox.top - size / 2}px)`;
        lens.classList.add('is-visible');
        stage.classList.add('has-loupe');
      };

      const hide = () => {
        lens.classList.remove('is-visible');
        stage.classList.remove('has-loupe');
      };

      stage.addEventListener('pointermove', (event) => {
        if (event.target.closest('button, a, model-viewer, video, iframe')) return hide();
        move(event);
      });
      stage.addEventListener('pointerleave', hide);
    }

    /* Touch and keyboard: a calm full-screen view; tap the image to zoom in and drag to look around */
    openZoom() {
      const item = this.activeItem();
      if (!item?.dataset.zoomSrc) return;
      this.zoomImages = this.items.filter((entry) => entry.dataset.zoomSrc);

      if (!this.zoomDialog) {
        const dialog = document.createElement('dialog');
        dialog.className = 'media-zoom';
        dialog.setAttribute('aria-label', this.zoomButton.getAttribute('aria-label'));
        dialog.innerHTML = `
          <div class="media-zoom__stage" data-zoom-stage><img class="media-zoom__image" alt="" draggable="false"></div>
          <button type="button" class="media-zoom__close" data-zoom-close>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <div class="media-zoom__nav">
            <button type="button" data-zoom-step="-1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6 8.5 12l6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <span data-zoom-count></span>
            <button type="button" data-zoom-step="1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>`;
        dialog.querySelector('[data-zoom-close]').setAttribute('aria-label', this.dataset.closeLabel || 'Close');
        dialog.querySelector('[data-zoom-step="-1"]').setAttribute('aria-label', this.dataset.prevLabel || 'Previous');
        dialog.querySelector('[data-zoom-step="1"]').setAttribute('aria-label', this.dataset.nextLabel || 'Next');
        if (this.zoomImages.length < 2) dialog.classList.add('media-zoom--single');

        this.zoomStage = dialog.querySelector('[data-zoom-stage]');
        this.zoomImage = dialog.querySelector('.media-zoom__image');

        dialog.addEventListener('click', (event) => {
          if (event.target.closest('[data-zoom-close]')) return dialog.close();
          const step = event.target.closest('[data-zoom-step]');
          if (step) return this.zoomTo(this.zoomIndex + Number(step.dataset.zoomStep));
          if (event.target === this.zoomImage) this.toggleZoom(event);
        });
        dialog.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowRight') this.zoomTo(this.zoomIndex + 1);
          if (event.key === 'ArrowLeft') this.zoomTo(this.zoomIndex - 1);
        });
        dialog.addEventListener('close', () => {
          document.documentElement.style.overflow = '';
          this.zoomButton.focus();
        });
        document.body.append(dialog);
        this.zoomDialog = dialog;
      }

      this.zoomTo(this.zoomImages.indexOf(item));
      document.documentElement.style.overflow = 'hidden';
      this.zoomDialog.showModal();
    }

    zoomTo(index) {
      const total = this.zoomImages.length;
      this.zoomIndex = (index + total) % total;
      const entry = this.zoomImages[this.zoomIndex];
      this.zoomStage.classList.remove('is-zoomed');
      this.zoomImage.src = entry.dataset.zoomSrc;
      this.zoomImage.alt = entry.dataset.zoomAlt || '';
      this.zoomDialog.querySelector('[data-zoom-count]').textContent = `${this.zoomIndex + 1} / ${total}`;
    }

    toggleZoom(event) {
      const box = this.zoomImage.getBoundingClientRect();
      const fx = (event.clientX - box.left) / box.width;
      const fy = (event.clientY - box.top) / box.height;
      const zoomed = this.zoomStage.classList.toggle('is-zoomed');
      if (!zoomed) return;
      requestAnimationFrame(() => {
        this.zoomStage.scrollLeft = this.zoomImage.offsetWidth * fx - this.zoomStage.clientWidth / 2;
        this.zoomStage.scrollTop = this.zoomImage.offsetHeight * fy - this.zoomStage.clientHeight / 2;
      });
    }

    disconnectedCallback() {
      document.removeEventListener('variant:change', this.onVariantChange);
    }

    show(mediaId) {
      const target = this.items.find((item) => item.dataset.mediaId === mediaId);
      if (!target) return;

      /* The AR button opens the 3D model that is showing, or the first one otherwise */
      const xrButton = this.closest('.shopify-section')?.querySelector('[data-shopify-xr]');
      if (xrButton && target.querySelector('model-viewer')) xrButton.dataset.shopifyModel3dId = mediaId;

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
      this.syncZoom();
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
        {
          name: 'shopify-xr',
          version: '1.0',
          onLoad: (error) => {
            if (error) return console.error(error);
            this.setupXr();
          },
        },
      ]);
    }

    /* "View in your space": registers the product's 3D models with Shopify's AR viewer */
    setupXr() {
      const data = this.closest('.shopify-section')?.querySelector('[data-product-models]');
      if (!data || !window.ShopifyXR) return;
      window.ShopifyXR.addModels(JSON.parse(data.textContent));
      window.ShopifyXR.setupXRElements();
    }
  }

  customElements.define('media-gallery', MediaGallery);
}
