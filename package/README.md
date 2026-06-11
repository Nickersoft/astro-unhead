# astro-unhead

[Unhead](https://unhead.unjs.io) for [Astro](https://astro.build). Manage your document `<head>` from anywhere in your component tree — pages, layouts, or deeply nested components — using unhead's full toolkit: `useHead`, `useSeoMeta`, `useHeadSafe`, `useScript`, and `useSchemaOrg`.

A middleware holds a per-request unhead instance in `AsyncLocalStorage`, so the hooks work in any component without prop drilling or `Astro.locals`.

## Installation

```bash
bun add astro-unhead unhead
# optional, for useSchemaOrg
bun add @unhead/schema-org
```

## Setup

Register the middleware in `src/middleware.ts`:

```ts
import unhead from "astro-unhead/middleware";

export const onRequest = unhead({
  // any unhead createHead() options: init, plugins, hooks, ...
  init: [
    {
      meta: [{ charset: "utf-8" }],
      link: [{ rel: "icon", href: "/favicon.ico" }],
    },
  ],
});
```

To compose with other middleware, use Astro's `sequence`:

```ts
import { sequence } from "astro/middleware";

export const onRequest = sequence(unhead({}), myOtherMiddleware);
```

## Usage

Call the hooks from any `.astro` frontmatter (or anything else that runs during the request):

```astro
---
import { useHead, useSeoMeta } from "astro-unhead";

useHead({
  title: "My Page",
  meta: [{ name: "description", content: "A fine page indeed" }],
});

useSeoMeta({
  ogTitle: "My Page",
  ogDescription: "A fine page indeed",
});
---

<html>
  <head></head>
  <body><slot /></body>
</html>
```

Head tags already present in your markup are extracted and deduplicated against entries registered through the hooks — hook entries win.

### Schema.org

```astro
---
import { useSchemaOrg } from "astro-unhead/schema-org";
import { defineWebPage } from "@unhead/schema-org";

useSchemaOrg([defineWebPage({ name: "Home" })]);
---
```

Add the `UnheadSchemaOrg` plugin to the middleware options to enable resolution:

```ts
import { UnheadSchemaOrg } from "@unhead/schema-org";

export const onRequest = unhead({ plugins: [UnheadSchemaOrg()] });
```

## Streaming

By default the middleware buffers the HTML response, transforms it once, and sends it — every `useHead` call ends up server-rendered in the `<head>`, no matter how late in the render it runs.

Astro streams responses, though, and buffering forfeits that. Opt in to streaming mode to keep it:

```ts
export const onRequest = unhead({ streaming: true });
```

In streaming mode:

- The document shell is flushed as soon as the opening `<body>` tag is rendered, with all head tags registered up to that point (typically your page frontmatter) server-rendered into the `<head>`.
- Head entries registered **after** the shell has flushed — e.g. from a component below an `await` deep in the body — are injected into the stream as patch scripts that update the DOM as they arrive, using unhead's streaming client. The client (~5 kB gzipped) is inlined once, and only on responses that actually need it.
- Responses without a `<body>` tag fall back to the buffered transform, and non-HTML responses pass through untouched as always.

### Caveat

Late head updates are applied client-side, so they require JavaScript to run in the browser. Crawlers that do not execute JavaScript will only see head tags registered before the shell was flushed. If your SEO-critical tags (`title`, `description`, canonical, og:\*) come from components that render late in the stream, either move those calls into the page frontmatter or stay with the default buffered mode.

## Options

`unhead(options)` accepts everything unhead's [`createHead`](https://unhead.unjs.io/docs/typescript/head/api/core/create-head) does (`init`, `plugins`, `hooks`, ...), plus:

| Option      | Type      | Default | Description                                      |
| ----------- | --------- | ------- | ------------------------------------------------ |
| `streaming` | `boolean` | `false` | Stream HTML responses instead of buffering them. |

## Development

```bash
bun install        # install dependencies
bun run test       # run the unit tests
bun run check      # format, lint, and type-check
bun run build      # build the library
```
