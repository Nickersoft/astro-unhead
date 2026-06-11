import { applyHeadToHtml, parseHtmlForUnheadExtraction } from "unhead/parser";
import { transformHtmlTemplate } from "unhead/server";
import { streamingIifeCode } from "unhead/stream/iife";
import {
  createBootstrapScript,
  renderShell,
  renderSSRHeadSuspenseChunk,
} from "unhead/stream/server";

import { ctx } from "./ctx.ts";
import type { Head } from "./types.ts";

const BODY_OPEN_RE = /<body[^>]*>/i;
const BODY_CLOSE_RE = /<\/body>/i;
const BODY_CLOSE = "</body>";
const SHELL_SENTINEL = "</body></html>";

export function wrapStream(
  head: Head,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = body.getReader();

  let shell = "";
  let shellSent = false;
  let clientSent = false;
  let bodyTags = "";
  let held = "";

  // Head entries registered after the shell has been flushed can only reach
  // the page as client-side DOM patches, which need unhead's streaming
  // client; it is inlined once, ahead of the first patch.
  const patchScript = () => {
    const patch = renderSSRHeadSuspenseChunk(head);
    if (!patch) return "";
    const client = clientSent ? "" : `<script>${streamingIifeCode}</script>`;
    clientSent = true;
    return `${client}<script>${patch}</script>`;
  };

  const renderShellHtml = (html: string) => {
    // Mirror transformHtmlTemplate: lift head tags out of the markup and
    // re-render them through unhead at the lowest priority, so entries
    // registered via useHead win over the template's own tags.
    const template = parseHtmlForUnheadExtraction(html + SHELL_SENTINEL);
    head.push(template.input, { _index: 0 } as Parameters<typeof head.push>[1]);
    const ssr = renderShell(head);
    bodyTags = ssr.bodyTags;
    const transformed = applyHeadToHtml(template, {
      htmlAttrs: ssr.htmlAttrs,
      headTags: createBootstrapScript() + ssr.headTags,
      bodyAttrs: ssr.bodyAttrs,
      bodyTagsOpen: ssr.bodyTagsOpen,
      bodyTags: "",
    });
    return transformed.endsWith(SHELL_SENTINEL)
      ? transformed.slice(0, -SHELL_SENTINEL.length)
      : transformed;
  };

  // Hold back everything from `</body>` on (or a chunk-trailing prefix of it)
  // so body-close tags and final patches can land inside the body.
  const withheld = (incoming: string) => {
    const text = held + incoming;
    held = "";
    const close = BODY_CLOSE_RE.exec(text);
    if (close) {
      held = text.slice(close.index);
      return text.slice(0, close.index);
    }
    for (let i = Math.min(BODY_CLOSE.length - 1, text.length); i > 0; i--) {
      if (text.slice(-i).toLowerCase() === BODY_CLOSE.slice(0, i)) {
        held = text.slice(-i);
        return text.slice(0, -i);
      }
    }
    return text;
  };

  return new ReadableStream({
    pull(controller) {
      // Re-enter the head context so components rendered while the response
      // is being consumed can still resolve it through AsyncLocalStorage.
      // Neither Node nor Bun re-invoke pull after it resolves without
      // enqueuing, so keep reading until there is something to emit.
      return ctx.callAsync(head, async () => {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const tail = held + decoder.decode();
            if (!shellSent) {
              controller.enqueue(encoder.encode(transformHtmlTemplate(head, shell + tail)));
            } else {
              const closing = bodyTags + patchScript();
              let close = -1;
              if (closing) {
                for (const match of tail.matchAll(/<\/body>/gi)) close = match.index;
              }
              const out =
                close >= 0 ? tail.slice(0, close) + closing + tail.slice(close) : tail + closing;
              if (out) controller.enqueue(encoder.encode(out));
            }
            controller.close();
            return;
          }

          const text = decoder.decode(value, { stream: true });

          if (!shellSent) {
            shell += text;
            const open = BODY_OPEN_RE.exec(shell);
            if (!open) continue;
            const at = open.index + open[0].length;
            const out = renderShellHtml(shell.slice(0, at)) + withheld(shell.slice(at));
            shellSent = true;
            shell = "";
            controller.enqueue(encoder.encode(out));
            return;
          }

          const out = withheld(text) + patchScript();
          if (out) {
            controller.enqueue(encoder.encode(out));
            return;
          }
        }
      });
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
