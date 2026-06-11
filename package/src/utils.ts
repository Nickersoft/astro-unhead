import { type Unhead } from "unhead/server";

import { ctx } from "./ctx.ts";

type UnheadHook = (head: Unhead, ...input: any[]) => unknown;

type DropHead<Hook extends UnheadHook> =
  Parameters<Hook> extends [Unhead, ...infer Rest] ? Rest : never;

export function wrap<Hook extends UnheadHook>(
  hook: Hook,
): (...params: DropHead<Hook>) => ReturnType<Hook> {
  return (...params) => (hook as UnheadHook)(ctx.use(), ...params) as ReturnType<Hook>;
}

export { ctx as head };
