/**
 * Runs before first paint, like the theme script: if Supabase has a saved
 * session in this browser, mark <html data-session> so the server-rendered
 * boot screen shows the app skeleton rather than the login screen — no
 * blank page while the JavaScript loads.
 */
export const bootScript = `(function(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.+-auth-token$/.test(k)){document.documentElement.setAttribute('data-session','');return;}}}catch(e){}})();`;
