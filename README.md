# type-router

A lightweight, type-safe router for single-page applications with first-class
TypeScript support. Zero dependencies, full type inference, and a simple but
powerful API.

## Features

- 🎯 **Robust Type-Safety**: Full TypeScript support with automatic parameter
  type inference
- 🪶 **Lightweight**: Zero dependencies, ~2KB minified
- 🔄 **Flexible Routing**: Hash-based routing by default with history-based
  routing available
- 🎨 **Framework Agnostic**: Works with any UI framework or vanilla JavaScript
- 🪝 **Lifecycle Hooks**: Route enter/exit/change callbacks for fine-grained
  control
- 📦 **Simple API**: Intuitive and minimal API surface
- ⚡ **Fast**: Efficient regex-based route matching
- 🔀 **Async Navigation**: Consistent async behavior across routing modes
- 🔍 **Query Parameters**: First-class support for type-safe query parameters

## Installation

### From JSR

```bash
# Deno
deno add @itaylor/type-router

# npm (use any of npx, yarn dlx, pnpm dlx, or bunx)
npx jsr add @itaylor/type-router
```

### From npm

```bash
npm install @itaylor/type-router
# or
yarn add @itaylor/type-router
# or
pnpm add @itaylor/type-router
```

## Quick Start

```typescript
import { createRouter } from '@itaylor/type-router';

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
// TypeScript will catch these errors:
// router.navigate('/invalid-route');  // ❌ Type error!
// router.navigate('/user/:id', { wrong: '123' }); // ❌ Type error!
// router.navigate('/search?bomb=true'); // ❌ Type error!
```

## Core Concepts

### Routes

Routes are defined as objects with a `path` pattern and optional lifecycle
hooks:

```typescript
const router = createRouter(
  [
    {
      path: '/user/:id/posts/:postId',
      onEnter: (params) => {
        // Called when entering this route
        console.log(`User ${params.id}, Post ${params.postId}`);
      },
      onExit: (params) => {
        // Called when leaving this route
        console.log(`Leaving user ${params.id}`);
      },
      onParamChange: (params, prevParams) => {
        // Called when navigating to the same route with different params
        console.log(`User changed from ${prevParams.id} to ${params.id}`);
      },
    },
  ] as const,
);
```

### Route Parameters

Parameters in routes are defined using the `:paramName` syntax. TypeScript
automatically infers the parameter types:

```typescript
const router = createRouter(
  [{ path: '/product/:category/:id' }] as const,
);

// TypeScript knows params must have 'category' and 'id'
router.navigate('/product/:category/:id', {
  category: 'electronics',
  id: 'laptop-123',
});
```

### Query Parameters

Query parameters are declared directly in the route path using the syntax
`?param1&param2&param3`. They are always optional and type-safe:

```typescript
const router = createRouter(
  [
    { path: '/search?q&category&sort' },
    { path: '/product/:id?color&size&variant' }, // Mixed path + query params
  ] as const,
);

// All query parameters are optional (string | undefined)
await router.navigate('/search?q=typescript&category=web');
await router.navigate('/search'); // Works without query params

// Mixed path and query parameters
await router.navigate('/product/laptop123?color=silver&size=15inch');

// Path parameters always take precedence over query parameters with same name
const router2 = createRouter([{ path: '/user/:id?id&settings' }] as const);
await router2.navigate('/user/alice?id=ignored&settings=dark');
// params.id === 'alice' (from path), not 'ignored' (from query)
```

**Key principles:**

- ✅ **Only declared query parameters are extracted** - undeclared params are
  ignored
- ✅ **Query parameters don't affect route matching** - only the path part
  (before `?`) is used
- ✅ **Path parameters trump query parameters** - when there's a name conflict,
  path params win
- ✅ **Type-safe and optional** - all query params are `string | undefined`

### Navigation Modes

type-router supports two URL modes:

```typescript
// Hash mode (default) - Works everywhere, no server config needed!
// URLs look like: #/path/to/route
const hashRouter = createRouter(routes); // Uses hash mode by default

// History mode - Clean URLs, requires server configuration
// URLs look like: /path/to/route
const historyRouter = createRouter(routes, {
  urlType: 'history',
});
```

## Routing Modes

### Hash Mode (Default) 🎯

Hash mode is the default because it alway works everywhere:

```typescript
// Hash mode - no configuration needed!
const router = createRouter(routes); // Uses hash mode by default
```

**Benefits:**

- ✅ **Zero server setup** - Works on GitHub Pages, Netlify, Vercel, S3, CDNs
- ✅ **No 404 errors** - Users can directly visit `yoursite.com/#/users/123`
- ✅ **File:// URLs work** - Perfect for local development and Electron apps
- ✅ **Instant deployment** - Upload files anywhere and routing works
- ✅ **Great for demos** - CodeSandbox, JSFiddle, static demos work immediately

**URLs look like:** `https://yoursite.com/#/users/123`

### History Mode

For clean URLs when you have server control:

```typescript
const router = createRouter(routes, {
  urlType: 'history',
});
```

**Benefits:**

- ✅ **Clean URLs** - `https://yoursite.com/users/123` (no hash)
- ✅ **SEO friendly** - Traditional URL structure
- ✅ **Server-side rendering** compatible

**Requirements:**

- ❗ **Server configuration needed** - Must serve `index.html` for all routes
- ❗ **Hosting limitations** - Not all static hosts support this easily

### When to Use Each

**Choose Hash Mode (default) when:**

- Building a client-only SPA
- Using static hosting (GitHub Pages, Netlify, etc.)
- Want zero configuration
- Rapid prototyping or demos
- Building desktop apps with Electron

**Choose History Mode when:**

- Clean URLs are critical
- You control the server
- SEO is a primary concern

## API Reference

### `createRouter(routes, options?)`

Creates a new router instance.

#### Parameters

- `routes`: An array of route definitions (use `as const` for best type
  inference)
- `options`: Optional configuration object

#### Options

| Option          | Type                  | Default     | Description                                                                                             |
| --------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `urlType`       | `'hash' \| 'history'` | `'hash'`    | Routing mode to use                                                                                     |
| `fallbackPath`  | `string`              | `undefined` | Route to use when no match is found (must be a concrete, non-parameterized route path from your routes) |
| `autoInit`      | `boolean`             | `true`      | Automatically initialize routing on creation                                                            |
| `onEnter`       | `function`            | `undefined` | Global hook called when entering any route                                                              |
| `onExit`        | `function`            | `undefined` | Global hook called when exiting any route                                                               |
| `onParamChange` | `function`            | `undefined` | Global hook called when params change                                                                   |
| `onMiss`        | `function`            | `undefined` | Called when no route matches                                                                            |

### `makeRoute(route)`

Helper function that creates a route with proper TypeScript inference. While not
strictly required, it provides better type checking when defining routes outside
of the `createRouter` call.

```typescript
import { makeRoute } from '@itaylor/type-router';

// Better type inference
const userRoute = makeRoute({
  path: '/user/:id',
  onEnter: (params) => {
    // params.id is properly typed as string
    console.log('User ID:', params.id);
  },
});

const router = createRouter([userRoute] as const);
```

### Router Methods

#### `navigate(path, params?)`

Navigate to a route with compile-time type checking. Returns a Promise that
resolves when navigation is complete.

```typescript
// With parameters (pattern matching)
await router.navigate('/user/:id', { id: '123' });

// With concrete path
await router.navigate('/user/123');

// Trailing slashes are optional
await router.navigate('/about');
await router.navigate('/about/'); // Same as above
```

#### `navigateAny(path)`

Navigate to any string path without compile-time type checking. Useful for
runtime navigation from user input, HTML links, or external URLs. Returns a
Promise that resolves when navigation is complete.

```typescript
// Navigate to any path - useful for dynamic/runtime navigation
await router.navigateAny('/dynamic/path/from/user/input');
await router.navigateAny(window.location.pathname); // Current URL

// No compile-time checking - will use fallback if route doesn't exist
await router.navigateAny('/potentially/invalid/route');
```

#### `getState()`

Get the current routing state. Returns an object with nullable properties.

```typescript
const state = router.getState();

// State properties can be null if no route is active
console.log(state.path); // string | null - Current path
console.log(state.params); // Record<string, string> - Current parameters
console.log(state.route); // Route object | null - Current route

// Always check for null before using
if (state.route) {
  console.log('Current route:', state.route.path);
}
```

**Note**: The state types are unions of all possible routes, not strictly typed
to the current route. Always check `state.route` for null and use type guards as
needed.

#### `subscribe(callback)`

Subscribe to route changes. Returns an unsubscribe function.

```typescript
const unsubscribe = router.subscribe((state) => {
  console.log('Route changed:', state.path);

  // Check for null route
  if (state.route) {
    console.log('Active route:', state.route.path);
  }
});

// Later...
unsubscribe();
```

#### `computePath(pattern, params?)`

Convert a route pattern and parameters into a concrete path. Works with both
path and query parameters.

```typescript
const path = router.computePath('/user/:id', { id: '123' });
console.log(path); // '/user/123'

// With query parameters
const searchPath = router.computePath('/search?q&category&sort', {
  q: 'typescript',
  category: 'web',
  sort: 'recent',
});
console.log(searchPath); // '/search?q=typescript&category=web&sort=recent'

// Mixed path and query parameters
const productPath = router.computePath('/product/:id?color&size', {
  id: 'laptop123',
  color: 'silver',
  // size omitted - won't appear in URL
});
console.log(productPath); // '/product/laptop123?color=silver'

// Works without parameters for routes without params
const homePath = router.computePath('/');
console.log(homePath); // '/'
```

#### `init()`

Manually initialize the router. Useful when `autoInit` is `false`.

```typescript
const router = createRouter(routes, {
  autoInit: false,
});

// Later, when ready...
router.init();
```

## Advanced Usage

### Using makeRoute for Better Type Safety

When defining routes outside of `createRouter`, use `makeRoute` for better type
inference:

```typescript
import { createRouter, makeRoute } from '@itaylor/type-router';

// When routes are defined inline - no makeRoute needed
const inlineRouter = createRouter(
  [
    {
      path: '/user/:id',
      onEnter: (params) => {
        // params.id is properly inferred as string
        console.log(params.id);
      },
    },
  ] as const,
);

// When routes are defined separately - makeRoute helps with inference
const userRoute = makeRoute({
  path: '/user/:id',
  onEnter: (params) => {
    // params.id is properly inferred as string
    console.log(params.id);
  },
});

const separateRouter = createRouter([userRoute] as const);
```

### Query Parameters

Query parameters provide a powerful way to add optional, type-safe parameters to
your routes. They're declared directly in the route path and automatically
inferred by TypeScript.

#### Enhanced Path-Only Navigation

Query parameters support three equivalent navigation patterns:

```typescript
const router = createRouter(
  [{ path: '/product/:id?color&size&variant' }] as const,
);

// All three approaches are equivalent and type-safe:

// 1. Path template (enhanced)
await router.navigate('/product/:id', {
  id: 'phone456',
  color: 'blue',
  size: '6.1inch',
  variant: 'wifi',
});

// 2. Concrete path (enhanced)
await router.navigate('/product/12', {
  color: 'red',
  size: 'large',
  variant: 'premium',
});

// 3. Traditional (still works)
await router.navigate('/product/:id?color&size&variant', {
  id: '789',
  color: 'green',
});
```

#### Key Features

- **Path parameters are required** (`string`) - extracted from URL path
- **Query parameters are optional** (`string | undefined`) - declared after `?`
- **Path parameters trump query parameters** with the same name
- **URL encoding/decoding** is handled automatically
- **Only declared parameters** are extracted; others are ignored

```typescript
// Mixed path and query parameters
const router = createRouter(
  [
    { path: '/search/:query?page&category&sort' },
  ] as const,
);

// TypeScript knows: query is required, others are optional
await router.navigate('/search/:query', {
  query: 'typescript', // string (required)
  page: '2', // string | undefined (optional)
  category: 'programming', // string | undefined (optional)
  // sort omitted - perfectly valid
});
```

### Global vs Route-Level Hooks

You can define hooks at both global and route levels. Global hooks run before
route-level hooks:

```typescript
const router = createRouter(
  [
    {
      path: '/dashboard',
      onEnter: () => console.log('Route: Entering dashboard'),
    },
  ],
  {
    onEnter: (route, params) => {
      console.log('Global: Entering', route.path);
    },
  },
);

// Navigation will log:
// "Global: Entering /dashboard"
// "Route: Entering dashboard"
```

### Fallback Routes and Error Handling

Handle unmatched routes gracefully with compile-time type safety:

```typescript
const router = createRouter(
  [
    { path: '/' },
    { path: '/about' },
    { path: '/user/:id' }, // Parameterized route
    { path: '/404' },
  ] as const,
  {
    // ✅ Valid - fallback must be a concrete route from your routes
    fallbackPath: '/404',

    // ❌ TypeScript error - fallback cannot be parameterized
    // fallbackPath: "/user/:id",

    // ❌ TypeScript error - fallback must exist in routes
    // fallbackPath: "/nonexistent",

    onMiss: (path) => {
      console.log(`No route found for: ${path}, redirecting to 404`);
    },
  },
);

// Use navigateAny for potentially invalid routes
await router.navigateAny('/some/unknown/path'); // Will use fallback
```

#### Fallback Path Constraints

The `fallbackPath` option has compile-time type checking with these rules:

1. **Must exist in your routes**: TypeScript ensures the fallback path matches
   one of your defined routes
2. **Cannot be parameterized**: Fallback paths must be concrete (no `:param`
   segments)
3. **Type safety**: Prevents typos and ensures fallback routes are actually
   available

```typescript
// ✅ Valid fallback configurations
const router1 = createRouter(
  [
    { path: '/' },
    { path: '/404' },
  ] as const,
  {
    fallbackPath: '/', // Concrete route that exists
  },
);

const router2 = createRouter(
  [
    { path: '/home' },
    { path: '/error' },
  ] as const,
  {
    fallbackPath: '/error', // Another concrete route
  },
);

// ❌ Invalid - TypeScript will catch these
const router3 = createRouter(
  [
    { path: '/user/:id' },
  ] as const,
  {
    // fallbackPath: "/user/:id" // Error: Cannot use parameterized route
    // fallbackPath: "/missing" // Error: Route doesn't exist
  },
);
```

### Runtime vs Compile-time Navigation

Choose the right navigation method for your use case:

```typescript
const router = createRouter(
  [
    { path: '/user/:id' },
    { path: '/search/:query' },
  ] as const,
);

// Compile-time checked - preferred for known routes
await router.navigate('/user/:id', { id: '123' });

// Runtime navigation - use for dynamic scenarios
const userInput = '/search/typescript';
await router.navigateAny(userInput);

// Click handler example
document.addEventListener('click', async (e) => {
  const link = e.target.closest('[data-route]');
  if (link) {
    e.preventDefault();
    await router.navigateAny(link.getAttribute('href'));
  }
});
```

### Delayed Initialization

Sometimes you need to set up your app before activating routing:

```typescript
const router = createRouter(routes, {
  autoInit: false,
});

// Do some async setup...
await loadUserData();
await initializeApp();

// Now initialize routing
router.init();
```

### Parameter Changes

When navigating to the same route with different parameters, only
`onParamChange` is called:

```typescript
const router = createRouter(
  [
    {
      path: '/user/:id',
      onEnter: (params) => {
        console.log('Setting up user view');
      },
      onParamChange: (params, prevParams) => {
        console.log(`User changed from ${prevParams.id} to ${params.id}`);
      },
      onExit: () => {
        console.log('Cleaning up user view');
      },
    },
  ] as const,
);

await router.navigate('/user/:id', { id: '1' }); // Calls onEnter
await router.navigate('/user/:id', { id: '2' }); // Calls onParamChange only
await router.navigate('/'); // Calls onExit
```

## TypeScript Benefits

type-router provides exceptional TypeScript support:

### Type-Safe Navigation

```typescript
const router = createRouter(
  [
    { path: '/user/:userId' },
    { path: '/post/:category/:id' },
  ] as const,
);

// ✅ All valid
router.navigate('/user/:userId', { userId: '123' });
router.navigate('/user/123');
router.navigate('/post/tech/typescript-intro');

// With query parameters
router.navigateAny('/search?q=typescript&category=web');

// ❌ TypeScript errors
router.navigate('/unknown'); // Unknown route
router.navigate('/user/:userId', { id: '123' }); // Wrong param name
router.navigate('/post/:category'); // Missing param
```

### Inferred Parameter Types

```typescript
const router = createRouter(
  [
    {
      path: '/article/:year/:month/:slug',
      onEnter: (params) => {
        // TypeScript knows params has year, month, and slug properties
        const { year, month, slug } = params; // All typed as string
      },
    },
    {
      path: '/search/:query?page&tags&exact',
      onEnter: (params) => {
        // Path parameters are required (string)
        const query: string = params.query;

        // Query parameters are optional (string | undefined)
        const page: string | undefined = params.page;
        const tags: string | undefined = params.tags;
        const exact: string | undefined = params.exact;
      },
    },
  ] as const,
);
```

## Error Handling

type-router throws errors for invalid paths and missing routes:

```typescript
// Invalid paths (double slashes) throw immediately
try {
  await router.navigate('//invalid//path');
} catch (error) {
  console.error('Invalid path:', error.message);
}

// Unknown routes without fallback throw errors
try {
  await router.navigate('/unknown');
} catch (error) {
  console.error('Route not found:', error.message);
}

// Use navigateAny with fallback for safe navigation
const router = createRouter(routes, {
  fallbackPath: '/404',
  onMiss: (path) => console.log(`Redirecting ${path} to 404`),
});

await router.navigateAny('/unknown'); // Safe - uses fallback
```

## License

MIT
