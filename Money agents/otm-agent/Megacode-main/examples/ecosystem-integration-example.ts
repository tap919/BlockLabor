/**
 * Example: Ecosystem Integration with OverCoat
 * 
 * This example demonstrates how to integrate various tools from the ecosystem
 * with OverCoat using the integration interfaces.
 */

import { IntegrationManager } from "../src/integrations/tool-integrations";
import { AutheliaIntegration } from "../src/integrations/tool-integrations";
import { MemUIntegration } from "../src/integrations/tool-integrations";
import { OpenMeterIntegration } from "../src/integrations/tool-integrations";
import { VoiceboxIntegration } from "../src/integrations/tool-integrations";
import { ZVecIntegration } from "../src/integrations/tool-integrations";
import { YumcutIntegration } from "../src/integrations/tool-integrations";
import { ShannonIntegration } from "../src/integrations/tool-integrations";

async function runEcosystemExample() {
  console.log("=== OverCoat Ecosystem Integration Example ===\n");

  // Create integration manager
  const integrationManager = new IntegrationManager();
  
  console.log("1. Registering tool integrations...");

  // Register Authelia for authentication/authorization
  const authelia = new AutheliaIntegration({
    serverUrl: "http://localhost:9091",
  });
  integrationManager.register(authelia);

  // Register memU for AI agent memory management
  const memU = new MemUIntegration({
    serverUrl: "http://localhost:8080",
  });
  integrationManager.register(memU);

  // Register OpenMeter for billing and metering
  const openMeter = new OpenMeterIntegration({
    serverUrl: "http://localhost:8888",
  });
  integrationManager.register(openMeter);

  // Register Voicebox for voice synthesis
  const voicebox = new VoiceboxIntegration({
    serverUrl: "http://localhost:8000",
  });
  integrationManager.register(voicebox);

  // Register ZVec for vector embeddings
  const zvec = new ZVecIntegration({
    serverUrl: "http://localhost:8001",
  });
  integrationManager.register(zvec);

  // Register Yumcut for image generation
  const yumcut = new YumcutIntegration({
    serverUrl: "http://localhost:8002",
  });
  integrationManager.register(yumcut);

  // Register Shannon for vector DB/search
  const shannon = new ShannonIntegration({
    serverUrl: "http://localhost:8003",
  });
  integrationManager.register(shannon);

  console.log(`Registered ${integrationManager.list().length} integrations:`);
  integrationManager.list().forEach(integration => {
    console.log(`  - ${integration.name} (${integration.id})`);
  });

  console.log("\n2. Performing health checks...");

  try {
    const healthResults = await integrationManager.healthCheckAll();
    
    for (const [integrationId, result] of Object.entries(healthResults)) {
      const status = result.healthy ? "✅ Healthy" : "❌ Unhealthy";
      console.log(`  ${integrationId}: ${status}`);
      if (result.message) {
        console.log(`    Message: ${result.message}`);
      }
    }

    console.log("\n3. Initializing enabled integrations...");
    
    await integrationManager.initializeAll();
    console.log("   All integrations initialized successfully!");

    console.log("\n4. Example: Using Authelia for authentication");
    
    // Example authentication (commented out as it requires actual Authelia server)
    /*
    try {
      const user = await authelia.authenticate("admin", "password123");
      console.log(`   Authenticated user: ${user.username}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Groups: ${user.groups.join(", ")}`);
    } catch (error) {
      console.log(`   Authentication example failed: ${error.message}`);
      console.log("   (This is expected if Authelia server is not running)");
    }
    */

    console.log("\n5. Example: Using memU for memory management");
    
    // Example memory storage (commented out as it requires actual memU server)
    /*
    try {
      const memory = await memU.storeMemory({
        userId: "user-123",
        content: "User prefers dark mode and uses React for frontend",
        tags: ["preferences", "frontend"],
        metadata: {
          source: "conversation",
          confidence: 0.9
        }
      });
      console.log(`   Stored memory with ID: ${memory.id}`);
      console.log(`   Content: ${memory.content.substring(0, 50)}...`);
    } catch (error) {
      console.log(`   Memory storage example failed: ${error.message}`);
      console.log("   (This is expected if memU server is not running)");
    }
    */

    console.log("\n6. Example: Using OpenMeter for usage tracking");
    
    // Example metering (commented out as it requires actual OpenMeter server)
    /*
    try {
      await openMeter.recordEvent({
        event: "llm_completion",
        timestamp: Date.now(),
        properties: {
          model: "gpt-4",
          tokens: 150,
          duration: 2.5
        },
        customerId: "customer-abc",
        namespace: "production"
      });
      console.log("   Recorded LLM completion event");
    } catch (error) {
      console.log(`   Metering example failed: ${error.message}`);
      console.log("   (This is expected if OpenMeter server is not running)");
    }
    */

    console.log("\n7. Example: Using Voicebox for voice synthesis");
    
    // Example voice generation (commented out as it requires actual Voicebox server)
    /*
    try {
      // First, list available profiles
      const profiles = await voicebox.listProfiles();
      console.log(`   Available voice profiles: ${profiles.length}`);
      
      if (profiles.length > 0) {
        const profile = profiles[0];
        console.log(`   Using profile: ${profile.name} (${profile.language})`);
        
        // Generate speech
        const generation = await voicebox.generateSpeech({
          profileId: profile.id,
          text: "Hello, this is a test of the Voicebox integration with OverCoat.",
          language: profile.language,
        });
        console.log(`   Generated speech with ID: ${generation.id}`);
        console.log(`   Audio duration: ${generation.duration.toFixed(2)} seconds`);
        console.log(`   Audio path: ${generation.audioPath}`);
      } else {
        console.log("   No voice profiles available. Create a profile first.");
      }
    } catch (error) {
      console.log(`   Voice synthesis example failed: ${error.message}`);
      console.log("   (This is expected if Voicebox server is not running)");
    }
    */

    console.log("\n8. Cleaning up integrations...");
    
    await integrationManager.cleanupAll();
    console.log("   All integrations cleaned up!");

  } catch (error) {
    console.error(`Error in ecosystem example: ${error}`);
  }

  console.log("\n=== Example Complete ===");
  console.log("\nNext steps:");
  console.log("1. Start the required services (Authelia, memU, OpenMeter, Voicebox, ZVec, Yumcut, Shannon)");
  console.log("2. Update server URLs in the integration configurations");
  console.log("3. Uncomment the example code blocks to test actual integrations");
  console.log("4. Extend with your own integration logic");
}

// Run the example if this file is executed directly
if (require.main === module) {
  runEcosystemExample().catch(console.error);
}

export { runEcosystemExample };