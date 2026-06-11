import { defineMiddleware } from "astro/middleware";
import { createHead, transformHtmlTemplate } from "unhead/server";

import { ctx } from "./ctx.ts";
import { wrapStream } from "./streaming.ts";
import type { MiddlewareOptions } from "./types.ts";

export default (options: MiddlewareOptions = {}) => {
  const { streaming, ...init } = options;

  return defineMiddleware(async (_ctx, next) => {
    const head = createHead(init);

    return ctx.callAsync(head, async () => {
      const response = await next();
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html")) {
        return response;
      }

      if (streaming && response.body) {
        const headers = new Headers(response.headers);
        headers.delete("content-length");

        return new Response(wrapStream(head, response.body), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      const html = await response.text();
      const transformed = transformHtmlTemplate(head, html);

      return new Response(transformed, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    });
  });
};

export type { MiddlewareOptions };
