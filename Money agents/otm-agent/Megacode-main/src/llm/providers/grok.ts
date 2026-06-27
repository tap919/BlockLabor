/**
 * Grok API Provider for OverCoat.
 * 
 * Supports Grok models via xAI API (OpenAI-compatible).
 * Includes support for:
 * - Grok (creative tasks, UI)
 * - Grok Imagine Image Pro (image generation)
 * - Grok Imagine Video (video generation)
 * - Grok 4 Fast Reasoning (2M context window)
 */

import { OpenAICompatibleProvider } from "./openai";
import { LLMProviderConfig } from "../provider";

export class GrokProvider extends OpenAICompatibleProvider {
  constructor(config: LLMProviderConfig) {
    // Set default base URL for Grok if not provided
    const grokConfig = {
      ...config,
      baseUrl: config.baseUrl || "https://api.x.ai/v1",
    };
    super(grokConfig);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.config.apiKey) return this.config.models;
    
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) return this.config.models;
      
      const data = (await response.json()) as {
        data?: Array<{ id: string }>;
      };
      
      const availableModels = data.data?.map((m) => m.id) || [];
      
      // Filter to only Grok models and return configured ones as fallback
      const grokModels = availableModels.filter(model => 
        model.toLowerCase().includes('grok') || 
        model.toLowerCase().includes('imagine')
      );
      
      return grokModels.length > 0 ? grokModels : this.config.models;
    } catch {
      return this.config.models;
    }
  }

  /** Check if this provider supports image generation */
  supportsImageGeneration(): boolean {
    return this.config.models.some(model => 
      model.toLowerCase().includes('imagine') && 
      model.toLowerCase().includes('image')
    );
  }

  /** Check if this provider supports video generation */
  supportsVideoGeneration(): boolean {
    return this.config.models.some(model => 
      model.toLowerCase().includes('imagine') && 
      model.toLowerCase().includes('video')
    );
  }

  /** Check if this provider supports fast reasoning (2M context) */
  supportsFastReasoning(): boolean {
    return this.config.models.some(model => 
      model.toLowerCase().includes('fast') || 
      model.toLowerCase().includes('reasoning') ||
      model.toLowerCase().includes('2m')
    );
  }

  /** Generate an image (if supported) */
  async generateImage(
    prompt: string,
    options?: {
      size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
      quality?: "standard" | "hd";
      style?: "vivid" | "natural";
      n?: number;
    }
  ): Promise<Array<{ url: string; revised_prompt?: string }>> {
    if (!this.supportsImageGeneration()) {
      throw new Error("Image generation not supported by this Grok model");
    }

    if (!this.config.apiKey) {
      throw new Error("API key not configured");
    }

    const response = await fetch(`${this.config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.models.find(m => m.includes('imagine-image')) || "grok-imagine-image-pro",
        prompt,
        n: options?.n || 1,
        size: options?.size || "1024x1024",
        quality: options?.quality || "standard",
        style: options?.style || "vivid",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ url: string; revised_prompt?: string }>;
    };

    return data.data;
  }

  /** Generate a video (if supported) */
  async generateVideo(
    prompt: string,
    options?: {
      duration?: number; // seconds
      fps?: number;
      size?: "256x256" | "512x512" | "768x768" | "1024x1024";
    }
  ): Promise<{ url: string; id: string; status: string }> {
    if (!this.supportsVideoGeneration()) {
      throw new Error("Video generation not supported by this Grok model");
    }

    if (!this.config.apiKey) {
      throw new Error("API key not configured");
    }

    const response = await fetch(`${this.config.baseUrl}/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.models.find(m => m.includes('imagine-video')) || "grok-imagine-video",
        prompt,
        duration: options?.duration || 5,
        fps: options?.fps || 30,
        size: options?.size || "1024x1024",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Video generation failed: ${errorText}`);
    }

    const data = (await response.json()) as {
      data: { url: string; id: string; status: string };
    };

    return data.data;
  }

  /** Check video generation status */
  async checkVideoStatus(videoId: string): Promise<{ status: string; url?: string }> {
    if (!this.config.apiKey) {
      throw new Error("API key not configured");
    }

    const response = await fetch(`${this.config.baseUrl}/videos/${videoId}`, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Video status check failed: ${errorText}`);
    }

    return response.json();
  }
}