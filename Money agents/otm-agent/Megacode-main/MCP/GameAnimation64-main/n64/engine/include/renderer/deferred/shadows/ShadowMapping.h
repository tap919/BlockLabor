/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Shadow mapping system for deferred rendering pipeline
 * Optimized for N64 hardware constraints
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include "../Common.h"
#include "../GBuffer.h"
#include "../../../memory/MemoryManager.h"
#include "../../../jobs/JobSystem.h"

namespace P64::Deferred::Shadows
{
    /**
     * Shadow map quality levels
     */
    enum class ShadowQuality : uint8_t
    {
        OFF = 0,        // No shadows
        LOW = 1,        // 128x128, no filtering
        MEDIUM = 2,     // 256x256, 2x2 PCF
        HIGH = 3        // 512x512, 4x4 PCF (Expansion Pak only)
    };
    
    /**
     * Shadow map types
     */
    enum class ShadowType : uint8_t
    {
        DIRECTIONAL = 0,    // Cascaded shadow maps
        POINT = 1,          // Omnidirectional (cube map)
        SPOT = 2           // Perspective shadow map
    };
    
    /**
     * Cascaded shadow map configuration
     */
    struct CascadeConfig
    {
        float splitDistance;    // Distance from camera for this cascade
        float bias;            // Depth bias for this cascade
        float blurRadius;      // Blur radius for soft shadows
        
        uint8_t padding[12];
    };
    
    /**
     * Shadow map configuration for a light
     */
    struct ShadowConfig
    {
        ShadowType type;
        ShadowQuality quality;
        
        // Resolution (square for directional/spot, per face for point)
        uint16_t resolution;
        
        // Bias parameters
        float depthBias;
        float normalBias;
        
        // Filtering
        bool enablePCF;        // Percentage-closer filtering
        uint8_t pcfSize;       // 2, 3, or 4 for NxN PCF
        
        // Cascades (for directional lights)
        uint8_t cascadeCount;  // 1-4 cascades
        CascadeConfig cascades[4];
        
        // Point light specific
        bool pointLightParallax; // Use parallax correction for point lights
        
        uint8_t padding[10];
    };
    
    /**
     * Shadow map data structure
     */
    class ShadowMap
    {
    private:
        // Shadow map surface(s)
        surface_t* shadowSurfaces;
        uint32_t surfaceCount; // 1 for directional/spot, 6 for point lights
        
        // Configuration
        ShadowConfig config;
        
        // View/projection matrices
        float viewMatrix[4][4];
        float projectionMatrix[4][4];
        
        // For cascaded shadows
        float cascadeMatrices[4][4][4]; // Up to 4 cascades
        float cascadeDistances[4];      // Split distances
        
        // Memory region
        P64::Deferred::MemoryRegion memoryRegion;
        
        // Performance tracking
        uint64_t renderTime;
        uint32_t triangleCount;
        
    public:
        ShadowMap(const ShadowConfig& config, P64::Deferred::MemoryRegion region = P64::Deferred::DEFAULT_MEMORY_REGION);
        ~ShadowMap();
        
        // No copy/move
        ShadowMap(const ShadowMap&) = delete;
        ShadowMap& operator=(const ShadowMap&) = delete;
        ShadowMap(ShadowMap&&) = delete;
        ShadowMap& operator=(ShadowMap&&) = delete;
        
        /**
         * Initialize shadow map
         */
        void init();
        
        /**
         * Update shadow map for directional light
         * @param lightDirection Light direction vector
         * @param cameraPosition Camera position for cascade splits
         * @param cameraView Camera view matrix
         * @param cameraFOV Camera field of view
         */
        void updateDirectional(const fm_vec3_t& lightDirection,
                              const fm_vec3_t& cameraPosition,
                              const float cameraView[4][4],
                              float cameraFOV);
        
        /**
         * Update shadow map for point light
         * @param lightPosition Light position
         * @param lightRange Light influence range
         */
        void updatePoint(const fm_vec3_t& lightPosition, float lightRange);
        
        /**
         * Update shadow map for spot light
         * @param lightPosition Light position
         * @param lightDirection Light direction
         * @param lightAngle Spot light angle (radians)
         * @param lightRange Light influence range
         */
        void updateSpot(const fm_vec3_t& lightPosition,
                       const fm_vec3_t& lightDirection,
                       float lightAngle, float lightRange);
        
        /**
         * Begin rendering to shadow map
         * @param cascadeIndex Cascade index (0-3 for directional, 0 for others)
         * @param faceIndex Face index (0-5 for point lights)
         */
        void beginRender(uint8_t cascadeIndex = 0, uint8_t faceIndex = 0);
        
        /**
         * End rendering to shadow map
         */
        void endRender();
        
        /**
         * Sample shadow map
         * @param worldPosition World space position to test
         * @param cascadeIndex Cascade index for directional lights
         * @param faceIndex Face index for point lights
         * @return Shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
         */
        [[nodiscard]] float sampleShadow(const fm_vec3_t& worldPosition,
                                        uint8_t cascadeIndex = 0,
                                        uint8_t faceIndex = 0) const;
        
        /**
         * Sample shadow map with PCF
         * @param worldPosition World space position to test
         * @param cascadeIndex Cascade index for directional lights
         * @param faceIndex Face index for point lights
         * @return Shadow factor with PCF filtering
         */
        [[nodiscard]] float sampleShadowPCF(const fm_vec3_t& worldPosition,
                                           uint8_t cascadeIndex = 0,
                                           uint8_t faceIndex = 0) const;
        
        /**
         * Get shadow map surface for a specific cascade/face
         */
        [[nodiscard]] surface_t* getSurface(uint8_t cascadeIndex = 0, uint8_t faceIndex = 0) const;
        
        /**
         * Get view-projection matrix for a specific cascade/face
         */
        [[nodiscard]] const float* getViewProjectionMatrix(uint8_t cascadeIndex = 0, uint8_t faceIndex = 0) const;
        
        /**
         * Get configuration
         */
        [[nodiscard]] const ShadowConfig& getConfig() const { return config; }
        
        /**
         * Get memory usage
         */
        [[nodiscard]] size_t getMemoryUsage() const;
        
        /**
         * Get performance statistics
         */
        [[nodiscard]] uint64_t getRenderTime() const { return renderTime; }
        [[nodiscard]] uint32_t getTriangleCount() const { return triangleCount; }
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Debug: Visualize shadow map
         */
        void debugVisualize(surface_t* target, uint8_t cascadeIndex = 0, uint8_t faceIndex = 0) const;
        
    private:
        /**
         * Calculate cascade splits for directional light
         */
        void calculateCascadeSplits(const fm_vec3_t& cameraPosition,
                                   const float cameraView[4][4],
                                   float cameraFOV);
        
        /**
         * Calculate view matrix for directional light cascade
         */
        void calculateDirectionalViewMatrix(const fm_vec3_t& lightDirection,
                                           uint8_t cascadeIndex);
        
        /**
         * Calculate projection matrix for directional light cascade
         */
        void calculateDirectionalProjectionMatrix(uint8_t cascadeIndex);
        
        /**
         * Calculate view matrix for point light face
         */
        void calculatePointViewMatrix(const fm_vec3_t& lightPosition,
                                     uint8_t faceIndex);
        
        /**
         * Calculate projection matrix for point light
         */
        void calculatePointProjectionMatrix(float lightRange);
        
        /**
         * Calculate view matrix for spot light
         */
        void calculateSpotViewMatrix(const fm_vec3_t& lightPosition,
                                    const fm_vec3_t& lightDirection);
        
        /**
         * Calculate projection matrix for spot light
         */
        void calculateSpotProjectionMatrix(float lightAngle, float lightRange);
        
        /**
         * Setup RDP state for shadow map rendering
         */
        void setupRDPState() const;
        
        /**
         * Convert world position to shadow map UV coordinates
         */
        [[nodiscard]] bool worldToShadowUV(const fm_vec3_t& worldPosition,
                                          float& u, float& v, float& depth,
                                          uint8_t cascadeIndex = 0,
                                          uint8_t faceIndex = 0) const;
        
        /**
         * Sample shadow map depth at UV coordinates
         */
        [[nodiscard]] float sampleDepth(float u, float v, uint8_t cascadeIndex = 0, uint8_t faceIndex = 0) const;
    };
    
    /**
     * Shadow manager for handling multiple shadow maps
     */
    class ShadowManager
    {
    private:
        // Shadow maps for each light
        ShadowMap* shadowMaps[9]; // Max 8 dynamic + 1 directional
        uint32_t shadowMapCount;
        
        // Configuration
        ShadowQuality globalQuality;
        uint32_t maxShadowMaps;
        
        // Memory management
        MemoryRegion memoryRegion;
        size_t memoryBudget;
        size_t memoryUsed;
        
        // Performance tracking
        uint64_t totalRenderTime;
        uint32_t totalTriangleCount;
        uint32_t shadowMapsRendered;
        
        // Job system for parallel shadow map rendering
        JobSystem* jobSystem;
        
    public:
        ShadowManager(ShadowQuality quality = ShadowQuality::MEDIUM,
                      uint32_t maxMaps = 4,
                      P64::Deferred::MemoryRegion region = P64::Deferred::DEFAULT_MEMORY_REGION,
                      JobSystem* jobs = nullptr);
        ~ShadowManager();
        
        /**
         * Initialize shadow manager
         */
        void init();
        
        /**
         * Create shadow map for a light
         * @param lightId Light identifier
         * @param type Shadow type
         * @param config Specific configuration (optional)
         * @return True if created successfully
         */
        bool createShadowMap(uint32_t lightId, ShadowType type,
                            const ShadowConfig* config = nullptr);
        
        /**
         * Destroy shadow map for a light
         */
        void destroyShadowMap(uint32_t lightId);
        
        /**
         * Update all shadow maps
         * @param lights Array of light data
         * @param lightCount Number of lights
         * @param cameraPosition Current camera position
         * @param cameraView Camera view matrix
         * @param cameraFOV Camera field of view
         */
        void updateShadowMaps(const P64::Deferred::LightData* lights, uint32_t lightCount,
                              const fm_vec3_t& cameraPosition,
                              const float cameraView[4][4],
                              float cameraFOV);
        
        /**
         * Render all shadow maps
         * @param renderCallback Callback function to render scene to shadow map
         */
        void renderShadowMaps(std::function<void(const float[4][4], surface_t*)> renderCallback);
        
        /**
         * Sample shadow for a light
         * @param lightId Light identifier
         * @param worldPosition World space position
         * @param cascadeIndex Cascade index (for directional lights)
         * @return Shadow factor (0.0-1.0)
         */
        [[nodiscard]] float sampleShadow(uint32_t lightId,
                                        const fm_vec3_t& worldPosition,
                                        uint8_t cascadeIndex = 0) const;
        
        /**
         * Get shadow map for a light
         */
        [[nodiscard]] ShadowMap* getShadowMap(uint32_t lightId) const;
        
        /**
         * Get global quality setting
         */
        [[nodiscard]] ShadowQuality getGlobalQuality() const { return globalQuality; }
        
        /**
         * Set global quality setting
         */
        void setGlobalQuality(ShadowQuality quality);
        
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
        [[nodiscard]] uint64_t getTotalRenderTime() const { return totalRenderTime; }
        [[nodiscard]] uint32_t getTotalTriangleCount() const { return totalTriangleCount; }
        [[nodiscard]] uint32_t getShadowMapsRendered() const { return shadowMapsRendered; }
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Check if light should cast shadows (based on distance/importance)
         */
        [[nodiscard]] bool shouldLightCastShadows(uint32_t lightId,
                                                  const fm_vec3_t& cameraPosition,
                                                  const P64::Deferred::LightData& light) const;
        
        /**
         * Debug: Visualize all shadow maps
         */
        void debugVisualizeAll(surface_t* target) const;
        
    private:
        /**
         * Calculate memory budget based on quality and available RAM
         */
        void calculateMemoryBudget();
        
        /**
         * Update memory usage tracking
         */
        void updateMemoryUsage();
        
        /**
         * Find shadow map index by light ID
         */
        [[nodiscard]] int32_t findShadowMapIndex(uint32_t lightId) const;
        
        /**
         * Render shadow map in parallel using job system
         */
        void renderShadowMapParallel(uint32_t lightId,
                                    std::function<void(const float[4][4], surface_t*)> renderCallback);
    };
    
    /**
     * Shadow filtering utilities
     */
    namespace ShadowFiltering
    {
        /**
         * Apply Percentage-Closer Filtering (PCF)
         * @param shadowMap Shadow map surface
         * @param u Texture U coordinate
         * @param v Texture V coordinate
         * @param compareDepth Depth to compare against
         * @param pcfSize Filter size (2, 3, or 4)
         * @return Filtered shadow factor
         */
        [[nodiscard]] float applyPCF(const surface_t* shadowMap,
                                    float u, float v, float compareDepth,
                                    uint8_t pcfSize);
        
        /**
         * Apply Variance Shadow Mapping (VSM)
         * @param shadowMap Shadow map surface (must store depth and depth²)
         * @param u Texture U coordinate
         * @param v Texture V coordinate
         * @param compareDepth Depth to compare against
         * @param minVariance Minimum variance to avoid artifacts
         * @return Shadow factor using VSM
         */
        [[nodiscard]] float applyVSM(const surface_t* shadowMap,
                                    float u, float v, float compareDepth,
                                    float minVariance = 0.00001f);
        
        /**
         * Apply Exponential Shadow Mapping (ESM)
         * @param shadowMap Shadow map surface
         * @param u Texture U coordinate
         * @param v Texture V coordinate
         * @param compareDepth Depth to compare against
         * @param exponent Exponential constant
         * @return Shadow factor using ESM
         */
        [[nodiscard]] float applyESM(const surface_t* shadowMap,
                                    float u, float v, float compareDepth,
                                    float exponent = 80.0f);
        
        /**
         * Apply Contact Hardening Shadows (CHS)
         * @param shadowMap Shadow map surface
         * @param u Texture U coordinate
         * @param v Texture V coordinate
         * @param compareDepth Depth to compare against
         * @param receiverDistance Distance from light to receiver
         * @param lightSize Apparent size of light source
         * @return Shadow factor with contact hardening
         */
        [[nodiscard]] float applyCHS(const surface_t* shadowMap,
                                    float u, float v, float compareDepth,
                                    float receiverDistance, float lightSize);
    }
    
    /**
     * RSP microcode for shadow map operations
     */
    namespace ShadowRSP
    {
        /**
         * Load shadow mapping microcode
         */
        void loadMicrocode();
        
        /**
         * Render depth to shadow map using RSP
         * @param vertexData Pointer to vertex data
         * @param vertexCount Number of vertices
         * @param mvpMatrix Model-view-projection matrix
         * @param shadowMap Shadow map surface
         */
        void renderDepthToShadowMap(const void* vertexData, uint32_t vertexCount,
                                   const float mvpMatrix[4][4],
                                   surface_t* shadowMap);
        
        /**
         * Sample shadow map with PCF using RSP
         * @param shadowMap Shadow map surface
         * @param uvData Array of UV coordinates to sample
         * @param depthData Array of depths to compare
         * @param sampleCount Number of samples
         * @param pcfSize PCF filter size
         * @param resultData Output array for shadow factors
         */
        void sampleShadowPCF_RSP(const surface_t* shadowMap,
                                const float* uvData, const float* depthData,
                                uint32_t sampleCount, uint8_t pcfSize,
                                float* resultData);
    }
}