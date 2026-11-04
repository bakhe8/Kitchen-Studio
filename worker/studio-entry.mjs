// Keep the original browser pathname/query intact. Relative ES-module URLs and
// the unit editor's project context depend on these public studio entry URLs.

// The UI builds a lot of HTML from strings, so these are defence in depth. Framing, referrers and powerful features are
// enforced now. Scripts are only reported (Report-Only) because the generated print/report documents still carry inline
// handlers; switch to Content-Security-Policy once the browser console shows no violations. The app frames its own
// pages (unit editor, report preview), hence SAMEORIGIN rather than DENY.
const policy=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",
  "connect-src 'self'","worker-src 'self' blob:","frame-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'"].join('; ');
export const securityHeaders=Object.freeze({
  'X-Frame-Options':'SAMEORIGIN',
  'Referrer-Policy':'same-origin',
  'Permissions-Policy':'geolocation=(), microphone=(), payment=(), usb=()',
  'Content-Security-Policy-Report-Only':policy
});
export function studioEntryResponse(request, indexHtml, unitHtml) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const path = new URL(request.url).pathname;
  if (path === '/examples/kitchen-5x5.html' || path === '/examples/kitchen-5x5.svg') {
    return new Response(request.method === 'HEAD' ? null : 'أُزيل المثال من استوديو المطابخ.', {
      status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  if (path !== '/' && path !== '/index.html' && path !== '/unit.html') return null;
  const body = path === '/unit.html' ? unitHtml : indexHtml;
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ...securityHeaders }
  });
}
