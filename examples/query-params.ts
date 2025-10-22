// Query Parameters Example
// This example demonstrates the query parameter functionality in type-router

import { createRouter, makeRoute } from '../type-router.ts';

console.log('🚀 Query Parameters Example');

// Define routes with query parameters declared in the path
const routes = [
  makeRoute({
    path: '/',
    onEnter: () => {
      console.log('📍 Home page loaded');
    },
  }),

  // Static route with query parameters
  makeRoute({
    path: '/search?q&category&sort',
    onEnter: (params) => {
      console.log('🔍 Search page loaded with params:', {
        q: params.q,
        category: params.category,
        sort: params.sort,
      });
      // TypeScript knows: q, category, sort are all string | undefined
    },
    onParamChange: (params, prevParams) => {
      console.log('🔄 Search params changed:', {
        from: prevParams,
        to: params,
      });
    },
  }),

  // Route with both path parameters and query parameters
  makeRoute({
    path: '/product/:id?color&size&variant',
    onEnter: (params) => {
      console.log('📦 Product page loaded:', {
        id: params.id, // string (required path parameter)
        color: params.color, // string | undefined (optional query parameter)
        size: params.size, // string | undefined (optional query parameter)
        variant: params.variant, // string | undefined (optional query parameter)
      });
    },
  }),

  // Route showing path parameters trump query parameters with same name
  makeRoute({
    path: '/user/:id?id&settings&theme',
    onEnter: (params) => {
      console.log('👤 User profile loaded:', {
        id: params.id, // This will be the path parameter, not query parameter
        settings: params.settings,
        theme: params.theme,
      });
    },
  }),
] as const;

// Create router
const router = createRouter(routes, {
  urlType: 'hash',
  onEnter: (route, _params) => {
    console.log(`🎯 Global: Entered route ${route.path}`);
  },
});

// Demonstration function
async function _demo() {
  console.log('\n=== 1. Basic Query Parameter Navigation ===');

  // Navigate with query parameters
  await router.navigate(
    '/search?q=typescript&category=programming&sort=date',
  );

  // Navigate with partial query parameters
  await router.navigate('/search?q=javascript&sort=popularity');

  // Navigate with no query parameters
  await router.navigate('/search');

  console.log('\n=== 2. Path + Query Parameter Combination ===');

  // Navigate to product with query parameters
  await router.navigate(
    '/product/laptop123?color=silver&size=15inch&variant=pro',
  );

  // Navigate to product with invalid query parameters should fail type checks
  await router.navigate(
    // @ts-expect-error bad query parameter
    '/product/laptop123?color=silver&bomb=true',
  );
  // Navigate to product with invalid query parameters should fail type checks
  await router.navigate(
    // @ts-expect-error bad query parameter
    '/product/laptop123?color=silver&bomb',
  );

  // Navigate to same product with different query params (triggers onParamChange)
  await router.navigate('/product/laptop123?color=black&size=13inch');

  console.log('\n=== 3. Path Parameters Trump Query Parameters ===');

  // The 'id' in the query string will be ignored, path parameter wins
  await router.navigate(
    '/user/alice?id=should-be-ignored&settings=dark&theme=blue',
  );

  console.log('\n=== 4. Typed Navigation with computePath ===');

  // Build URLs with computePath
  const searchUrl = router.computePath('/search?q&category&sort', {
    q: 'react hooks',
    category: 'frontend',
    sort: 'recent',
  });
  console.log('🔧 Built search URL:', searchUrl);

  const productUrl = router.computePath('/product/:id?color&size&variant', {
    id: 'phone456',
    color: 'blue',
    size: '6.1inch',
    // variant omitted - will not appear in URL
  });
  console.log('🔧 Built product URL:', productUrl);

  // Navigate using typed parameters
  await router.navigate('/product/:id?color&size&variant', {
    id: 'tablet789',
    color: 'white',
    size: '10inch',
    variant: 'wifi',
  });

  console.log('\n=== 5. URL Encoding Handling ===');

  // Special characters are properly encoded/decoded
  await router.navigate('/search?q=hello%20world&category=C%2B%2B');

  console.log('\n=== 6. Only Declared Parameters Are Extracted ===');

  // Extra query parameters not declared in the route are ignored
  const state = await router.navigateAny(
    '/search?q=test&category=misc&undeclared=ignored&also=ignored',
  );
  // @ts-expect-error 'undeclared' is not a declared parameter, it's not valid
  state.params.undeclared;
  state.params.q?.toString();

  console.log('\n✅ Demo completed! Check the console output above.');
}

// Demonstration of enhanced path-only navigation patterns
async function _pathOnlyDemo() {
  console.log('\n=== Enhanced Path-Only Navigation Patterns ===');

  console.log('\n1. Path template navigation (enhanced):');
  // ✅ Use just the path pattern, include query params in parameters
  await router.navigate('/product/:id', {
    id: 'phone456',
    color: 'blue',
    size: '6.1inch',
    variant: 'wifi',
  });

  console.log('\n2. Concrete path navigation (enhanced):');
  // ✅ Use concrete path, ID extracted automatically
  await router.navigate('/product/12', {
    color: 'red',
    size: 'large',
    variant: 'premium',
  });

  console.log('\n3. Traditional method (still works):');
  // ✅ Original way with full path including query params
  await router.navigate('/product/:id?color&size&variant', {
    id: '789',
    color: 'green',
    size: 'medium',
  });

  console.log('\n4. All three approaches are equivalent and type-safe!');
  console.log('   - Path template: /product/:id + params');
  console.log('   - Concrete path: /product/123 + params');
  console.log('   - Traditional: /product/:id?color&size&variant + params');

  console.log('\n✅ Enhanced navigation demo completed!');
}

// Run the demonstration
// if (import.meta.main) {
//   await demo();
//   await pathOnlyDemo();
// }

// Export for use in other examples
export { router, routes };

/*
Key Features Demonstrated:

1. **Query Parameter Declaration**: Declare query parameters directly in the path using `?param1&param2&param3`

2. **Enhanced Path-Only Navigation**: Three equivalent ways to navigate:
   - Path template: `router.navigate('/product/:id', { id: '123', color: 'red' })`
   - Concrete path: `router.navigate('/product/123', { color: 'red' })`
   - Traditional: `router.navigate('/product/:id?color&size', { id: '123', color: 'red' })`

3. **Type Safety**: TypeScript correctly infers:
   - Path parameters as `string` (required)
   - Query parameters as `string | undefined` (optional)

4. **Parameter Precedence**: Path parameters always take precedence over query parameters with the same name

5. **URL Building**: Use `computePath` to build URLs with both path and query parameters

6. **Flexible Navigation**:
   - `navigateAny(path)` for any string path
   - `navigate(pattern, params)` for type-safe navigation with parameters

7. **Automatic Filtering**: Only declared query parameters are extracted; others are ignored

8. **URL Encoding**: Automatic encoding/decoding of special characters

Usage Examples:

```typescript
// Define a route with query parameters
makeRoute({
  path: '/product/:id?color&size&variant',
  onEnter: (params) => {
    // params.id: string (required)
    // params.color: string | undefined (optional)
    // params.size: string | undefined (optional)
    // params.variant: string | undefined (optional)
  }
})

// Enhanced navigation patterns (all equivalent):
router.navigate('/product/:id', { id: '123', color: 'red' });       // Path template
router.navigate('/product/123', { color: 'red' });                  // Concrete path
router.navigate('/product/:id?color&size', { id: '123', color: 'red' }); // Traditional
```
*/
