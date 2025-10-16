# type-router

A lightweight, type-safe router for single-page applications with first-class TypeScript support. Zero dependencies, full type inference, and a simple but powerful API.

## Features

- 🎯 **100% Type-Safe**: Full TypeScript support with automatic parameter type inference
- 🪶 **Lightweight**: Zero dependencies, ~2KB minified
- 🔄 **Flexible Routing**: Support for both hash-based and history-based routing
- 🎨 **Framework Agnostic**: Works with any UI framework or vanilla JavaScript
- 🪝 **Lifecycle Hooks**: Route enter/exit/change callbacks for fine-grained control
- 📦 **Simple API**: Intuitive and minimal API surface
- ⚡ **Fast**: Efficient regex-based route matching
- 🔀 **Async Navigation**: Consistent async behavior across routing modes

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

// Define your routes
const router = createRouter([
  { path: '/' },
  { path: '/about' },
  { 
    path: '/user/:id',
    onEnter: (params) => {
      console.log(`Entering user profile: ${params.id}`);
      // params.id is typed as string!
    }
  },
  { path: '/post/:category/:slug' }
] as const);

// Navigate with type safety
await router.navigate('/');
await router.navigate('/about');
await router.navigate('/user/:id', { id: '123' });
await router.navigate('/user/123'); // Also works with concrete paths
await router.navigate('/post/:category/:slug', { 
  category: 'tech', 
  slug: 'intro-to-typescript' 
});

// TypeScript will catch these errors:
// router.navigate('/invalid-route');  // ❌ Type error!
// router.navigate('/user/:id', { wrong: '123' }); // ❌ Type error!
```

## Core Concepts

### Routes

Routes are defined as objects with a `path` pattern and optional lifecycle hooks:

```typescript
const route = {
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
  }
};
```

### Route Parameters

Parameters in routes are defined using the `:paramName` syntax. TypeScript automatically infers the parameter types:

```typescript
const router = createRouter([
  { path: '/product/:category/:id' }
] as const);

// TypeScript knows params must have 'category' and 'id'
router.navigate('/product/:category/:id', {
  category: 'electronics',
  id: 'laptop-123'
});
```

### Navigation Modes

type-router supports two URL modes:

```typescript
// History mode (default) - Uses HTML5 History API
// URLs look like: /path/to/route
const historyRouter = createRouter(routes, {
  urlType: 'history'
});

// Hash mode - Uses URL hash
// URLs look like: #/path/to/route
const hashRouter = createRouter(routes, {
  urlType: 'hash'
});
```

## API Reference

### `createRouter(routes, options?)`

Creates a new router instance.

#### Parameters

- `routes`: An array of route definitions (use `as const` for best type inference)
- `options`: Optional configuration object

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `urlType` | `'hash' \| 'history'` | `'history'` | Routing mode to use |
| `fallbackPath` | `string` | `undefined` | Route to use when no match is found |
| `autoInit` | `boolean` | `true` | Automatically initialize routing on creation |
| `onEnter` | `function` | `undefined` | Global hook called when entering any route |
| `onExit` | `function` | `undefined` | Global hook called when exiting any route |
| `onParamChange` | `function` | `undefined` | Global hook called when params change |
| `onMiss` | `function` | `undefined` | Called when no route matches |

### Router Methods

#### `navigate(path, params?)`

Navigate to a route. Returns a Promise that resolves when navigation is complete.

```typescript
// With parameters
await router.navigate('/user/:id', { id: '123' });

// With concrete path
await router.navigate('/user/123');

// Trailing slashes are optional
await router.navigate('/about');
await router.navigate('/about/'); // Same as above
```

#### `getState()`

Get the current routing state.

```typescript
const state = router.getState();
console.log(state.path);   // Current path
console.log(state.params); // Current parameters
console.log(state.route);  // Current route object
```

#### `subscribe(callback)`

Subscribe to route changes. Returns an unsubscribe function.

```typescript
const unsubscribe = router.subscribe((state) => {
  console.log('Route changed:', state.path);
});

// Later...
unsubscribe();
```

#### `computePath(pattern, params?)`

Convert a route pattern and parameters into a concrete path.

```typescript
const path = router.computePath('/user/:id', { id: '123' });
console.log(path); // '/user/123'
```

#### `init()`

Manually initialize the router. Useful when `autoInit` is `false`.

```typescript
const router = createRouter(routes, { 
  autoInit: false 
});

// Later, when ready...
router.init();
```

## Advanced Usage

### Global vs Route-Level Hooks

You can define hooks at both global and route levels. Global hooks run before route-level hooks:

```typescript
const router = createRouter([
  {
    path: '/dashboard',
    onEnter: () => console.log('Route: Entering dashboard')
  }
], {
  onEnter: (route, params) => {
    console.log('Global: Entering', route.path);
  }
});

// Navigation will log:
// "Global: Entering /dashboard"
// "Route: Entering dashboard"
```

### Fallback Routes

Handle unmatched routes gracefully:

```typescript
const router = createRouter([
  { path: '/' },
  { path: '/about' },
  { path: '/404' }
] as const, {
  fallbackPath: '/404',
  onMiss: (path) => {
    console.log(`No route found for: ${path}`);
  }
});
```

### Delayed Initialization

Sometimes you need to set up your app before activating routing:

```typescript
const router = createRouter(routes, {
  autoInit: false
});

// Do some async setup...
await loadUserData();
await initializeApp();

// Now initialize routing
router.init();
```

### Parameter Changes

When navigating to the same route with different parameters, only `onParamChange` is called:

```typescript
const router = createRouter([
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
    }
  }
] as const);

await router.navigate('/user/:id', { id: '1' }); // Calls onEnter
await router.navigate('/user/:id', { id: '2' }); // Calls onParamChange only
await router.navigate('/');                       // Calls onExit
```

## TypeScript Benefits

type-router provides exceptional TypeScript support:

### Type-Safe Navigation

```typescript
const router = createRouter([
  { path: '/user/:userId' },
  { path: '/post/:category/:id' }
] as const);

// ✅ All valid
router.navigate('/user/:userId', { userId: '123' });
router.navigate('/user/123');
router.navigate('/post/tech/typescript-intro');

// ❌ TypeScript errors
router.navigate('/unknown');                        // Unknown route
router.navigate('/user/:userId', { id: '123' });   // Wrong param name
router.navigate('/post/:category');                 // Missing param
```

### Inferred Parameter Types

```typescript
const router = createRouter([
  { 
    path: '/article/:year/:month/:slug',
    onEnter: (params) => {
      // TypeScript knows params has year, month, and slug properties
      const { year, month, slug } = params; // All typed as string
    }
  }
] as const);
```

### Strict Route State

```typescript
const state = router.getState();
// state.route is typed as one of your defined routes
// state.params is typed based on the current route
```

## Browser Compatibility

type-router works in all modern browsers that support:
- ES6+ (ES2015)
- History API (for history mode)
- `hashchange` event (for hash mode)

## Examples

### Basic SPA

```typescript
import { createRouter } from '@itaylor/type-router';

const router = createRouter([
  { 
    path: '/',
    onEnter: () => renderHomePage()
  },
  { 
    path: '/about',
    onEnter: () => renderAboutPage()
  },
  { 
    path: '/contact',
    onEnter: () => renderContactPage()
  }
] as const);

// Navigate on link clicks
document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest('a[data-route]');
  if (link) {
    e.preventDefault();
    const path = link.getAttribute('href')!;
    router.navigate(path);
  }
});
```

### With React (using a wrapper)

```typescript
function useRouter() {
  const [state, setState] = useState(router.getState());
  
  useEffect(() => {
    return router.subscribe(setState);
  }, []);
  
  return {
    ...state,
    navigate: router.navigate
  };
}

function App() {
  const { path, params, navigate } = useRouter();
  
  return (
    <div>
      <button onClick={() => navigate('/user/:id', { id: '123' })}>
        Go to User
      </button>
    </div>
  );
}
```

## Why type-router?

- **True Type Safety**: Not just TypeScript support, but actual compile-time route validation
- **Zero Dependencies**: No bloat, just the routing you need
- **Framework Agnostic**: Use with React, Vue, Svelte, or vanilla JavaScript
- **Predictable**: Async navigation ensures consistent behavior across modes
- **Simple**: Minimal API surface area, easy to learn and use

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.