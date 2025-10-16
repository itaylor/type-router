// --- param parsing helpers ---
type ParamKeys<S extends string> = S extends `${string}:${infer P}`
  ? P extends `${infer Key}/${infer Rest}`
    ? Key | ParamKeys<Rest>
    : P
  : never;

export type ParamsFor<P extends string> = [ParamKeys<P>] extends [never]
  ? {}
  : Record<ParamKeys<P>, string>;

// --- route + factory ---
export type Route<P extends string> = {
  path: P;
  onEnter?: (params: ParamsFor<P>) => void;
  onParamChange?: (params: ParamsFor<P>, prevParams: ParamsFor<P>) => void;
  onExit?: (params: ParamsFor<P>) => void;
};

// -------- new path-matching helpers --------
type StripLeadingSlash<S extends string> = S extends `/${infer R}`
  ? StripLeadingSlash<R>
  : S;

type StripTrailingSlash<S extends string> = S extends `${infer A}/`
  ? StripTrailingSlash<A>
  : S;

type WithOptionalTrailingSlash<S extends string> = S extends `${infer A}/`
  ? S | A
  : S | `${S}/`;

type Segments<S extends string> =
  StripLeadingSlash<S> extends `${infer A}/${infer B}`
    ? [A, ...Segments<B>]
    : StripLeadingSlash<S> extends ""
      ? []
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
  : SS extends []
    ? true
    : false; // must be exact length (no extras)

type IsConcreteMatch<S extends string, P extends string> = MatchSegments<
  Segments<StripTrailingSlash<S>>,
  Segments<StripTrailingSlash<P>>
>;

// For a union of patterns, accept S if it matches *any* member.
type ConcretePathForUnion<Ps extends string, S extends string> = Ps extends any
  ? IsConcreteMatch<S, Ps> extends true
    ? S
    : never
  : never;

export type Options<R extends readonly Route<string>[]> = {
  urlType: "hash" | "history";
  fallbackPath?: R[number]["path"];
  onEnter?: (route: Route<string>, params: Record<string, string>) => void;
  onParamChange?: (
    route: Route<string>,
    params: Record<string, string>,
    prevParams: Record<string, string>,
  ) => void;
  onExit?: (route: Route<string>, params: Record<string, string>) => void;
  onMiss?: (path: string) => void;
};

type RouteWithParams<Path extends string> = {
  realPath: string;
  params: ParamsFor<Path>;
  route: Route<Path>;
};

export type RouteState<R extends readonly Route<string>[]> = {
  path: string | null;
  params: ParamsFor<R[number]["path"]>;
  route: Route<R[number]["path"]> | null;
};

// Sets the url to a valid path that exists in a route
// Overload 1: call with a declared pattern + (typed) params
// Overload 2: call with a concrete path that matches one of the patterns
export type NavigateFn<R extends readonly Route<string>[]> = {
  <P extends WithOptionalTrailingSlash<R[number]["path"]>>(
    path: P,
    params: ParamsFor<P>,
  ): Promise<void>;
  <S extends string>(
    path: ConcretePathForUnion<R[number]["path"], S>,
  ): Promise<void>;
};

// Router type for the return type of createRouter
export type Router<R extends readonly Route<string>[]> = {
  navigate: NavigateFn<R>;
  getState: () => RouteState<R>;
  subscribe: (callback: (route: RouteState<R>) => void) => () => void;
  computePath: (
    path: R[number]["path"],
    params?: ParamsFor<R[number]["path"]>,
  ) => ConcretePathForUnion<R[number]["path"], typeof path>;
};

const defaultOptions = {
  urlType: "history",
} as const;

export function createRouter<const R extends readonly Route<string>[]>(
  routes: R,
  opts: Partial<Options<R>> = defaultOptions,
): Router<R> {
  const options = { ...defaultOptions, ...opts };
  type Path = R[number]["path"];
  const emptyParams = {} as ParamsFor<Path>;
  const subscribers = new Set<(state: RouteState<R>) => void>();

  const { urlType } = options;
  let currState: RouteState<R> = {
    path: null,
    params: emptyParams,
    route: null,
  };
  let matchers = buildRouteMatchers(routes);

  // Track pending navigation promises for proper async handling
  const pendingNavigations: Array<{ path: string; resolve: () => void }> = [];

  const navigate: NavigateFn<R> = function navigate<
    P extends WithOptionalTrailingSlash<Path>,
  >(path: P, paramsToSub?: ParamsFor<P>): Promise<void> {
    let pathStr: string = path;
    if (paramsToSub) {
      pathStr = computePath(path, paramsToSub);
    }
    const { route, params } = getRouteWithParams(pathStr);
    if (!route) throw new Error(`No route found for path: ${path}`);

    return new Promise<void>((resolve) => {
      if (urlType === "history") {
        // For history mode: pushState doesn't trigger any events,
        // so we manually activate the route asynchronously
        window.history.pushState({}, "", pathStr);
        setTimeout(() => {
          activateRoute(pathStr, route, params);
          resolve();
        }, 0);
      } else {
        // For hash mode: setting hash triggers hashchange event,
        // so we let the event handler activate the route
        // Add this navigation to the queue
        // Each hash change fires its own event, so we queue them all
        pendingNavigations.push({ path: pathStr, resolve });
        window.location.hash = pathStr;
        // The hashchange handler will call activateRoute and resolve
      }
    });
  };

  function computePath(
    path: Path,
    params?: ParamsFor<Path>,
  ): ConcretePathForUnion<R[number]["path"], typeof path> {
    // Takes the params and substitutes them into the path string, then returns it.
    // EG: 'path/abc' === computePath('/path/:id', { id: 'abc' });
    if (!params) {
      return path as ConcretePathForUnion<R[number]["path"], typeof path>;
    }
    return path.replace(
      /:(\w+)/g,
      (_, key) => params[key] || "",
    ) as ConcretePathForUnion<R[number]["path"], typeof path>;
  }

  function getRouteWithParams(path: string): RouteWithParams<Path> {
    // Strip query string if present
    const cleanPath = path.split("?")[0];

    for (const [routePath, regex] of matchers) {
      const match = regex.exec(cleanPath);
      if (match) {
        // Find the route object
        const route = routes.find((r) => r.path === routePath);
        if (!route) continue;

        // Extract parameters from the matched path
        const paramKeys =
          routePath.match(/:(\w+)/g)?.map((p) => p.slice(1)) || [];
        const params: Record<string, string> = {};
        paramKeys.forEach((key, index) => {
          params[key] = match[index + 1]; // +1 because match[0] is the full match
        });

        return {
          realPath: cleanPath,
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
    if (urlType === "history") {
      const { pathname, search } = window.location;
      return pathname + search;
    }
    const { hash } = window.location;
    return hash.slice(1);
  }

  // Handles the url change.  If there is a route change it updates the
  function handleUrlChange(path: string) {
    const { route, params } = getRouteWithParams(path);
    activateRoute(path, route, params);

    // Resolve pending navigation promise if this was triggered by navigate() in hash mode
    // Since hashchange events are FIFO, just shift from the queue
    if (pendingNavigations.length > 0) {
      const nav = pendingNavigations.shift()!;
      nav.resolve();
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
        options.onParamChange?.(route, params, currParams);
        route.onParamChange?.(params, currParams);
        currState.params = params;
        currState.path = path;
        subscribers.forEach((subscriber) => subscriber(currState));
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
      const matcher = new RegExp(
        `^${route.path.replace(/:[^/]+/g, "([^/]+)")}/?$`,
      );
      matchers.set(route.path, matcher);
    }
    return matchers;
  }

  function init() {
    const path = getPath();
    const { route, params }: RouteWithParams<Path> = getRouteWithParams(path);
    // activate the route once before adding event listener
    // this will set the current route and params
    activateRoute(path, route, params);
    const event = urlType === "history" ? "popstate" : "hashchange";
    window.addEventListener(event, () => {
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

  init();
  return {
    getState,
    computePath,
    navigate,
    subscribe,
  };
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

// Shouldn't work
// router.navigate('/profile/:user', { dude: "bob" }); // type error: Object literal may only specify known properties, and 'dude' does not exist in type 'Record<"user", string>'. (ts 2353)
// router.navigate('/somewhere'); // type error Argument of type '"/somewhere"' is not assignable to parameter of type '"/home" | "/profile/:user"'. (ts 2345)
// router.navigate("/profile/:user/barf", { user: "bob" });
