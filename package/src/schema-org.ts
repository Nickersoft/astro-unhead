import * as unheadSchema from "@unhead/schema-org";

import { wrap } from "./utils.ts";

export const useSchemaOrg: ReturnType<typeof wrap<typeof unheadSchema.useSchemaOrg>> = wrap(
  unheadSchema.useSchemaOrg,
);
