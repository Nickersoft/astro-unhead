import { createHead, type Unhead } from "unhead/server";
import { expect, test } from "vite-plus/test";

import { ctx } from "../src/ctx.ts";
import { head, wrap } from "../src/utils.ts";

test("wrap injects the contextual head as the first argument", async () => {
  const instance = createHead();
  const hook = (h: Unhead, ...rest: string[]) => ({ h, rest });
  const wrapped = wrap(hook);

  const result = await ctx.callAsync(instance, async () => wrapped("a", "b"));

  expect(result.h).toBe(instance);
  expect(result.rest).toEqual(["a", "b"]);
});

test("wrap forwards the hook's return value", async () => {
  const wrapped = wrap((_h: Unhead) => 42);

  const result = await ctx.callAsync(createHead(), async () => wrapped());

  expect(result).toBe(42);
});

test("wrapped hooks throw outside of a head context", () => {
  const wrapped = wrap((_h: Unhead) => "never");

  expect(() => wrapped()).toThrow();
});

test("head is the shared unhead context", () => {
  expect(head).toBe(ctx);
});
