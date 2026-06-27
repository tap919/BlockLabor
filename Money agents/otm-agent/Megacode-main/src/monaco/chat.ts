/**
 * Megacode IDE Chat Integration
 * 
 * DeepSeek-powered chat interface for Monaco-based IDEs.
 * This module provides a drop-in chat integration that connects
 * to DeepSeek by default for AI-powered coding assistance.
 * 
 * Usage in your IDE:
 *   import { MegacodeChat } from 'megacode/chat';
 *   
 *   const chat = new MegacodeChat({
 *     container: document.getElementById('chat-container'),
 *     onCodeInsert: (code) => editor.insert(code)
 *   });
 *   
 *   chat.send("Hello, help me write a function");
 */

import { EventEmitter } from "events";

/** Default configuration */
export interface ChatConfig {
  /** Container element for the chat UI */
  container: HTMLElement | string;
  /** DeepSeek API key (uses default if not provided) */
  apiKey?: string;
  /** Model to use (default: deepseek-coder) */
  model?: string;
  /** Base URL for API (default: DeepSeek API) */
  baseUrl?: string;
  /** Callback when user wants to insert code into editor */
  onCodeInsert?: (code: string, language?: string) => void;
  /** Callback when user wants to open a file */
  onFileOpen?: (path: string) => void;
  /** Callback when user wants to execute a command */
  onCommandExecute?: (command: string) => void;
  /** Custom system prompt */
  systemPrompt?: string;
  /** Show streaming response */
  streaming?: boolean;
}

/** Message in the chat */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  codeBlocks?: Array<{ language: string; code: string }>;
}

/** Chat message sent to API */
export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/** Response from API */
export interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Stream chunk from API */
export interface StreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason?: string;
  }>;
}

/** Default system prompt */
const DEFAULT_SYSTEM_PROMPT = `You are Megacode, an AI coding assistant integrated into this IDE. 

You help users by:
- Writing, debugging, and explaining code
- Refactoring and improving code quality
- Answering programming questions
- Searching documentation when needed

When providing code:
- Use appropriate syntax highlighting
- Explain what the code does
- Keep responses focused and practical

You have access to the IDE's editor. When users select code, you can see it in context.`;

let messageIdCounter = 0;

/**
 * MegacodeChat - Drop-in chat interface for IDEs
 */
export class MegacodeChat extends EventEmitter {
  private config: Required<ChatConfig>;
  private messages: ChatMessage[] = [];
  private container: HTMLElement;
  private messageElements: Map<string, HTMLElement> = new Map();
  private isStreaming: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: ChatConfig) {
    super();
    
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error(
        "MegacodeChat requires an explicit apiKey (do not hard-code keys in the library).",
      );
    }

    this.config = {
      container: typeof config.container === "string" 
        ? document.querySelector(config.container) as HTMLElement
        : config.container,
      apiKey: config.apiKey.trim(),
      model: config.model ?? "deepseek-coder",
      baseUrl: config.baseUrl ?? "https://api.deepseek.com",
      onCodeInsert: config.onCodeInsert ?? (() => {}),
      onFileOpen: config.onFileOpen ?? (() => {}),
      onCommandExecute: config.onCommandExecute ?? (() => {}),
      systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      streaming: config.streaming ?? true,
    };

    if (!this.config.container) {
      throw new Error("Chat container not found");
    }

    this.init();
  }

  private init(): void {
    // Add system message
    this.messages.push({
      id: this.generateId(),
      role: "system",
      content: this.config.systemPrompt,
      timestamp: Date.now(),
    });

    // Render initial UI
    this.render();
  }

  private generateId(): string {
    return `msg_${++messageIdCounter}_${Date.now()}`;
  }

  /**
   * Send a message to the chat
   */
  async send(content: string): Promise<void> {
    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this.messages.push(userMessage);
    this.appendMessage(userMessage);

    // Show typing indicator
    this.showTyping();

    // Get response
    try {
      await this.getCompletion(content);
    } catch (error) {
      this.hideTyping();
      this.appendMessage({
        id: this.generateId(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get completion from DeepSeek API
   */
  private async getCompletion(userMessage: string): Promise<void> {
    const messagesForAPI = this.messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role, content: m.content }));

    const request: ChatRequest = {
      model: this.config.model,
      messages: messagesForAPI,
      stream: this.config.streaming,
      temperature: 0.7,
      max_tokens: 4096,
    };

    this.abortController = new AbortController();

    try {
      if (this.config.streaming) {
        await this.streamCompletion(request);
      } else {
        await this.nonStreamingCompletion(request);
      }
    } finally {
      this.abortController = null;
      this.hideTyping();
    }
  }

  private async nonStreamingCompletion(request: ChatRequest): Promise<void> {
    request.stream = false;
    
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data: ChatResponse = await response.json();
    const content = data.choices[0]?.message?.content ?? "";

    this.appendMessage({
      id: this.generateId(),
      role: "assistant",
      content,
      timestamp: Date.now(),
      codeBlocks: this.extractCodeBlocks(content),
    });
  }

  private async streamCompletion(request: ChatRequest): Promise<void> {
    request.stream = true;

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(request),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    // Create assistant message element
    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    this.messages.push(assistantMessage);

    const messageEl = this.createMessageElement(assistantMessage);
    const contentEl = messageEl.querySelector(".content") as HTMLElement;
    this.messageElements.set(assistantMessage.id, messageEl);

    const messagesContainer = this.container.querySelector(".messages") as HTMLElement;
    messagesContainer.appendChild(messageEl);
    this.scrollToBottom();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk: StreamChunk = JSON.parse(data);
            const delta = chunk.choices[0]?.delta?.content;
            
            if (delta) {
              fullContent += delta;
              contentEl.innerHTML = this.formatContent(fullContent);
              this.scrollToBottom();
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Update message with final content and code blocks
    assistantMessage.content = fullContent;
    assistantMessage.codeBlocks = this.extractCodeBlocks(fullContent);
  }

  /**
   * Extract code blocks from markdown content
   */
  private extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const blocks: Array<{ language: string; code: string }> = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || "text",
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  /**
   * Format message content with markdown
   */
  private formatContent(content: string): string {
    let formatted = content;

    // Escape HTML
    formatted = formatted.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Code blocks
    formatted = formatted.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (_, lang, code) => {
        const language = lang || "text";
        return `<pre class="code-block" data-language="${language}"><code>${code.trim()}</code></pre>`;
      }
    );

    // Inline code
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="inline-code">$1</code>'
    );

    // Bold
    formatted = formatted.replace(
      /\*\*([^*]+)\*\*/g,
      "<strong>$1</strong>"
    );

    // Italic
    formatted = formatted.replace(
      /\*([^*]+)\*/g,
      "<em>$1</em>"
    );

    // Links
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank">$1</a>'
    );

    // Lists
    formatted = formatted.replace(
      /^[-*]\s+(.+)$/gm,
      "<li>$1</li>"
    );
    formatted = formatted.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

    // Paragraphs
    formatted = formatted.replace(/\n\n/g, "</p><p>");
    formatted = `<p>${formatted}</p>`;

    return formatted;
  }

  /**
   * Create message element
   */
  private createMessageElement(message: ChatMessage): HTMLElement {
    const div = document.createElement("div");
    div.className = `message message-${message.role}`;
    div.dataset.id = message.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = message.role === "user" ? "You" : "Megacode";

    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = this.formatContent(message.content);

    // Add action buttons for code blocks
    if (message.codeBlocks && message.codeBlocks.length > 0 && message.role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "actions";
      
      const insertBtn = document.createElement("button");
      insertBtn.className = "action-btn";
      insertBtn.textContent = "Insert Code";
      insertBtn.onclick = () => {
        const code = message.codeBlocks?.[0]?.code;
        if (code) {
          this.config.onCodeInsert(code, message.codeBlocks?.[0]?.language);
        }
      };
      
      const copyBtn = document.createElement("button");
      copyBtn.className = "action-btn";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        const code = message.codeBlocks?.[0]?.code;
        if (code) {
          navigator.clipboard.writeText(code);
          copyBtn.textContent = "Copied!";
          setTimeout(() => copyBtn.textContent = "Copy", 2000);
        }
      };

      actions.appendChild(insertBtn);
      actions.appendChild(copyBtn);
      content.appendChild(actions);
    }

    div.appendChild(avatar);
    div.appendChild(content);

    return div;
  }

  /**
   * Append a message to the chat
   */
  private appendMessage(message: ChatMessage): void {
    const messagesContainer = this.container.querySelector(".messages") as HTMLElement;
    if (!messagesContainer) return;

    const el = this.createMessageElement(message);
    messagesContainer.appendChild(el);
    this.messageElements.set(message.id, el);
    this.scrollToBottom();
  }

  /**
   * Show typing indicator
   */
  private showTyping(): void {
    const messagesContainer = this.container.querySelector(".messages") as HTMLElement;
    if (!messagesContainer) return;

    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.id = "typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    messagesContainer.appendChild(typing);
    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  private hideTyping(): void {
    const typing = this.container.querySelector("#typing");
    if (typing) typing.remove();
  }

  /**
   * Scroll to bottom of chat
   */
  private scrollToBottom(): void {
    const messagesContainer = this.container.querySelector(".messages") as HTMLElement;
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Render the chat UI
   */
  private render(): void {
    this.container.innerHTML = `
      <style>
        .megacode-chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #1e1e1e;
          color: #d4d4d4;
        }
        .megacode-chat .header {
          padding: 12px 16px;
          background: #252526;
          border-bottom: 1px solid #3c3c3c;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .megacode-chat .header .logo {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
        }
        .megacode-chat .header .title {
          font-weight: 600;
          font-size: 14px;
        }
        .megacode-chat .header .model {
          margin-left: auto;
          font-size: 11px;
          color: #858585;
          background: #3c3c3c;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .megacode-chat .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .megacode-chat .message {
          display: flex;
          gap: 12px;
          max-width: 100%;
        }
        .megacode-chat .message-user {
          flex-direction: row-reverse;
        }
        .megacode-chat .avatar {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .megacode-chat .message-user .avatar {
          background: #0e639c;
        }
        .megacode-chat .message-assistant .avatar {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }
        .megacode-chat .message-system .avatar {
          background: #3c3c3c;
          font-size: 8px;
        }
        .megacode-chat .content {
          flex: 1;
          line-height: 1.5;
          font-size: 13px;
        }
        .megacode-chat .content p {
          margin: 0 0 8px 0;
        }
        .megacode-chat .content p:last-child {
          margin-bottom: 0;
        }
        .megacode-chat .content pre {
          background: #2d2d2d;
          border-radius: 6px;
          padding: 12px;
          margin: 8px 0;
          overflow-x: auto;
        }
        .megacode-chat .content code {
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
        }
        .megacode-chat .content .inline-code {
          background: #3c3c3c;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
        .megacode-chat .content .actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
        }
        .megacode-chat .content .action-btn {
          background: #0e639c;
          border: none;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .megacode-chat .content .action-btn:hover {
          background: #1177bb;
        }
        .megacode-chat .input-area {
          padding: 12px 16px;
          background: #252526;
          border-top: 1px solid #3c3c3c;
        }
        .megacode-chat .input-wrapper {
          display: flex;
          gap: 8px;
          background: #3c3c3c;
          border-radius: 8px;
          padding: 8px 12px;
        }
        .megacode-chat .input-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          color: #d4d4d4;
          font-size: 13px;
          outline: none;
        }
        .megacode-chat .input-wrapper input::placeholder {
          color: #858585;
        }
        .megacode-chat .input-wrapper button {
          background: #6366f1;
          border: none;
          color: white;
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 500;
        }
        .megacode-chat .input-wrapper button:hover {
          background: #4f46e5;
        }
        .megacode-chat .input-wrapper button:disabled {
          background: #555;
          cursor: not-allowed;
        }
        .megacode-chat .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }
        .megacode-chat .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #6366f1;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }
        .megacode-chat .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .megacode-chat .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      </style>
      
      <div class="header">
        <div class="logo">M</div>
        <span class="title">Megacode</span>
        <span class="model">${this.config.model}</span>
      </div>
      
      <div class="messages"></div>
      
      <div class="input-area">
        <div class="input-wrapper">
          <input type="text" placeholder="Ask me anything..." />
          <button class="send-btn">Send</button>
        </div>
      </div>
    `;

    // Bind events
    const input = this.container.querySelector("input") as HTMLInputElement;
    const sendBtn = this.container.querySelector(".send-btn") as HTMLButtonElement;

    const handleSend = () => {
      const content = input.value.trim();
      if (!content || this.isStreaming) return;
      
      input.value = "";
      this.send(content);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn.addEventListener("click", handleSend);

    // Focus input
    input.focus();
  }

  /**
   * Clear chat history
   */
  clear(): void {
    this.messages = [{
      id: this.generateId(),
      role: "system",
      content: this.config.systemPrompt,
      timestamp: Date.now(),
    }];
    
    const messagesContainer = this.container.querySelector(".messages") as HTMLElement;
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }
  }

  /**
   * Abort current request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.hideTyping();
    }
  }

  /**
   * Get message history
   */
  getHistory(): ChatMessage[] {
    return [...this.messages];
  }
}

/**
 * Create a Megacode chat instance (convenience function)
 */
export function createChat(config: ChatConfig): MegacodeChat {
  return new MegacodeChat(config);
}

/**
 * Simple text-based chat (for non-browser environments)
 */
export class MegacodeTextChat {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private messages: Array<{ role: string; content: string }> = [];

  constructor(config: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  } = {}) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error("MegacodeTextChat requires an explicit apiKey.");
    }
    this.apiKey = config.apiKey.trim();
    this.model = config.model ?? "deepseek-coder";
    this.baseUrl = config.baseUrl ?? "https://api.deepseek.com";
  }

  async chat(message: string): Promise<string> {
    this.messages.push({ role: "user", content: message });

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    const reply = data.choices[0]?.message?.content ?? "";

    this.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  clear(): void {
    this.messages = [];
  }
}
