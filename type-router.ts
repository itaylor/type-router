// --- path validation helpers ---
type HasEmptySegment<S extends string> = S extends `${string}//${string}` ? true
  : false;

export type ValidatePath<P extends string> = HasEmptySegment<P> extends true
  ? never
  : P;

// --- param parsing helpers ---
type ParamKeys<S extends string> = S extends `${string}:${infer P}`
  ? P extends `${infer Key}/${infer Rest}` ? Key | ParamKeys<Rest>
  : P extends `${infer Key}?${string}` ? Key // Stop at query params
  : P
  : never;

// --- query param parsing helpers ---
type QueryParamKeys<S extends string> = S extends `${string}?${infer Q}`
  ? Q extends `${infer Key}&${infer Rest}` ? Key | QueryParamKeys<`?${Rest}`>
  : Q extends '' ? never
  : Q
  : never;

export type ParamsFor<P extends string> = [ParamKeys<P>] extends [never]
  ? [QueryParamKeys<P>] extends [never] ? Record<string, string>
  : { [K in QueryParamKeys<P>]?: string }
  : [QueryParamKeys<P>] extends [never] ? Record<ParamKeys<P>, string>
  :
    & Record<ParamKeys<P>, string>
    & { [K in Exclude<QueryParamKeys<P>, ParamKeys<P>>]?: string };

// --- route + factory ---
export type Route<P extends string> = {
  path: ValidatePath<P>;
  onEnter?: (params: ParamsFor<P>) => void;
  onParamChange?: (params: ParamsFor<P>, prevParams: ParamsFor<P>) => void;
  onExit?: (params: ParamsFor<P>) => void;
};

export type RoutePath<R extends readonly Route<string>[]> = R[number]['path'];

// -------- new path-matching helpers --------
type StripLeadingSlash<S extends string> = S extends `/${infer R}`
  ? StripLeadingSlash<R>
  : S;

type StripTrailingSlash<S extends string> = S extends `${infer A}/`
  ? StripTrailingSlash<A>
  : S;

export type WithOptionalTrailingSlash<S extends string> = S extends
  `${infer A}/` ? S | A
  : S | `${S}/`;

type Segments<S extends string> = StripLeadingSlash<S> extends
  `${infer A}/${infer B}` ? [A, ...Segments<B>]
  : StripLeadingSlash<S> extends '' ? []
  : [StripLeadingSlash<S>];

type MatchSegments<
  SS extends string[], // concrete segments
  PP extends string[], // pattern segments
> = PP extends [infer PH extends string, ...infer PT extends string[]]
  ? SS extends [infer SH extends string, ...infer ST extends string[]]
    ? PH extends `:${string}` // param segment -> any single segment
      ? MatchSegments<ST, PT>
    : SH extends PH // literal segment must equal
      ? MatchSegments<ST, PT>
    : false
  : false // not enough concrete segments
  : SS extends [] ? true
  : false; // must be exact length (no extras)

// Extract query parameter names from a route pattern
type ExtractQueryParams<S extends string> = S extends `${string}?${infer Q}`
  ? Q extends `${infer Param}&${infer Rest}`
    ? Param | ExtractQueryParams<`?${Rest}`>
  : Q extends '' ? never
  : Q
  : never;

// Extract query parameter names from a concrete URL
type ExtractConcreteQueryParams<S extends string> = S extends
  `${string}?${infer Q}`
  ? Q extends `${infer Param}=${string}&${infer Rest}`
    ? Param | ExtractConcreteQueryParams<`?${Rest}`>
  : Q extends `${infer Param}&${infer Rest}`
    ? Param | ExtractConcreteQueryParams<`?${Rest}`>
  : Q extends `${infer Param}=${string}` ? Param
  : Q extends '' ? never
  : Q
  : never;

// Check if concrete query params are a subset of declared query params
type QueryParamsMatch<
  ConcreteParams extends string,
  DeclaredParams extends string,
> = [ConcreteParams] extends [never] ? true // No query params in concrete URL is always valid
  : ConcreteParams extends DeclaredParams ? true
  : false;

type IsConcreteMatch<S extends string, P extends string> =
  // First check if path segments match
  MatchSegments<
    Segments<
      StripTrailingSlash<S extends `${infer Path}?${string}` ? Path : S>
    >,
    Segments<StripTrailingSlash<P extends `${infer Path}?${string}` ? Path : P>>
  > extends true
    // Then check if query parameters match
    ? QueryParamsMatch<
      ExtractConcreteQueryParams<S>,
      ExtractQueryParams<P>
    > extends true ? true
    : false
    : false;

// Check if a path is concrete (contains no parameters like :id)
// Ignore query parameters after ? when checking
export type IsConcretePath<S extends string> = S extends
  `${infer Path}?${string}` ? Path extends `${string}:${string}` ? false : true
  : S extends `${string}:${string}` ? false
  : true;

// For a union of patterns, accept S if it matches *any* member AND is concrete
export type ConcretePathForUnion<Ps extends string, S extends string> =
  IsConcretePath<S> extends true
    ? Ps extends any ? IsConcreteMatch<S, Ps> extends true ? S
      : never
    : never
    : never;

export type Options<R extends readonly Route<string>[]> = {
  urlType: 'hash' | 'history';
  fallbackPath?: RoutePath<R>;
  autoInit?: boolean;
  onEnter?: (route: Route<string>, params: ParamsFor<RoutePath<R>>) => void;
  onParamChange?: (
    route: Route<string>,
    params: ParamsFor<RoutePath<R>>,
    prevParams: ParamsFor<RoutePath<R>>,
  ) => void;
  onExit?: (route: Route<string>, params: ParamsFor<RoutePath<R>>) => void;
  onMiss?: (path: string) => void;
};

type RouteWithParams<Path extends string> = {
  realPath: string;
  params: ParamsFor<Path>;
  route: Route<Path>;
};

export type RouteState<R extends readonly Route<string>[]> = {
  path: string | null;
  params: ParamsFor<RoutePath<R>>;
  route: Route<RoutePath<R>> | null;
};

// Extract path-only part (before ?) from a route pattern
type PathOnly<P extends string> = P extends `${infer Path}?${string}` ? Path
  : P;

// Find the full route definition that matches a path-only pattern
type FindFullRouteForPath<P extends string, R extends string> = R extends any
  ? PathOnly<R> extends P ? R : never
  : never;

// Get parameter types for a path-only pattern by finding its full route definition
type ParamsForPathOnly<P extends string, R extends readonly Route<string>[]> =
  ParamsFor<FindFullRouteForPath<P, RoutePath<R>>>;

// Check if a path-only pattern matches any route's path part
type IsValidPathOnly<P extends string, R extends readonly Route<string>[]> =
  FindFullRouteForPath<P, RoutePath<R>> extends never ? false : true;

// Sets the url to a valid path that exists in a route
// Overload 1: call with a declared pattern + (typed) params
// Overload 2: call with a concrete path that matches one of the patterns
// Overload 3: call with path-only pattern + params (including query params)
// Overload 4: call with concrete path-only + params (including query params)
export type NavigateFn<R extends readonly Route<string>[]> = {
  <P extends WithOptionalTrailingSlash<RoutePath<R>>>(
    path: ValidatePath<P>,
    params: ParamsFor<P>,
  ): Promise<RouteState<R>>;
  <S extends string>(
    path: ValidatePath<ConcretePathForUnion<RoutePath<R>, S>>,
  ): Promise<RouteState<R>>;
  <P extends WithOptionalTrailingSlash<PathOnly<RoutePath<R>>>>(
    path: ValidatePath<P>,
    params: IsValidPathOnly<P, R> extends true ? ParamsForPathOnly<P, R>
      : never,
  ): Promise<RouteState<R>>;
  <S extends string>(
    path: ValidatePath<ConcretePathForUnion<PathOnly<RoutePath<R>>, S>>,
    params: ParamsFor<FindFullRouteForPath<S, RoutePath<R>>>,
  ): Promise<RouteState<R>>;
};

// Router type for the return type of createRouter
export type Router<R extends readonly Route<string>[]> = {
  navigate: NavigateFn<R>;
  navigateAny: (path: string) => Promise<RouteState<R>>;
  getState: () => RouteState<R>;
  subscribe: (callback: (route: RouteState<R>) => void) => () => void;
  computePath: <P extends RoutePath<R>>(
    path: P,
    params?: ParamsFor<P>,
  ) => string;
  init: () => void;
};

const defaultOptions = {
  urlType: 'hash',
  autoInit: true,
} as const;

// Path validation error message
const INVALID_PATH_ERROR = (path: string) => `Invalid path: ${path}`;

// Path validation helper - rejects paths with empty segments
function isValidPath(path: string): boolean {
  // Check for consecutive slashes (empty segments)
  return !path.includes('//');
}

function validatePath(path: string): void {
  if (!isValidPath(path)) {
    throw new Error(INVALID_PATH_ERROR(path));
  }
}
const enc = encodeURIComponent;
const dec = decodeURIComponent;

export function createRouter<const R extends readonly Route<string>[]>(
  routes: R,
  opts: Partial<Options<R>> = defaultOptions,
): Router<R> {
  const options = { ...defaultOptions, ...opts };
  type Path = RoutePath<R>;
  const emptyParams = {} as ParamsFor<Path>;
  const subscribers = new Set<(state: RouteState<R>) => void>();

  const { urlType } = options;
  let currState: RouteState<R> = {
    path: null,
    params: emptyParams,
    route: null,
  };
  const matchers = buildRouteMatchers(routes);

  // Track pending navigation promises for proper async handling
  const pendingNavigations: Array<
    { path: string; resolve: (routeState: RouteState<R>) => void }
  > = [];

  const navigate: NavigateFn<R> = function navigate(
    path: string,
    paramsToSub?: any,
  ): Promise<RouteState<R>> {
    let pathStr: string = path;
    if (paramsToSub) {
      // Check if this is a path-only pattern that corresponds to a route with query parameters
      if (!path.includes('?')) {
        const fullRoutePath = findFullRoutePathForPathOnly(path, routes);
        if (fullRoutePath && fullRoutePath.includes('?')) {
          if (path.includes(':')) {
            // Template path - use computePath with full route
            pathStr = computePath(fullRoutePath, paramsToSub);
          } else {
            // Concrete path - append query params manually
            const queryParams = getQueryParamKeys(fullRoutePath);
            const queryPairs: string[] = [];
            for (const queryParam of queryParams) {
              const value = paramsToSub[queryParam];
              if (value !== undefined) {
                queryPairs.push(
                  `${enc(queryParam)}=${enc(value)}`,
                );
              }
            }
            pathStr = path +
              (queryPairs.length > 0 ? `?${queryPairs.join('&')}` : '');
          }
        } else {
          pathStr = computePath(path, paramsToSub);
        }
      } else {
        pathStr = computePath(path, paramsToSub);
      }
    }
    const { route, params } = getRouteWithParams(pathStr);
    if (!route) throw new Error(`No route found for path: ${path}`);

    return new Promise<RouteState<R>>((resolve) => {
      // Validate path before calling pushState to avoid browser errors
      validatePath(pathStr);
      if (urlType === 'history') {
        // For history mode: pushState doesn't trigger any events,
        // so we manually activate the route asynchronously
        globalThis.history.pushState({}, '', pathStr);
        setTimeout(() => {
          activateRoute(pathStr, route, params);
          resolve(getState());
        }, 0);
      } else {
        // For hash mode: setting hash triggers hashchange event,
        // so we let the event handler activate the route
        // Add this navigation to the queue
        // Each hash change fires its own event, so we queue them all
        pendingNavigations.push({ path: pathStr, resolve });
        globalThis.location.hash = pathStr;
        // The hashchange handler will call activateRoute and resolve
      }
    });
  };

  // navigateAny allows navigation to any string path without compile-time type checking
  // Useful for runtime navigation from user input, HTML links, external URLs, etc.
  function navigateAny(path: string): Promise<RouteState<R>> {
    return (navigate as any)(path);
  }

  function computePath<P extends Path>(
    path: P,
    params?: ParamsFor<P>,
  ): string {
    // Takes the params and substitutes them into the path string, then returns it.
    // EG: 'path/abc' === computePath('/path/:id', { id: 'abc' });
    if (!params) {
      return path;
    }

    // Split path and query parts
    const [pathPart, queryPart] = path.split('?', 2);

    // Substitute path parameters
    let resultPath = pathPart.replace(
      /:(\w+)/g,
      (_, key) => enc((params as any)[key] || ''),
    );

    // Build query string from declared query parameters
    if (queryPart) {
      const queryParams = getQueryParamKeys(path);
      const queryPairs: string[] = [];

      for (const queryParam of queryParams) {
        const value = (params as any)[queryParam];
        if (value !== undefined) {
          queryPairs.push(
            `${enc(queryParam)}=${enc(value)}`,
          );
        }
      }

      if (queryPairs.length > 0) {
        resultPath += `?${queryPairs.join('&')}`;
      }
    }

    return resultPath;
  }

  function getRouteWithParams(path: string): RouteWithParams<Path> {
    // Split path and query string
    const [cleanPath, queryString] = path.split('?', 2);

    // Validate the cleaned path
    if (!isValidPath(cleanPath)) {
      // Invalid paths are hard errors - don't use fallback or call onMiss
      throw new Error(INVALID_PATH_ERROR(cleanPath));
    }

    for (const [routePath, regex] of matchers) {
      const match = regex.exec(cleanPath);
      if (match) {
        // Find the route object
        const route = routes.find((r) => r.path === routePath);
        if (!route) continue;

        // Extract path parameters from the matched path
        const pathParamKeys =
          cleanPathPart(routePath).match(/:(\w+)/g)?.map((p) => p.slice(1)) ||
          [];
        const params: Record<string, string> = {};
        pathParamKeys.forEach((key, index) => {
          params[key] = dec(match[index + 1]); // +1 because match[0] is the full match
        });

        // Extract query parameters from the route definition and URL
        if (queryString) {
          const declaredQueryParams = getQueryParamKeys(routePath);
          const urlSearchParams = new URLSearchParams(queryString);

          for (const queryParam of declaredQueryParams) {
            const value = urlSearchParams.get(queryParam);
            if (value !== null) {
              // Path params trump query params with the same name
              if (!(queryParam in params)) {
                params[queryParam] = value; // Don't double-decode
              }
            }
          }
        }

        return {
          realPath: path,
          route: route as Route<Path>,
          params: params as ParamsFor<Path>,
        };
      }
    }

    // No match found - notify miss handler
    options.onMiss?.(cleanPath);
    const { fallbackPath } = options;

    // Use fallback route if configured
    if (fallbackPath) {
      const fallback = routes.find((r) => r.path === fallbackPath);
      if (fallback) {
        return {
          realPath: cleanPath,
          route: fallback,
          params: {} as ParamsFor<Path>, // Fallback gets empty params
        };
      }
    }

    let errMsg = `No route found for path: ${cleanPath}`;
    if (fallbackPath) {
      errMsg += `, fallback path: ${fallbackPath} not found.`;
    }
    throw new Error(errMsg);
  }

  function getPath() {
    if (urlType === 'history') {
      const { pathname, search } = globalThis.location;
      return pathname + search;
    }
    const { hash } = globalThis.location;
    const hashPath = hash.slice(1); // Remove the #
    return hashPath || '/'; // Default to '/' if empty
  }

  // Handles the url change.  If there is a route change it updates the
  function handleUrlChange(path: string) {
    const { route, params } = getRouteWithParams(path);
    activateRoute(path, route, params);

    // Resolve pending navigation promise if this was triggered by navigate() in hash mode
    // Since hashchange events are FIFO, just shift from the queue
    if (pendingNavigations.length > 0) {
      const nav = pendingNavigations.shift()!;
      nav.resolve(getState());
    }
  }
  function activateRoute(
    path: string,
    route: Route<Path>,
    params: ParamsFor<Path>,
  ) {
    const { route: currRoute, params: currParams } = currState;
    if (currRoute) {
      if (currRoute === route) {
        if (!shallowEqual(params, currParams)) {
          opts.onParamChange?.(route, params, currParams);
          route.onParamChange?.(params, currParams);
          currState = {
            ...currState,
            params,
            path,
          };
          subscribers.forEach((subscriber) => subscriber(currState));
        }
        return;
      }
      options.onExit?.(currRoute, currParams);
      currRoute.onExit?.(currParams);
    }
    options.onEnter?.(route, params);
    route.onEnter?.(params);

    currState = {
      route,
      params,
      path,
    };
    subscribers.forEach((subscriber) => subscriber(currState));
  }

  function buildRouteMatchers(routes: R) {
    const matchers = new Map<string, RegExp>();
    for (const route of routes) {
      // Validate route path at creation time
      validatePath(route.path);
      // Strip query parameters for matching - only match the path part
      const pathPart = cleanPathPart(route.path);
      const matcher = new RegExp(
        `^${pathPart.replace(/:[^/]+/g, '([^/]+)')}/?$`,
      );
      matchers.set(route.path, matcher);
    }
    return matchers;
  }

  function init() {
    // activate the route once before adding event listener
    // this will set the current route and params
    handleUrlChange(getPath());

    const event = urlType === 'history' ? 'popstate' : 'hashchange';
    globalThis.addEventListener(event, () => {
      handleUrlChange(getPath());
    });
  }

  function subscribe(callback: (route: RouteState<R>) => void) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  function getState(): RouteState<R> {
    return currState;
  }

  // Auto-initialize if autoInit is true (default)
  if (options.autoInit) {
    init();
  }

  return {
    getState,
    computePath,
    navigate,
    navigateAny,
    subscribe,
    init,
  };
}

// helper function that sets the appropriate type on the route by inference.
// useful when you want to create the routes outside of the call to createRouter
// which would usually infer them for you
export function makeRoute<P extends string>(route: Route<P>): Route<P> {
  return route;
}

function shallowEqual(
  obj1: Record<string, string | undefined>,
  obj2: Record<string, string | undefined>,
): boolean {
  if (obj1 === obj2) {
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  return keys1.every((key) => keys2.includes(key) && obj1[key] === obj2[key]);
}

// Helper function to extract just the path part (before ?)
function cleanPathPart(path: string): string {
  return path.split('?')[0];
}

// Helper function to get query parameter names from a path
function getQueryParamKeys(path: string): string[] {
  const queryPart = path.split('?')[1];
  if (!queryPart) return [];

  return queryPart.split('&').filter((param) => param.length > 0);
}

// Helper function to find full route path for a path-only pattern
function findFullRoutePathForPathOnly(
  pathOnlyPattern: string,
  routes: readonly Route<string>[],
): string | null {
  for (const route of routes) {
    const routePathOnly = cleanPathPart(route.path);

    // If input is a template pattern, do exact match
    if (pathOnlyPattern.includes(':')) {
      if (routePathOnly === pathOnlyPattern) {
        return route.path;
      }
    } else {
      // If input is concrete path, check if it matches the route pattern
      const matcher = new RegExp(
        `^${routePathOnly.replace(/:[^/]+/g, '([^/]+)')}/?$`,
      );
      if (matcher.test(pathOnlyPattern)) {
        return route.path;
      }
    }
  }
  return null;
}

// // --- usage ---
// const router = createRouter([
//   { path: "/home" },
//   { path: "/profile/:user", onEnter: p => { /* p.user is string */ } },
//   { path: "/" },

// ] as const);

// // ✅ OK

// router.navigate("/home");
// router.navigate("/profile/:user", { user: "alice" });
// router.navigate("/profile/:user/", { user: "bob" });
// router.navigate("/profile/alice/");
// router.navigate("/profile/bob");
// router.navigate("/");

// // Shouldn't work
// router.navigate('/profile/:user', { dude: "bob" }); // type error: Object literal may only specify known properties, and 'dude' does not exist in type 'Record<"user", string>'. (ts 2353)
// router.navigate('/somewhere'); // type error Argument of type '"/somewhere"' is not assignable to parameter of type '"/home" | "/profile/:user"'. (ts 2345)
// router.navigate("/profile/:user/barf", { user: "bob" });
