/// <reference lib="deno.ns" />
import { launch } from "jsr:@astral/astral";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { transpile } from "https://deno.land/x/emit@0.31.0/mod.ts";

// Declare window properties that are added by the test setup

async function setupTestServer() {
  const server = Deno.serve({ port: 0 }, async (req) => {
    const url = new URL(req.url);

    // Serve the TypeScript file as JavaScript
    if (url.pathname === "/type-router.js") {
      const tsCode = await Deno.readTextFile("./type-router.ts");
      const result = await transpile(
        new URL("file://" + Deno.cwd() + "/type-router.ts"),
        {
          load(specifier: string) {
            if (specifier.endsWith("type-router.ts")) {
              return Promise.resolve({
                kind: "module",
                specifier,
                content: tsCode,
              });
            }
            return Promise.resolve({ kind: "module", specifier, content: "" });
          },
        },
      );
      const jsCode = result.get("file://" + Deno.cwd() + "/type-router.ts") ||
        "";
      return new Response(jsCode, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    // Serve the route TypeScript files as JavaScript
    if (url.pathname === "/shared-routes.js") {
      const tsCode = await Deno.readTextFile(
        "./test-fixtures/shared-routes.ts",
      );
      const result = await transpile(
        new URL("file://" + Deno.cwd() + "/test-fixtures/shared-routes.ts"),
        {
          load(specifier: string) {
            if (specifier.endsWith("shared-routes.ts")) {
              return Promise.resolve({
                kind: "module",
                specifier,
                content: tsCode.replace(
                  "../type-router.ts",
                  "./type-router.js",
                ),
              });
            }
            return Promise.resolve({ kind: "module", specifier, content: "" });
          },
        },
      );
      const jsCode = result.get(
        "file://" + Deno.cwd() + "/test-fixtures/shared-routes.ts",
      ) || "";
      return new Response(jsCode, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    if (url.pathname === "/manual-init-routes.js") {
      const tsCode = await Deno.readTextFile(
        "./test-fixtures/manual-init-routes.ts",
      );
      const result = await transpile(
        new URL(
          "file://" + Deno.cwd() + "/test-fixtures/manual-init-routes.ts",
        ),
        {
          load(specifier: string) {
            if (specifier.endsWith("manual-init-routes.ts")) {
              return Promise.resolve({
                kind: "module",
                specifier,
                content: tsCode.replace(
                  "../type-router.ts",
                  "./type-router.js",
                ),
              });
            }
            return Promise.resolve({ kind: "module", specifier, content: "" });
          },
        },
      );
      const jsCode = result.get(
        "file://" + Deno.cwd() + "/test-fixtures/manual-init-routes.ts",
      ) || "";
      return new Response(jsCode, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    // Serve test fixture HTML files
    if (url.pathname === "/" || url.pathname === "/history") {
      const html = await Deno.readTextFile("./test-fixtures/history-test.html");
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }
  

    if (url.pathname === "/hash") {
      const html = await Deno.readTextFile(
        "./test-fixtures/hash-mode-test.html",
      );
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/manual" || url.pathname === "/test") {
      const html = await Deno.readTextFile(
        "./test-fixtures/manual-init-test.html",
      );
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Default: serve history test for any other path
    const html = await Deno.readTextFile("./test-fixtures/history-test.html");
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  });

  return server;
}

Deno.test("type-router - basic navigation and lifecycle hooks", async () => {
  const server = await setupTestServer();
  const browser = await launch();

  try {
    const page = await browser.newPage(`http://localhost:${server.addr.port}/`);
    

    // Wait for router to initialize
    await page.waitForFunction(() =>
      window.testResults?.includes("ready:history")
    );

    // First navigate to "/" explicitly to establish initial state
    await page.evaluate(() => window.router.navigate("/"));
    await page.waitForFunction(() => window.testResults?.includes("entered:/"));

    // Test basic navigation from "/" to "/about"
    await page.evaluate(() => window.router.navigate("/about"));
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/about")
    );

    const results1 = await page.evaluate(() => window.testResults);
    // Now "/" was entered, then exited when navigating to "/about"
    assertEquals(results1.includes("entered:/"), true);
    assertEquals(results1.includes("global:exit:/"), true);
    assertEquals(results1.includes("exited:/"), true);
    assertEquals(results1.includes("global:enter:/about"), true);
    assertEquals(results1.includes("entered:/about"), true);

    // Test parameterized routes
    await page.evaluate(() =>
      window.router.navigate("/user/:id", { id: "123" })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/user/123")
    );

    const state1 = await page.evaluate(() => window.lastState);
    assertEquals(state1.path, "/user/123");
    assertEquals(state1.params.id, "123");

    // Test parameter change (should NOT exit/enter, only paramChange)
    await page.evaluate(() =>
      window.router.navigate("/user/:id", { id: "456" })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("paramChange:123->456")
    );

    const results2 = await page.evaluate(() => window.testResults);
    assertEquals(results2.includes("paramChange:123->456"), true);
    assertEquals(
      results2.filter((r: string) => r === "exited:/user/123").length,
      0,
    );
    assertEquals(
      results2.filter((r: string) => r === "entered:/user/456").length,
      0,
    );

    // Test multiple parameters
    await page.evaluate(() =>
      window.router.navigate("/post/:category/:slug", {
        category: "tech",
        slug: "hello-world",
      })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/post/tech/hello-world")
    );

    const state2 = await page.evaluate(() => window.lastState);
    assertEquals(state2.path, "/post/tech/hello-world");
    assertEquals(state2.params.category, "tech");
    assertEquals(state2.params.slug, "hello-world");

    // Test concrete path navigation
    await page.evaluate(() => window.router.navigate("/user/789"));
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/user/789")
    );

    const state3 = await page.evaluate(() => window.lastState);
    assertEquals(state3.path, "/user/789");
    assertEquals(state3.params.id, "789");

    // Test fallback route
    await page.evaluate(() => window.router.navigateAny("/nonexistent"));
    await page.waitForFunction(() =>
      window.testResults?.includes("missed:/nonexistent")
    );

    const results3 = await page.evaluate(() => window.testResults);
    assertEquals(results3.includes("missed:/nonexistent"), true);
    assertEquals(results3.includes("entered:/404"), true);

    // Test browser back button
    await page.evaluate(() => window.history.back());
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stateAfterBack = await page.evaluate(() => window.lastState);
    assertEquals(stateAfterBack.path, "/user/789");

    // Test computePath utility
    const computed = await page.evaluate(() =>
      window.router.computePath("/user/:id", { id: "computed" })
    );
    assertEquals(computed, "/user/computed");

    // Test state subscription
    const stateHistory = await page.evaluate(() => window.stateHistory);
    assertEquals(stateHistory.length > 0, true);
    assertEquals(stateHistory[stateHistory.length - 1].path, "/user/789");
  } finally {
    await browser.close();
    await server.shutdown();
  }
});

Deno.test("type-router - hash mode routing", async () => {
  const server = await setupTestServer();
  const browser = await launch();

  try {
    const page = await browser.newPage(
      `http://localhost:${server.addr.port}/hash`,
    );

    // Wait for router to initialize
    await page.waitForFunction(() =>
      window.testResults?.includes("ready:hash")
    );

    // Navigate using hash mode
    await page.evaluate(() => window.router.navigate("/about"));
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/about")
    );

    const hash1 = await page.evaluate(() => window.location.hash);
    assertEquals(hash1, "#/about");

    // Test hash navigation with global hooks
    const results1 = await page.evaluate(() => window.testResults);
    assertEquals(results1.includes("global:enter:/about"), true);
    assertEquals(results1.includes("entered:/about"), true);

    // Navigate to user route
    await page.evaluate(() =>
      window.router.navigate("/user/:id", { id: "123" })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/user/123")
    );

    const hash2 = await page.evaluate(() => window.location.hash);
    assertEquals(hash2, "#/user/123");

    const results2 = await page.evaluate(() => window.testResults);
    assertEquals(results2.includes("global:exit:/about"), true);
    assertEquals(results2.includes("exited:/about"), true);
    assertEquals(results2.includes("global:enter:/user/:id"), true);
    assertEquals(results2.includes("entered:/user/123"), true);

    // Test parameterized route in hash mode
    await page.evaluate(() =>
      window.router.navigate("/profile/:username", { username: "alice" })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/profile/alice")
    );

    const hash3 = await page.evaluate(() => window.location.hash);
    assertEquals(hash3, "#/profile/alice");

    const state = await page.evaluate(() => window.lastState);
    assertEquals(state.path, "/profile/alice");
    assertEquals(state.params.username, "alice");

    // Test param change in hash mode
    await page.evaluate(() =>
      window.router.navigate("/profile/:username", { username: "bob" })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("paramChange:alice->bob")
    );

    const results3 = await page.evaluate(() => window.testResults);
    assertEquals(results3.includes("paramChange:alice->bob"), true);

    // Test clicking hash links (hash mode doesn't intercept clicks)
    const hashLink = await page.$('a[href="#/post/tech/hello"]');
    await hashLink!.click();
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/post/tech/hello")
    );

    const hash4 = await page.evaluate(() => window.location.hash);
    assertEquals(hash4, "#/post/tech/hello");
  } finally {
    await browser.close();
    await server.shutdown();
  }
});

Deno.test("type-router - manual initialization", async () => {
  const server = await setupTestServer();
  const browser = await launch();

  try {
    const page = await browser.newPage(
      `http://localhost:${server.addr.port}/test`,
    );

    // Wait for router to be created (but not initialized)
    await page.waitForFunction(() =>
      window.testResults?.includes("manual-created")
    );

    // Verify initial state before init
    const beforeInit = await page.evaluate(() => window.testResults);
    assertEquals(beforeInit.includes("initial-state-path:null"), true);
    assertEquals(beforeInit.includes("initial-state-route:null"), true);
    assertEquals(beforeInit.includes("manual:entered:/test"), false);

    // Click the init button
    const initBtn = await page.$("#init-btn");
    await initBtn!.click();
    await page.waitForFunction(() =>
      window.testResults?.includes("manual-initialized")
    );

    // Verify route was activated after init
    const afterInit = await page.evaluate(() => window.testResults);
    assertEquals(afterInit.includes("manual:global:enter:/test"), true);
    assertEquals(afterInit.includes("manual:entered:/test"), true);
    assertEquals(afterInit.includes("state-updated:/test"), true);

    // Test that navigation works after init
    const navigateBtn = await page.$("#navigate-btn");
    await navigateBtn!.click();
    await page.waitForFunction(() =>
      window.testResults?.includes("manual:entered:/dashboard")
    );

    const results = await page.evaluate(() => window.testResults);
    assertEquals(results.includes("manual:global:exit:/test"), true);
    assertEquals(results.includes("manual:exited:/test"), true);
    assertEquals(results.includes("manual:global:enter:/dashboard"), true);
    assertEquals(results.includes("manual:entered:/dashboard"), true);
    assertEquals(results.includes("state-updated:/dashboard"), true);

    // Test navigation with params after manual init
    await page.evaluate(() =>
      window.manualRouter.navigate("/settings/:section", {
        section: "privacy",
      })
    );
    await page.waitForFunction(() =>
      window.testResults?.includes("manual:entered:/settings/privacy")
    );

    const state = await page.evaluate(() => window.lastManualState);
    assertEquals(state.path, "/settings/privacy");
    assertEquals(state.params.section, "privacy");
  } finally {
    await browser.close();
    await server.shutdown();
  }
});

Deno.test("type-router - trailing slashes", async () => {
  const server = await setupTestServer();
  const browser = await launch();

  try {
    const page = await browser.newPage(`http://localhost:${server.addr.port}/`);

    await page.waitForFunction(() =>
      window.testResults?.includes("ready:history")
    );

    // Test that routes work with and without trailing slashes
    await page.evaluate(() => window.router.navigate("/about/"));
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/about")
    );

    const state1 = await page.evaluate(() => window.lastState);
    assertEquals(state1.route.path, "/about");

    await page.evaluate(() => window.router.navigate("/user/123/"));
    await page.waitForFunction(() =>
      window.testResults?.includes("entered:/user/123")
    );

    const state2 = await page.evaluate(() => window.lastState);
    assertEquals(state2.params.id, "123");
    assertEquals(state2.route.path, "/user/:id");
  } finally {
    await browser.close();
    await server.shutdown();
  }
});

Deno.test("type-router - getState and subscribe", async () => {
  const server = await setupTestServer();
  const browser = await launch();

  try {
    const page = await browser.newPage(`http://localhost:${server.addr.port}/`);

    await page.waitForFunction(() =>
      window.testResults?.includes("ready:history")
    );

    // Navigate to "/" first to establish state
    await page.evaluate(() => window.router.navigate("/"));
    await page.waitForFunction(() => window.stateHistory?.length >= 1);

    // Test getState returns current state
    const initialState = await page.evaluate(() => window.router.getState());
    assertEquals(initialState.path, "/");
    assertEquals(initialState.route?.path, "/");

    // Navigate and check state history from subscription
    await page.evaluate(() => window.router.navigate("/about"));
    await page.waitForFunction(() => window.stateHistory?.length >= 2);

    await page.evaluate(() => window.router.navigate("/user/42"));
    await page.waitForFunction(() => window.stateHistory?.length >= 3);

    const stateHistory = await page.evaluate(() => window.stateHistory);
    assertEquals(stateHistory[stateHistory.length - 3].path, "/");
    assertEquals(stateHistory[stateHistory.length - 2].path, "/about");
    assertEquals(stateHistory[stateHistory.length - 1].path, "/user/42");
    assertEquals(stateHistory[stateHistory.length - 1].params.id, "42");

    // Verify getState returns latest
    const currentState = await page.evaluate(() => window.router.getState());
    assertEquals(currentState.path, "/user/42");
    assertEquals(currentState.params.id, "42");
  } finally {
    await browser.close();
    await server.shutdown();
  }
});
