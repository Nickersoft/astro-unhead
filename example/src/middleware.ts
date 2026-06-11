import { UnheadSchemaOrg } from "@unhead/schema-org";
import unhead from "astro-unhead/middleware";
import { InferSeoMetaPlugin } from "unhead/plugins";

export const onRequest = unhead({
  plugins: [InferSeoMetaPlugin(), UnheadSchemaOrg()],
  init: [
    {
      link: [
        { rel: "icon", href: "/favicon.ico" },
        {
          rel: "sitemap",
          type: "application/xml",
          title: "Sitemap",
          href: "/sitemap-index.xml",
        },
      ],
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width,initial-scale=1" },
      ],
    },
  ],
});
