import * as unhead from "unhead";

import { wrap, head } from "./utils.ts";

const useHead: ReturnType<typeof wrap<typeof unhead.useHead>> = wrap(unhead.useHead);
const useScript: ReturnType<typeof wrap<typeof unhead.useScript>> = wrap(unhead.useScript);
const useHeadSafe: ReturnType<typeof wrap<typeof unhead.useHeadSafe>> = wrap(unhead.useHeadSafe);
const useSeoMeta: ReturnType<typeof wrap<typeof unhead.useSeoMeta>> = wrap(unhead.useSeoMeta);

export { head, useHead, useScript, useHeadSafe, useSeoMeta };
