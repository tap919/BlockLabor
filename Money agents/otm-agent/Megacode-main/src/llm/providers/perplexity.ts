/**
 * Perplexity API Provider for OverCoat.
 * 
 * Supports Perplexity models for research tasks with web search capabilities.
 */

import { OpenAICompatibleProvider } from "./openai";
import { LLMProviderConfig, LLMCompletionRequest, LLMCompletionResponse } from "../provider";

export class PerplexityProvider extends OpenAICompatibleProvider {
  constructor(config: LLMProviderConfig) {
    // Set default base URL for Perplexity if not provided
    const perplexityConfig = {
      ...config,
      baseUrl: config.baseUrl || "https://api.perplexity.ai",
    };
    super(perplexityConfig);
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
      
      // Filter to only Perplexity models and return configured ones as fallback
      const perplexityModels = availableModels.filter(model => 
        model.toLowerCase().includes('perplexity') || 
        model.toLowerCase().includes('sonar') ||
        model.toLowerCase().includes('research')
      );
      
      return perplexityModels.length > 0 ? perplexityModels : this.config.models;
    } catch {
      return this.config.models;
    }
  }

  /** Enhanced complete method with web search context for research tasks */
  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    // Check if this is a research task
    const isResearchTask = this.isResearchTask(request);
    
    if (isResearchTask) {
      console.log(`[Perplexity] Research task detected, enabling web search`);
      
      // For research tasks, we can use Perplexity's search capabilities
      // by adding search parameters to the request
      const enhancedRequest = {
        ...request,
        // Perplexity-specific parameters for web search
        searchOptions: {
          enable_web_search: true,
          search_domain_filter: "all",
          freshness: "month",
        },
      };
      
      return super.complete(enhancedRequest);
    }
    
    // For non-research tasks, use standard completion
    return super.complete(request);
  }

  /** Check if a request is a research task */
  private isResearchTask(request: LLMCompletionRequest): boolean {
    const content = request.messages
      .map(m => m.content.toLowerCase())
      .join(" ");
    
    const researchKeywords = [
      "research", "study", "investigate", "explore", "analyze",
      "what is", "how does", "explain", "tell me about", "find information",
      "look up", "search for", "background", "context", "latest",
      "current", "recent", "news", "update", "trend", "statistics",
      "data", "facts", "information about", "who is", "when did",
      "where is", "why does", "compare", "difference between",
      "advantages of", "disadvantages of", "pros and cons",
    ];
    
    return researchKeywords.some(keyword => content.includes(keyword));
  }

  /** Perform a web search and return results */
  async webSearch(
    query: string,
    options?: {
      maxResults?: number;
      freshness?: "day" | "week" | "month" | "year";
      domainFilter?: string;
    }
  ): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    date?: string;
    relevance: number;
  }>> {
    if (!this.config.apiKey) {
      throw new Error("API key not configured");
    }

    // Use Perplexity's chat completion with web search enabled
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.defaultModel || "sonar",
        messages: [
          {
            role: "user",
            content: `Perform a web search for: ${query}\n\nReturn search results in JSON format with title, url, snippet, and relevance score.`,
          },
        ],
        search_options: {
          enable_web_search: true,
          search_domain_filter: options?.domainFilter || "all",
          freshness: options?.freshness || "month",
          max_results: options?.maxResults || 10,
        },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Web search failed: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       [null, content];
      
      const jsonContent = jsonMatch[1] || content;
      const results = JSON.parse(jsonContent);
      
      if (Array.isArray(results)) {
        return results;
      } else if (results.results && Array.isArray(results.results)) {
        return results.results;
      } else if (results.search_results && Array.isArray(results.search_results)) {
        return results.search_results;
      }
      
      throw new Error("Unexpected response format");
    } catch {
      // If JSON parsing fails, extract information from text
      const lines = content.split('\n').filter(line => line.trim());
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        relevance: number;
      }> = [];
      
      let currentResult: Partial<{
        title: string;
        url: string;
        snippet: string;
      }> = {};
      
      for (const line of lines) {
        if (line.match(/^\d+\./)) {
          // New result
          if (currentResult.title || currentResult.url) {
            results.push({
              title: currentResult.title || "",
              url: currentResult.url || "",
              snippet: currentResult.snippet || "",
              relevance: 0.5,
            });
          }
          currentResult = { title: line.replace(/^\d+\.\s*/, "") };
        } else if (line.includes('http')) {
          currentResult.url = line.trim();
        } else if (line.trim()) {
          currentResult.snippet = (currentResult.snippet || "") + line.trim() + " ";
        }
      }
      
      // Add last result
      if (currentResult.title || currentResult.url) {
        results.push({
          title: currentResult.title || "",
          url: currentResult.url || "",
          snippet: currentResult.snippet || "",
          relevance: 0.5,
        });
      }
      
      return results;
    }
  }

  /** Get research summary with citations */
  async researchSummary(
    topic: string,
    options?: {
      depth?: "brief" | "detailed" | "comprehensive";
      includeCitations?: boolean;
      maxLength?: number;
    }
  ): Promise<{
    summary: string;
    citations?: Array<{ title: string; url: string; snippet: string }>;
    keyPoints: string[];
    lastUpdated?: string;
  }> {
    const prompt = `Provide a ${options?.depth || "detailed"} research summary about "${topic}". 
    ${options?.includeCitations ? "Include citations with URLs." : ""}
    Structure the response with:
    1. Comprehensive summary
    2. Key points (bullet points)
    3. ${options?.includeCitations ? "Citations with sources" : ""}
    4. Last updated information if available`;
    
    const response = await this.complete({
      messages: [{ role: "user", content: prompt }],
      model: this.config.defaultModel || "sonar-pro",
      maxTokens: options?.maxLength || 2000,
      temperature: 0.3,
    });
    
    // Parse the response to extract structured information
    const content = response.content;
    
    // Extract citations if present
    const citations: Array<{ title: string; url: string; snippet: string }> = [];
    if (options?.includeCitations) {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = content.match(urlRegex) || [];
      
      for (const url of urls) {
        // Find context around the URL
        const urlIndex = content.indexOf(url);
        const contextStart = Math.max(0, urlIndex - 100);
        const contextEnd = Math.min(content.length, urlIndex + url.length + 100);
        const context = content.substring(contextStart, contextEnd);
        
        // Extract title from context (first line before URL)
        const lines = context.split('\n');
        const title = lines.find(line => line.trim() && !line.includes('http'))?.trim() || "Source";
        
        citations.push({
          title,
          url,
          snippet: context.replace(title, '').replace(url, '').trim().substring(0, 200) + '...',
        });
      }
    }
    
    // Extract key points (lines starting with bullet points or numbers)
    const keyPoints: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[•\-*]\s/) || trimmed.match(/^\d+\.\s/)) {
        keyPoints.push(trimmed.replace(/^[•\-*\d\.]\s*/, ''));
      }
    }
    
    // Extract summary (first substantial paragraph)
    let summary = "";
    const paragraphs = content.split('\n\n');
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length > 100 && !paragraph.includes('http')) {
        summary = paragraph.trim();
        break;
      }
    }
    
    // Extract last updated info
    let lastUpdated: string | undefined;
    const dateRegex = /(last updated|updated|as of|current as of)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i;
    const dateMatch = content.match(dateRegex);
    if (dateMatch) {
      lastUpdated = dateMatch[2];
    }
    
    return {
      summary: summary || content.substring(0, 500) + '...',
      citations: options?.includeCitations ? citations : undefined,
      keyPoints: keyPoints.length > 0 ? keyPoints : ["No key points extracted"],
      lastUpdated,
    };
  }
}