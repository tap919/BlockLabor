/**
 * Game Engine Integration Example
 * 
 * Demonstrates how to use the GameEngineBridge with GameAnimation64
 * and other game engines for asset generation and AI-assisted development.
 */

import { IntegrationManager } from '../src/integrations/tool-integrations.js';
import { GameEngineBridge, GameAnimation64Bridge } from '../src/integrations/game-engine-bridge.js';
import type { CharacterDescription, LevelDescription } from '../src/integrations/game-engine-bridge.js';

// ─── Example 1: Basic Game Engine Integration ─────────────────────────────────

async function exampleBasicIntegration() {
  console.log('=== Example 1: Basic Game Engine Integration ===\n');
  
  // Create integration manager with all tools
  const manager = new IntegrationManager();
  
  // Register all tool integrations (in a real app, these would be configured)
  // manager.registerIntegration(new ZVecIntegration({ ... }));
  // manager.registerIntegration(new YumcutIntegration({ ... }));
  // manager.registerIntegration(new VoiceboxIntegration({ ... }));
  
  // Create game engine bridge
  const gameBridge = new GameEngineBridge(manager);
  
  // Example character description
  const heroCharacter: CharacterDescription = {
    name: 'Sir Galen',
    role: 'Knight Protector',
    personality: ['brave', 'honorable', 'protective', 'stoic'],
    abilities: ['sword mastery', 'shield defense', 'leadership', 'healing aura'],
    visualDescription: 'armored knight with silver plate armor, blue cape, glowing sword',
    animationStyle: 'medieval knight, heavy armor movement, heroic poses'
  };
  
  // Example level description
  const castleLevel: LevelDescription = {
    name: 'Crystal Castle',
    theme: 'fantasy medieval',
    environment: 'ice crystal castle with floating platforms',
    mood: 'mysterious, magical, dangerous',
    challenges: ['ice platforming', 'crystal guardians', 'puzzle doors'],
    visualStyle: 'crystalline architecture, blue-white color palette, magical glow'
  };
  
  console.log('Character:', heroCharacter.name);
  console.log('Level:', castleLevel.name);
  
  // Check available integrations
  console.log('\nAvailable Integrations:');
  console.log('- ZVec:', gameBridge.getZVec() ? 'Available' : 'Not available');
  console.log('- Yumcut:', gameBridge.getYumcut() ? 'Available' : 'Not available');
  console.log('- Voicebox:', gameBridge.getVoicebox() ? 'Available' : 'Not available');
  
  return { gameBridge, heroCharacter, castleLevel };
}

// ─── Example 2: Complete Character Generation ─────────────────────────────────

async function exampleCharacterGeneration(gameBridge: GameEngineBridge, character: CharacterDescription) {
  console.log('\n=== Example 2: Complete Character Generation ===\n');
  
  try {
    // Generate complete character with sprite and voice lines
    const result = await gameBridge.generateCompleteCharacter(character, {
      generateSprite: true,
      generateVoiceLines: [
        'Stand back! I will protect this realm!',
        'My sword shines with the light of justice!',
        'For honor and glory!'
      ],
      style: 'fantasy pixel art'
    });
    
    console.log(`Generated character: ${result.character.name}`);
    
    if (result.sprite) {
      console.log(`- Sprite generated: ${result.sprite.imageUrl}`);
      console.log(`  Metadata:`, result.sprite.metadata);
    }
    
    if (result.voiceLines) {
      console.log(`- Voice lines generated: ${result.voiceLines.length}`);
      result.voiceLines.forEach((line, i) => {
        console.log(`  ${i + 1}. "${line.text}" (${line.duration}s)`);
      });
    }
    
    if (result.embedding) {
      console.log(`- Embedding vector: ${result.embedding.length} dimensions`);
    }
    
    return result;
  } catch (error) {
    console.log('Character generation failed (integration not configured):', error.message);
    return null;
  }
}

// ─── Example 3: Level Design Pipeline ─────────────────────────────────────────

async function exampleLevelDesign(gameBridge: GameEngineBridge, level: LevelDescription) {
  console.log('\n=== Example 3: Level Design Pipeline ===\n');
  
  try {
    // Generate complete level with textures and ambient sound
    const result = await gameBridge.generateCompleteLevel(level, {
      generateTextures: true,
      generateAmbientSound: true,
      style: 'fantasy cartoon'
    });
    
    console.log(`Generated level: ${result.level.name}`);
    
    if (result.textures) {
      console.log(`- Textures generated: ${result.textures.length}`);
      result.textures.forEach((texture, i) => {
        console.log(`  ${i + 1}. ${texture.type}: ${texture.imageUrl}`);
      });
    }
    
    if (result.ambientSound) {
      console.log(`- Ambient sound: ${result.ambientSound.description}`);
      console.log(`  Audio URL: ${result.ambientSound.audioUrl}`);
    }
    
    return result;
  } catch (error) {
    console.log('Level generation failed (integration not configured):', error.message);
    return null;
  }
}

// ─── Example 4: Asset Search and Discovery ────────────────────────────────────

async function exampleAssetSearch(gameBridge: GameEngineBridge) {
  console.log('\n=== Example 4: Asset Search and Discovery ===\n');
  
  try {
    // Search for game assets using natural language
    const query = 'hero knight with sword and shield fantasy';
    console.log(`Searching for: "${query}"`);
    
    const results = await gameBridge.searchGameAssets(query, ['character', 'texture'], 5);
    
    console.log(`Found ${results.length} results:`);
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.asset.name} (${result.asset.type})`);
      console.log(`   Similarity: ${result.similarity.toFixed(3)}`);
      console.log(`   Source: ${result.source}`);
    });
    
    return results;
  } catch (error) {
    console.log('Asset search failed (integration not configured):', error.message);
    return [];
  }
}

// ─── Example 5: GameAnimation64 Specific Integration ──────────────────────────

async function exampleGameAnimation64Integration() {
  console.log('\n=== Example 5: GameAnimation64 Specific Integration ===\n');
  
  // Mock GameAnimation64 integration (in real app, this would be the actual integration)
  const mockGameAnimation64Integration = {
    exportAsset: async (asset: any) => ({ success: true, assetId: 'mock_123' }),
    createProject: async (name: string) => ({ success: true, projectId: 'proj_mock' })
  };
  
  const manager = new IntegrationManager();
  const gameBridge = new GameAnimation64Bridge(manager, mockGameAnimation64Integration);
  
  // Example: Generate Vibe coding prompts for game assets
  const gameAssets = [
    {
      id: 'char_hero',
      name: 'Hero Knight',
      type: 'character' as const,
      description: 'Brave knight with sword and shield',
      tags: ['hero', 'knight', 'melee'],
      metadata: { health: 100, damage: 20 },
      createdAt: new Date()
    },
    {
      id: 'env_castle',
      name: 'Crystal Castle',
      type: 'environment' as const,
      description: 'Magical ice castle with floating platforms',
      tags: ['fantasy', 'castle', 'ice'],
      metadata: { difficulty: 'medium' },
      createdAt: new Date()
    }
  ];
  
  const vibePrompts = (gameBridge as any).generateVibePrompts(gameAssets);
  
  console.log('Generated Vibe Coding Prompts:');
  vibePrompts.forEach((prompt: string, i: number) => {
    console.log(`${i + 1}. ${prompt}`);
  });
  
  // Example: Export to GameAnimation64 format
  const exportResult = await (gameBridge as any).exportToGameAnimation64(
    { characters: gameAssets },
    'test_project'
  );
  
  console.log('\nExport Result:', exportResult);
  
  return { gameBridge, vibePrompts, exportResult };
}

// ─── Example 6: Real-time Asset Generation Workflow ───────────────────────────

async function exampleRealTimeWorkflow() {
  console.log('\n=== Example 6: Real-time Asset Generation Workflow ===\n');
  
  console.log('Simulating game development workflow:');
  console.log('1. Designer describes character concept');
  console.log('2. System generates sprite variations');
  console.log('3. System generates voice lines');
  console.log('4. System creates embedding for search');
  console.log('5. Assets exported to game engine');
  
  // This would be the actual workflow in a game engine integration
  const workflowSteps = [
    'Concept → AI generates 4 sprite variations',
    'Select best variation → AI generates matching voice lines',
    'Combine assets → Create embedding vector',
    'Export to GameAnimation64 N64 format',
    'Test in 3D viewport with cartoon shader'
  ];
  
  workflowSteps.forEach((step, i) => {
    console.log(`${i + 1}. ${step}`);
  });
  
  return { workflowSteps };
}

// ─── Main Execution ───────────────────────────────────────────────────────────

async function main() {
  console.log('Game Engine Integration Examples\n');
  
  try {
    // Run all examples
    const example1 = await exampleBasicIntegration();
    
    await exampleCharacterGeneration(example1.gameBridge, example1.heroCharacter);
    await exampleLevelDesign(example1.gameBridge, example1.castleLevel);
    await exampleAssetSearch(example1.gameBridge);
    await exampleGameAnimation64Integration();
    await exampleRealTimeWorkflow();
    
    console.log('\n=== Summary ===');
    console.log('The GameEngineBridge provides:');
    console.log('1. Unified access to AI tools for game development');
    console.log('2. Complete pipelines for character/level generation');
    console.log('3. Semantic search for game assets');
    console.log('4. Integration with specific game engines like GameAnimation64');
    console.log('5. Vibe coding prompt generation for AI-assisted scripting');
    
    console.log('\nIntegration with GameAnimation64 enables:');
    console.log('- AI-generated assets directly in the N64 game engine');
    console.log('- Vibe coding for behavior scripting');
    console.log('- Cartoon shader integration with generated textures');
    console.log('- Real-time preview in Three.js viewport');
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleBasicIntegration,
  exampleCharacterGeneration,
  exampleLevelDesign,
  exampleAssetSearch,
  exampleGameAnimation64Integration,
  exampleRealTimeWorkflow
};