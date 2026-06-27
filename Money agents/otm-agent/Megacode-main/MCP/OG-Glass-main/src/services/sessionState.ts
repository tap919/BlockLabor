// ─────────────────────────────────────────────────────────────────────────────
// services/sessionState.ts  –  Active preset session management + overrides
// ─────────────────────────────────────────────────────────────────────────────

import deepmerge from "deepmerge";
import type { SessionState, Preset, DesignTokens } from "../types/index.js";

// ── Singleton state ───────────────────────────────────────────────────────────

let state: SessionState = {
  activePresetId: null,
  activePreset: null,
  loadedAt: null,
  overrides: {},
};

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getSessionState(): SessionState {
  return state;
}

export function getActivePreset(): Preset | null {
  return state.activePreset;
}

export function getActivePresetId(): string | null {
  return state.activePresetId;
}

export function requireActivePreset(toolName: string): Preset {
  if (!state.activePreset) {
    throw new Error(
      `No active preset. Run load_preset first before calling ${toolName}.`
    );
  }
  return state.activePreset;
}

export function getEffectiveTokens(): DesignTokens {
  const preset = requireActivePreset("getEffectiveTokens");
  if (Object.keys(state.overrides).length === 0) {
    return preset.tokens;
  }
  return deepmerge(preset.tokens, state.overrides as DesignTokens, {
    arrayMerge: (_dst, src) => src,
  });
}

// ── Mutators ──────────────────────────────────────────────────────────────────

export function setActivePreset(presetId: string, preset: Preset): void {
  state = {
    activePresetId: presetId,
    activePreset: preset,
    loadedAt: new Date(),
    overrides: {},
  };
}

export function applyTokenOverrides(overrides: Partial<DesignTokens>): void {
  state = {
    ...state,
    overrides: deepmerge(state.overrides as DesignTokens, overrides as DesignTokens, {
      arrayMerge: (_dst, src) => src,
    }),
  };
}

export function resetSession(): void {
  state = {
    activePresetId: null,
    activePreset: null,
    loadedAt: null,
    overrides: {},
  };
}
