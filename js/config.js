/**
 * QRForge — Global Configuration
 * Controls site-wide behavior: maintenance, dev mode, feature flags
 */

const CONFIG = {
  // --- Site Identity ---
  siteName: "QRForge",
  version: "1.0.0",
  githubUrl: "https://github.com/nikomarinovic",

  // --- Maintenance Mode ---
  // Set to true to redirect ALL pages to maintenance screen
  maintenance: false,
  maintenancePath: "/public/dev/maintenance.html",

  // --- Under-Development Pages ---
  // Key = page slug, value = true means redirect to under-development
  underDevelopment: {
    gallery: true,
  },
  underDevelopmentPath: "/public/dev/under-development.html",

  // --- Mobile Redirect ---
  mobileRedirect: false,
  mobileRedirectUrl: null,         // e.g. "https://m.example.com"
  mobileBreakpoint: 480,           // px

  // --- Security ---
  disableRightClick: false,

  // --- Feature Flags ---
  features: {
    logoUpload: true,
    gradientQR: true,
    svgExport: true,
    presets: true,
  },
};

// ─── Runtime Boot ────────────────────────────────────────────────────────────

(function boot() {
  const path = window.location.pathname;
  const isMaintPage = path.includes("maintenance.html");
  const isDevPage = path.includes("under-development.html");

  // Maintenance mode: redirect everything except the maintenance page itself
  if (CONFIG.maintenance && !isMaintPage) {
    window.location.replace(CONFIG.maintenancePath);
    return;
  }

  // Under-development redirect per page slug
  if (!isDevPage) {
    for (const [slug, isDev] of Object.entries(CONFIG.underDevelopment)) {
      if (isDev && path.includes(slug)) {
        window.location.replace(CONFIG.underDevelopmentPath);
        return;
      }
    }
  }

  // Mobile redirect
  if (
    CONFIG.mobileRedirect &&
    CONFIG.mobileRedirectUrl &&
    window.innerWidth <= CONFIG.mobileBreakpoint
  ) {
    window.location.replace(CONFIG.mobileRedirectUrl);
    return;
  }

  // Disable right-click
  if (CONFIG.disableRightClick) {
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }
})();
