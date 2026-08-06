/**
 * Local behaviour patch for the static mirror.
 *
 * The page hydrates with Shopify's own Remix bundle, so scroll animation, the
 * Rive canvas, lazy video and the nav all work as they do on the live site.
 * What does not work is client-side routing: React Router owns clicks on
 * same-origin links and would fetch `<route>.data` from this static server,
 * which has no such endpoint. Every internal link is therefore turned back into
 * a plain navigation against shopify.com.
 */
(() => {
  const ORIGIN = 'https://www.shopify.com';

  // Capture phase, so this runs before React Router's delegated handler.
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return; // in-page nav, leave alone

      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return; // already external

      event.preventDefault();
      event.stopPropagation();
      window.open(ORIGIN + url.pathname + url.search + url.hash, '_blank', 'noopener');
    },
    true,
  );

  // Remix restores scroll from sessionStorage on load; on a single-page mirror
  // that just fights the reader on refresh.
  try {
    sessionStorage.removeItem('positions');
  } catch {}
})();
