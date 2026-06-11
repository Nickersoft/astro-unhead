import { AsyncLocalStorage } from "node:async_hooks";

import { getContext } from "unctx";

import type { Head } from "./types.ts";

export const ctx = getContext<Head>("arch:unhead", {
  asyncContext: true,
  AsyncLocalStorage,
});
