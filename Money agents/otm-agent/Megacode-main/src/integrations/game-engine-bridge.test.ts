/**
 * Game Engine Bridge Tests
 * 
 * Tests for the GameEngineBridge integration with game engines.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationManager } from './tool-integrations.js';
import { GameEngineBridge } from './game-engine-bridge.js';
import type { CharacterDescription, LevelDescription } from './game-engine-bridge.js';

// Mock tool integrations for testing
class MockZVecIntegration {
  name = 'zvec';
  async embed(text: string): Promise<number[]> {
    return Array(384).fill(0).map(() => Math.random());
  }
  async search(vector: number[], topK: number = 10): Promise<any[]> {
    return Array(topK).fill(0).map((_, i) => ({
      id: `result_${i}`,
      score: 1 - (i * 0.1),
      text: `Mock result ${i}`
    }));
  }
}

class MockYumcutIntegration {
  name = 'yumcut';
  async generateImage(prompt: string, options: any): Promise<any> {
    return {
      imageUrl: `https://mock.yumcut.com/image_${Date.now()}.png`,
      metadata: { prompt, options, generatedAt: new Date().toISOString() }
    };
  }
}

class MockVoiceboxIntegration {
  name = 'voicebox';
  async generateSpeech(text: string, options: any): Promise<any> {
    return {
      audioUrl: `https://mock.voicebox.com/audio_${Date.now()}.mp3`,
      duration: text.length * 0.1,
      metadata: { text, options }
    };
  }
}

describe('GameEngineBridge', () => {
  let integrationManager: IntegrationManager;
  let gameBridge: GameEngineBridge;
  
  beforeEach(() => {
    integrationManager = new IntegrationManager();
    
    // Register mock integrations
    integrationManager.registerIntegration(new MockZVecIntegration() as any);
    integrationManager.registerIntegration(new MockYumcutIntegration() as any);
    integrationManager.registerIntegration(new MockVoiceboxIntegration() as any);
    
    gameBridge = new GameEngineBridge(integrationManager);
  });
  
  afterEach(() => {
    // Clean up if needed
  });
  
  describe('Initialization', () => {
    it('should initialize with integration manager', () => {
      expect(gameBridge).toBeDefined();
      expect(gameBridge.getZVec()).toBeDefined();
      expect(gameBridge.getYumcut()).toBeDefined();
      expect(gameBridge.getVoicebox()).toBeDefined();
    });
    
    it('should handle missing integrations gracefully', () => {
      const emptyManager = new IntegrationManager();
      const bridgeWithNoIntegrations = new GameEngineBridge(emptyManager);
      
      expect(bridgeWithNoIntegrations.getZVec()).toBeNull();
      expect(bridgeWithNoIntegrations.getYumcut()).toBeNull();
      expect(bridgeWithNoIntegrations.getVoicebox()).toBeNull();
    });
  });
  
  describe('ZVecGameIntegration', () => {
    it('should embed game assets', async () => {
      const zvec = gameBridge.getZVec();
      expect(zvec).toBeDefined();
      
      if (zvec) {
        const mockAsset = {
          id: 'test_asset',
          name: 'Test Character',
          type: 'character' as const,
          description: 'A test character',
          tags: ['test', 'character'],
          metadata: {},
          createdAt: new Date()
        };
        
        const embedding = await zvec.embedGameAsset(mockAsset);
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      }
    });
    
    it('should search for similar assets', async () => {
      const zvec = gameBridge.getZVec();
      expect(zvec).toBeDefined();
      
      if (zvec) {
        const results = await zvec.searchSimilarAssets('hero knight', 5);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(5);
        
        if (results.length > 0) {
          const result = results[0];
          expect(result.asset).toBeDefined();
          expect(typeof result.similarity).toBe('number');
          expect(result.similarity).toBeGreaterThanOrEqual(0);
          expect(result.similarity).toBeLessThanOrEqual(1);
        }
      }
    });
    
    it('should cluster characters by behavior', async () => {
      const zvec = gameBridge.getZVec();
      expect(zvec).toBeDefined();
      
      if (zvec) {
        const characters: CharacterDescription[] = [
          {
            name: 'Warrior',
            role: 'Melee Fighter',
            personality: ['aggressive', 'brave', 'direct'],
            abilities: ['sword', 'shield', 'charge'],
            visualDescription: 'Heavy armor, big sword',
            animationStyle: 'powerful, slow movements'
          },
          {
            name: 'Mage',
            role: 'Spell Caster',
            personality: ['intelligent', 'calm', 'strategic'],
            abilities: ['fireball', 'teleport', 'shield'],
            visualDescription: 'Robes, staff, glowing eyes',
            animationStyle: 'graceful, flowing movements'
          },
          {
            name: 'Archer',
            role: 'Ranged Fighter',
            personality: ['patient', 'observant', 'precise'],
            abilities: ['bow', 'stealth', 'trap'],
            visualDescription: 'Leather armor, bow, hood',
            animationStyle: 'quick, agile movements'
          }
        ];
        
        const clusters = await zvec.clusterCharactersByBehavior(characters, 3);
        expect(Array.isArray(clusters)).toBe(true);
        expect(clusters.length).toBeGreaterThan(0);
        expect(clusters.length).toBeLessThanOrEqual(3);
        
        // All characters should be in clusters
        const totalCharacters = clusters.reduce((sum, cluster) => sum + cluster.characters.length, 0);
        expect(totalCharacters).toBe(characters.length);
      }
    });
  });
  
  describe('YumcutGameIntegration', () => {
    it('should generate character sprites', async () => {
      const yumcut = gameBridge.getYumcut();
      expect(yumcut).toBeDefined();
      
      if (yumcut) {
        const character: CharacterDescription = {
          name: 'Test Hero',
          role: 'Protector',
          personality: ['brave', 'kind'],
          abilities: ['sword', 'heal'],
          visualDescription: 'Armored hero with glowing sword',
          animationStyle: 'heroic'
        };
        
        const result = await yumcut.generateCharacterSprite(character, 'pixel art');
        expect(result).toBeDefined();
        expect(result.imageUrl).toContain('http');
        expect(result.metadata).toBeDefined();
        expect(result.metadata.prompt).toBeDefined();
      }
    });
    
    it('should generate environment textures', async () => {
      const yumcut = gameBridge.getYumcut();
      expect(yumcut).toBeDefined();
      
      if (yumcut) {
        const level: LevelDescription = {
          name: 'Test Level',
          theme: 'fantasy',
          environment: 'forest',
          mood: 'peaceful',
          challenges: ['navigation'],
          visualStyle: 'lush, green'
        };
        
        const result = await yumcut.generateEnvironmentTexture(level, 'cartoon');
        expect(result).toBeDefined();
        expect(result.imageUrl).toContain('http');
        expect(result.metadata).toBeDefined();
      }
    });
    
    it('should generate UI elements', async () => {
      const yumcut = gameBridge.getYumcut();
      expect(yumcut).toBeDefined();
      
      if (yumcut) {
        const result = await yumcut.generateUIElement('health bar', 'fantasy');
        expect(result).toBeDefined();
        expect(result.imageUrl).toContain('http');
        expect(result.metadata).toBeDefined();
      }
    });
    
    it('should generate asset variations', async () => {
      const yumcut = gameBridge.getYumcut();
      expect(yumcut).toBeDefined();
      
      if (yumcut) {
        const baseAsset = {
          id: 'test_asset',
          name: 'Test Asset',
          type: 'character' as const,
          description: 'A test asset for variations',
          tags: ['test'],
          metadata: {},
          createdAt: new Date()
        };
        
        const variations = await yumcut.generateAssetVariations(baseAsset, 3, ['pixel art', 'cartoon', 'anime']);
        expect(Array.isArray(variations)).toBe(true);
        expect(variations.length).toBe(3);
        
        variations.forEach(variation => {
          expect(variation.imageUrl).toContain('http');
          expect(variation.style).toBeDefined();
          expect(variation.metadata.baseAssetId).toBe(baseAsset.id);
        });
      }
    });
  });
  
  describe('VoiceboxGameIntegration', () => {
    it('should generate character voice lines', async () => {
      const voicebox = gameBridge.getVoicebox();
      expect(voicebox).toBeDefined();
      
      if (voicebox) {
        const character: CharacterDescription = {
          name: 'Test Voice',
          role: 'Speaker',
          personality: ['energetic', 'deep'],
          abilities: ['speech'],
          visualDescription: 'Talking character',
          animationStyle: 'expressive'
        };
        
        const lines = ['Hello world!', 'This is a test.', 'Goodbye!'];
        const results = await voicebox.generateCharacterVoice(character, lines);
        
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(lines.length);
        
        results.forEach((result, i) => {
          expect(result.text).toBe(lines[i]);
          expect(result.audioUrl).toContain('http');
          expect(typeof result.duration).toBe('number');
        });
      }
    });
    
    it('should generate ambient sounds', async () => {
      const voicebox = gameBridge.getVoicebox();
      expect(voicebox).toBeDefined();
      
      if (voicebox) {
        const level: LevelDescription = {
          name: 'Test Ambient',
          theme: 'nature',
          environment: 'forest',
          mood: 'calm',
          challenges: [],
          visualStyle: 'natural'
        };
        
        const result = await voicebox.generateAmbientSounds(level, 10);
        expect(result).toBeDefined();
        expect(result.audioUrl).toContain('http');
        expect(result.description).toBeDefined();
      }
    });
  });
  
  describe('Complete Generation Pipelines', () => {
    it('should generate complete character', async () => {
      const character: CharacterDescription = {
        name: 'Complete Hero',
        role: 'Test Subject',
        personality: ['test', 'complete'],
        abilities: ['everything'],
        visualDescription: 'Fully generated character',
        animationStyle: 'test animation'
      };
      
      const result = await gameBridge.generateCompleteCharacter(character, {
        generateSprite: true,
        generateVoiceLines: ['Test line 1', 'Test line 2'],
        style: 'test style'
      });
      
      expect(result).toBeDefined();
      expect(result.character.name).toBe(character.name);
      expect(result.sprite).toBeDefined();
      expect(result.voiceLines).toBeDefined();
      expect(Array.isArray(result.voiceLines)).toBe(true);
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
    });
    
    it('should generate complete level', async () => {
      const level: LevelDescription = {
        name: 'Complete Level',
        theme: 'test',
        environment: 'test environment',
        mood: 'test mood',
        challenges: ['test challenge'],
        visualStyle: 'test visual'
      };
      
      const result = await gameBridge.generateCompleteLevel(level, {
        generateTextures: true,
        generateAmbientSound: true,
        style: 'test style'
      });
      
      expect(result).toBeDefined();
      expect(result.level.name).toBe(level.name);
      expect(result.textures).toBeDefined();
      expect(Array.isArray(result.textures)).toBe(true);
      expect(result.ambientSound).toBeDefined();
    });
    
    it('should search for game assets', async () => {
      const results = await gameBridge.searchGameAssets('hero knight fantasy', ['character', 'texture'], 3);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
      
      if (results.length > 0) {
        const result = results[0];
        expect(result.asset).toBeDefined();
        expect(result.similarity).toBeDefined();
        expect(result.source).toBe('zvec');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing tool integrations gracefully', async () => {
      const emptyManager = new IntegrationManager();
      const bridge = new GameEngineBridge(emptyManager);
      
      const character: CharacterDescription = {
        name: 'Test',
        role: 'Test',
        personality: [],
        abilities: [],
        visualDescription: '',
        animationStyle: ''
      };
      
      // These should not throw, just return null or empty results
      expect(bridge.getZVec()).toBeNull();
      expect(bridge.getYumcut()).toBeNull();
      expect(bridge.getVoicebox()).toBeNull();
      
      // Complete generation should work but with limited results
      const result = await bridge.generateCompleteCharacter(character, {
        generateSprite: true,
        generateVoiceLines: ['test']
      });
      
      expect(result).toBeDefined();
      expect(result.character.name).toBe('Test');
      // Sprite and voice lines won't be generated without integrations
    });
    
    it('should handle search with no integrations', async () => {
      const emptyManager = new IntegrationManager();
      const bridge = new GameEngineBridge(emptyManager);
      
      const results = await bridge.searchGameAssets('test query');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});