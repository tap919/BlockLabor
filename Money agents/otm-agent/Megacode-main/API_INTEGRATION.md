# MegaCode CLI API Integration

## Overview

MegaCode CLI now features intelligent task-based LLM routing that automatically selects the best AI model for each task type. The system integrates with multiple AI providers and uses your API keys from the `APIs` folder.

## Task-Based LLM Rotation

The system intelligently routes requests based on task type:

| Task Type | Primary Model | Use Case |
|-----------|---------------|----------|
| **Daily** | DeepSeek | General coding tasks, debugging, daily work |
| **Research** | Perplexity | Web research, information gathering, fact-checking |
| **Complex Logic** | Claude Opus 4.6 | Code review, architecture, complex algorithms |
| **Creative/UI** | Grok | UI design, creative writing, inventive solutions |
| **Templates** | Claude Sonnet 4.6 | Code templates, boilerplate, scaffolding |
| **Image** | Grok Imagine Image Pro | Image generation, visualization |
| **Video** | Grok Imagine Video | Video generation, animation |
| **Long Session** | Grok 4 Fast Reasoning (2M context) | Long coding sessions, comprehensive projects |
| **The Block** | DeepSeek | Blockchain, crypto, smart contracts |

## API Key Setup

### 1. API Keys Folder
Place your API key files in the `APIs` folder:

```
APIs/
├── api keys.txt          # OpenAI key (sk-proj-...)
├── Claude api .docx      # Anthropic/Claude key
├── Grok API.docx         # xAI/Grok key  
├── Perplexity Gemini.docx # Perplexity key
├── mistral.txt           # Mistral key
├── OLLAMA API.txt        # Ollama key
└── ... other API files
```

### 2. Environment Variables (Alternative)
You can also set API keys via environment variables:

```bash
# Standard environment variables
export DEEPSEEK_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
export XAI_API_KEY=your_key
export PERPLEXITY_API_KEY=your_key
export OPENAI_API_KEY=your_key
export MISTRAL_API_KEY=your_key
export OLLAMA_API_KEY=your_key
export GEMINI_API_KEY=your_key

# Or with MEGACODE_ prefix
export MEGACODE_DEEPSEEK_API_KEY=your_key
export MEGACODE_ANTHROPIC_API_KEY=your_key
# ... etc
```

## Usage Examples

### Basic Setup
```javascript
const { ConfigFactory } = require('megacode');

// Create configuration with your API keys
const factory = new ConfigFactory({
  debug: true, // Enable debug logging
  apisFolder: './APIs', // Custom APIs folder path
});

// Create task router
const taskRouter = factory.createTaskRouter();

// Check available providers
const providers = factory.getAvailableProviders();
console.log(`Available providers: ${providers.join(', ')}`);
```

### Making Requests
```javascript
// The router automatically detects task type
const response = await taskRouter.complete({
  messages: [
    { role: "system", content: "You are a helpful coding assistant." },
    { role: "user", content: "Research the latest React 19 features" }
  ]
});

console.log(`Task type: ${response.provider}`);
console.log(`Response: ${response.content}`);
```

### Manual Task Type Selection
```javascript
// You can manually specify task type
const response = await taskRouter.complete(
  {
    messages: [{ role: "user", content: "Design a login form UI" }]
  },
  "creative" // Force creative task type (uses Grok)
);
```

### Image Generation (Grok)
```javascript
const { GrokProvider } = require('megacode');

const grok = new GrokProvider({
  name: "grok-imagine",
  baseUrl: "https://api.x.ai/v1",
  apiKey: "your_grok_key",
  models: ["grok-imagine-image-pro"],
});

const images = await grok.generateImage(
  "A futuristic city at night with neon lights",
  {
    size: "1024x1024",
    quality: "hd",
    style: "vivid",
    n: 1
  }
);

console.log(`Generated image: ${images[0].url}`);
```

### Web Research (Perplexity)
```javascript
const { PerplexityProvider } = require('megacode');

const perplexity = new PerplexityProvider({
  name: "perplexity",
  baseUrl: "https://api.perplexity.ai",
  apiKey: "your_perplexity_key",
  models: ["sonar"],
});

// Web search
const searchResults = await perplexity.webSearch(
  "latest developments in quantum computing 2024",
  {
    maxResults: 5,
    freshness: "month"
  }
);

// Research summary with citations
const research = await perplexity.researchSummary(
  "quantum computing applications",
  {
    depth: "detailed",
    includeCitations: true,
    maxLength: 1000
  }
);
```

## Configuration Options

### Custom Task Mapping
```javascript
const factory = new ConfigFactory({
  taskMapping: {
    daily: ["deepseek", "openai"], // Use DeepSeek first, OpenAI as fallback
    research: ["perplexity", "claude-sonnet"], // Perplexity for research
    complex_logic: ["claude-opus", "grok"], // Claude for complex logic
    creative: ["grok", "claude-sonnet"], // Grok for creative tasks
    // ... other task types
  }
});
```

### Provider-Specific Configuration
```javascript
const factory = new ConfigFactory({
  providers: {
    deepseek: {
      timeoutMs: 90000, // Longer timeout for DeepSeek
      defaultModel: "deepseek-coder", // Use coder model for coding
    },
    claude: {
      timeoutMs: 120000, // Claude can be slower
      models: ["claude-3-opus-20240229", "claude-3-5-sonnet-20241022"],
    },
    grok: {
      timeoutMs: 180000, // Longer for image/video generation
    },
  }
});
```

## CLI Integration

The MegaCode CLI automatically uses the task-based routing system. When you run commands, it will:

1. **Detect task type** from your request content
2. **Select appropriate provider** based on task mapping
3. **Route request** to the best available model
4. **Provide fallback** if primary provider fails

### CLI Examples
```bash
# Research task (uses Perplexity)
megacode research "latest React features"

# Code review (uses Claude Opus)
megacode review "path/to/code.js"

# Creative design (uses Grok)
megacode design "weather app UI"

# Image generation (uses Grok Imagine)
megacode image "futuristic cityscape"

# General coding (uses DeepSeek)
megacode code "fix this bug"
```

## Health Checking

```javascript
// Check provider health
const health = await taskRouter.healthCheck();
for (const [provider, isHealthy] of Object.entries(health)) {
  console.log(`${provider}: ${isHealthy ? '✅' : '❌'}`);
}

// Get API key status
const keyStatus = factory.getAPIKeyStatus();
for (const [provider, status] of Object.entries(keyStatus)) {
  console.log(`${provider}: ${status.available ? 'Available' : 'Missing'}`);
}
```

## Troubleshooting

### No Providers Available
If no providers are available:
1. Check that API keys are in the `APIs` folder
2. Verify file names match expected patterns
3. Check environment variables are set correctly
4. Run with `debug: true` to see loading process

### Provider Connection Issues
1. Check internet connectivity
2. Verify API keys are valid and not expired
3. Check provider status pages (some may be down)
4. Increase timeout settings for slow providers

### Task Detection Issues
If tasks aren't being routed correctly:
1. Check the task mapping configuration
2. Review keyword detection in task detection
3. Manually specify task type when needed
4. Customize task mapping for your use case

## Advanced Features

### Custom Providers
```javascript
const { TaskRouter } = require('megacode');

const router = new TaskRouter({
  taskMapping: {
    daily: ["my-custom-provider"],
    // ... other mappings
  },
  providers: {
    "my-custom-provider": {
      name: "my-custom-provider",
      baseUrl: "https://custom-api.example.com/v1",
      apiKey: "custom_key",
      models: ["custom-model"],
      enabled: true,
    },
  },
});
```

### Streaming Responses
```javascript
const stream = await taskRouter.streamComplete({
  messages: [{ role: "user", content: "Explain quantum computing" }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
  if (chunk.done) break;
}
```

## File Structure

```
src/llm/
├── task-router.ts          # Task-based routing logic
├── config-factory.ts       # Configuration factory
├── api-key-loader.ts       # API key loading
├── providers/
│   ├── claude.ts          # Claude API provider
│   ├── grok.ts           # Grok API provider
│   ├── perplexity.ts     # Perplexity API provider
│   ├── deepseek.ts       # DeepSeek provider
│   ├── openai.ts         # OpenAI provider
│   └── ... others
└── router.ts             # Base LLM router
```

## Support

For issues or questions:
1. Check the `test-integration.js` file for examples
2. Review API key setup in the `APIs` folder
3. Enable debug mode to see detailed logs
4. Check provider documentation for API changes