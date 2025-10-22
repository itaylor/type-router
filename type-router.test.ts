/// <reference lib="deno.ns" />
import { assertEquals, assertRejects, assertThrows } from '@std/assert';
import {
  createRouter,
  makeRoute,
  type Route as _Route,
} from './type-router.ts';
import { mockGlobalThis } from './test-utils/mock-globals.ts';

Deno.test('URL encoding/decoding - handles spaces in parameters', async () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }), // Add root route for init
    makeRoute({
      path: '/search/:query',
      onEnter: (params) => {
        assertEquals(params.query, 'hello world');
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false, urlType: 'history' });
  router.init();

  // Navigate with spaces in parameter
  await router.navigate('/search/:query', { query: 'hello world' });

  // The URL should have the spaces encoded as %20
  assertEquals(mock.mockLocation.pathname, '/search/hello%20world');

  // Now test navigating directly to the encoded URL
  await router.navigateAny('/search/hello%20world');
  // The params should be decoded
  const state = router.getState();
  assertEquals(state.params.query, 'hello world');

  // Reset for next test
  mock.reset();
});

Deno.test('URL encoding/decoding - handles special characters', async () => {
  const mock = mockGlobalThis();

  let capturedParams: Record<string, string> = {};

  const routes = [
    makeRoute({ path: '/' }), // Add root route for init
    makeRoute({
      path: '/tag/:name',
      onEnter: (params) => {
        capturedParams = params;
      },
      onParamChange: (params) => {
        capturedParams = params;
      },
    }),
    makeRoute({
      path: '/file/:path',
      onEnter: (params) => {
        capturedParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false, urlType: 'history' });
  router.init();

  // Test with C++ (plus signs)
  await router.navigate('/tag/:name', { name: 'C++' });
  assertEquals(capturedParams.name, 'C++');
  assertEquals(mock.mockLocation.pathname, '/tag/C%2B%2B');

  // Note: forward slashes in parameter values don't work as they're path separators
  // This would need URL encoding to work properly

  // Test with various special characters - should be URL encoded
  await router.navigate('/tag/:name', { name: '@user#123' });
  assertEquals(capturedParams.name, '@user#123');
  assertEquals(mock.mockLocation.pathname, '/tag/%40user%23123');

  await router.navigate('/tag/:name', { name: 'Node.js & TypeScript' });
  assertEquals(capturedParams.name, 'Node.js & TypeScript');
  assertEquals(mock.mockLocation.pathname, '/tag/Node.js%20%26%20TypeScript');

  mock.reset();
});

Deno.test('Error cases - navigate to non-existent route without fallback', async () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({ path: '/user/:id' }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: undefined,
  });
  router.init();

  // Should throw when navigating to non-existent route
  await assertRejects(
    async () => await router.navigateAny('/nonexistent'),
    Error,
    'No route found for path: /nonexistent',
  );

  // Should also throw for paths that look similar but don't match
  await assertRejects(
    async () => await router.navigateAny('/users'), // note: plural, route is /user/:id
    Error,
    'No route found for path: /users',
  );

  mock.reset();
});

Deno.test('Error cases - navigate to malformed paths', async () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({ path: '/user/:id' }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: undefined,
  });
  router.init();

  // Multiple slashes should be rejected by validation
  await assertRejects(
    async () => await router.navigateAny('///broken//path//'),
    Error,
    'Invalid path: ///broken//path//',
  );

  // Empty segments
  await assertRejects(
    async () => await router.navigateAny('/user//123'),
    Error,
    'Invalid path: /user//123',
  );

  // Just slashes
  await assertRejects(
    async () => await router.navigateAny('///'),
    Error,
    'Invalid path: ///',
  );

  mock.reset();
});

Deno.test('Error cases - fallback route with onMiss handler', async () => {
  const mock = mockGlobalThis();

  let missedPath: string | null = null;
  let fallbackEntered = false;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({
      path: '/404',
      onEnter: () => {
        fallbackEntered = true;
      },
    }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: '/404',
    onMiss: (path) => {
      missedPath = path;
    },
  });
  router.init();

  // Navigate to non-existent route - should trigger onMiss and go to fallback
  await router.navigateAny('/nonexistent');

  assertEquals(missedPath, '/nonexistent');
  assertEquals(fallbackEntered, true);

  // Reset state
  missedPath = null;
  // Don't reset fallbackEntered - we're already on /404 route
  // so onEnter won't fire again when navigating to another missing route

  // Malformed paths with consecutive slashes now trigger validation errors
  // They do NOT use the fallback - they're hard errors
  await assertRejects(
    async () => await router.navigateAny('/path//with//double'),
    Error,
    'Invalid path: /path//with//double',
  );
  // We're still on /404 from the first navigation
  assertEquals(fallbackEntered, true); // Still true from first navigation

  mock.reset();
});

Deno.test("Error cases - fallback path doesn't exist", () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
  ] as const;

  // Test with an invalid fallback path (intentionally using a path that doesn't exist)
  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: '/404' as any, // Intentionally invalid path for testing
  });
  router.init();

  // Should throw with helpful message about missing fallback
  assertRejects(
    async () => await router.navigateAny('/nonexistent'),
    Error,
    'No route found for path: /nonexistent, fallback path: /404 not found.',
  );

  mock.reset();
});

Deno.test('Route priority - FIFO ordering when multiple routes could match', async () => {
  const mock = mockGlobalThis();

  const visitedRoutes: string[] = [];

  const routes = [
    makeRoute({ path: '/' }), // Add root route for init
    makeRoute({
      path: '/user/profile',
      onEnter: () => visitedRoutes.push('/user/profile'),
    }),
    makeRoute({
      path: '/user/:id',
      onEnter: () => visitedRoutes.push('/user/:id'),
    }),
    makeRoute({
      path: '/:section/:id',
      onEnter: () => visitedRoutes.push('/:section/:id'),
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false, urlType: 'history' });
  router.init();

  // Clear visited routes
  visitedRoutes.length = 0;

  // "/user/profile" should match the first route (exact match)
  await router.navigateAny('/user/profile');
  assertEquals(visitedRoutes[visitedRoutes.length - 1], '/user/profile');

  // "/user/123" should match the second route (first pattern that matches)
  await router.navigateAny('/user/123');
  assertEquals(visitedRoutes[visitedRoutes.length - 1], '/user/:id');

  // "/blog/456" should match the third route
  await router.navigateAny('/blog/456');
  assertEquals(visitedRoutes[visitedRoutes.length - 1], '/:section/:id');

  mock.reset();
});

Deno.test('Race conditions - concurrent navigation in history mode', async () => {
  const mock = mockGlobalThis();

  const navigationOrder: string[] = [];
  const enterOrder: string[] = [];

  const routes = [
    makeRoute({
      path: '/',
      onEnter: () => enterOrder.push('/'),
    }),
    makeRoute({
      path: '/page1',
      onEnter: () => enterOrder.push('/page1'),
    }),
    makeRoute({
      path: '/page2',
      onEnter: () => enterOrder.push('/page2'),
    }),
    makeRoute({
      path: '/page3',
      onEnter: () => enterOrder.push('/page3'),
    }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    urlType: 'history',
  });
  router.init();

  // Track navigation calls with proper typing
  const originalNavigate = router.navigate.bind(router);
  const trackedNavigate: typeof router.navigate = function <
    P extends '/' | '/page1' | '/page2' | '/page3',
  >(
    ...args: Parameters<typeof router.navigate>
  ) {
    const path = args[0] as string;
    navigationOrder.push(path);
    return originalNavigate(...args);
  } as typeof router.navigate;

  // Replace navigate method
  Object.defineProperty(router, 'navigate', {
    value: trackedNavigate,
    writable: true,
    configurable: true,
  });

  // Start concurrent navigations
  const promises = Promise.all([
    router.navigate('/page1'),
    router.navigate('/page2'),
    router.navigate('/page3'),
  ]);

  await promises;

  // Restore original navigate
  Object.defineProperty(router, 'navigate', {
    value: originalNavigate,
    writable: true,
    configurable: true,
  });

  // All navigations should complete
  assertEquals(navigationOrder.length, 3);
  assertEquals(navigationOrder, ['/page1', '/page2', '/page3']);

  // Due to async nature (setTimeout), the last navigation wins
  // The enter hooks should fire for each in sequence (plus initial "/" from init)
  assertEquals(enterOrder.length, 4);

  // The final state should be page3 (last navigation)
  const finalState = router.getState();
  assertEquals(finalState.path, '/page3');
  assertEquals(finalState.route?.path, '/page3');

  mock.reset();
});

Deno.test('Race conditions - rapid sequential navigation', async () => {
  const mock = mockGlobalThis();

  let enterCount = 0;
  let exitCount = 0;

  const routes = [
    makeRoute({
      path: '/',
      onEnter: () => enterCount++,
      onExit: () => exitCount++,
    }),
    makeRoute({
      path: '/fast',
      onEnter: () => enterCount++,
      onExit: () => exitCount++,
    }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    urlType: 'history',
  });
  router.init();

  // Reset counters after init
  enterCount = 0;
  exitCount = 0;

  // Rapidly navigate back and forth
  const rapidNavigations: Promise<unknown>[] = [];
  for (let i = 0; i < 10; i++) {
    const path = i % 2 === 0 ? '/fast' : '/';
    rapidNavigations.push(router.navigateAny(path));
  }

  await Promise.all(rapidNavigations);

  // Should have handled all navigations
  assertEquals(enterCount, 10);
  assertEquals(exitCount, 10); // Each navigation causes an exit from the previous route

  // Final state should be "/" (last navigation in the loop when i=9)
  const finalState = router.getState();
  assertEquals(finalState.path, '/');

  mock.reset();
});

Deno.test('Query parameters are stripped from path matching', async () => {
  const mock = mockGlobalThis();

  let capturedParams: Record<string, string> = {};
  let enteredPath: string | null = null;

  const routes = [
    makeRoute({ path: '/' }), // Add root route for init
    makeRoute({
      path: '/search/:term',
      onEnter: (params) => {
        capturedParams = params;
        enteredPath = '/search/:term';
      },
    }),
    makeRoute({
      path: '/user/:id',
      onEnter: (params) => {
        capturedParams = params;
        enteredPath = '/user/:id';
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false, urlType: 'history' });
  router.init();

  // Navigate with query parameters - they should be ignored for route matching
  await router.navigateAny('/search/typescript?page=2&sort=date');

  assertEquals(enteredPath, '/search/:term');
  assertEquals(capturedParams.term, 'typescript');
  // The query params are preserved in the URL but not used for matching
  assertEquals(mock.mockLocation.pathname, '/search/typescript');
  assertEquals(mock.mockLocation.search, '?page=2&sort=date');

  // Test with user route
  await router.navigateAny('/user/123?tab=profile&view=full');

  assertEquals(enteredPath, '/user/:id');
  assertEquals(capturedParams.id, '123');
  assertEquals(mock.mockLocation.pathname, '/user/123');
  assertEquals(mock.mockLocation.search, '?tab=profile&view=full');

  mock.reset();
});

Deno.test('Path validation - rejects empty segments', async () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({ path: '/user/:id' }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: undefined,
  });
  router.init();

  // Should reject paths with consecutive slashes
  await assertRejects(
    async () => await router.navigateAny('//invalid'),
    Error,
    'Invalid path: //invalid',
  );

  await assertRejects(
    async () => await router.navigateAny('/path//to/somewhere'),
    Error,
    'Invalid path: /path//to/somewhere',
  );

  await assertRejects(
    async () => await router.navigateAny('///'),
    Error,
    'Invalid path: ///',
  );

  // Valid paths should still work
  await router.navigate('/about');
  assertEquals(mock.mockLocation.hash, '#/about');

  mock.reset();
});

Deno.test('Path validation - rejects invalid paths even with fallback', async () => {
  const mock = mockGlobalThis();

  let missedPath: string | null = null;
  let fallbackEntered = false;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({
      path: '/404',
      onEnter: () => {
        fallbackEntered = true;
      },
    }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: '/404',
    onMiss: (path) => {
      missedPath = path;
    },
  });
  router.init();

  // Invalid paths with empty segments should be hard errors, NOT use fallback
  await assertRejects(
    async () => await router.navigateAny('//invalid'),
    Error,
    'Invalid path: //invalid',
  );
  assertEquals(missedPath, null); // onMiss was never called
  assertEquals(fallbackEntered, false); // Fallback was never entered

  await assertRejects(
    async () => await router.navigateAny('/path//with//double'),
    Error,
    'Invalid path: /path//with//double',
  );
  assertEquals(missedPath, null); // Still never called
  assertEquals(fallbackEntered, false); // Still never entered

  // But valid non-existent paths should still use fallback
  await router.navigateAny('/valid/but/missing');
  assertEquals(missedPath, '/valid/but/missing');
  assertEquals(fallbackEntered, true);

  mock.reset();
});

Deno.test('Path validation - rejects invalid route declarations', () => {
  // TypeScript prevents invalid paths at compile time, but we can test runtime validation
  // by bypassing type checks (this simulates runtime data that hasn't been validated)

  // Should also throw when passing invalid routes to createRouter
  assertThrows(
    () =>
      createRouter(
        [
          { path: '/' },
          { path: '/user//profile' },
        ] as any, // Bypass TypeScript to test runtime validation
        { autoInit: false },
      ),
    Error,
    'Invalid path: /user//profile',
  );

  // Note: In normal usage, TypeScript would prevent these at compile time
  // These tests verify the runtime validation works as a safety net
});

Deno.test('Parameter extraction with special regex characters', async () => {
  const mock = mockGlobalThis();

  let capturedParams: Record<string, string> = {};

  const routes = [
    makeRoute({ path: '/' }), // Add root route for init
    makeRoute({
      path: '/regex/:pattern',
      onEnter: (params) => {
        capturedParams = params;
      },
      onParamChange: (params) => {
        capturedParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false, urlType: 'history' });
  router.init();

  // Test with regex special characters in parameter values
  // These should be treated as literal strings, not regex patterns
  await router.navigate('/regex/:pattern', { pattern: '.*' });
  assertEquals(capturedParams.pattern, '.*');
  assertEquals(mock.mockLocation.pathname, '/regex/.*');

  await router.navigate('/regex/:pattern', { pattern: '[a-z]+' });
  assertEquals(capturedParams.pattern, '[a-z]+');
  assertEquals(mock.mockLocation.pathname, '/regex/%5Ba-z%5D%2B');

  await router.navigate('/regex/:pattern', { pattern: 'test(123)' });
  assertEquals(capturedParams.pattern, 'test(123)');
  // Parentheses are not encoded by encodeURIComponent
  assertEquals(mock.mockLocation.pathname, '/regex/test(123)');

  await router.navigate('/regex/:pattern', { pattern: 'a|b' });
  assertEquals(capturedParams.pattern, 'a|b');
  assertEquals(mock.mockLocation.pathname, '/regex/a%7Cb');

  mock.reset();
});

Deno.test('Query parameters - basic functionality and path param precedence', async () => {
  const mock = mockGlobalThis();

  let enteredParams: any = null;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({
      path: '/foo/:bar/baz?bar&fizz&buzz',
      onEnter: (params) => {
        enteredParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false });
  router.init();

  // Test with all query parameters present - path param should trump query param
  await router.navigateAny('/foo/alice/baz?bar=bob&fizz=rad&buzz=yep');

  assertEquals(enteredParams.bar, 'alice'); // Path param trumps query param
  assertEquals(enteredParams.fizz, 'rad');
  assertEquals(enteredParams.buzz, 'yep');

  // Test with no query parameters
  enteredParams = null;
  await router.navigate('/'); // Reset to different route first
  await router.navigateAny('/foo/bob/baz');

  assertEquals(enteredParams.bar, 'bob');
  assertEquals(enteredParams.fizz, undefined);
  assertEquals(enteredParams.buzz, undefined);

  // Test that undeclared query parameters are ignored
  enteredParams = null;
  await router.navigate('/'); // Reset to different route first
  await router.navigateAny(
    '/foo/charlie/baz?bar=ignored&fizz=cool&buzz=nice&undeclared=ignored',
  );

  assertEquals(enteredParams.bar, 'charlie'); // Path parameter wins
  assertEquals(enteredParams.fizz, 'cool'); // Declared query parameter
  assertEquals(enteredParams.buzz, 'nice'); // Declared query parameter
  assertEquals(enteredParams.undeclared, undefined); // Undeclared query parameter ignored

  mock.reset();
});

Deno.test('Query parameters - URL encoding and decoding', async () => {
  const mock = mockGlobalThis();

  let enteredParams: any = null;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({
      path: '/search?q&tags',
      onEnter: (params) => {
        enteredParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false });
  router.init();

  // Test URL encoding in query params
  await router.navigateAny('/search?q=hello%20world&tags=C%2B%2B');

  assertEquals(enteredParams.q, 'hello world');
  assertEquals(enteredParams.tags, 'C++');

  mock.reset();
});

Deno.test('Query parameters - computePath builds URLs correctly', () => {
  const mock = mockGlobalThis();

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({
      path: '/search/:category?q&sort',
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false });

  // Test building URL with query parameters
  const url = router.computePath('/search/:category?q&sort', {
    category: 'books',
    q: 'typescript',
    sort: 'price',
  });

  assertEquals(url.includes('/search/books'), true);
  assertEquals(url.includes('q=typescript'), true);
  assertEquals(url.includes('sort=price'), true);

  // Test with partial parameters
  const url2 = router.computePath('/search/:category?q&sort', {
    category: 'tech',
    q: 'javascript',
    // sort omitted
  });

  assertEquals(url2.includes('/search/tech'), true);
  assertEquals(url2.includes('q=javascript'), true);
  assertEquals(url2.includes('sort='), false);

  mock.reset();
});

Deno.test('Query parameters - mixed with existing functionality', async () => {
  const mock = mockGlobalThis();

  const visitedRoutes: string[] = [];

  const routes = [
    makeRoute({
      path: '/',
      onEnter: () => visitedRoutes.push('home'),
    }),
    makeRoute({
      path: '/search/:query?page&tags&exact',
      onEnter: (params) => {
        visitedRoutes.push(
          `search:${params.query}:${params.page}:${params.exact}`,
        );
      },
      onParamChange: (params) => {
        visitedRoutes.push(
          `search:${params.query}:${params.page}:${params.exact}`,
        );
      },
    }),
  ] as const;

  const router = createRouter(routes, {
    autoInit: false,
    fallbackPath: '/',
  });
  router.init();

  // Test regular route still works
  await router.navigate('/');
  assertEquals(visitedRoutes[visitedRoutes.length - 1], 'home');

  // Test route with query params
  await router.navigateAny('/search/typescript?page=2&tags=web&exact=true');
  assertEquals(
    visitedRoutes[visitedRoutes.length - 1],
    'search:typescript:2:true',
  );

  // Test navigation using typed parameters
  await router.navigate('/search/:query?page&tags&exact', {
    query: 'javascript',
    page: '1',
    tags: 'tutorial',
    exact: 'false',
  });
  assertEquals(
    visitedRoutes[visitedRoutes.length - 1],
    'search:javascript:1:false',
  );

  mock.reset();
});

Deno.test('Query parameters - parameters with and without values', async () => {
  const mock = mockGlobalThis();

  let enteredParams: any = null;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({
      path: '/product/:id?color&size&variant',
      onEnter: (params) => {
        enteredParams = params;
      },
    }),
    makeRoute({
      path: '/flags?verbose&debug&silent',
      onEnter: (params) => {
        enteredParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false });
  router.init();

  // Test parameters with values
  await router.navigateAny(
    '/product/laptop123?color=silver&size=15inch&variant=pro',
  );
  assertEquals(enteredParams.id, 'laptop123');
  assertEquals(enteredParams.color, 'silver');
  assertEquals(enteredParams.size, '15inch');
  assertEquals(enteredParams.variant, 'pro');

  // Test parameters without values (flags)
  enteredParams = null;
  await router.navigate('/'); // Reset
  await router.navigateAny('/flags?verbose&debug&silent');
  assertEquals(enteredParams.verbose, '');
  assertEquals(enteredParams.debug, '');
  assertEquals(enteredParams.silent, '');

  // Test mix of parameters with and without values
  enteredParams = null;
  await router.navigate('/'); // Reset
  await router.navigateAny('/product/phone456?color=black&variant');
  assertEquals(enteredParams.id, 'phone456');
  assertEquals(enteredParams.color, 'black');
  assertEquals(enteredParams.variant, ''); // Parameter without value becomes empty string
  assertEquals(enteredParams.size, undefined);

  mock.reset();
});

Deno.test('Query parameters - path-only navigation support', async () => {
  const mock = mockGlobalThis();

  let enteredParams: any = null;

  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({
      path: '/product/:id?color&size&variant',
      onEnter: (params) => {
        enteredParams = params;
      },
    }),
  ] as const;

  const router = createRouter(routes, { autoInit: false });
  router.init();

  // Test navigation with path-only pattern + query parameters
  await router.navigate('/product/:id', {
    id: 'phone456',
    color: 'blue',
    size: '6.1inch',
    variant: 'wifi',
  });

  assertEquals(enteredParams.id, 'phone456');
  assertEquals(enteredParams.color, 'blue');
  assertEquals(enteredParams.size, '6.1inch');
  assertEquals(enteredParams.variant, 'wifi');

  // Test navigation with concrete path + query parameters
  enteredParams = null;
  await router.navigate('/'); // Reset to different route first
  await router.navigate('/product/12', {
    color: 'red',
    size: 'large',
    variant: 'premium',
  });

  assertEquals(enteredParams.id, '12');
  assertEquals(enteredParams.color, 'red');
  assertEquals(enteredParams.size, 'large');
  assertEquals(enteredParams.variant, 'premium');

  // Test partial parameters work too
  enteredParams = null;
  await router.navigate('/'); // Reset to different route first
  await router.navigate('/product/:id', {
    id: 'tablet789',
    color: 'black',
    // size and variant omitted
  });

  assertEquals(enteredParams.id, 'tablet789');
  assertEquals(enteredParams.color, 'black');
  assertEquals(enteredParams.size, undefined);
  assertEquals(enteredParams.variant, undefined);

  mock.reset();
});

// Define your routes with path and query parameters
const router = createRouter(
  [
    { path: '/' },
    { path: '/about' },
    {
      path: '/user/:id',
      onEnter: (params) => {
        console.log(`Entering user profile: ${params.id}`);
        // params.id is typed as string!
      },
    },
    { path: '/post/:category/:slug' },
    {
      path: '/search?q&category&sort',
      onEnter: (params) => {
        console.log(`Search: ${params.q}, Category: ${params.category}`);
        // params.q, params.category, params.sort are typed as string | undefined
      },
    },
  ] as const,
);

// Navigate with type safety
await router.navigate('/');
await router.navigate('/about');
await router.navigate('/user/:id', { id: '123' });
await router.navigate('/user/123'); // Also works with concrete paths
await router.navigate('/post/:category/:slug', {
  category: 'tech',
  slug: 'intro-to-typescript',
});

// Navigate with query parameters
await router.navigate('/search?q=typescript&category=web&sort=recent');

// Or navigate with an object containing the query parameters
await router.navigate('/search', {
  q: 'typescript',
  category: 'web',
  sort: 'recent',
});
