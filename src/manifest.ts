import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Idea Pipeline",
  version: "0.0.0",
  action: {
    default_title: "Idea Pipeline",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "sidePanel"],
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  commands: {
    "open-panel": {
      suggested_key: {
        default: "Ctrl+Shift+Y",
        mac: "Command+Shift+Y",
      },
      description: "Ouvrir le panneau Idea Pipeline",
    },
  },
});
