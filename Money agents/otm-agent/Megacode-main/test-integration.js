/**
 * Test script for MegaCode CLI API integration
 * 
 * Tests the task-based LLM routing system with all providers.
 */

const { ConfigFactory } = require('./dist/index.js');

async function testIntegration() {
  console.log('='.repeat(60));
  console.log('MegaCode CLI API Integration Test');
  console.log('='.repeat(60));
  
  try {
    // Create configuration factory
    const configFactory = new ConfigFactory({
      debug: true,
    });
    
    // Show API key status
    console.log('\n📋 API Key Status:');
    console.log('-'.repeat(40));
    const keyStatus = configFactory.getAPIKeyStatus();
    for (const [provider, status] of Object.entries(keyStatus)) {
      console.log(`  ${provider}: ${status.available ? '✅ Available' : '❌ Missing'} (${status.keyPreview})`);
    }
    
    // Show available providers
    console.log('\n🚀 Available Providers:');
    console.log('-'.repeat(40));
    const providers = configFactory.getAvailableProviders();
    if (providers.length > 0) {
      providers.forEach(provider => console.log(`  • ${provider}`));
    } else {
      console.log('  No providers available. Check API keys.');
    }
    
    // Show task mapping
    console.log('\n🎯 Task Mapping:');
    console.log('-'.repeat(40));
    const routerConfig = configFactory.getTaskRouterConfig();
    for (const [taskType, providerNames] of Object.entries(routerConfig.taskMapping)) {
      console.log(`  ${taskType}: ${providerNames.join(', ')}`);
    }
    
    // Create task router
    console.log('\n🔧 Creating Task Router...');
    const taskRouter = configFactory.createTaskRouter();
    
    // Test health check
    console.log('\n🏥 Health Check:');
    console.log('-'.repeat(40));
    try {
      const health = await taskRouter.healthCheck();
      for (const [provider, isHealthy] of Object.entries(health)) {
        console.log(`  ${provider}: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      }
    } catch (error) {
      console.log(`  Health check failed: ${error.message}`);
    }
    
    // Test task detection
    console.log('\n🔍 Task Detection Examples:');
    console.log('-'.repeat(40));
    
    const testCases = [
      {
        prompt: "Research the latest developments in quantum computing",
        expected: "research",
      },
      {
        prompt: "Review this code for security vulnerabilities and optimize it",
        expected: "complex_logic",
      },
      {
        prompt: "Design a beautiful user interface for a weather app",
        expected: "creative",
      },
      {
        prompt: "Create a template for a React component with TypeScript",
        expected: "templates",
      },
      {
        prompt: "Generate an image of a futuristic city at night",
        expected: "image",
      },
      {
        prompt: "Create a short video animation of a bouncing ball",
        expected: "video",
      },
      {
        prompt: "Write a comprehensive guide to blockchain technology",
        expected: "long_session",
      },
      {
        prompt: "Explain how smart contracts work on Ethereum",
        expected: "the_block",
      },
      {
        prompt: "Help me debug this Python function",
        expected: "daily",
      },
    ];
    
    for (const testCase of testCases) {
      const request = {
        messages: [{ role: "user", content: testCase.prompt }],
      };
      
      const detectedTask = taskRouter.detectTaskType(request);
      const icon = detectedTask === testCase.expected ? '✅' : '❌';
      console.log(`  ${icon} "${testCase.prompt.substring(0, 40)}..."`);
      console.log(`     Detected: ${detectedTask}, Expected: ${testCase.expected}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Integration Test Complete');
    console.log('='.repeat(60));
    
    if (providers.length === 0) {
      console.log('\n⚠️  Warning: No providers available.');
      console.log('   Please add API keys to the APIs folder or environment variables.');
      console.log('   Expected files in APIs folder:');
      console.log('     • api keys.txt (OpenAI key)');
      console.log('     • Claude api .docx (Claude key)');
      console.log('     • Grok API.docx (Grok key)');
      console.log('     • Perplexity Gemini.docx (Perplexity key)');
      console.log('     • mistral.txt (Mistral key)');
      console.log('     • OLLAMA API.txt (Ollama key)');
    } else {
      console.log(`\n🎉 Ready to use ${providers.length} LLM providers with task-based routing!`);
      console.log('\nUsage example:');
      console.log('  const { ConfigFactory } = require("./dist/index.js");');
      console.log('  const factory = new ConfigFactory({ debug: true });');
      console.log('  const router = factory.createTaskRouter();');
      console.log('  const response = await router.complete({ messages: [...] });');
    }
    
  } catch (error) {
    console.error('\n❌ Integration Test Failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testIntegration().catch(console.error);
}

module.exports = { testIntegration };