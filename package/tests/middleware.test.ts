import { expect, test } from "vite-plus/test";

import { useHead } from "../src/index.ts";
import unhead from "../src/middleware.ts";

const PAGE = "<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>";

const htmlResponse = (body: string, init?: ResponseInit) =>
  new Response(body, {
    ...init,
    headers: { "content-type": "text/html", ...Object.fromEntries(new Headers(init?.headers)) },
  });

const run = (next: () => Promise<Response>, init = {}) =>
  unhead(init)({} as never, next as never) as Promise<Response>;

test("injects head tags into html responses", async () => {
  const response = await run(async () => {
    useHead({ title: "From Middleware" });
    return htmlResponse(PAGE);
  });

  const html = await response.text();
  expect(html).toContain("<title>From Middleware</title>");
  expect(html).toContain("<h1>Hi</h1>");
});

test("applies init options to every request", async () => {
  const response = await run(async () => htmlResponse(PAGE), {
    init: [{ meta: [{ name: "generator", content: "astro-unhead" }] }],
  });

  const html = await response.text();
  expect(html).toContain('name="generator"');
  expect(html).toContain('content="astro-unhead"');
});

test("passes non-html responses through untouched", async () => {
  const json = new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });

  const response = await run(async () => json);

  expect(response).toBe(json);
  expect(await response.json()).toEqual({ ok: true });
});

test("passes responses without a content-type through untouched", async () => {
  const bare = new Response("plain");
  bare.headers.delete("content-type");

  const response = await run(async () => bare);

  expect(response).toBe(bare);
});

test("preserves status, statusText and headers on transformed responses", async () => {
  const response = await run(async () =>
    htmlResponse(PAGE, {
      status: 404,
      statusText: "Not Found",
      headers: { "x-custom": "yes" },
    }),
  );

  expect(response.status).toBe(404);
  expect(response.statusText).toBe("Not Found");
  expect(response.headers.get("x-custom")).toBe("yes");
  expect(response.headers.get("content-type")).toContain("text/html");
});

test("isolates head state between concurrent requests", async () => {
  const slow = run(async () => {
    useHead({ title: "Slow" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return htmlResponse(PAGE);
  });

  const fast = run(async () => {
    useHead({ title: "Fast" });
    return htmlResponse(PAGE);
  });

  const [slowHtml, fastHtml] = await Promise.all([
    slow.then((r) => r.text()),
    fast.then((r) => r.text()),
  ]);

  expect(slowHtml).toContain("<title>Slow</title>");
  expect(slowHtml).not.toContain("Fast");
  expect(fastHtml).toContain("<title>Fast</title>");
  expect(fastHtml).not.toContain("Slow");
});
