// Derived from Starlight (MIT License) — see packages/app/NOTICE.md.
// The table-of-contents scroll-spy, renamed to Portosaur's `porto-`
// prefix throughout. The `customElements.define` call is guarded (the
// original is not) because both the desktop and mobile TOC components
// import this module.

import { PAGE_TITLE_ID } from "../constants.ts";

export class PortoTOC extends HTMLElement {
  private _current = this.querySelector<HTMLAnchorElement>(
    'a[aria-current="true"]',
  );
  private minH = parseInt(this.dataset.minH || "2", 10);
  private maxH = parseInt(this.dataset.maxH || "3", 10);

  /**
   * CSS selector string that matches only headings that can appear in the table of contents.
   * Generates a selector like `h1#_top,:where(h2,h3)[id]`.
   */
  private tocHeadingSelector =
    `h1#${PAGE_TITLE_ID},` +
    `:where(${[...Array.from({ length: 1 + this.maxH - this.minH }).map((_, index) => `h${this.minH + index}`)].join()})[id]`;

  protected set current(link: HTMLAnchorElement) {
    if (link === this._current) return;
    if (this._current) this._current.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    this._current = link;
  }

  private onIdle = (cb: IdleRequestCallback) =>
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 1)))(cb);

  private observer: IntersectionObserver | undefined;
  private resizeTimeout: number | undefined;
  private setCurrent: IntersectionObserverCallback = () => {};
  private toObserve: NodeListOf<Element> | Element[] = [];

  private onResize = () => {
    // Disable intersection observer while window is resizing.
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    window.clearTimeout(this.resizeTimeout);
    this.resizeTimeout = window.setTimeout(
      () => this.onIdle(this.observe),
      200,
    );
  };

  constructor() {
    super();
    this.onIdle(() => this.init());
  }

  disconnectedCallback() {
    // Client-side navigation discards the TOC: disconnect the
    // observer (it holds the old page's headings) and drop the
    // resize listener, or each navigation leaks both.
    this.observer?.disconnect();
    this.observer = undefined;
    window.clearTimeout(this.resizeTimeout);
    window.removeEventListener("resize", this.onResize);
  }

  private observe = (): void => {
    if (this.observer || !this.isConnected) {
      return;
    }
    this.observer = new IntersectionObserver(this.setCurrent, {
      rootMargin: this.getRootMargin(),
    });
    this.toObserve.forEach((h) => this.observer!.observe(h));
  };

  private init = (): void => {
    // The idle callback can fire after navigation (the element was
    // discarded while waiting) — never observe from a detached TOC.
    if (!this.isConnected) {
      return;
    }
    /** All the links in the table of contents. */
    const links = [...this.querySelectorAll("a")];

    /** Test if an element is a table-of-contents heading. */
    const isHeading = (el: Element): el is HTMLHeadingElement =>
      el.matches(this.tocHeadingSelector);

    /** Walk up the DOM to find the nearest heading. */
    const getElementHeading = (el: Element | null): HTMLElement | null => {
      while (el) {
        // Short circuit if we reach the top-level content container or one of the other containers in main.
        if (el.matches(".porto-markdown-content, main > *")) {
          return document.getElementById(PAGE_TITLE_ID);
        }
        if (isHeading(el)) return el;
        // Find the first heading that is a child of this element, and return it if there is one.
        const childHeading = el.querySelector<HTMLElement>(
          this.tocHeadingSelector,
        );
        if (childHeading) return childHeading;
        // Look for the previous sibling last and most deeply nested child.
        let prev = el.previousElementSibling;
        while (prev?.lastElementChild) {
          prev = prev.lastElementChild;
        }
        el = prev ?? el.parentElement;
      }
      return null;
    };

    /** Handle intersections and set the current link to the heading for the current intersection. */
    this.setCurrent = (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        const heading = getElementHeading(target);
        if (!heading) continue;
        const link = links.find(
          (link) => link.hash === "#" + encodeURIComponent(heading.id),
        );
        if (link) {
          this.current = link;
          break;
        }
      }
    };

    // Observe the following elements:
    // - headings that appear in the table of contents
    // - siblings of those headings or of the `.porto-heading-wrapper` added by the anchor-links feature
    // - direct children of `.porto-markdown-content` to include elements before the first subheading
    // - direct children of `main` that don’t include headings (mainly to target banners)
    // Ignore any elements that themselves contain a table-of-contents heading, as we are already observing those children.
    this.toObserve = document.querySelectorAll(
      [
        `main :where(${this.tocHeadingSelector})`,
        `main :where(${this.tocHeadingSelector}, .porto-heading-wrapper) ~ *:not(:has(${this.tocHeadingSelector}))`,
        `main .porto-markdown-content > *:not(:has(${this.tocHeadingSelector}))`,
        `main > *:not(:has(${this.tocHeadingSelector}))`,
      ].join(),
    );

    this.observe();
    window.addEventListener("resize", this.onResize);
  };

  private getRootMargin(): `-${number}px 0% ${number}px` {
    const navBarHeight =
      document.querySelector("header")?.getBoundingClientRect().height || 0;
    // `<summary>` only exists in mobile ToC, so will fall back to 0 in large viewport component.
    const mobileTocHeight =
      this.querySelector("summary")?.getBoundingClientRect().height || 0;
    /** Start intersections at nav height + 2rem padding. */
    const top = navBarHeight + mobileTocHeight + 32;
    /** End intersections `53px` later. This is slightly more than the maximum `margin-top` in Markdown content. */
    const bottom = top + 53;
    const height = document.documentElement.clientHeight;
    return `-${top}px 0% ${bottom - height}px`;
  }
}

if (!customElements.get("porto-toc")) {
  customElements.define("porto-toc", PortoTOC);
}
