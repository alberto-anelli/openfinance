/**
 * Detect the base path from the current browser URL.
 *
 * The app is served from multiple paths (e.g. /finance, /aa/finance)
 * via nginx rewrites.  This function finds which prefix the browser
 * is actually using and returns it, so that navigation links and API
 * calls stay coherent with the current URL.
 *
 * Detection logic: find the last occurrence of `/finance` in the URL
 * pathname and take everything up to and including it.
 *
 * Examples:
 *   /finance/month        → /finance
 *   /aa/finance/month     → /aa/finance
 *   /content/finance/     → /content/finance
 */
export function getBasePath(): string {
	if (typeof window === 'undefined') return '';
	const pathname = window.location.pathname;
	const idx = pathname.lastIndexOf('/finance');
	if (idx !== -1) {
		return pathname.substring(0, idx + '/finance'.length);
	}
	return '';
}