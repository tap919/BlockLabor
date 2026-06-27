/**
 * ImageContextLoader — Item #15 (Windsurf feature)
 *
 * Loads images from disk or URLs, converts them to base64 data URIs,
 * extracts metadata (dimensions, format, size), and packages everything
 * into a context object ready to be injected into a multi-modal LLM prompt.
 *
 * Supports: PNG, JPEG, GIF, WEBP, SVG, BMP, ICO.
 * URL fetching is supported for http/https only (no private-range SSRF).
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

/** MIME types supported by the loader. */
export type ImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "image/svg+xml"
  | "image/bmp"
  | "image/x-icon";

/** Loaded image ready for injection into an LLM prompt. */
export interface ImageContext {
  /** Original source path or URL. */
  source: string;
  /** MIME type. */
  mimeType: ImageMimeType;
  /** Base64-encoded content. */
  base64: string;
  /** Data URI: `data:<mime>;base64,<base64>`. */
  dataUri: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** Image width in pixels (null for SVG). */
  width: number | null;
  /** Image height in pixels (null for SVG). */
  height: number | null;
  /** Optional user-provided caption or alt text. */
  caption?: string;
}

/** Options for loading an image. */
export interface LoadImageOptions {
  /** Optional caption / alt text to attach. */
  caption?: string;
  /** Maximum file size allowed in bytes. Default: 10 MB. */
  maxBytes?: number;
}

// ============================================================================
// ImageContextLoader
// ============================================================================

const EXT_MIME: Record<string, ImageMimeType> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".bmp":  "image/bmp",
  ".ico":  "image/x-icon",
};

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Loads images from disk or URLs and packages them for LLM context injection.
 *
 * Usage:
 *   const loader = new ImageContextLoader();
 *   const ctx = await loader.loadFile("screenshots/ui.png", { caption: "Current UI" });
 *   // Inject into prompt: [{ type: "image_url", image_url: { url: ctx.dataUri } }]
 */
export class ImageContextLoader {
  private cache: Map<string, ImageContext> = new Map();
  private defaultMaxBytes: number;

  constructor(defaultMaxBytes = DEFAULT_MAX_BYTES) {
    this.defaultMaxBytes = defaultMaxBytes;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Load an image from a local file path.
   */
  async loadFile(filePath: string, options: LoadImageOptions = {}): Promise<ImageContext> {
    const abs = path.resolve(filePath);
    const maxBytes = options.maxBytes ?? this.defaultMaxBytes;

    const stat = fs.statSync(abs);
    if (stat.size > maxBytes) {
      throw new Error(
        `Image too large: ${stat.size} bytes (max ${maxBytes}). File: ${filePath}`
      );
    }

    const ext = path.extname(abs).toLowerCase();
    const mimeType = EXT_MIME[ext];
    if (!mimeType) {
      throw new Error(`Unsupported image format: ${ext}`);
    }

    const buffer = fs.readFileSync(abs);
    return this._buildContext(abs, buffer, mimeType, stat.size, options.caption);
  }

  /**
   * Load an image from an http/https URL.
   * Private/internal addresses are blocked (SSRF protection).
   */
  async loadUrl(url: string, options: LoadImageOptions = {}): Promise<ImageContext> {
    const maxBytes = options.maxBytes ?? this.defaultMaxBytes;

    // Validate URL (SSRF protection)
    if (!this._isAllowedUrl(url)) {
      throw new Error(`Blocked URL (private/internal): ${url}`);
    }

    // Check cache
    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      if (options.caption) return { ...cached, caption: options.caption };
      return cached;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { Accept: "image/*" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const mimeType = this._mimeFromContentType(contentType);
    if (!mimeType) {
      throw new Error(`Unsupported image content-type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `Image too large: ${buffer.byteLength} bytes (max ${maxBytes}). URL: ${url}`
      );
    }

    const ctx = this._buildContext(url, buffer, mimeType, buffer.byteLength, options.caption);
    this.cache.set(url, ctx);
    return ctx;
  }

  /**
   * Load from a base64 string or data URI directly.
   */
  loadBase64(
    base64OrDataUri: string,
    mimeType: ImageMimeType,
    options: LoadImageOptions = {}
  ): ImageContext {
    let base64 = base64OrDataUri;
    if (base64OrDataUri.startsWith("data:")) {
      const match = /^data:[^;]+;base64,(.+)$/.exec(base64OrDataUri);
      if (!match) throw new Error("Invalid data URI format");
      base64 = match[1];
    }

    const buffer = Buffer.from(base64, "base64");
    return this._buildContext("base64-input", buffer, mimeType, buffer.byteLength, options.caption);
  }

  /**
   * Load multiple images at once (from paths or URLs).
   * Invalid images are returned as Error entries rather than throwing.
   */
  async loadMany(
    sources: string[],
    options: LoadImageOptions = {}
  ): Promise<Array<ImageContext | Error>> {
    return Promise.all(
      sources.map(async (src) => {
        try {
          return src.startsWith("http://") || src.startsWith("https://")
            ? await this.loadUrl(src, options)
            : await this.loadFile(src, options);
        } catch (err) {
          return err instanceof Error ? err : new Error(String(err));
        }
      })
    );
  }

  /**
   * Clear the URL cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Format image contexts for injection into an OpenAI-compatible multi-modal
   * message array.
   *
   * @example
   *   const images = await loader.loadMany(["shot.png"]);
   *   const content = loader.toOpenAIContent(images.filter(c => !(c instanceof Error)) as ImageContext[]);
   *   // content: [{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }]
   */
  toOpenAIContent(
    contexts: ImageContext[]
  ): Array<{ type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }> {
    return contexts.map((ctx) => ({
      type: "image_url",
      image_url: { url: ctx.dataUri, detail: "auto" },
    }));
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _buildContext(
    source: string,
    buffer: Buffer,
    mimeType: ImageMimeType,
    sizeBytes: number,
    caption?: string
  ): ImageContext {
    const base64 = buffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;
    const { width, height } = this._extractDimensions(buffer, mimeType);

    return { source, mimeType, base64, dataUri, sizeBytes, width, height, caption };
  }

  private _extractDimensions(
    buffer: Buffer,
    mimeType: ImageMimeType
  ): { width: number | null; height: number | null } {
    try {
      if (mimeType === "image/png") {
        // PNG: width at bytes 16-19, height at 20-23 (big-endian)
        if (buffer.length >= 24) {
          return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20),
          };
        }
      } else if (mimeType === "image/jpeg" || mimeType === "image/jpg" as ImageMimeType) {
        // JPEG: scan for SOF markers
        const dim = this._jpegDimensions(buffer);
        if (dim) return dim;
      } else if (mimeType === "image/gif") {
        // GIF: width at bytes 6-7, height at 8-9 (little-endian)
        if (buffer.length >= 10) {
          return {
            width: buffer.readUInt16LE(6),
            height: buffer.readUInt16LE(8),
          };
        }
      } else if (mimeType === "image/bmp") {
        // BMP: width at bytes 18-21, height at 22-25 (little-endian)
        if (buffer.length >= 26) {
          return {
            width: buffer.readInt32LE(18),
            height: Math.abs(buffer.readInt32LE(22)),
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return { width: null, height: null };
  }

  private _jpegDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    let i = 2; // Skip SOI marker
    while (i < buffer.length - 1) {
      if (buffer[i] !== 0xff) break;
      const marker = buffer[i + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        // SOF0/SOF1/SOF2/SOF3
        if (i + 8 < buffer.length) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
      const segLen = buffer.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
    return null;
  }

  private _mimeFromContentType(contentType: string): ImageMimeType | null {
    const type = contentType.split(";")[0].trim().toLowerCase();
    const map: Record<string, ImageMimeType> = {
      "image/png":      "image/png",
      "image/jpeg":     "image/jpeg",
      "image/jpg":      "image/jpeg",
      "image/gif":      "image/gif",
      "image/webp":     "image/webp",
      "image/svg+xml":  "image/svg+xml",
      "image/bmp":      "image/bmp",
      "image/x-icon":   "image/x-icon",
    };
    return map[type] ?? null;
  }

  private _isAllowedUrl(urlStr: string): boolean {
    let parsed: URL;
    try { parsed = new URL(urlStr); } catch { return false; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const h = parsed.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return false;
    const priv = [
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^169\.254\.\d+\.\d+$/,
    ];
    return !priv.some((re) => re.test(h));
  }
}
