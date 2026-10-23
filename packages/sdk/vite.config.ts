import { defineConfig } from "vite"
import { resolve } from "path"

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ShopG41",
      fileName: (format) => {
        if (format === "es") return "sdk.js"
        return "sdk.umd.cjs"
      },
    },
  },
})
