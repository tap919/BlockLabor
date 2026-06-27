// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts  –  All shared types for the UI Preset MCP Server
// ─────────────────────────────────────────────────────────────────────────────

// ── Design Token types ────────────────────────────────────────────────────────

export interface ColorTokens {
  base: {
    bg: string;         // deepest background
    surface: string;    // glass surface bg (rgba)
    border: string;     // glass border (rgba)
    overlay: string;    // modal overlay
  };
  accent: Record<string, string>;   // e.g. { primary, secondary, danger, success }
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  glass: {
    tint: string;       // rgba tint applied to glass surfaces
    tintHover?: string; // rgba tint on hover
    highlight: string;  // top-edge highlight on glass cards
    shadow: string;     // drop shadow color
  };
}

export interface BlurTokens {
  none: string;
  sm: string;    // e.g. "blur(4px)"
  md: string;    // e.g. "blur(12px)"
  lg: string;    // e.g. "blur(24px)"
  xl: string;    // e.g. "blur(40px)"
  // elevation layers
  elevation: {
    0: string; // base layer
    1: string; // cards
    2: string; // panels / sidebar
    3: string; // modals
    4: string; // tooltips / popovers
  };
}

export interface SpacingTokens {
  scale: number[];        // e.g. [0, 4, 8, 12, 16, 24, 32, 48, 64, 96]
  sidebar: {
    width: string;
    collapsedWidth: string;
    padding: string;
  };
  card: {
    padding: string;
    gap: string;
    borderRadius: string;
  };
  settings: {
    rowHeight: string;
    sectionGap: string;
    labelWidth: string;
  };
}

export interface TypographyTokens {
  fontFamily: {
    display: string;
    body: string;
    mono: string;
  };
  scale: Record<string, string>;   // xs, sm, base, lg, xl, 2xl …
  weight: Record<string, number>;  // light, regular, medium, semibold, bold
  lineHeight: Record<string, string>;
}

export interface AnimationTokens {
  duration: Record<string, string>;   // instant, fast, normal, slow
  easing: Record<string, string>;     // ease, spring, bounce …
  transition: {
    default: string;
    glass: string;      // specific transition for glass hover effects
    sidebar: string;
    settings: string;
  };
}

export interface DesignTokens {
  colors: ColorTokens;
  blur: BlurTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  animation: AnimationTokens;
}

// ── Preset types ───────────────────────────────────────────────────────────────

export type PresetId = string;

export interface PresetManifest {
  id: PresetId;
  name: string;
  description: string;
  version: string;
  extends?: PresetId;         // parent preset to inherit from (deep merge)
  author?: string;
  tags: string[];
  components: string[];       // list of component template filenames available
  layouts: string[];
  styleCategory?: string;     // e.g. 'glassmorphic', 'neumorphic', 'brutalist', 'cyberpunk', 'pastel', 'aurora'
  designPrinciples?: string[]; // key design principles this preset embodies
}

export interface Preset {
  manifest: PresetManifest;
  tokens: DesignTokens;
  components: Record<string, ComponentTemplate>;
  layouts: Record<string, LayoutTemplate>;
}

export interface ComponentTemplate {
  name: string;
  category: 'shell' | 'surface' | 'settings' | 'navigation' | 'data' | 'feedback';
  description: string;
  propsSchema: Record<string, PropDefinition>;
  template: string;           // JSX template string with token placeholders
  cssModule?: string;         // optional CSS module template
  variants?: Record<string, Partial<ComponentTemplate>>;
}

export interface LayoutTemplate {
  name: string;
  description: string;
  regions: string[];          // named regions (sidebar, main, topbar, etc.)
  template: string;
}

export interface PropDefinition {
  type: string;
  required: boolean;
  default?: unknown;
  description: string;
  options?: unknown[];        // for enum props
}

// ── Session / Active State types ──────────────────────────────────────────────

export interface SessionState {
  activePresetId: PresetId | null;
  activePreset: Preset | null;
  loadedAt: Date | null;
  overrides: Partial<DesignTokens>;
}

// ── Correction types ──────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface UIIssue {
  severity: IssueSeverity;
  rule: string;
  message: string;
  line?: number;
  column?: number;
  fix?: string;               // suggested fix description
}

export interface CorrectionResult {
  original: string;
  corrected: string;
  issues: UIIssue[];
  appliedFixes: string[];
  presetUsed: PresetId;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: UIIssue[];
  score: number;              // 0–100 conformance score
  presetUsed: PresetId;
}

export interface PresetDiff {
  added: string[];
  removed: string[];
  changed: Array<{ path: string; from: unknown; to: unknown }>;
}

// ── Tool response wrapper ─────────────────────────────────────────────────────

export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

export interface ToolError {
  ok: false;
  error: string;
  hint?: string;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;
