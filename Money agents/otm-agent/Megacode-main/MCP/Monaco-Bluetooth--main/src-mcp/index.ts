#!/usr/bin/env node

/**
 * Monaco Bluetooth MCP Server
 *
 * Exposes PlayStation / Xbox controller configuration, button mappings,
 * mode system, analog config, on-screen keyboard layout, haptic profiles,
 * and device profiles as MCP tools so an AI assistant can help configure
 * and manage the Bluetooth controller integration for Monaco Editor.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
//  DATA — mirrors the browser-side source files in src/
// ═══════════════════════════════════════════════════════════════

// ── Button Names (Gamepad API standard layout) ────────────────

interface ButtonEntry {
  index: number;
  name: string;
  psLabel: string;
  xboxLabel: string;
}

const BUTTON_NAMES: Record<number, { name: string; psLabel: string; xboxLabel: string }> = {
  0:  { name: "Cross_A",       psLabel: "Cross",    xboxLabel: "A"       },
  1:  { name: "Circle_B",      psLabel: "Circle",   xboxLabel: "B"       },
  2:  { name: "Square_X",      psLabel: "Square",   xboxLabel: "X"       },
  3:  { name: "Triangle_Y",    psLabel: "Triangle",  xboxLabel: "Y"       },
  4:  { name: "L1_LB",         psLabel: "L1",       xboxLabel: "LB"      },
  5:  { name: "R1_RB",         psLabel: "R1",       xboxLabel: "RB"      },
  6:  { name: "L2_LT",         psLabel: "L2",       xboxLabel: "LT"      },
  7:  { name: "R2_RT",         psLabel: "R2",       xboxLabel: "RT"      },
  8:  { name: "Select_Back",   psLabel: "Share",    xboxLabel: "View"    },
  9:  { name: "Start_Options", psLabel: "Options",  xboxLabel: "Menu"    },
  10: { name: "L3",            psLabel: "L3",       xboxLabel: "LS"      },
  11: { name: "R3",            psLabel: "R3",       xboxLabel: "RS"      },
  12: { name: "DPad_Up",       psLabel: "DPad Up",  xboxLabel: "DPad Up" },
  13: { name: "DPad_Down",     psLabel: "DPad Down", xboxLabel: "DPad Down" },
  14: { name: "DPad_Left",     psLabel: "DPad Left", xboxLabel: "DPad Left" },
  15: { name: "DPad_Right",    psLabel: "DPad Right", xboxLabel: "DPad Right" },
};

// ── Axes ──────────────────────────────────────────────────────

const AXES: Record<number, string> = {
  0: "Left Stick X",
  1: "Left Stick Y",
  2: "Right Stick X",
  3: "Right Stick Y",
};

// ── Action Map (mode → combo → action) ───────────────────────

interface ActionEntry {
  action: string;
  label: string;
}

type ActionMode = Record<string, ActionEntry>;

const ACTION_MAP: Record<string, ActionMode> = {
  global: {
    "Select_Back":       { action: "actions.find",                              label: "Quick Open"       },
    "Start_Options":     { action: "workbench.action.showCommands",              label: "Command Palette"  },
    "L1_LB+DPad_Left":  { action: "workbench.view.explorer",                    label: "Focus Sidebar"    },
    "L1_LB+DPad_Right": { action: "workbench.action.focusFirstEditorGroup",     label: "Focus Editor"     },
    "R1_RB+DPad_Down":  { action: "workbench.action.terminal.focus",            label: "Focus Terminal"   },
  },
  editor: {
    // Cursor movement
    "L1_LB+DPad_Left":  { action: "cursorWordLeft",                             label: "Word Left"        },
    "L1_LB+DPad_Right": { action: "cursorWordRight",                            label: "Word Right"       },
    "L1_LB+DPad_Up":    { action: "cursorHome",                                 label: "Line Start"       },
    "L1_LB+DPad_Down":  { action: "cursorEnd",                                  label: "Line End"         },
    // Selection
    "Cross_A+Cross_A":  { action: "editor.action.selectHighlights",             label: "Select Word"      },
    "R1_RB+Cross_A":    { action: "expandLineSelection",                        label: "Select Line"      },
    "L2_LT+R2_RT":      { action: "editor.action.selectAll",                    label: "Select All"       },
    // Editing — clipboard
    "L1_LB+Square_X":   { action: "editor.action.clipboardCopyAction",          label: "Copy"             },
    "L1_LB+Triangle_Y": { action: "editor.action.clipboardCutAction",           label: "Cut"              },
    "L1_LB+Circle_B":   { action: "editor.action.clipboardPasteAction",         label: "Paste"            },
    // Editing — undo / redo / save
    "L2_LT+Square_X":   { action: "undo",                                       label: "Undo"             },
    "L2_LT+Triangle_Y": { action: "redo",                                       label: "Redo"             },
    "L2_LT+Circle_B":   { action: "workbench.action.files.save",                label: "Save"             },
    "L2_LT+Cross_A":    { action: "workbench.action.files.saveAll",             label: "Save All"         },
    // Editing — format / comment / indent
    "R2_RT+Triangle_Y": { action: "editor.action.formatDocument",               label: "Format"           },
    "R2_RT+Square_X":   { action: "editor.action.commentLine",                  label: "Toggle Comment"   },
    "R2_RT+Circle_B":   { action: "tab",                                         label: "Indent"           },
    "R2_RT+Cross_A":    { action: "outdent",                                     label: "Outdent"          },
    // Navigation
    "R3":               { action: "editor.action.revealDefinition",              label: "Go to Definition" },
    "L3+Square_X":      { action: "actions.find",                               label: "Find"             },
    "L3+Triangle_Y":    { action: "editor.action.startFindReplaceAction",        label: "Replace"          },
    "L3+Circle_B":      { action: "workbench.action.gotoLine",                  label: "Go to Line"       },
    "L3+Cross_A":       { action: "editor.action.peekDefinition",               label: "Peek Definition"  },
    // Error navigation
    "R1_RB+R2_RT":      { action: "editor.action.marker.next",                  label: "Next Error"       },
    "L1_LB+L2_LT":      { action: "editor.action.marker.prev",                  label: "Prev Error"       },
    // IntelliSense
    "Triangle_Y":       { action: "editor.action.triggerSuggest",               label: "Trigger Suggest"  },
  },
  tabs: {
    "R2_RT":            { action: "workbench.action.nextEditor",                label: "Next Tab"         },
    "L2_LT":            { action: "workbench.action.previousEditor",            label: "Prev Tab"         },
    "Circle_B":         { action: "workbench.action.closeActiveEditor",         label: "Close Tab"        },
    "R1_RB+DPad_Left":  { action: "workbench.action.moveEditorLeftInGroup",     label: "Move Tab Left"    },
    "R1_RB+DPad_Right": { action: "workbench.action.moveEditorRightInGroup",    label: "Move Tab Right"   },
  },
  sidebar: {
    "R1_RB+Square_X":   { action: "explorer.newFile",                           label: "New File"         },
    "R1_RB+Triangle_Y": { action: "explorer.newFolder",                         label: "New Folder"       },
    "R1_RB+R2_RT":      { action: "workbench.files.action.refreshFilesExplorer", label: "Refresh"         },
  },
  terminal: {
    "R1_RB+R2_RT":      { action: "workbench.action.terminal.toggleTerminal",   label: "Toggle Terminal"  },
    "L1_LB+Square_X":   { action: "workbench.action.terminal.new",              label: "New Terminal"     },
    "L1_LB+Triangle_Y": { action: "workbench.action.terminal.clear",            label: "Clear Terminal"   },
    "L1_LB+Circle_B":   { action: "workbench.action.terminal.kill",             label: "Close Terminal"   },
  },
  activity_bar: {
    "L1_LB+Square_X":   { action: "workbench.view.explorer",                    label: "Explorer"         },
    "L1_LB+Triangle_Y": { action: "workbench.view.search",                      label: "Search"           },
    "L1_LB+Circle_B":   { action: "workbench.view.scm",                         label: "Source Control"   },
    "L1_LB+Cross_A":    { action: "workbench.view.extensions",                  label: "Extensions"       },
  },
};

// ── Mode descriptions ─────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<string, string> = {
  global:       "Global fallback — commands available everywhere (Quick Open, Command Palette, focus switches)",
  editor:       "Active when the Monaco code editor has focus — cursor movement, selection, clipboard, undo/redo, save, format, comment, indent, go-to-definition, find/replace, error navigation, IntelliSense",
  tabs:         "Tab management — next/prev tab, close tab, reorder tabs",
  sidebar:      "Sidebar / Explorer focused — create files & folders, refresh explorer",
  terminal:     "Integrated terminal focused — toggle, new, clear, close terminal",
  activity_bar: "Activity bar navigation — switch between Explorer, Search, Source Control, Extensions views",
};

// ── Analog stick configuration ────────────────────────────────

const ANALOG_CONFIG = {
  deadzone:              0.12,
  triggerDeadzone:       0.05,
  cursorAccumThreshold:  1.0,
  scrollAccumThreshold:  4.0,
  scrollMultiplier:      8,
  l2ScrollSpeedBoost:    3,
  keyRepeatDelay:        400,
  keyRepeatInterval:     80,
  pollHz:                60,
  axes: AXES,
};

// ── Device profiles ───────────────────────────────────────────

const DEVICE_PROFILES = [
  {
    name:     "PlayStation DualShock / DualSense",
    vendorId: "054c",
    vendor:   "Sony Interactive Entertainment",
    models:   ["DualShock 4 (CUH-ZCT2)", "DualSense (CFI-ZCT1)"],
    features: ["Touchpad", "Gyroscope", "Accelerometer", "Haptic feedback", "Adaptive triggers (DualSense)"],
    btProfile: "Bluetooth HID",
  },
  {
    name:     "Xbox Wireless Controller",
    vendorId: "045e",
    vendor:   "Microsoft",
    models:   ["Xbox Wireless Controller (Model 1914)", "Xbox Elite Series 2"],
    features: ["Impulse triggers", "Bluetooth LE", "Share button (newer models)"],
    btProfile: "Bluetooth HID",
  },
  {
    name:     "Generic Bluetooth HID Gamepad",
    vendorId: null,
    vendor:   "Various",
    models:   ["Any Bluetooth HID-compliant gamepad"],
    features: ["Standard Gamepad API layout (16 buttons, 4 axes)"],
    btProfile: "Bluetooth HID",
  },
];

// ── On-screen keyboard layout ─────────────────────────────────

const OSK_LAYOUT = {
  rows: [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "\u232B"],
    ["Tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
    ["Caps", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"],
    ["\u21E7", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "\u21E7"],
    ["Ctrl", "Alt", "Space", "Alt", "Ctrl"],
  ],
  wideKeys:   ["Tab", "Caps", "\u21E7", "Ctrl", "Alt"],
  widestKeys: ["Space"],
  widerKeys:  ["Enter", "\u232B"],
  navigation: {
    "DPad_Up":    "Move focus up",
    "DPad_Down":  "Move focus down",
    "DPad_Left":  "Move focus left",
    "DPad_Right": "Move focus right",
    "Cross_A":    "Press focused key",
    "Square_X":   "Backspace",
    "L1_LB+Cross_A": "Space",
    "Circle_B":   "Dismiss OSK",
  },
  trigger: "Double-tap Cross_A on any text input",
};

// ── Haptic feedback profiles ──────────────────────────────────

const HAPTIC_PROFILES: Record<string, { pattern: number[]; description: string }> = {
  fileOpen:    { pattern: [100],          description: "Short single pulse when a file is opened" },
  fileSave:    { pattern: [50, 30, 50],   description: "Double tap on successful save" },
  error:       { pattern: [200, 100, 200], description: "Long-short-long buzz on error" },
  modeSwitch:  { pattern: [40],           description: "Light tap on controller mode change" },
  connect:     { pattern: [200],          description: "Medium pulse on Bluetooth connect" },
  disconnect:  { pattern: [100, 50, 100], description: "Double pulse on Bluetooth disconnect" },
  batteryWarn: { pattern: [100, 50, 100], description: "Alert pattern when controller battery is low (<= 15%)" },
  oskOpen:     { pattern: [30],           description: "Micro tap when on-screen keyboard opens" },
  oskKeyPress: { pattern: [15],           description: "Tiny tick on each OSK key press" },
  voiceStart:  { pattern: [60],           description: "Short pulse when voice input starts" },
  voiceEnd:    { pattern: [30, 20, 30],   description: "Double tick when voice input ends" },
};

// ── In-memory custom action overrides ─────────────────────────

const customOverrides: Record<string, Record<string, ActionEntry>> = {};

// ═══════════════════════════════════════════════════════════════
//  MCP SERVER
// ═══════════════════════════════════════════════════════════════

const server = new McpServer({
  name: "monaco-bluetooth-mcp",
  version: "1.0.0",
});

// ── Tool: get_button_map ──────────────────────────────────────

server.tool(
  "get_button_map",
  "Returns the full PlayStation / Xbox button mapping table — index, unified name, PS label, Xbox label for all 16 standard Gamepad API buttons plus the 4 analog axes",
  {},
  async () => {
    const buttons: ButtonEntry[] = Object.entries(BUTTON_NAMES).map(
      ([idx, entry]) => ({
        index: Number(idx),
        name: entry.name,
        psLabel: entry.psLabel,
        xboxLabel: entry.xboxLabel,
      })
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ buttons, axes: AXES }, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_action_map ──────────────────────────────────────

const validModes = ["global", "editor", "tabs", "sidebar", "terminal", "activity_bar"] as const;

server.tool(
  "get_action_map",
  "Returns the action map for a specific controller mode or all modes. Each entry contains the button combo string, Monaco action ID, and human-readable label.",
  {
    mode: z
      .enum(validModes)
      .optional()
      .describe("Controller mode to query. Omit to get all modes."),
  },
  async ({ mode }) => {
    const mergedMap: Record<string, ActionMode> = {};
    for (const m of validModes) {
      mergedMap[m] = { ...ACTION_MAP[m], ...customOverrides[m] };
    }

    const result = mode ? { [mode]: mergedMap[mode] } : mergedMap;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_all_modes ───────────────────────────────────────

server.tool(
  "get_all_modes",
  "Returns all 6 controller modes with descriptions explaining when each mode is active and what it controls",
  {},
  async () => {
    const modes = validModes.map((m) => ({
      mode: m,
      description: MODE_DESCRIPTIONS[m],
      actionCount: Object.keys({ ...ACTION_MAP[m], ...customOverrides[m] }).length,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(modes, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_mode_actions ────────────────────────────────────

server.tool(
  "get_mode_actions",
  "Returns all button combos and their actions for a specific controller mode, including any custom overrides",
  {
    mode: z
      .enum(validModes)
      .describe("The controller mode to query"),
  },
  async ({ mode }) => {
    const merged = { ...ACTION_MAP[mode], ...customOverrides[mode] };
    const actions = Object.entries(merged).map(([combo, entry]) => ({
      combo,
      actionId: entry.action,
      label: entry.label,
      isCustom: !!(customOverrides[mode]?.[combo]),
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { mode, description: MODE_DESCRIPTIONS[mode], actions },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: search_action ───────────────────────────────────────

server.tool(
  "search_action",
  "Searches across all modes for actions matching the query string. Searches action IDs, labels, and combo strings (case-insensitive).",
  {
    query: z.string().describe("Search term to match against action IDs, labels, and combo strings"),
  },
  async ({ query }) => {
    const q = query.toLowerCase();
    const results: Array<{
      mode: string;
      combo: string;
      actionId: string;
      label: string;
    }> = [];

    for (const mode of validModes) {
      const merged = { ...ACTION_MAP[mode], ...customOverrides[mode] };
      for (const [combo, entry] of Object.entries(merged)) {
        if (
          combo.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.label.toLowerCase().includes(q)
        ) {
          results.push({
            mode,
            combo,
            actionId: entry.action,
            label: entry.label,
          });
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { query, matchCount: results.length, results },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: get_device_profiles ─────────────────────────────────

server.tool(
  "get_device_profiles",
  "Returns the supported controller device profiles — PlayStation DualShock/DualSense (vendor 054c), Xbox Wireless (vendor 045e), and Generic Bluetooth HID",
  {},
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(DEVICE_PROFILES, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_analog_config ───────────────────────────────────

server.tool(
  "get_analog_config",
  "Returns analog stick and trigger configuration — deadzones, cursor accumulation thresholds, scroll multipliers, key repeat timing, and axis descriptions",
  {},
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(ANALOG_CONFIG, null, 2),
        },
      ],
    };
  }
);

// ── Tool: customize_action ────────────────────────────────────

server.tool(
  "customize_action",
  "Records a custom action override for a specific mode and button combo. The override is stored in memory for the current session and takes priority over built-in mappings.",
  {
    mode: z.enum(validModes).describe("Controller mode to customize"),
    combo: z
      .string()
      .describe(
        'Button combo string, e.g. "L1_LB+Square_X". Use button names from get_button_map joined with "+".'
      ),
    actionId: z
      .string()
      .describe(
        'Monaco editor action ID to bind, e.g. "editor.action.formatDocument"'
      ),
    label: z.string().describe("Human-readable label for this action"),
  },
  async ({ mode, combo, actionId, label }) => {
    if (!customOverrides[mode]) {
      customOverrides[mode] = {};
    }
    const previous = ACTION_MAP[mode]?.[combo] || customOverrides[mode]?.[combo] || null;
    customOverrides[mode][combo] = { action: actionId, label };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              status: "ok",
              mode,
              combo,
              newAction: { actionId, label },
              previousAction: previous,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: get_osk_layout ──────────────────────────────────────

server.tool(
  "get_osk_layout",
  "Returns the on-screen keyboard QWERTY layout structure including rows, key sizing classes, controller navigation mappings, and trigger method",
  {},
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(OSK_LAYOUT, null, 2),
        },
      ],
    };
  }
);

// ── Tool: get_haptic_profiles ─────────────────────────────────

server.tool(
  "get_haptic_profiles",
  "Returns haptic feedback event definitions — vibration patterns for file operations, errors, mode switches, Bluetooth state, OSK interaction, and voice input events",
  {},
  async () => {
    const profiles = Object.entries(HAPTIC_PROFILES).map(([event, cfg]) => ({
      event,
      pattern: cfg.pattern,
      description: cfg.description,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(profiles, null, 2),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Monaco Bluetooth MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
