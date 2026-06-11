import { defineWebPage } from "@unhead/schema-org";
import { createHead, renderSSRHead } from "unhead/server";
import { expect, test } from "vite-plus/test";

import { ctx } from "../src/ctx.ts";
import { useSchemaOrg } from "../src/schema-org.ts";

test("useSchemaOrg registers ld+json on the contextual head", async () => {
  const rendered = await ctx.callAsync(createHead(), async () => {
    useSchemaOrg([defineWebPage({ name: "Home" })]);
    return renderSSRHead(ctx.use());
  });

  const output = rendered.headTags + rendered.bodyTags;
  expect(output).toContain("application/ld+json");
  expect(output).toContain('"WebPage"');
});

test("useSchemaOrg throws outside of a head context", () => {
  expect(() => useSchemaOrg([defineWebPage({ name: "Nope" })])).toThrow();
});
