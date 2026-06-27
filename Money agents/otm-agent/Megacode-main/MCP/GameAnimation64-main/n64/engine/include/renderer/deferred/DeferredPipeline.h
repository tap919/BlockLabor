/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include "./Common.h"
#include "../pipeline.h"
#include "./GBuffer.h"
#include "../../ecs/Coordinator.h"
#include "../../jobs/JobSystem.h"

namespace P64::Deferred
{
    /**
     * Light structure for deferred rendering
     */
    struct LightData
    {
        enum Type : uint8_t
        {
            DIRECTIONAL = 0,
            POINT = 1,
            SPOT = 2
        };
        
        Type type;
        color_t color;
        float intensity;
        
        // Position for point/spot lights
        fm_vec3_t position;
        
        // Direction for directional/spot lights
        fm_vec3_t direction;
        
        // Range/angle for point/spot lights
        float range;        // Point light range
        float innerAngle;   // Spot light inner angle (radians)
        float outerAngle;   // Spot light outer angle (radians)
        
        // Shadow parameters
        bool castsShadows;
        float shadowBias;
        
        // Padding for alignment
        uint8_t padding[3];
    };
    
    /**
     * Material structure for deferred rendering
     */
    struct MaterialData
    {
        color_t baseColor;
        float roughness;
        float metallic;
        float emissiveIntensity;
        
        // Cartoon shading parameters
        uint8_t shadeBands;
        color_t outlineColor;
        float outlineThreshold;
        
        // Texture IDs (0 = no texture)
        uint16_t albedoTextureId;
        uint16_t normalTextureId;
        uint16_t roughnessTextureId;
        
        // Flags
        bool isTransparent : 1;
        bool isCutout : 1;
        bool isEmissive : 1;
        bool receivesShadows : 1;
        
        uint8_t padding[3];
    };
    
    /**
     * Deferred rendering pipeline implementation
     */
    class RenderPipelineDeferred final : public RenderPipeline
    {
    private:
        // G-buffer for deferred rendering
        GBuffer* gBuffer;
        
        // Lighting buffer (final output before post-process)
        surface_t lightingBuffer;
        
        // Light list (max 8 dynamic lights + 1 directional)
        static constexpr uint32_t MAX_LIGHTS = 9;
        LightData lights[MAX_LIGHTS];
        uint32_t lightCount;
        
        // Material database
        static constexpr uint32_t MAX_MATERIALS = 64;
        MaterialData materials[MAX_MATERIALS];
        uint32_t materialCount;
        
        // Tile-based lighting data
        struct TileLightList
        {
            uint8_t lightIndices[8]; // Max 8 lights per tile
            uint8_t lightCount;
            uint8_t padding[3];
        };
        
        TileLightList* tileLightLists;
        
        // ECS coordinator for rendering
        ECS::Coordinator* ecsCoordinator;
        
        // Job system for parallel processing
        JobSystem* jobSystem;
        
        // Performance counters
        uint64_t geometryPassTime;
        uint64_t lightingPassTime;
        uint64_t postProcessTime;
        uint32_t triangleCount;
        uint32_t visibleTileCount;
        
        // Configuration
        struct Config
        {
            bool enableShadows : 1;
            bool enableBloom : 1;
            bool enableMotionBlur : 1;
            bool enableAntiAliasing : 1;
            bool enableTileCulling : 1;
            bool enableEarlyZ : 1;
            
            uint8_t shadowQuality; // 0=off, 1=low, 2=medium, 3=high
            uint8_t msaaLevel;     // 0=off, 1=2x, 2=4x
            
            uint16_t padding;
        } config;
        
    public:
        RenderPipelineDeferred(Scene &sc, ECS::Coordinator* coordinator = nullptr, JobSystem* jobs = nullptr);
        ~RenderPipelineDeferred() override;
        
        // No copy/move
        RenderPipelineDeferred(const RenderPipelineDeferred&) = delete;
        RenderPipelineDeferred& operator=(const RenderPipelineDeferred&) = delete;
        RenderPipelineDeferred(RenderPipelineDeferred&&) = delete;
        RenderPipelineDeferred& operator=(RenderPipelineDeferred&&) = delete;
        
        /**
         * Initialize deferred rendering pipeline
         */
        void init() override;
        
        /**
         * Pre-draw setup (called before geometry pass)
         */
        void preDraw() override;
        
        /**
         * Main draw function (executes full deferred pipeline)
         */
        void draw() override;
        
        /**
         * Add light to the scene
         * @return Light ID or -1 if max lights reached
         */
        int32_t addLight(const LightData& light);
        
        /**
         * Remove light from the scene
         */
        void removeLight(uint32_t lightId);
        
        /**
         * Update existing light
         */
        void updateLight(uint32_t lightId, const LightData& light);
        
        /**
         * Add material to the database
         * @return Material ID or -1 if max materials reached
         */
        int32_t addMaterial(const MaterialData& material);
        
        /**
         * Get material by ID
         */
        [[nodiscard]] const MaterialData* getMaterial(uint32_t materialId) const;
        
        /**
         * Update material
         */
        void updateMaterial(uint32_t materialId, const MaterialData& material);
        
        /**
         * Get performance counters
         */
        [[nodiscard]] uint64_t getGeometryPassTime() const { return geometryPassTime; }
        [[nodiscard]] uint64_t getLightingPassTime() const { return lightingPassTime; }
        [[nodiscard]] uint64_t getPostProcessTime() const { return postProcessTime; }
        [[nodiscard]] uint32_t getTriangleCount() const { return triangleCount; }
        [[nodiscard]] uint32_t getVisibleTileCount() const { return visibleTileCount; }
        
        /**
         * Get configuration
         */
        [[nodiscard]] const Config& getConfig() const { return config; }
        
        /**
         * Update configuration
         */
        void setConfig(const Config& newConfig) { config = newConfig; }
        
        /**
         * Debug: Visualize G-buffer channels
         */
        void debugVisualizeGBuffer(uint8_t channel);
        
        /**
         * Debug: Toggle wireframe mode
         */
        void debugToggleWireframe();
        
    private:
        /**
         * Execute geometry pass (fill G-buffer)
         */
        void executeGeometryPass();
        
        /**
         * Execute lighting pass (deferred shading)
         */
        void executeLightingPass();
        
        /**
         * Execute post-processing pass
         */
        void executePostProcessPass();
        
        /**
         * Build tile light lists (assign lights to tiles)
         */
        void buildTileLightLists();
        
        /**
         * Cull lights against tiles (frustum culling)
         */
        void cullLightsPerTile();
        
        /**
         * Render geometry for a specific tile
         */
        void renderGeometryTile(uint8_t tileX, uint8_t tileY);
        
        /**
         * Render lighting for a specific tile
         */
        void renderLightingTile(uint8_t tileX, uint8_t tileY);
        
        /**
         * Apply cartoon banding to lighting result
         */
        void applyCartoonBanding(surface_t* target);
        
        /**
         * Apply outline effect (cel-shading)
         */
        void applyOutlineEffect(surface_t* target);
        
        /**
         * Setup RDP state for geometry pass
         */
        void setupRDPStateGeometry();
        
        /**
         * Setup RDP state for lighting pass
         */
        void setupRDPStateLighting();
        
        /**
         * Setup RDP state for post-processing
         */
        void setupRDPStatePostProcess();
        
        /**
         * Update performance counters
         */
        void updatePerformanceCounters();
        
        /**
         * Reset performance counters for new frame
         */
        void resetPerformanceCounters();
    };
    
    /**
     * ECS Components for deferred rendering
     */
    namespace ECSComponents
    {
        /**
         * Renderable component for deferred pipeline
         */
        struct DeferredRenderable
        {
            uint32_t materialId;
            uint32_t meshId;
            bool castsShadows;
            bool receivesShadows;
            uint8_t lodLevel; // 0=highest, 3=lowest
            
            // Bounding sphere for culling
            fm_vec3_t boundingCenter;
            float boundingRadius;
            
            // Instance data (for instanced rendering)
            uint32_t instanceCount;
            void* instanceData; // Transform matrices
            
            uint8_t padding[3];
        };
        
        /**
         * Light component for deferred pipeline
         */
        struct DeferredLight
        {
            uint32_t lightId; // Reference to light in pipeline
            bool isActive;
            
            uint8_t padding[3];
        };
    }
    
    /**
     * ECS Systems for deferred rendering
     */
    namespace ECSSystems
    {
        /**
         * Geometry rendering system
         * Processes DeferredRenderable components and renders to G-buffer
         */
        class GeometryRenderSystem : public ECS::System
        {
        private:
            RenderPipelineDeferred* pipeline;
            
        public:
            explicit GeometryRenderSystem(RenderPipelineDeferred* pipe) : pipeline(pipe) {}
            
            void update(ECS::Coordinator& coordinator) override
            {
                // This would iterate through DeferredRenderable components
                // and queue them for rendering in the geometry pass
            }
        };
        
        /**
         * Light management system
         * Processes DeferredLight components and updates light data in pipeline
         */
        class LightManagementSystem : public ECS::System
        {
        private:
            RenderPipelineDeferred* pipeline;
            
        public:
            explicit LightManagementSystem(RenderPipelineDeferred* pipe) : pipeline(pipe) {}
            
            void update(ECS::Coordinator& coordinator) override
            {
                // This would iterate through DeferredLight components
                // and update light positions/directions in the pipeline
            }
        };
        
        /**
         * Culling system
         * Performs frustum and occlusion culling for renderable entities
         */
        class CullingSystem : public ECS::System
        {
        private:
            RenderPipelineDeferred* pipeline;
            
        public:
            explicit CullingSystem(RenderPipelineDeferred* pipe) : pipeline(pipe) {}
            
            void update(ECS::Coordinator& coordinator) override
            {
                // This would perform culling and mark entities as visible/invisible
            }
        };
    }
}