import { createRouter, makeRoute } from "../type-router.ts";

// Extend Window interface for our test utilities
declare global {
  interface globalThis {
    testResults: string[];
    log: (msg: string) => void;
    lastManualState: any;
  }
}

// Define manual init test routes with proper typing
export const manualRoutes = [
  makeRoute({
    path: "/test",
    onEnter: () => window.log("manual:entered:/test"),
    onExit: () => window.log("manual:exited:/test"),
  }),
  makeRoute({
    path: "/dashboard",
    onEnter: () => window.log("manual:entered:/dashboard"),
    onExit: () => window.log("manual:exited:/dashboard"),
  }),
  makeRoute({
    path: "/settings/:section",
    onEnter: (params) =>
      window.log("manual:entered:/settings/" + params.section),
  }),
] as const;

export const manualRouterOptions = {
  autoInit: false,
  onEnter: (route: any) => window.log("manual:global:enter:" + route.path),
  onExit: (route: any) => window.log("manual:global:exit:" + route.path),
};

// Setup function to initialize the manual router and attach handlers
export function setupManualRouter() {
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

  // Create router with manual init (autoInit: false)
  const manualRouter = createRouter(manualRoutes, manualRouterOptions);

  window.log("manual-created");

  // Subscribe to state changes
  manualRouter.subscribe((state) => {
    window.lastManualState = state;
    window.log("state-updated:" + (state.path || "null"));
  });

  // Setup button handlers
  const initBtn = document.getElementById("init-btn") as HTMLButtonElement;
  const navigateBtn = document.getElementById(
    "navigate-btn",
  ) as HTMLButtonElement;

  if (initBtn) {
    initBtn.addEventListener("click", () => {
      manualRouter.init();
      window.log("manual-initialized");
      initBtn.disabled = true;
      if (navigateBtn) {
        navigateBtn.disabled = false;
      }
    });
  }

  if (navigateBtn) {
    navigateBtn.addEventListener("click", () => {
      manualRouter.navigate("/dashboard");
    });
  }

  // Check initial state
  const initialState = manualRouter.getState();
  window.log("initial-state-path:" + (initialState.path || "null"));
  window.log("initial-state-route:" + (initialState.route ? "exists" : "null"));
}
