import { createRouter, makeRoute } from '../type-router.ts';

// Initialize window properties at module level so they can be used in route definitions
window.testResults = window.testResults || [];
window.lastManualState = window.lastManualState || null;
window.log = window.log || ((msg: string) => {
  window.testResults.push(msg);
  console.log(msg);
});

// Destructure for cleaner code
const { log } = window;

// Define manual init test routes with proper typing
export const manualRoutes = [
  makeRoute({
    path: '/',
    onEnter: () => log('manual:entered:/'),
    onExit: () => log('manual:exited:/'),
  }),
  makeRoute({
    path: '/test',
    onEnter: () => log('manual:entered:/test'),
    onExit: () => log('manual:exited:/test'),
  }),
  makeRoute({
    path: '/dashboard',
    onEnter: () => log('manual:entered:/dashboard'),
    onExit: () => log('manual:exited:/dashboard'),
  }),
  makeRoute({
    path: '/settings/:section',
    onEnter: (params) => log('manual:entered:/settings/' + params.section),
  }),
] as const;

export const manualRouterOptions = {
  autoInit: false,
  onEnter: (route: any) => log('manual:global:enter:' + route.path),
  onExit: (route: any) => log('manual:global:exit:' + route.path),
};

// Setup function to initialize the manual router and attach handlers
export function setupManualRouter() {
  // Re-initialize logging for clean test state
  window.testResults = [];
  window.log = (msg: string) => {
    window.testResults.push(msg);
    const output = document.getElementById('output');
    if (output) {
      const line = document.createElement('div');
      line.textContent = msg;
      output.appendChild(line);
    }
  };

  // Create router with manual init (autoInit: false)
  const manualRouter = createRouter(manualRoutes, manualRouterOptions);
  window.manualRouter = manualRouter;

  log('manual-created');

  // Subscribe to state changes
  manualRouter.subscribe((state) => {
    window.lastManualState = state;
    log('state-updated:' + (state.path || 'null'));
  });

  // Setup button handlers
  const initBtn = document.getElementById('init-btn') as HTMLButtonElement;
  const navigateBtn = document.getElementById(
    'navigate-btn',
  ) as HTMLButtonElement;

  if (initBtn) {
    initBtn.addEventListener('click', () => {
      manualRouter.init();
      log('manual-initialized');
      initBtn.disabled = true;
      if (navigateBtn) {
        navigateBtn.disabled = false;
      }
    });
  }

  if (navigateBtn) {
    navigateBtn.addEventListener('click', () => {
      manualRouter.navigate('/dashboard');
    });
  }

  // Check initial state
  const initialState = manualRouter.getState();
  log('initial-state-path:' + (initialState.path || 'null'));
  log('initial-state-route:' + (initialState.route ? 'exists' : 'null'));
}
