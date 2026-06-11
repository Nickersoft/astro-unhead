import type { createHead, ServerUnhead } from "unhead/server";

export type HeadOptions = Parameters<typeof createHead>[0];

export type MiddlewareOptions = NonNullable<HeadOptions> & {
  /**
   * Stream HTML responses instead of buffering them. The shell is flushed as
   * soon as the opening `<body>` tag is seen, and head entries registered
   * after that point are applied on the client through injected patch
   * scripts, which requires JavaScript to run in the browser.
   */
  streaming?: boolean;
};

export type Head = ServerUnhead;
