import { createHead, renderSSRHead } from "unhead/server";
import { expect, test } from "vite-plus/test";

import { ctx } from "../src/ctx.ts";
import { head, useHead, useHeadSafe, useScript, useSeoMeta } from "../src/index.ts";

const withHead = <T>(fn: () => T | Promise<T>) => ctx.callAsync(createHead(), async () => fn());

test("useHead registers tags on the contextual head", async () => {
  const rendered = await withHead(async () => {
    useHead({ title: "Hello" });
    return renderSSRHead(ctx.use());
  });

  expect(rendered.headTags).toContain("<title>Hello</title>");
});

test("useSeoMeta expands meta shorthands", async () => {
  const rendered = await withHead(async () => {
    useSeoMeta({ description: "A fine page", ogTitle: "Hello OG" });
    return renderSSRHead(ctx.use());
  });

  expect(rendered.headTags).toContain('name="description"');
  expect(rendered.headTags).toContain('content="A fine page"');
  expect(rendered.headTags).toContain('property="og:title"');
});

test("useHeadSafe filters unsafe input", async () => {
  const rendered = await withHead(async () => {
    useHeadSafe({
      title: "Safe",
      script: [{ innerHTML: "alert(1)" }],
    });
    return renderSSRHead(ctx.use());
  });

  expect(rendered.headTags).toContain("<title>Safe</title>");
  expect(rendered.headTags).not.toContain("alert(1)");
});

test("useScript registers a script tag", async () => {
  const rendered = await withHead(async () => {
    useScript({ src: "https://example.com/analytics.js" });
    return renderSSRHead(ctx.use());
  });

  expect(rendered.headTags).toContain("https://example.com/analytics.js");
});

test("hooks throw when called outside of a head context", () => {
  expect(() => useHead({ title: "Nope" })).toThrow();
});

test("head context is re-exported", () => {
  expect(head).toBe(ctx);
});
