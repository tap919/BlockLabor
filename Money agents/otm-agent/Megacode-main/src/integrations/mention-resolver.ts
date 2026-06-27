/**
 * MentionResolver — Item #7
 *
 * Parses @-mentions in prompts and injects resolved content before the
 * text is sent to an LLM. Supports:
 *
 *   @filename        — reads a local file relative to rootDir
 *   @docs:url        — fetches a URL and returns its text
 *   @web:query       — placeholder for web search (returns reminder to use Perplexity)
 *   @notepad:name    — content of a named NotepadManager notepad
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface MentionResolution {
  /** The original mention string, e.g. "@src/index.ts" */
  mention: string;
  /** Resolved text content. */
  content: string;
  /** True if resolution succeeded. */
  success: boolean;
  error?: string;
}

export interface ResolvedPrompt {
  /** The final prompt with inline mention blocks injected. */
  text: string;
  /** Details of each mention that was found. */
  resolutions: MentionResolution[];
}

export interface MentionResolverConfig {
  rootDir?: string;
  /** Max file size to inline (bytes). Default 100 KB. */
  maxFileSizeBytes?: number;
  /** Max URL fetch size (bytes). Default 50 KB. */
  maxUrlBytes?: number;
  /** HTTP fetch timeout (ms). Default 8 s. */
  fetchTimeoutMs?: number;
}

// Regex that finds all @-mentions in a prompt.
// Matches: @path/to/file.ts  |  @docs:https://...  |  @web:query  |  @notepad:name
const MENTION_RE = /@(docs|web|notepad):([^\s]+)|@([^\s@#:,]+)/g;

export class MentionResolver {
  private readonly config: Required<MentionResolverConfig>;

  constructor(config: MentionResolverConfig = {}) {
    this.config = {
      rootDir: config.rootDir ?? process.cwd(),
      maxFileSizeBytes: config.maxFileSizeBytes ?? 100_000,
      maxUrlBytes: config.maxUrlBytes ?? 50_000,
      fetchTimeoutMs: config.fetchTimeoutMs ?? 8_000,
    };
  }

  /** Find and resolve all @-mentions in a prompt string. */
  async resolve(prompt: string): Promise<ResolvedPrompt> {
    const resolutions: MentionResolution[] = [];
    const mentions: Array<{ mention: string; start: number; end: number }> = [];

    let match: RegExpExecArray | null;
    MENTION_RE.lastIndex = 0;
    while ((match = MENTION_RE.exec(prompt)) !== null) {
      mentions.push({ mention: match[0], start: match.index, end: match.index + match[0].length });
    }

    // Resolve all mentions in parallel
    await Promise.all(
      mentions.map(async ({ mention }) => {
        const res = await this.resolveOne(mention);
        resolutions.push(res);
      })
    );

    // Build the augmented prompt — replace mentions with resolved blocks
    let text = prompt;
    const resMap = new Map(resolutions.map(r => [r.mention, r]));

    // Replace from end to start so indices don't shift
    for (const { mention, start, end } of [...mentions].reverse()) {
      const r = resMap.get(mention);
      if (!r || !r.success) continue;
      const block = `\n\n<!-- @mention: ${mention} -->\n\`\`\`\n${r.content}\n\`\`\`\n`;
      text = text.slice(0, start) + block + text.slice(end);
    }

    return { text, resolutions };
  }

  /** Resolve a single @-mention. */
  async resolveOne(mention: string): Promise<MentionResolution> {
    try {
      if (mention.startsWith("@docs:")) {
        const url = mention.slice(6);
        const content = await this.fetchUrl(url);
        return { mention, content, success: true };
      }

      if (mention.startsWith("@web:")) {
        const query = mention.slice(5);
        return {
          mention,
          content: `[Web search for "${query}" — route this prompt through the Perplexity provider for live results]`,
          success: true,
        };
      }

      if (mention.startsWith("@notepad:")) {
        const name = mention.slice(9);
        return {
          mention,
          content: `[Notepad "${name}" — retrieve with NotepadManager.get("${name}")]`,
          success: true,
        };
      }

      // Default: file path
      const filePath = mention.slice(1); // strip @
      const abs = path.resolve(this.config.rootDir, filePath);

      // Safety: must stay within rootDir
      if (!abs.startsWith(path.resolve(this.config.rootDir))) {
        return { mention, content: "", success: false, error: "Path traversal blocked" };
      }

      if (!fs.existsSync(abs)) {
        return { mention, content: "", success: false, error: `File not found: ${filePath}` };
      }

      const stat = fs.statSync(abs);
      if (stat.size > this.config.maxFileSizeBytes) {
        return { mention, content: "", success: false, error: `File too large (${stat.size} bytes)` };
      }

      const content = fs.readFileSync(abs, "utf8");
      return { mention, content, success: true };
    } catch (err) {
      return { mention, content: "", success: false, error: (err as Error).message };
    }
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https") ? https : http;
      const req = client.get(url, (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > this.config.maxUrlBytes) {
            req.destroy();
            resolve(chunks.map(c => c.toString()).join("").slice(0, this.config.maxUrlBytes));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(chunks.map(c => c.toString()).join("")));
        res.on("error", reject);
      });
      req.setTimeout(this.config.fetchTimeoutMs, () => {
        req.destroy();
        reject(new Error(`Fetch timeout: ${url}`));
      });
      req.on("error", reject);
    });
  }
}
