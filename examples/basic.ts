import { createRouter } from '../type-router.ts';

// Example 1: Basic routing with lifecycle hooks
console.log('=== Example 1: Basic Routing ===');

const basicRouter = createRouter([
  {
    path: '/',
    onEnter: () => console.log('Welcome to the home page!'),
    onExit: () => console.log('Leaving home page')
  },
  {
    path: '/about',
    onEnter: () => console.log('About page entered'),
    onExit: () => console.log('About page exited')
  },
  {
    path: '/contact',
    onEnter: () => console.log('Contact page entered')
  }
] as const);

// Navigate between routes
await basicRouter.navigate('/');
await basicRouter.navigate('/about');
await basicRouter.navigate('/contact');

// Example 2: Parameterized routes
console.log('\n=== Example 2: Parameterized Routes ===');

const userRouter = createRouter([
  {
    path: '/user/:id',
    onEnter: (params) => {
      console.log(`Loading user profile for ID: ${params.id}`);
    },
    onParamChange: (params, prevParams) => {
      console.log(`User changed from ${prevParams.id} to ${params.id}`);
    },
    onExit: (params) => {
      console.log(`Closing user profile for ID: ${params.id}`);
    }
  },
  {
    path: '/post/:category/:slug',
    onEnter: (params) => {
      console.log(`Viewing post: ${params.slug} in category: ${params.category}`);
    }
  }
] as const);

// Navigate with parameters
await userRouter.navigate('/user/:id', { id: '123' });
await userRouter.navigate('/user/:id', { id: '456' }); // Triggers onParamChange
await userRouter.navigate('/post/:category/:slug', {
  category: 'tech',
  slug: 'intro-to-typescript'
});

// Example 3: Global hooks and fallback routes
console.log('\n=== Example 3: Global Hooks & Fallback ===');

const advancedRouter = createRouter([
  { path: '/' },
  { path: '/products' },
  { path: '/404' }
] as const, {
  fallbackPath: '/404',
  onEnter: (route, params) => {
    console.log(`[Global] Entering route: ${route.path}`);
  },
  onExit: (route, params) => {
    console.log(`[Global] Exiting route: ${route.path}`);
  },
  onMiss: (path) => {
    console.log(`[Global] No route found for: ${path}, using fallback`);
  }
});

await advancedRouter.navigate('/');
await advancedRouter.navigate('/products');
// This will trigger onMiss and use the fallback route
await advancedRouter.navigate('/non-existent' as any);

// Example 4: State management and subscriptions
console.log('\n=== Example 4: State & Subscriptions ===');

const stateRouter = createRouter([
  { path: '/' },
  { path: '/user/:id' },
  { path: '/settings' }
] as const);

// Subscribe to route changes
const unsubscribe = stateRouter.subscribe((state) => {
  console.log('Route state changed:', {
    path: state.path,
    params: state.params,
    routePath: state.route?.path
  });
});

// Navigate and observe state changes
await stateRouter.navigate('/');
await stateRouter.navigate('/user/:id', { id: 'alice' });

// Get current state
const currentState = stateRouter.getState();
console.log('Current state:', currentState);

// Compute paths
const computedPath = stateRouter.computePath('/user/:id', { id: 'bob' });
console.log('Computed path:', computedPath); // '/user/bob'

// Cleanup
unsubscribe();

// Example 5: Manual initialization
console.log('\n=== Example 5: Manual Initialization ===');

const manualRouter = createRouter([
  {
    path: '/',
    onEnter: () => console.log('App ready, showing home')
  },
  {
    path: '/dashboard',
    onEnter: () => console.log('Dashboard loaded')
  }
] as const, {
  autoInit: false
});

console.log('Performing async setup...');
// Simulate async setup
await new Promise(resolve => setTimeout(resolve, 100));
console.log('Setup complete, initializing router');

// Now manually initialize the router
manualRouter.init();

// Router is now active and will respond to the current URL
await manualRouter.navigate('/dashboard');

// Example 6: Hash vs History mode
console.log('\n=== Example 6: Hash vs History Mode ===');

// Hash-based routing (for environments without proper server support)
const hashRouter = createRouter([
  { path: '/' },
  { path: '/app' },
  { path: '/app/:section' }
] as const, {
  urlType: 'hash'
});

console.log('Hash router created - URLs will use # prefix');

// History-based routing (default, requires server support)
const historyRouter = createRouter([
  { path: '/' },
  { path: '/app' },
  { path: '/app/:section' }
] as const, {
  urlType: 'history'
});

console.log('History router created - URLs use standard paths');

// Example 7: TypeScript type safety demonstration
console.log('\n=== Example 7: TypeScript Type Safety ===');

const typeSafeRouter = createRouter([
  { path: '/product/:id' },
  { path: '/category/:name/item/:itemId' }
] as const);

// These would work (TypeScript knows the required params):
await typeSafeRouter.navigate('/product/:id', { id: '123' });
await typeSafeRouter.navigate('/category/:name/item/:itemId', {
  name: 'electronics',
  itemId: 'laptop-1'
});

// These would be TypeScript errors (uncomment to see):
// typeSafeRouter.navigate('/unknown-route'); // Error: Unknown route
// typeSafeRouter.navigate('/product/:id', { wrong: '123' }); // Error: Wrong param name
// typeSafeRouter.navigate('/product/:id'); // Error: Missing params

console.log('\n=== All examples completed ===');
