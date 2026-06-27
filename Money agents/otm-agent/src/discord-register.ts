/**
 * TapClaw Discord Bot — one-shot command registration script.
 *
 * Run this once after creating your Discord app to register all slash commands.
 * The main discord-bot.ts also calls this on startup, so running it manually
 * is optional — it's provided here for CI / pre-deploy convenience.
 *
 * Usage:
 *   node --loader ts-node/esm src/discord-register.ts
 *   # or from extensions/otm-agent/:
 *   pnpm discord:register
 *
 * Required env vars (in .env or shell):
 *   DISCORD_BOT_TOKEN   — Bot token from the Discord Developer Portal
 *   DISCORD_APP_ID      — Application ID from the Discord Developer Portal
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { REST, Routes } from "discord.js";
import { TAPCLAW_COMMANDS } from "./discord-commands.js";

async function loadDotenv(): Promise<void> {
  const candidates = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", "..", ".env"),
    join(homedir(), ".openclaw", ".env"),
  ];
  for (const p of candidates) {
    try {
      const text = await readFile(p, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed
          .slice(eq + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        if (key && val && !process.env[key]) process.env[key] = val;
      }
      break;
    } catch {
      // Not found — try next candidate
    }
  }
}

async function register(): Promise<void> {
  await loadDotenv();

  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APP_ID;

  if (!token || !appId) {
    console.error(
      "Error: DISCORD_BOT_TOKEN and DISCORD_APP_ID must be set.\n" +
        "Add them to your .env file or export them in your shell.",
    );
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  console.log(`Registering ${TAPCLAW_COMMANDS.length} command(s) globally...`);
  const result = (await rest.put(Routes.applicationCommands(appId), {
    body: TAPCLAW_COMMANDS,
  })) as unknown[];

  console.log(`Successfully registered ${result.length} command(s):`);
  for (const cmd of TAPCLAW_COMMANDS) {
    console.log(`  /${cmd.name} — ${cmd.description}`);
  }
}

register().catch((err) => {
  console.error("Registration failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
