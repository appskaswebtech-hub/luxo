/* Product card image slider: one image per slide, moved by arrows, dots or swipe */
if (!customElements.get('card-image-slider')) {
  customElements.define(
    'card-image-slider',
    class CardImageSlider extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-slider-track]');
        this.slides = [...this.track.children];
        this.prev = this.querySelector('[data-slider-prev]');
        this.next = this.querySelector('[data-slider-next]');
        this.dots = [...this.querySelectorAll('[data-slider-dot]')];
        this.strip = this.querySelector('[data-slider-strip]');
        this.progress = this.querySelector('[data-slider-progress]');
        this.maxDots = Number(this.dataset.maxDots) || 5;

        this.prev?.addEventListener('click', (event) => this.step(event, -1));
        this.next?.addEventListener('click', (event) => this.step(event, 1));
        this.dots.forEach((dot) =>
          dot.addEventListener('click', (event) => {
            event.preventDefault();
            this.goTo(Number(dot.dataset.sliderDot));
          })
        );

        this.onScroll = () => {
          cancelAnimationFrame(this.frame);
          this.frame = requestAnimationFrame(() => this.sync());
        };
        this.track.addEventListener('scroll', this.onScroll, { passive: true });
        this.sync();
      }

      disconnectedCallback() {
        this.track?.removeEventListener('scroll', this.onScroll);
      }

      index() {
        return Math.round(this.track.scrollLeft / (this.track.clientWidth || 1));
      }

      step(event, direction) {
        event.preventDefault();
        this.goTo(this.index() + direction);
      }

      goTo(index) {
        const target = Math.max(0, Math.min(index, this.slides.length - 1));
        this.track.scrollTo({ left: target * this.track.clientWidth });
      }

      sync() {
        const current = this.index();
        if (this.prev) this.prev.disabled = current <= 0;
        if (this.next) this.next.disabled = current >= this.slides.length - 1;

        this.slides.forEach((slide, i) => {
          if (i === current) {
            slide.removeAttribute('tabindex');
            slide.removeAttribute('aria-hidden');
          } else {
            slide.setAttribute('tabindex', '-1');
            slide.setAttribute('aria-hidden', 'true');
          }
        });

        this.dots.forEach((dot, i) => {
          if (i === current) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });

        this.slideDots(current);

        if (this.progress) {
          this.progress.style.width = `${((current + 1) / this.slides.length) * 100}%`;
        }
      }

      /* Keeps the current dot inside the visible window and shrinks the edge dots when more sit beyond */
      slideDots(current) {
        if (!this.strip || this.dots.length <= this.maxDots) return;

        const half = Math.floor(this.maxDots / 2);
        const start = Math.max(0, Math.min(current - half, this.dots.length - this.maxDots));
        const end = start + this.maxDots - 1;
        const step = this.dots[1].offsetLeft - this.dots[0].offsetLeft;

        this.strip.style.transform = `translateX(${-start * step}px)`;
        this.dots.forEach((dot, i) => {
          const edge = (i === start && start > 0) || (i === end && end < this.dots.length - 1);
          dot.classList.toggle('is-edge', edge && i !== current);
        });
      }
    }
  );
}
