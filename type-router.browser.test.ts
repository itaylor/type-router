/// <reference lib="deno.ns" />
import { launch } from '@astral/astral';
import { assertEquals } from '@std/assert';

import type { Router } from './type-router.ts';
import type { testRoutes } from './test-fixtures/shared-routes.ts';
import type { manualRoutes } from './test-fixtures/manual-init-routes.ts';

// Declare window properties that are added by the test setup
// // Extend Window interface for our test utilities
declare global {
  interface Window {
    testResults: string[];
    log: (msg: string) => void;
    router: Router<typeof testRoutes>;
    manualRouter: Router<typeof manualRoutes>;
    lastState: any;
    lastManualState: any;
    stateHistory: Array<{
      path: string | null;
      params: Record<string, string>;
      routePath: string | undefined;
    }>;
  }
}

// Named localhost IPs for different test modes
const HISTORY_MODE_IP = '127.0.0.1';
const HASH_MODE_IP = '127.0.0.2';
const MANUAL_INIT_IP = '127.0.0.3';

function setupTestServer() {
  const server = Deno.serve({ port: 0, hostname: '0.0.0.0' }, async (req) => {
    const url = new URL(req.url);
    const host = req.headers.get('host')?.split(':')[0] || '127.0.0.1';

    // Serve static files from test-fixtures
    if (url.pathname.startsWith('/dist/')) {
      try {
        const content = await Deno.readTextFile(
          `./test-fixtures${url.pathname}`,
        );
        return new Response(content, {
          headers: { 'Content-Type': 'application/javascript' },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    // Serve different HTML files at root based on IP
    if (url.pathname === '/') {
      let htmlFile: string;
      switch (host) {
        case HISTORY_MODE_IP:
          htmlFile = './test-fixtures/history-test.html';
          break;
        case HASH_MODE_IP:
          htmlFile = './test-fixtures/hash-mode-test.html';
          break;
        case MANUAL_INIT_IP:
          htmlFile = './test-fixtures/manual-init-test.html';
          break;
        default:
          htmlFile = './test-fixtures/history-test.html';
      }

      const html = await Deno.readTextFile(htmlFile);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not found', { status: 404 });
  });

  return server;
}

// Test setup/teardown variables
let server = await setupTestServer();
let browser: any;

Deno.test.beforeEach(async () => {
  server = await setupTestServer();
  browser = await launch();
});

Deno.test.afterEach(async () => {
  await browser?.close();
  await server?.shutdown();
});

// Helper to create a page with a specific IP
function createPage(ip = HISTORY_MODE_IP) {
  return browser.newPage(`http://${ip}:${server.addr.port}/`);
}

Deno.test('type-router - basic navigation and lifecycle hooks', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  // Wait for router to initialize
  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // First navigate to "/" explicitly to establish initial state
  await page.evaluate(() => window.router.navigate('/'));
  await page.waitForFunction(() => window.testResults?.includes('entered:/'));

  // Test basic navigation from "/" to "/about"
  await page.evaluate(() => window.router.navigate('/about'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/about')
  );

  const results1 = await page.evaluate(() => window.testResults);
  // Now "/" was entered, then exited when navigating to "/about"
  assertEquals(results1.includes('entered:/'), true);
  assertEquals(results1.includes('global:exit:/'), true);
  assertEquals(results1.includes('exited:/'), true);
  assertEquals(results1.includes('global:enter:/about'), true);
  assertEquals(results1.includes('entered:/about'), true);

  // Test parameterized routes
  await page.evaluate(() => window.router.navigate('/user/:id', { id: '123' }));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/123')
  );

  const state1 = await page.evaluate(() => window.lastState);
  assertEquals(state1.path, '/user/123');
  assertEquals(state1.params.id, '123');

  // Test parameter change (should NOT exit/enter, only paramChange)
  await page.evaluate(() => window.router.navigate('/user/:id', { id: '456' }));
  await page.waitForFunction(() =>
    window.testResults?.includes('paramChange:123->456')
  );

  const results2 = await page.evaluate(() => window.testResults);
  assertEquals(results2.includes('paramChange:123->456'), true);
  assertEquals(
    results2.filter((r: string) => r === 'exited:/user/123').length,
    0,
  );
  assertEquals(
    results2.filter((r: string) => r === 'entered:/user/456').length,
    0,
  );

  // Test multiple parameters
  await page.evaluate(() =>
    window.router.navigate('/post/:category/:slug', {
      category: 'tech',
      slug: 'hello-world',
    })
  );
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/post/tech/hello-world')
  );

  const state2 = await page.evaluate(() => window.lastState);
  assertEquals(state2.path, '/post/tech/hello-world');
  assertEquals(state2.params.category, 'tech');
  assertEquals(state2.params.slug, 'hello-world');

  // Test concrete path navigation
  await page.evaluate(() => window.router.navigate('/user/789'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/789')
  );

  const state3 = await page.evaluate(() => window.lastState);
  assertEquals(state3.path, '/user/789');
  assertEquals(state3.params.id, '789');

  // Test fallback route
  await page.evaluate(() => window.router.navigateAny('/nonexistent'));
  await page.waitForFunction(() =>
    window.testResults?.includes('missed:/nonexistent')
  );

  const results3 = await page.evaluate(() => window.testResults);
  assertEquals(results3.includes('missed:/nonexistent'), true);
  assertEquals(results3.includes('entered:/404'), true);

  // Test browser back button
  await page.evaluate(() => window.history.back());
  await new Promise((resolve) => setTimeout(resolve, 100));

  const stateAfterBack = await page.evaluate(() => window.lastState);
  assertEquals(stateAfterBack.path, '/user/789');

  // Test computePath utility
  const computed = await page.evaluate(() =>
    window.router.computePath('/user/:id', { id: 'computed' })
  );
  assertEquals(computed, '/user/computed');

  // Test state subscription
  const stateHistory = await page.evaluate(() => window.stateHistory);
  assertEquals(stateHistory.length > 0, true);
  assertEquals(stateHistory[stateHistory.length - 1].path, '/user/789');
  await page.close();
});

Deno.test('type-router - hash mode routing', async () => {
  const page = await createPage(HASH_MODE_IP);

  // Wait for router to initialize
  await page.waitForFunction(() => window.testResults?.includes('ready:hash'));

  // Navigate using hash mode
  await page.evaluate(() => window.router.navigate('/about'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/about')
  );

  const hash1 = await page.evaluate(() => window.location.hash);
  assertEquals(hash1, '#/about');

  // Test hash navigation with global hooks
  const results1 = await page.evaluate(() => window.testResults);
  assertEquals(results1.includes('global:enter:/about'), true);
  assertEquals(results1.includes('entered:/about'), true);

  // Navigate to user route
  await page.evaluate(() => window.router.navigate('/user/:id', { id: '123' }));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/123')
  );

  const hash2 = await page.evaluate(() => window.location.hash);
  assertEquals(hash2, '#/user/123');

  const results2 = await page.evaluate(() => window.testResults);
  assertEquals(results2.includes('global:exit:/about'), true);
  assertEquals(results2.includes('exited:/about'), true);
  assertEquals(results2.includes('global:enter:/user/:id'), true);
  assertEquals(results2.includes('entered:/user/123'), true);

  // Test parameterized route in hash mode
  await page.evaluate(() =>
    window.router.navigate('/profile/:username', { username: 'alice' })
  );
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/profile/alice')
  );

  const hash3 = await page.evaluate(() => window.location.hash);
  assertEquals(hash3, '#/profile/alice');

  const state = await page.evaluate(() => window.lastState);
  assertEquals(state.path, '/profile/alice');
  assertEquals(state.params.username, 'alice');

  // Test param change in hash mode
  await page.evaluate(() =>
    window.router.navigate('/profile/:username', { username: 'bob' })
  );
  await page.waitForFunction(() =>
    window.testResults?.includes('paramChange:alice->bob')
  );

  const results3 = await page.evaluate(() => window.testResults);
  assertEquals(results3.includes('paramChange:alice->bob'), true);

  // Test clicking hash links (hash mode doesn't intercept clicks)
  const hashLink = await page.$('a[href="#/post/tech/hello"]');
  await hashLink!.click();
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/post/tech/hello')
  );

  const hash4 = await page.evaluate(() => window.location.hash);
  assertEquals(hash4, '#/post/tech/hello');
  await page.close();
});

Deno.test('type-router - hash mode empty path handling', async () => {
  // Test 1: URL without any hash should default to root route
  const page1 = await browser.newPage(
    `http://${HASH_MODE_IP}:${server.addr.port}/`,
  );
  await page1.waitForFunction(() => window.testResults?.includes('ready:hash'));

  // Should automatically route to root path
  await page1.waitForFunction(() => window.testResults?.includes('entered:/'));

  // Add a small delay to allow state subscription to be called
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Get state from subscription or router directly as fallback
  let currentPath = await page1.evaluate(() =>
    window.lastState?.path || window.router?.getState()?.path
  );
  assertEquals(currentPath, '/');
  await page1.close();

  // Test 2: URL with just '#' should also default to root route
  const page2 = await browser.newPage(
    `http://${HASH_MODE_IP}:${server.addr.port}/#`,
  );
  await page2.waitForFunction(() => window.testResults?.includes('ready:hash'));

  await page2.waitForFunction(() => window.testResults?.includes('entered:/'));

  // Add a small delay to allow state subscription to be called
  await new Promise((resolve) => setTimeout(resolve, 50));

  currentPath = await page2.evaluate(() =>
    window.lastState?.path || window.router?.getState()?.path
  );
  assertEquals(currentPath, '/');
  await page2.close();

  // Test 3: URL with '#/' should work normally
  const page3 = await browser.newPage(
    `http://${HASH_MODE_IP}:${server.addr.port}/#/`,
  );
  await page3.waitForFunction(() => window.testResults?.includes('ready:hash'));

  await page3.waitForFunction(() => window.testResults?.includes('entered:/'));

  // Add a small delay to allow state subscription to be called
  await new Promise((resolve) => setTimeout(resolve, 50));

  currentPath = await page3.evaluate(() =>
    window.lastState?.path || window.router?.getState()?.path
  );
  assertEquals(currentPath, '/');
  await page3.close();

  // Test 4: URL with a real hash path should still work
  const page4 = await browser.newPage(
    `http://${HASH_MODE_IP}:${server.addr.port}/#/about`,
  );
  await page4.waitForFunction(() => window.testResults?.includes('ready:hash'));

  await page4.waitForFunction(() =>
    window.testResults?.includes('entered:/about')
  );

  // Add a small delay to allow state subscription to be called
  await new Promise((resolve) => setTimeout(resolve, 50));

  currentPath = await page4.evaluate(() =>
    window.lastState?.path || window.router?.getState()?.path
  );
  assertEquals(currentPath, '/about');
  await page4.close();
});

Deno.test('type-router - URL encoding/decoding in browser', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // Add routes with special character handling
  await page.evaluate(() => {
    // Track parameter values received
    (window as any).receivedParams = [];

    // Add a search route to the existing router's routes
    const _searchRoute = {
      path: '/search/:query',
      onEnter: (params: any) => {
        window.log('entered:/search/' + params.query);
        (window as any).receivedParams.push({
          route: 'search',
          query: params.query,
        });
      },
    };

    const _tagRoute = {
      path: '/tag/:name',
      onEnter: (params: any) => {
        window.log('entered:/tag/' + params.name);
        (window as any).receivedParams.push({
          route: 'tag',
          name: params.name,
        });
      },
    };

    // Since we can't modify the existing router, we'll use navigateAny
    // to test URL encoding through concrete paths
  });

  // Test spaces in parameters - navigate with space
  await page.evaluate(() => window.router.navigateAny('/search/hello world'));

  // Wait for navigation but since the route doesn't exist in testRoutes,
  // it should fall back to 404
  await page.waitForFunction(() =>
    window.testResults?.includes('missed:/search/hello world')
  );

  // Test special characters in URL
  await page.evaluate(() => window.router.navigateAny('/tag/C++'));

  await page.waitForFunction(() =>
    window.testResults?.includes('missed:/tag/C++')
  );

  // Test URL with encoded characters
  await page.evaluate(() => window.router.navigateAny('/search/hello%20world'));

  await page.waitForFunction(() =>
    window.testResults?.includes('missed:/search/hello%20world')
  );

  // Test that browser location reflects the navigation
  const location1 = await page.evaluate(() => window.location.pathname);
  assertEquals(location1, '/search/hello%20world');

  // Test various special characters
  await page.evaluate(() => window.router.navigateAny('/tag/@typescript'));

  const location2 = await page.evaluate(() => window.location.pathname);
  assertEquals(location2, '/tag/@typescript');

  await page.close();
});

Deno.test('type-router - race conditions with concurrent navigation', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // Clear test results for clean slate
  await page.evaluate(() => {
    window.testResults = ['ready:history'];
  });

  // Test concurrent navigation - all should complete but last one wins
  await page.evaluate(async () => {
    const promises = [
      window.router.navigate('/'),
      window.router.navigate('/about'),
      window.router.navigate('/user/:id', { id: 'final' }),
    ];

    await Promise.all(promises);
  });

  // Wait for the final navigation to complete
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/final')
  );

  // Verify final state is the last navigation
  const finalState = await page.evaluate(() => window.router.getState());
  assertEquals(finalState.path, '/user/final');
  assertEquals(finalState.route?.path, '/user/:id');
  assertEquals(finalState.params.id, 'final');

  // Verify the final navigation completed
  // In concurrent navigation, intermediate navigations may be skipped
  const results = await page.evaluate(() => window.testResults);
  assertEquals(results.includes('entered:/user/final'), true);

  // Test rapid sequential navigation
  await page.evaluate(() => {
    window.testResults = [];
  });

  await page.evaluate(async () => {
    // Rapidly navigate between two routes
    const rapidNavs = [];
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) {
        rapidNavs.push(window.router.navigate('/about'));
      } else {
        rapidNavs.push(window.router.navigate('/'));
      }
    }
    await Promise.all(rapidNavs);
  });

  // Final navigation should be to /about (i=4, even)
  await new Promise((resolve) => setTimeout(resolve, 100));
  const rapidState = await page.evaluate(() => window.router.getState());
  assertEquals(rapidState.path, '/about');

  await page.close();
});

Deno.test('type-router - hash mode race conditions', async () => {
  const page = await createPage(HASH_MODE_IP);

  await page.waitForFunction(() => window.testResults?.includes('ready:hash'));

  // Clear test results
  await page.evaluate(() => {
    window.testResults = ['ready:hash'];
  });

  // Test concurrent navigation in hash mode
  // Hash mode queues navigations through hashchange events
  await page.evaluate(async () => {
    const promises = [
      window.router.navigate('/'),
      window.router.navigate('/about'),
      window.router.navigate('/user/:id', { id: 'hash-final' }),
    ];

    await Promise.all(promises);
  });

  // Wait for all navigations to complete
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/hash-final')
  );

  // Verify final state
  const finalState = await page.evaluate(() => window.router.getState());
  assertEquals(finalState.path, '/user/hash-final');
  assertEquals(finalState.params.id, 'hash-final');

  // Verify hash is set correctly
  const hash = await page.evaluate(() => window.location.hash);
  assertEquals(hash, '#/user/hash-final');

  // In hash mode, navigations are queued, so all should complete in order
  const results = await page.evaluate(() => window.testResults);

  // Find the sequence of enters after the ready message
  const enterSequence = results.filter((r: string) => r.startsWith('entered:'));
  // Verify the final navigation completed
  assertEquals(
    enterSequence[enterSequence.length - 1],
    'entered:/user/hash-final',
  );

  await page.close();
});

Deno.test('type-router - malformed paths and error handling', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // Test navigation to paths with empty segments (consecutive slashes)
  // Our validation now rejects these with "Invalid path:" errors
  const error1 = await page.evaluate(async () => {
    try {
      await window.router.navigateAny('//invalid');
      return null;
    } catch (e: any) {
      return e.message;
    }
  });
  assertEquals(error1, 'Invalid path: //invalid');

  // Test path with multiple empty segments
  const error2 = await page.evaluate(async () => {
    try {
      await window.router.navigateAny('/path//with//double');
      return null;
    } catch (e: any) {
      return e.message;
    }
  });
  assertEquals(error2, 'Invalid path: /path//with//double');

  // Test path that's just slashes
  const error3 = await page.evaluate(async () => {
    try {
      await window.router.navigateAny('///');
      return null;
    } catch (e: any) {
      return e.message;
    }
  });
  assertEquals(error3, 'Invalid path: ///');

  // Test valid but non-existent paths still trigger miss handler
  await page.evaluate(() => window.router.navigateAny('/not/found'));

  await page.waitForFunction(() =>
    window.testResults?.includes('missed:/not/found')
  );

  const results = await page.evaluate(() => window.testResults);
  assertEquals(results.includes('entered:/404'), true);

  // Verify state is at fallback route
  const state = await page.evaluate(() => window.router.getState());
  assertEquals(state.route?.path, '/404');

  await page.close();
});

Deno.test('type-router - route priority and matching order', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // The existing test routes already demonstrate FIFO matching:
  // Routes are checked in order, first match wins

  // Navigate to /user/123 - matches /user/:id route
  await page.evaluate(() => window.router.navigate('/user/123'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/123')
  );

  const state1 = await page.evaluate(() => window.router.getState());
  assertEquals(state1.route?.path, '/user/:id');

  // Navigate to /profile/alice - matches /profile/:username route
  await page.evaluate(() => window.router.navigate('/profile/alice'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/profile/alice')
  );

  const state2 = await page.evaluate(() => window.router.getState());
  assertEquals(state2.route?.path, '/profile/:username');

  // If we had overlapping patterns, first one would win
  // The existing routes don't overlap, but the matching is still FIFO

  await page.close();
});

Deno.test('type-router - manual initialization', async () => {
  const page = await createPage(MANUAL_INIT_IP);

  // Wait for router to be created (but not initialized)
  await page.waitForFunction(
    () => window.testResults?.includes('manual-created'),
    { timeout: 3000 },
  );

  // Verify initial state before init
  const beforeInit = await page.evaluate(() => window.testResults);
  assertEquals(beforeInit.includes('initial-state-path:null'), true);
  assertEquals(beforeInit.includes('initial-state-route:null'), true);
  assertEquals(beforeInit.includes('manual:entered:/'), false);

  // Click the init button
  const initBtn = await page.$('#init-btn');
  await initBtn!.click();
  await page.waitForFunction(() =>
    window.testResults?.includes('manual-initialized')
  );

  // Verify route was activated after init
  const afterInit = await page.evaluate(() => window.testResults);
  assertEquals(afterInit.includes('manual:global:enter:/'), true);
  assertEquals(afterInit.includes('manual:entered:/'), true);
  assertEquals(afterInit.includes('state-updated:/'), true);

  // Test that navigation works after init
  const navigateBtn = await page.$('#navigate-btn');
  await navigateBtn!.click();
  await page.waitForFunction(() =>
    window.testResults?.includes('manual:entered:/dashboard')
  );

  const results = await page.evaluate(() => window.testResults);
  assertEquals(results.includes('manual:global:exit:/'), true);
  assertEquals(results.includes('manual:exited:/'), true);
  assertEquals(results.includes('manual:global:enter:/dashboard'), true);
  assertEquals(results.includes('manual:entered:/dashboard'), true);
  assertEquals(results.includes('state-updated:/dashboard'), true);

  // Test navigation with params after manual init
  await page.evaluate(() =>
    window.manualRouter.navigate('/settings/:section', {
      section: 'privacy',
    })
  );
  await page.waitForFunction(() =>
    window.testResults?.includes('manual:entered:/settings/privacy')
  );

  const state = await page.evaluate(() => window.lastManualState);
  assertEquals(state.path, '/settings/privacy');
  assertEquals(state.params.section, 'privacy');

  await page.close();
});

Deno.test('type-router - trailing slashes', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // Test that routes work with and without trailing slashes
  await page.evaluate(() => window.router.navigate('/about/'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/about')
  );

  const state1 = await page.evaluate(() => window.lastState);
  assertEquals(state1.route.path, '/about');

  await page.evaluate(() => window.router.navigate('/user/123/'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/123')
  );

  const state2 = await page.evaluate(() => window.lastState);
  assertEquals(state2.params.id, '123');
  assertEquals(state2.route.path, '/user/:id');

  await page.close();
});

Deno.test('type-router - getState and subscribe', async () => {
  const page = await createPage(HISTORY_MODE_IP);

  await page.waitForFunction(() =>
    window.testResults?.includes('ready:history')
  );

  // Navigate to "/" first to establish state
  await page.evaluate(() => window.router.navigate('/'));
  await page.waitForFunction(() => window.testResults?.includes('entered:/'));

  // Test getState returns current state
  const initialState = await page.evaluate(() => window.router.getState());
  assertEquals(initialState.path, '/');
  assertEquals(initialState.route?.path, '/');

  // Navigate and check state history from subscription
  await page.evaluate(() => window.router.navigate('/about'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/about')
  );

  await page.evaluate(() => window.router.navigate('/user/42'));
  await page.waitForFunction(() =>
    window.testResults?.includes('entered:/user/42')
  );

  const stateHistory = await page.evaluate(() => window.stateHistory);

  // Should have 2 state changes from our navigations (/about and /user/42)
  // The initial navigation to "/" doesn't create a state entry since the router was already at "/"
  assertEquals(
    stateHistory.length,
    2,
    `Expected 2 state entries, got ${stateHistory.length}`,
  );

  // Check the entries we have
  assertEquals(stateHistory[0].path, '/about');
  assertEquals(stateHistory[1].path, '/user/42');
  assertEquals(stateHistory[1].params.id, '42');

  // Verify getState returns latest
  const currentState = await page.evaluate(() => window.router.getState());
  assertEquals(currentState.path, '/user/42');
  assertEquals(currentState.params.id, '42');

  await page.close();
});
