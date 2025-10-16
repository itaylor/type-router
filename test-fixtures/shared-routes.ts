import {
  createRouter,
  makeRoute,
  type Route,
  type RoutePath,
} from "../type-router.ts";

// Extend Window interface for our test utilities
declare global {
  interface Window {
    testResults: string[];
    log: (msg: string) => void;
    router: ReturnType<typeof createRouter<typeof testRoutes>>;
    lastState: any;
    stateHistory: Array<{
      path: string | null;
      params: Record<string, string>;
      routePath: string | undefined;
    }>;
  }
}

// Define shared test routes with proper typing
export const testRoutes = [
  makeRoute({
    path: "/",
    onEnter: () => window.log("entered:/"),
    onExit: () => window.log("exited:/"),
  }),
  makeRoute({
    path: "/about",
    onEnter: () => window.log("entered:/about"),
    onExit: () => window.log("exited:/about"),
  }),
  makeRoute({
    path: "/user/:id",
    onEnter: (params) => window.log("entered:/user/" + params.id),
    onExit: (params) => window.log("exited:/user/" + params.id),
    onParamChange: (params, prev) =>
      window.log("paramChange:" + prev.id + "->" + params.id),
  }),
  makeRoute({
    path: "/post/:category/:slug",
    onEnter: (params) =>
      window.log("entered:/post/" + params.category + "/" + params.slug),
    onExit: (params) =>
      window.log("exited:/post/" + params.category + "/" + params.slug),
  }),
  makeRoute({
    path: "/profile/:username",
    onEnter: (params) => window.log("entered:/profile/" + params.username),
    onExit: (params) => window.log("exited:/profile/" + params.username),
    onParamChange: (params, prev) =>
      window.log("paramChange:" + prev.username + "->" + params.username),
  }),
  makeRoute({
    path: "/404",
    onEnter: () => window.log("entered:/404"),
  }),
] as const;

// Setup function that works for both hash and history modes
export function setupRouter(mode: "hash" | "history" = "history") {
  // Initialize logging
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
    onMiss: (path) => window.log("missed:" + path),
    onEnter: (route, params) => window.log("global:enter:" + route.path),
    onExit: (route, params) => window.log("global:exit:" + route.path),
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

  window.log("ready:" + mode);
}
