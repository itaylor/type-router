import { createRouter, makeRoute } from "../type-router.ts";

// Initialize window properties at module level so they can be used in route definitions
window.testResults = window.testResults || [];
window.log = window.log || ((msg: string) => {
  window.testResults.push(msg);
  console.log(msg);
});

// Destructure for cleaner code
const { log } = window;

// Define shared test routes with proper typing
export const testRoutes = [
  makeRoute({
    path: "/",
    onEnter: () => log("entered:/"),
    onExit: () => log("exited:/"),
  }),
  makeRoute({
    path: "/about",
    onEnter: () => log("entered:/about"),
    onExit: () => log("exited:/about"),
  }),
  makeRoute({
    path: "/user/:id",
    onEnter: (params) => log("entered:/user/" + params.id),
    onExit: (params) => log("exited:/user/" + params.id),
    onParamChange: (params, prev) =>
      log("paramChange:" + prev.id + "->" + params.id),
  }),
  makeRoute({
    path: "/post/:category/:slug",
    onEnter: (params) =>
      log("entered:/post/" + params.category + "/" + params.slug),
    onExit: (params) =>
      log("exited:/post/" + params.category + "/" + params.slug),
  }),
  makeRoute({
    path: "/profile/:username",
    onEnter: (params) => log("entered:/profile/" + params.username),
    onExit: (params) => log("exited:/profile/" + params.username),
    onParamChange: (params, prev) =>
      log("paramChange:" + prev.username + "->" + params.username),
  }),
  makeRoute({
    path: "/404",
    onEnter: () => log("entered:/404"),
  }),
] as const;

// Setup function that works for both hash and history modes
export function setupRouter(mode: "hash" | "history" = "history") {
  // Re-initialize logging for clean test state
  window.testResults = [];
  window.log = (msg: string) => {
    window.testResults.push(msg);
    const output = document.getElementById("output");
    if (output) {
      const line = document.createElement("div");
      line.textContent = msg;
      output.appendChild(line);
    }
  };

  // Create router with specified mode
  const router = createRouter(testRoutes, {
    urlType: mode,
    fallbackPath: "/404",
    onMiss: (path) => log("missed:" + path),
    onEnter: (route) => log("global:enter:" + route.path),
    onExit: (route) => log("global:exit:" + route.path),
  });

  // Make router globally accessible
  window.router = router;

  // Subscribe to state changes
  window.stateHistory = [];
  router.subscribe((state) => {
    window.lastState = state;
    window.stateHistory.push({
      path: state.path,
      params: { ...state.params },
      routePath: state.route?.path,
    });
  });

  // For history mode, intercept link clicks to use router.navigate
  // For hash mode, let the browser handle hash links naturally
  if (mode === "history") {
    document.addEventListener("click", (e) => {
      const link = (e.target as HTMLElement).closest("a[data-route]");
      if (link) {
        e.preventDefault();
        const path = link.getAttribute("href");
        if (path) {
          // Navigate to the concrete path directly
          // The href should contain a concrete path (e.g., "/user/123"), not a pattern (e.g., "/user/:id")
          // Use navigateAny for runtime paths that can't be type-checked at compile time
          router.navigateAny(path);
        }
      }
    });
  }

  log("ready:" + mode);
}
