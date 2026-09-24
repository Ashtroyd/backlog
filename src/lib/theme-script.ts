export const THEME_KEY = "backlog:theme";

/**
 * Runs synchronously before first paint: applies the saved appearance, or
 * follows the OS when it's "system"/unset — and keeps following it live, so
 * flipping macOS/iOS to dark mode flips the app without a reload.
 */
export const themeScript = `(function(){try{var k='${THEME_KEY}',m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t=m.matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);};apply();m.addEventListener('change',apply);window.__applyTheme=apply;}catch(e){}})();`;
