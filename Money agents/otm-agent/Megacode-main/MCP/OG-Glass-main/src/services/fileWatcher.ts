// ─────────────────────────────────────────────────────────────────────────────
// services/fileWatcher.ts  –  Hot-reload presets on disk changes (dev mode)
// ─────────────────────────────────────────────────────────────────────────────

import chokidar from "chokidar";
import path from "path";
import { PRESETS_DIR } from "../constants.js";

export function startWatching(
  onChange: (changedPresetId: string) => void
): void {
  const watcher = chokidar.watch(PRESETS_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 4,
  });

  const getPresetId = (filePath: string): string | null => {
    const relative = path.relative(PRESETS_DIR, filePath);
    const parts = relative.split(path.sep);
    return parts[0] ?? null;
  };

  watcher.on("change", (filePath) => {
    const presetId = getPresetId(filePath);
    if (presetId) onChange(presetId);
  });

  watcher.on("add", (filePath) => {
    const presetId = getPresetId(filePath);
    if (presetId) onChange(presetId);
  });
}
