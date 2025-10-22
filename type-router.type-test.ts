/// <reference lib="deno.ns" />

/**
 * Type-level tests for type-router
 *
 * These tests verify compile-time type checking behavior.
 * They don't need to be executed - TypeScript's compiler checks them.
 *
 * Run with: deno check type-router.type-test.ts
 */

import {
  createRouter,
  type IsConcretePath,
  makeRoute,
  type ParamsFor,
  type Route,
  type RouteState,
} from './type-router.ts';

// ============================================================================
// Type Testing Utilities
// ============================================================================

/**
 * Utility type to check if two types are exactly equal
 */
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

/**
 * Utility to assert types are equal at compile time
 */
type AssertEqual<T extends true> = T;

/**
 * Utility to assert a type is never
 */
type AssertNever<T extends never> = T;

/**
 * Utility to assert a type extends another
 */
type AssertExtends<T, U extends T> = U;

// ============================================================================
// Path Validation Tests
// ============================================================================

// Test: Paths with empty segments should be rejected
{
  // Valid paths should work
  const _validRoute1 = makeRoute({ path: '/users' });
  const _validRoute2 = makeRoute({ path: '/users/:id' });
  const _validRoute3 = makeRoute({ path: '/users/:id/posts/:postId' });

  // @ts-expect-error - Path with empty segments should be rejected
  const _invalidRoute1 = makeRoute({ path: '//users' });

  // @ts-expect-error - Path with empty segments in middle should be rejected
  const _invalidRoute2 = makeRoute({ path: '/users//posts' });

  // @ts-expect-error - Path with multiple consecutive slashes should be rejected
  const _invalidRoute3 = makeRoute({ path: '///' });

  // @ts-expect-error - Path with trailing double slash should be rejected
  const _invalidRoute4 = makeRoute({ path: '/users//' });
}

// ============================================================================
// Parameter Extraction Tests
// ============================================================================

// Test: ParamsFor should extract parameters correctly
{
  type Test1 = AssertEqual<Equal<ParamsFor<'/users'>, Record<string, string>>>;
  type Test2 = AssertEqual<Equal<ParamsFor<'/users/:id'>, { id: string }>>;
  type Test3 = AssertEqual<
    Equal<ParamsFor<'/users/:id/posts/:postId'>, { id: string; postId: string }>
  >;

  // Multiple params in sequence
  type Test4 = AssertEqual<
    Equal<ParamsFor<'/:category/:subcategory/:id'>, {
      category: string;
      subcategory: string;
      id: string;
    }>
  >;
}

// ============================================================================
// Route Creation Tests
// ============================================================================

// Test: Route callbacks receive correctly typed parameters
{
  const _route1 = makeRoute({
    path: '/users/:userId/posts/:postId',
    onEnter: (params) => {
      // These should be typed correctly
      const _userId: string = params.userId;
      const _postId: string = params.postId;

      // @ts-expect-error - Property 'invalid' does not exist
      const _invalid = params.invalid;
    },
    onParamChange: (params, prevParams) => {
      // Both should have the same shape
      const _userId: string = params.userId;
      const _prevUserId: string = prevParams.userId;
    },
  });
}

// ============================================================================
// Router Navigation Tests
// ============================================================================

// Test: Router navigation type checking
{
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/about' }),
    makeRoute({ path: '/users/:id' }),
    makeRoute({ path: '/posts/:category/:id' }),
  ] as const;

  const router = createRouter(routes);

  // Valid navigations
  router.navigate('/');
  router.navigate('/about');
  router.navigate('/users/:id', { id: '123' });
  router.navigate('/posts/:category/:id', { category: 'tech', id: '456' });

  // Valid concrete paths
  router.navigate('/users/123');
  router.navigate('/posts/tech/456');

  // @ts-expect-error - Path doesn't exist in routes
  router.navigate('/invalid');

  // @ts-expect-error - Missing required parameters
  router.navigate('/users/:id');

  // @ts-expect-error - Wrong parameter name
  router.navigate('/users/:id', { userId: '123' });

  // @ts-expect-error - Missing one of the required parameters
  router.navigate('/posts/:category/:id', { category: 'tech' });

  // @ts-expect-error - Extra parameters not allowed
  router.navigate('/users/:id', { id: '123', extra: 'value' });

  // @ts-expect-error - Path with empty segments not allowed
  router.navigate('//about');
}

// ============================================================================
// Concrete vs Parameterized Path Tests
// ============================================================================

// Test: IsConcretePath type helper
{
  type TestConcrete1 = AssertEqual<Equal<IsConcretePath<'/users/123'>, true>>;
  type TestConcrete2 = AssertEqual<Equal<IsConcretePath<'/about'>, true>>;
  type TestConcrete3 = AssertEqual<Equal<IsConcretePath<'/'>, true>>;

  type TestNotConcrete1 = AssertEqual<
    Equal<IsConcretePath<'/users/:id'>, false>
  >;
  type TestNotConcrete2 = AssertEqual<
    Equal<IsConcretePath<'/:category/:id'>, false>
  >;
  type TestNotConcrete3 = AssertEqual<
    Equal<IsConcretePath<'/posts/:slug'>, false>
  >;
}

// Test: ConcretePathForUnion only accepts concrete paths
{
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/users/:id' }),
    makeRoute({ path: '/posts/:category/:id' }),
  ] as const;

  const router = createRouter(routes);

  // These should work - concrete paths that match patterns
  router.navigate('/users/123'); // concrete path matching /users/:id
  router.navigate('/posts/tech/456'); // concrete path matching /posts/:category/:id
  router.navigate('/'); // exact match

  // These should NOT work - parameterized paths should use other overload
  // @ts-expect-error - Parameterized path should require params
  router.navigate('/users/:id');

  // @ts-expect-error - Parameterized path should require params
  router.navigate('/posts/:category/:id');

  // But these SHOULD work with params
  router.navigate('/users/:id', { id: '123' });
  router.navigate('/posts/:category/:id', { category: 'tech', id: '456' });
}

// ============================================================================
// Navigate Function Overload Tests
// ============================================================================

// Test: Navigate function should have correct overloads
{
  const routes = [
    makeRoute({ path: '/users/:id' }),
    makeRoute({ path: '/posts/:category/:slug' }),
  ] as const;

  const router = createRouter(routes);

  // Test overload 1: Pattern with params
  const _promise1 = router.navigate('/users/:id', { id: '123' });

  // Test overload 2: Concrete path
  const _promise2 = router.navigate('/users/123');
}

// ============================================================================
// Path-only navigation with query parameters type tests
// ============================================================================

function _testPathOnlyNavigationTypes() {
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/product/:id?color&size&variant' }),
    makeRoute({ path: '/search/:query?page&tags&exact' }),
  ] as const;

  const router = createRouter(routes);

  // ✅ Valid: Path-only pattern with all parameters (including query params)
  const promise1 = router.navigate('/product/:id', {
    id: '123',
    color: 'red',
    size: 'large',
    variant: 'premium',
  });

  // ✅ Valid: Path-only pattern with partial parameters
  const promise2 = router.navigate('/product/:id', {
    id: '456',
    color: 'blue',
    // size and variant omitted (optional)
  });

  // ✅ Valid: Concrete path with query parameters
  const promise3 = router.navigate('/product/789', {
    color: 'green',
    size: 'medium',
  });

  // ✅ Valid: Concrete path with no query parameters
  const promise4 = router.navigate('/product/999', {});

  // ✅ Valid: Mixed path and query parameters
  const promise5 = router.navigate('/search/:query', {
    query: 'typescript',
    page: '1',
    tags: 'programming',
    exact: 'true',
  });

  // Type assertions to verify return types
  type TestPromise1 = AssertEqual<
    Equal<typeof promise1, Promise<RouteState<typeof routes>>>
  >;
  type TestPromise2 = AssertEqual<
    Equal<typeof promise2, Promise<RouteState<typeof routes>>>
  >;
  type TestPromise3 = AssertEqual<
    Equal<typeof promise3, Promise<RouteState<typeof routes>>>
  >;
  type TestPromise4 = AssertEqual<
    Equal<typeof promise4, Promise<RouteState<typeof routes>>>
  >;
  type TestPromise5 = AssertEqual<
    Equal<typeof promise5, Promise<RouteState<typeof routes>>>
  >;

  // TypeScript should catch these errors:

  //@ts-expect-error Missing required path parameter
  const _errorPromise1 = router.navigate('/product/:id', {
    color: 'red',
    // id is missing!
  });

  //@ts-expect-error Wrong parameter name
  const _errorPromise2 = router.navigate('/product/:id', {
    id: '123',
    colour: 'red', // should be 'color'
  });

  //@ts-expect-error Undeclared query parameter
  const _errorPromise3 = router.navigate('/product/:id', {
    id: '123',
    color: 'red',
    undeclared: 'param', // not in route definition
  });

  //@ts-expect-error  Invalid path-only pattern
  const _errorPromise4 = router.navigate('/nonexistent/:id', {
    id: '123',
  });
}

// ============================================================================</text>

// Router State Types
// ============================================================================

// Test: getState should return correctly typed state
{
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/users/:id' }),
  ] as const;

  const router = createRouter(routes);
  const state = router.getState();

  // State should have the correct shape
  type StateTest = typeof state;
  type TestPath = AssertExtends<string | null, StateTest['path']>;
  type TestRoute = AssertExtends<
    Route<'/' | '/users/:id'> | null,
    StateTest['route']
  >;

  // Params should be a union of all possible params
  if (state.route?.path === '/users/:id') {
    // TypeScript should know params has 'id' when route is /users/:id
    const _id: string = state.params.id;
  }
}

// ============================================================================
// Subscribe Callback Types
// ============================================================================

// Test: Subscribe callback receives correctly typed state
{
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/users/:id' }),
  ] as const;

  const router = createRouter(routes);

  const unsubscribe = router.subscribe((state) => {
    // State should be typed correctly
    if (state.route?.path === '/users/:id') {
      const _id: string = state.params.id;

      // @ts-expect-error - When route is /users/:id, params.invalid doesn't exist
      const _invalid = state.params.invalid;
    }
  });

  // Unsubscribe should be a function
  type TestUnsubscribe = AssertEqual<Equal<typeof unsubscribe, () => void>>;
}

// ============================================================================
// ComputePath Tests
// ============================================================================

// Test: computePath should type check parameters
{
  const routes = [
    makeRoute({ path: '/users/:id' }),
    makeRoute({ path: '/posts/:category/:id' }),
  ] as const;

  const router = createRouter(routes);

  // Valid usage
  const _path1: string = router.computePath('/users/:id', { id: '123' });
  const _path2: string = router.computePath('/posts/:category/:id', {
    category: 'tech',
    id: '456',
  });

  // @ts-expect-error - Wrong parameter name
  router.computePath('/users/:id', { userId: '123' });

  // @ts-expect-error - Missing required parameter
  router.computePath('/posts/:category/:id', { category: 'tech' });

  // Path without params shouldn't require params object
  const routes2 = [makeRoute({ path: '/' })] as const;
  const router2 = createRouter(routes2);
  const _path3: string = router2.computePath('/');
}

// ============================================================================
// Options Type Tests
// ============================================================================

// Test: Router options should be properly typed
{
  const routes = [
    makeRoute({ path: '/' }),
    makeRoute({ path: '/404' }),
  ] as const;

  // Valid options
  const _router1 = createRouter(routes, {
    urlType: 'hash',
    fallbackPath: '/404',
    autoInit: false,
    onMiss: (path: string) => console.log(path),
    onEnter: (route, params) => console.log(route.path, params),
    onExit: (route, params) => console.log(route.path, params),
    onParamChange: (route, params, prevParams) =>
      console.log(route.path, params, prevParams),
  });

  const _router2 = createRouter(routes, {
    // @ts-expect-error - Invalid urlType
    urlType: 'invalid',
  });

  const _router3 = createRouter(routes, {
    // @ts-expect-error - fallbackPath must be a route that exists
    fallbackPath: '/nonexistent',
  });

  const _router4 = createRouter(routes, {
    // @ts-expect-error - Invalid option
    invalidOption: true,
  });
}

// ============================================================================
// Trailing Slash Tests
// ============================================================================

// Test: Trailing slashes should be handled
{
  const routes = [
    makeRoute({ path: '/users' }),
    makeRoute({ path: '/posts/:id' }),
  ] as const;

  const router = createRouter(routes);

  // With trailing slash should work
  router.navigate('/users/');
  router.navigate('/posts/:id/', { id: '123' });
  router.navigate('/posts/123/');

  // Without trailing slash should also work
  router.navigate('/users');
  router.navigate('/posts/:id', { id: '123' });
  router.navigate('/posts/123');
}

// ============================================================================
// Complex Nested Routes Tests
// ============================================================================

// Test: Deeply nested routes with multiple parameters
{
  const routes = [
    makeRoute({
      path: '/org/:orgId/projects/:projectId/tasks/:taskId/comments/:commentId',
    }),
  ] as const;

  const router = createRouter(routes);

  // All parameters should be required
  router.navigate(
    '/org/:orgId/projects/:projectId/tasks/:taskId/comments/:commentId',
    {
      orgId: '1',
      projectId: '2',
      taskId: '3',
      commentId: '4',
    },
  );
  // @ts-expect-error - Missing commentId
  router.navigate(
    '/org/:orgId/projects/:projectId/tasks/:taskId/comments/:commentId',
    {
      orgId: '1',
      projectId: '2',
      taskId: '3',
    },
  );
}

// If this file type-checks without errors (except for @ts-expect-error lines),
// then all type-level tests pass!
console.log(
  'Type tests completed. Check TypeScript output for any unexpected errors.',
);
