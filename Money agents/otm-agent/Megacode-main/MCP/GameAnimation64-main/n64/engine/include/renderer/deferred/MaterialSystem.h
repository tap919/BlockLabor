/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Material system for PBR-inspired cartoon rendering
 * Optimized for N64 hardware and deferred pipeline
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include "./Common.h"
#include "../../memory/MemoryManager.h"
#include "../../jobs/JobSystem.h"

namespace P64::Deferred::Materials
{
    /**
     * Material types for deferred rendering
     */
    enum class MaterialType : uint8_t
    {
        OPAQUE = 0,         // Standard opaque material
        TRANSPARENT = 1,    // Alpha blended transparency
        CUTOUT = 2,         // Alpha tested (cutout)
        EMISSIVE = 3,       // Self-illuminated
        SUBSURFACE = 4,     // Subsurface scattering (skin, wax)
        CLEAR_COAT = 5,     // Clear coat (car paint, plastics)
        ANISOTROPIC = 6     // Anisotropic (brushed metal, hair)
    };
    
    /**
     * Texture channels for materials
     */
    enum class TextureChannel : uint8_t
    {
        ALBEDO = 0,         // Base color/diffuse
        NORMAL = 1,         // Normal map
        ROUGHNESS = 2,      // Roughness/smoothness
        METALLIC = 3,       // Metallic map
        EMISSIVE = 4,       // Emissive map
        AMBIENT_OCCLUSION = 5, // Ambient occlusion
        HEIGHT = 6,         // Height/displacement map
        DETAIL = 7          // Detail map (tiling)
    };
    
    /**
     * Texture format optimization for N64
     */
    enum class TextureFormat : uint8_t
    {
        RGBA32 = 0,         // 32-bit RGBA (high quality)
        RGBA16 = 1,         // 16-bit RGBA (standard)
        CI8 = 2,            // 8-bit color index (paletted)
        CI4 = 3,            // 4-bit color index (very compact)
        IA8 = 4,            // 8-bit intensity+alpha (grayscale)
        IA4 = 5,            // 4-bit intensity+alpha
        I8 = 6,             // 8-bit intensity (grayscale)
        I4 = 7              // 4-bit intensity
    };
    
    /**
     * Texture data structure with N64 optimization
     */
    struct TextureData
    {
        sprite_t* sprite;           // Libdragon sprite handle
        TextureFormat format;       // Compression format
        uint16_t width;             // Texture width
        uint16_t height;            // Texture height
        uint8_t mipLevels;          // Number of mipmap levels
        bool isSRGB;                // sRGB color space
        bool isCompressed;          // Compressed texture data
        
        // Memory tracking
        size_t memorySize;          // Size in bytes
        P64::Deferred::MemoryRegion memoryRegion;  // Where texture is stored
        
        uint8_t padding[6];
    };
    
    /**
     * Material properties for PBR-inspired cartoon rendering
     */
    struct MaterialProperties
    {
        // Base properties
        color_t albedoColor;        // Base color (RGBA)
        float roughness;            // 0.0 = smooth, 1.0 = rough
        float metallic;             // 0.0 = dielectric, 1.0 = metal
        float specular;             // Specular intensity (0.0-1.0)
        
        // Cartoon shading
        uint8_t shadeBands;         // Number of shade bands (2, 3, or 4)
        color_t outlineColor;       // Cel outline color
        float outlineWidth;         // Outline width in pixels
        float outlineThreshold;     // Depth/normal threshold for outlines
        
        // Advanced properties
        float emissiveIntensity;    // Self-illumination strength
        float subsurfaceScattering; // Subsurface scattering amount
        float clearCoat;            // Clear coat layer strength
        float clearCoatRoughness;   // Clear coat roughness
        float anisotropy;           // Anisotropic direction/strength
        float anisotropyRotation;   // Anisotropy rotation (radians)
        
        // Texture IDs (0 = no texture)
        uint16_t textureIds[8];     // Index into texture array
        
        // Flags
        bool isDoubleSided : 1;     // Render both sides
        bool castsShadows : 1;      // Material casts shadows
        bool receivesShadows : 1;   // Material receives shadows
        bool isTransparent : 1;     // Alpha blended
        bool isCutout : 1;          // Alpha tested
        bool isEmissive : 1;        // Emits light
        bool hasSubsurface : 1;     // Has subsurface scattering
        bool hasClearCoat : 1;      // Has clear coat layer
        
        uint8_t padding[3];
    };
    
    /**
     * Material instance with runtime data
     */
    class MaterialInstance
    {
    private:
        // Core properties
        MaterialProperties properties;
        MaterialType type;
        
        // Textures
        TextureData* textures[8];   // Pointers to texture data
        
        // Runtime state
        bool isLoaded;              // Material is loaded and ready
        bool isDirty;               // Properties changed, needs update
        
        // Performance tracking
        uint64_t lastUsedTime;      // Last frame material was used
        uint32_t useCount;          // Number of times used
        
        // Memory management
        P64::Deferred::MemoryRegion memoryRegion;
        
    public:
        MaterialInstance(const MaterialProperties& props, MaterialType matType,
                        P64::Deferred::MemoryRegion region = P64::Deferred::DEFAULT_MEMORY_REGION);
        ~MaterialInstance();
        
        /**
         * Load material textures
         */
        bool loadTextures();
        
        /**
         * Unload material textures
         */
        void unloadTextures();
        
        /**
         * Bind material for rendering
         */
        void bind() const;
        
        /**
         * Update material properties
         */
        void updateProperties(const MaterialProperties& newProps);
        
        /**
         * Set texture for a channel
         */
        bool setTexture(TextureChannel channel, TextureData* texture);
        
        /**
         * Get texture for a channel
         */
        [[nodiscard]] TextureData* getTexture(TextureChannel channel) const;
        
        /**
         * Get material properties
         */
        [[nodiscard]] const MaterialProperties& getProperties() const { return properties; }
        
        /**
         * Get material type
         */
        [[nodiscard]] MaterialType getType() const { return type; }
        
        /**
         * Check if material is loaded
         */
        [[nodiscard]] bool isMaterialLoaded() const { return isLoaded; }
        
        /**
         * Get memory usage
         */
        [[nodiscard]] size_t getMemoryUsage() const;
        
        /**
         * Get performance statistics
         */
        [[nodiscard]] uint64_t getLastUsedTime() const { return lastUsedTime; }
        [[nodiscard]] uint32_t getUseCount() const { return useCount; }
        
        /**
         * Mark material as used (for LRU tracking)
         */
        void markUsed(uint64_t frameTime);
        
        /**
         * Reset usage statistics
         */
        void resetUsageStats();
        
        /**
         * Debug: Dump material info
         */
        void debugDump() const;
        
    private:
        /**
         * Setup RDP state for material
         */
        void setupRDPState() const;
        
        /**
         * Upload textures to RDP
         */
        void uploadTextures() const;
        
        /**
         * Calculate texture memory size
         */
        [[nodiscard]] size_t calculateTextureMemory() const;
    };
    
    /**
     * Material manager for handling multiple materials
     */
    class MaterialManager
    {
    private:
        // Material storage
        std::vector<MaterialInstance*> materials;
        uint32_t maxMaterials;
        
        // Texture storage
        std::vector<TextureData*> textures;
        uint32_t maxTextures;
        
        // Memory management
        P64::Deferred::MemoryRegion memoryRegion;
        size_t memoryBudget;
        size_t memoryUsed;
        
        // Performance tracking
        uint64_t totalBindTime;
        uint32_t materialsBound;
        uint32_t texturesLoaded;
        
        // LRU cache for materials
        std::vector<MaterialInstance*> lruCache;
        uint32_t cacheSize;
        
        // Job system for parallel loading
        JobSystem* jobSystem;
        
    public:
        MaterialManager(uint32_t maxMats = 64, uint32_t maxTex = 128,
                        P64::Deferred::MemoryRegion region = P64::Deferred::DEFAULT_MEMORY_REGION,
                        JobSystem* jobs = nullptr);
        ~MaterialManager();
        
        /**
         * Initialize material manager
         */
        void init();
        
        /**
         * Create new material
         * @param properties Material properties
         * @param type Material type
         * @return Material ID or -1 if failed
         */
        [[nodiscard]] int32_t createMaterial(const MaterialProperties& properties,
                                            MaterialType type);
        
        /**
         * Destroy material
         */
        void destroyMaterial(uint32_t materialId);
        
        /**
         * Load texture from file
         * @param filename Texture file path
         * @param format Texture format
         * @param generateMips Generate mipmaps
         * @return Texture ID or -1 if failed
         */
        [[nodiscard]] int32_t loadTexture(const char* filename,
                                         TextureFormat format = TextureFormat::RGBA16,
                                         bool generateMips = true);
        
        /**
         * Create texture from memory
         * @param data Texture data
         * @param width Texture width
         * @param height Texture height
         * @param format Texture format
         * @param generateMips Generate mipmaps
         * @return Texture ID or -1 if failed
         */
        [[nodiscard]] int32_t createTexture(const void* data,
                                           uint16_t width, uint16_t height,
                                           TextureFormat format = TextureFormat::RGBA16,
                                           bool generateMips = true);
        
        /**
         * Unload texture
         */
        void unloadTexture(uint32_t textureId);
        
        /**
         * Bind material for rendering
         */
        void bindMaterial(uint32_t materialId);
        
        /**
         * Update material properties
         */
        void updateMaterial(uint32_t materialId, const MaterialProperties& properties);
        
        /**
         * Assign texture to material channel
         */
        bool assignTextureToMaterial(uint32_t materialId, TextureChannel channel,
                                    uint32_t textureId);
        
        /**
         * Get material by ID
         */
        [[nodiscard]] MaterialInstance* getMaterial(uint32_t materialId) const;
        
        /**
         * Get texture by ID
         */
        [[nodiscard]] TextureData* getTexture(uint32_t textureId) const;
        
        /**
         * Get memory usage statistics
         */
        [[nodiscard]] size_t getMemoryUsed() const { return memoryUsed; }
        [[nodiscard]] size_t getMemoryBudget() const { return memoryBudget; }
        [[nodiscard]] float getMemoryUsagePercent() const {
            return memoryBudget > 0 ? (float)memoryUsed / memoryBudget * 100.0f : 0.0f;
        }
        
        /**
         * Get performance statistics
         */
        [[nodiscard]] uint64_t getTotalBindTime() const { return totalBindTime; }
        [[nodiscard]] uint32_t getMaterialsBound() const { return materialsBound; }
        [[nodiscard]] uint32_t getTexturesLoaded() const { return texturesLoaded; }
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Update LRU cache
         */
        void updateLRUCache();
        
        /**
         * Unload least recently used materials
         */
        void unloadLRUMaterials(uint32_t count);
        
        /**
         * Preload materials (async)
         */
        void preloadMaterials(const uint32_t* materialIds, uint32_t count);
        
        /**
         * Debug: Dump all materials info
         */
        void debugDumpAll() const;
        
        /**
         * Debug: Visualize material properties
         */
        void debugVisualizeMaterial(uint32_t materialId, surface_t* target) const;
        
    private:
        /**
         * Calculate memory budget
         */
        void calculateMemoryBudget();
        
        /**
         * Update memory usage tracking
         */
        void updateMemoryUsage();
        
        /**
         * Find material index by ID
         */
        [[nodiscard]] int32_t findMaterialIndex(uint32_t materialId) const;
        
        /**
         * Find texture index by ID
         */
        [[nodiscard]] int32_t findTextureIndex(uint32_t textureId) const;
        
        /**
         * Load texture async using job system
         */
        void loadTextureAsync(uint32_t textureId, const char* filename,
                             TextureFormat format, bool generateMips);
        
        /**
         * Generate mipmaps for texture
         */
        void generateMipmaps(TextureData* texture);
        
        /**
         * Compress texture data
         */
        void compressTexture(TextureData* texture, TextureFormat format);
    };
    
    /**
     * Predefined materials for common use cases
     */
    namespace PredefinedMaterials
    {
        /**
         * Create cartoon material
         */
        [[nodiscard]] MaterialProperties createCartoonMaterial(color_t baseColor = {255, 200, 100, 255},
                                                              uint8_t bands = 3);
        
        /**
         * Create metallic material
         */
        [[nodiscard]] MaterialProperties createMetallicMaterial(color_t baseColor = {200, 200, 200, 255},
                                                               float roughness = 0.3f);
        
        /**
         * Create plastic material
         */
        [[nodiscard]] MaterialProperties createPlasticMaterial(color_t baseColor = {255, 255, 255, 255},
                                                              float clearCoat = 0.5f);
        
        /**
         * Create skin material
         */
        [[nodiscard]] MaterialProperties createSkinMaterial(color_t baseColor = {255, 220, 200, 255},
                                                           float subsurface = 0.3f);
        
        /**
         * Create cloth material
         */
        [[nodiscard]] MaterialProperties createClothMaterial(color_t baseColor = {150, 100, 200, 255},
                                                            float roughness = 0.8f);
        
        /**
         * Create water material
         */
        [[nodiscard]] MaterialProperties createWaterMaterial(color_t baseColor = {100, 150, 255, 200},
                                                            float roughness = 0.1f);
        
        /**
         * Create emissive material
         */
        [[nodiscard]] MaterialProperties createEmissiveMaterial(color_t emissiveColor = {255, 100, 50, 255},
                                                               float intensity = 2.0f);
    }
    
    /**
     * Material baking utilities for offline processing
     */
    namespace MaterialBaking
    {
        /**
         * Bake material to texture atlas
         * @param material Material to bake
         * @param width Atlas width
         * @param height Atlas height
         * @return Baked texture data
         */
        [[nodiscard]] TextureData* bakeMaterialToAtlas(const MaterialInstance* material,
                                                      uint16_t width, uint16_t height);
        
        /**
         * Bake lighting to texture (lightmap)
         * @param material Material properties
         * @param lightData Array of light data
         * @param lightCount Number of lights
         * @param width Lightmap width
         * @param height Lightmap height
         * @return Baked lightmap texture
         */
        [[nodiscard]] TextureData* bakeLightingToTexture(const MaterialProperties& material,
                                                         const P64::Deferred::LightData* lightData,
                                                         uint32_t lightCount,
                                                         uint16_t width, uint16_t height);
        
        /**
         * Bake ambient occlusion
         * @param mesh Mesh data
         * @param material Material properties
         * @param width AO map width
         * @param height AO map height
         * @return Baked AO texture
         */
        [[nodiscard]] TextureData* bakeAmbientOcclusion(const void* meshData,
                                                       const MaterialProperties& material,
                                                       uint16_t width, uint16_t height);
        
        /**
         * Bake normal map from height map
         * @param heightMap Height map texture
         * @param strength Normal map strength
         * @return Baked normal map
         */
        [[nodiscard]] TextureData* bakeNormalMap(const TextureData* heightMap,
                                                float strength = 1.0f);
        
        /**
         * Bake curvature map
         * @param mesh Mesh data
         * @param width Curvature map width
         * @param height Curvature map height
         * @return Baked curvature map
         */
        [[nodiscard]] TextureData* bakeCurvatureMap(const void* meshData,
                                                   uint16_t width, uint16_t height);
    }
    
    /**
     * RSP microcode for material operations
     */
    namespace MaterialRSP
    {
        /**
         * Load material processing microcode
         */
        void loadMicrocode();
        
        /**
         * Apply material properties using RSP
         * @param material Material properties
         * @param vertexData Vertex data to process
         * @param vertexCount Number of vertices
         * @param outputData Output buffer for processed vertices
         */
        void applyMaterialProperties(const MaterialProperties& material,
                                    const void* vertexData, uint32_t vertexCount,
                                    void* outputData);
        
        /**
         * Apply cartoon banding using RSP
         * @param lightingData Input lighting data
         * @param bandCount Number of bands (2, 3, or 4)
         * @param outputData Output banded lighting data
         * @param pixelCount Number of pixels to process
         */
        void applyCartoonBanding_RSP(const void* lightingData, uint8_t bandCount,
                                    void* outputData, uint32_t pixelCount);
        
        /**
         * Apply outline detection using RSP
         * @param depthData Depth buffer data
         * @param normalData Normal buffer data
         * @param threshold Outline threshold
         * @param outputData Output outline mask
         * @param pixelCount Number of pixels to process
         */
        void applyOutlineDetection_RSP(const void* depthData, const void* normalData,
                                      float threshold, void* outputData,
                                      uint32_t pixelCount);
    }
}