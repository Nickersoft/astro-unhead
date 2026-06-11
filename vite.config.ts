import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/middleware.ts", "src/index.ts", "src/schema-org.ts"],
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    sortImports: true,
    sortPackageJson: true,
  },
});
