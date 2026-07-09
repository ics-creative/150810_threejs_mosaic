import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, "index.html"),
        demoIcons: resolve(root, "DemoIcons.html"),
        demoCubes: resolve(root, "DemoCubes.html"),
        demoIcons_4000: resolve(root, "DemoIcons_4000.html"),
      },
    },
  },
});
