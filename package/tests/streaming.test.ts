import { expect, test } from "vite-plus/test";

import { useHead } from "../src/index.ts";
import unhead from "../src/middleware.ts";
import type { MiddlewareOptions } from "../src/middleware.ts";

const encoder = new TextEncoder();

const run = (next: () => Promise<Response>, options: MiddlewareOptions = {}) =>
  unhead({ streaming: true, ...options })({} as never, next as never) as Promise<Response>;

// Emulates Astro's streaming renderer: each chunk thunk runs at pull time, so
// useHead calls inside later thunks happen after earlier chunks have flushed.
const streamingNext =
  (chunks: Array<() => string>, init?: ResponseInit) => async (): Promise<Response> => {
    let index = 0;
    // highWaterMark 0 stops the stream from pre-pulling, so each thunk runs
    // exactly when the middleware reads it — matching Astro's render order.
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(encoder.encode(chunks[index++]()));
          } else {
            controller.close();
          }
        },
      },
      { highWaterMark: 0 },
    );

    return new Response(body, {
      ...init,
      headers: { "content-type": "text/html", ...Object.fromEntries(new Headers(init?.headers)) },
    });
  };

test("renders shell head tags server-side with the bootstrap script", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ title: "Shell Title" });
        return "<!DOCTYPE html><html><head></head><body>";
      },
      () => "<p>content</p>",
      () => "</body></html>",
    ]),
  );

  const html = await response.text();
  const shell = html.slice(0, html.indexOf("</head>"));

  expect(shell).toContain("<title>Shell Title</title>");
  expect(shell).toContain("window.__unhead__={_q:[]");
  expect(html).toContain("<p>content</p>");
  expect(html.trimEnd().endsWith("</body></html>")).toBe(true);
});

test("patches late head updates into the stream as scripts", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ title: "Shell Title" });
        return "<!DOCTYPE html><html><head></head><body>";
      },
      () => "<p>early</p>",
      () => {
        useHead({ title: "Late Title" });
        return "<p>late</p>";
      },
      () => "</body></html>",
    ]),
  );

  const html = await response.text();

  expect(html).toContain("__unhead_iife__");
  expect(html).toContain("window.__unhead__.push(");
  expect(html).toContain("Late Title");
  expect(html.indexOf("window.__unhead__.push(")).toBeGreaterThan(html.indexOf("<p>late</p>"));
  expect(html.indexOf("window.__unhead__.push(")).toBeLessThan(html.indexOf("</body>"));
});

test("inlines the streaming client only once across multiple patches", async () => {
  const response = await run(
    streamingNext([
      () => "<!DOCTYPE html><html><head></head><body>",
      () => {
        useHead({ meta: [{ name: "first", content: "1" }] });
        return "<p>one</p>";
      },
      () => {
        useHead({ meta: [{ name: "second", content: "2" }] });
        return "<p>two</p>";
      },
      () => "</body></html>",
    ]),
  );

  const html = await response.text();

  expect(html.split("__unhead_iife__").length - 1).toBe(1);
  expect(html.split("window.__unhead__.push(").length - 1).toBe(2);
});

test("dedupes template head tags against shell-time head entries", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ title: "Winning Title" });
        return '<!DOCTYPE html><html><head><title>Template Title</title><meta name="description" content="from template"></head><body>';
      },
      () => "</body></html>",
    ]),
  );

  const html = await response.text();

  expect(html.split("<title>").length - 1).toBe(1);
  expect(html).toContain("<title>Winning Title</title>");
  expect(html).toContain('content="from template"');
});

test("emits no client runtime when all head updates land in the shell", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ title: "Only Shell" });
        return "<!DOCTYPE html><html><head></head><body><p>hi</p></body></html>";
      },
    ]),
  );

  const html = await response.text();

  expect(html).toContain("<title>Only Shell</title>");
  expect(html).not.toContain("__unhead_iife__");
  expect(html).not.toContain("window.__unhead__.push(");
});

test("applies htmlAttrs and bodyAttrs from shell-time head entries", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ htmlAttrs: { lang: "en" }, bodyAttrs: { class: "dark" } });
        return "<!DOCTYPE html><html><head></head><body>";
      },
      () => "</body></html>",
    ]),
  );

  const html = await response.text();

  expect(html).toContain('<html lang="en">');
  expect(html).toContain('<body class="dark">');
});

test("falls back to a buffered transform when no body tag arrives", async () => {
  const response = await run(
    streamingNext([
      () => {
        useHead({ title: "No Body" });
        return "<html><head>";
      },
      () => "</head><p>odd document</p></html>",
    ]),
  );

  const html = await response.text();

  expect(html).toContain("<title>No Body</title>");
  expect(html).toContain("<p>odd document</p>");
});

test("handles a body close tag split across chunks", async () => {
  const response = await run(
    streamingNext([
      () => "<!DOCTYPE html><html><head></head><body>",
      () => {
        useHead({ title: "Split" });
        return "<p>x</p></bo";
      },
      () => "dy></html>",
    ]),
  );

  const html = await response.text();

  expect(html).toContain("window.__unhead__.push(");
  expect(html.indexOf("window.__unhead__.push(")).toBeLessThan(html.indexOf("</body>"));
  expect(html.trimEnd().endsWith("</body></html>")).toBe(true);
});

test("passes non-html responses through untouched in streaming mode", async () => {
  const json = new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });

  const response = await run(async () => json);

  expect(response).toBe(json);
});

test("drops content-length and preserves status on streamed responses", async () => {
  const response = await run(
    streamingNext([() => "<!DOCTYPE html><html><head></head><body></body></html>"], {
      status: 404,
      statusText: "Not Found",
      headers: { "content-length": "57", "x-custom": "yes" },
    }),
  );

  expect(response.status).toBe(404);
  expect(response.statusText).toBe("Not Found");
  expect(response.headers.get("content-length")).toBeNull();
  expect(response.headers.get("x-custom")).toBe("yes");
});

test("isolates head state between concurrent streamed requests", async () => {
  const slow = run(
    streamingNext([
      () => {
        useHead({ title: "Slow" });
        return "<!DOCTYPE html><html><head></head><body>";
      },
      () => "</body></html>",
    ]),
  );

  const fast = run(
    streamingNext([
      () => {
        useHead({ title: "Fast" });
        return "<!DOCTYPE html><html><head></head><body></body></html>";
      },
    ]),
  );

  const [slowHtml, fastHtml] = await Promise.all([
    slow.then((r) => r.text()),
    fast.then((r) => r.text()),
  ]);

  expect(slowHtml).toContain("<title>Slow</title>");
  expect(slowHtml).not.toContain("Fast");
  expect(fastHtml).toContain("<title>Fast</title>");
  expect(fastHtml).not.toContain("Slow");
});
