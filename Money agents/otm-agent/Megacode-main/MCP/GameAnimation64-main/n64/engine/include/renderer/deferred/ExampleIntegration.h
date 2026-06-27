/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Example integration of deferred rendering pipeline with existing systems
 */
#pragma once

#include "./Common.h"
#include "./DeferredPipeline.h"
#include "../../ecs/Coordinator.h"
#include "../../jobs/JobSystem.h"
#include "../../memory/MemoryManager.h"

namespace P64::Deferred::Example
{
    /**
     * Example scene setup using deferred rendering
     */
    class ExampleDeferredScene
    {
    private:
        // Core systems
        ECS::Coordinator ecsCoordinator;
        JobSystem jobSystem;
        MemoryManager memoryManager;
        
        // Deferred pipeline
        RenderPipelineDeferred* deferredPipeline;
        
        // Scene entities
        ECS::Entity cameraEntity;
        ECS::Entity directionalLightEntity;
        std::vector<ECS::Entity> objectEntities;
        std::vector<ECS::Entity> pointLightEntities;
        
    public:
        ExampleDeferredScene();
        ~ExampleDeferredScene();
        
        /**
         * Initialize example scene
         */
        void init();
        
        /**
         * Update scene (called each frame)
         */
        void update(float deltaTime);
        
        /**
         * Render scene using deferred pipeline
         */
        void render();
        
        /**
         * Get performance statistics
         */
        void printPerformanceStats() const;
        
    private:
        /**
         * Setup ECS components and systems
         */
        void setupECS();
        
        /**
         * Create example camera
         */
        void createCamera();
        
        /**
         * Create example directional light
         */
        void createDirectionalLight();
        
        /**
         * Create example point lights
         */
        void createPointLights();
        
        /**
         * Create example objects with materials
         */
        void createObjects();
        
        /**
         * Create example materials
         */
        void createMaterials();
        
        /**
         * Setup deferred pipeline configuration
         */
        void setupPipelineConfig();
    };
    
    /**
     * Example ECS components for deferred rendering
     */
    struct ExampleTransform
    {
        fm_vec3_t position;
        fm_quat_t rotation;
        fm_vec3_t scale;
        
        uint8_t padding[4];
    };
    
    struct ExampleMesh
    {
        uint32_t meshId;
        uint32_t vertexCount;
        uint32_t triangleCount;
        
        uint8_t padding[4];
    };
    
    /**
     * Example ECS systems for deferred rendering
     */
    class ExampleRenderSystem : public ECS::System
    {
    private:
        RenderPipelineDeferred* pipeline;
        
    public:
        explicit ExampleRenderSystem(RenderPipelineDeferred* pipe) : pipeline(pipe) {}
        
        void update(ECS::Coordinator& coordinator) override
        {
            auto view = coordinator.view<ExampleTransform, ExampleMesh, ECSComponents::DeferredRenderable>();
            
            for (auto entity : view)
            {
                auto& transform = coordinator.getComponent<ExampleTransform>(entity);
                auto& mesh = coordinator.getComponent<ExampleMesh>(entity);
                auto& renderable = coordinator.getComponent<ECSComponents::DeferredRenderable>(entity);
                
                // In a real implementation, this would:
                // 1. Perform frustum culling
                // 2. Update renderable bounding volumes
                // 3. Queue objects for rendering
                // 4. Handle LOD selection
            }
        }
    };
    
    class ExampleLightSystem : public ECS::System
    {
    private:
        RenderPipelineDeferred* pipeline;
        
    public:
        explicit ExampleLightSystem(RenderPipelineDeferred* pipe) : pipeline(pipe) {}
        
        void update(ECS::Coordinator& coordinator) override
        {
            auto view = coordinator.view<ExampleTransform, ECSComponents::DeferredLight>();
            
            for (auto entity : view)
            {
                auto& transform = coordinator.getComponent<ExampleTransform>(entity);
                auto& light = coordinator.getComponent<ECSComponents::DeferredLight>(entity);
                
                if (light.isActive)
                {
                    // Update light position/direction in pipeline
                    LightData lightData;
                    // ... populate lightData from transform and light component
                    
                    pipeline->updateLight(light.lightId, lightData);
                }
            }
        }
    };
    
    /**
     * Example usage of deferred rendering pipeline
     */
    void exampleUsage()
    {
        Log::info("Starting deferred rendering example");
        
        // Initialize core systems
        MemoryManager::init();
        JobSystem::init(4); // 4 worker threads
        
        // Create ECS coordinator
        ECS::Coordinator coordinator;
        
        // Register components
        coordinator.registerComponent<ExampleTransform>();
        coordinator.registerComponent<ExampleMesh>();
        coordinator.registerComponent<ECSComponents::DeferredRenderable>();
        coordinator.registerComponent<ECSComponents::DeferredLight>();
        
        // Create deferred pipeline
        // Note: Scene reference would come from actual scene system
        Scene* exampleScene = nullptr; // Would be initialized from scene manager
        RenderPipelineDeferred pipeline(*exampleScene, &coordinator, JobSystem::getInstance());
        
        // Initialize pipeline
        pipeline.init();
        
        // Create example materials
        MaterialData cartoonMaterial;
        cartoonMaterial.baseColor = { 255, 200, 100, 255 };
        cartoonMaterial.roughness = 0.8f;
        cartoonMaterial.metallic = 0.0f;
        cartoonMaterial.emissiveIntensity = 0.0f;
        cartoonMaterial.shadeBands = 3;
        cartoonMaterial.outlineColor = { 0, 0, 0, 255 };
        cartoonMaterial.outlineThreshold = 0.1f;
        cartoonMaterial.isTransparent = false;
        cartoonMaterial.isCutout = false;
        cartoonMaterial.isEmissive = false;
        cartoonMaterial.receivesShadows = true;
        
        int32_t materialId = pipeline.addMaterial(cartoonMaterial);
        
        if (materialId >= 0)
        {
            Log::info("Created cartoon material with ID: %d", materialId);
        }
        
        // Create example directional light
        LightData sunLight;
        sunLight.type = LightData::DIRECTIONAL;
        sunLight.color = { 255, 255, 255, 255 };
        sunLight.intensity = 1.0f;
        sunLight.direction = { 0.5f, -1.0f, 0.5f };
        sunLight.castsShadows = true;
        sunLight.shadowBias = 0.001f;
        
        int32_t lightId = pipeline.addLight(sunLight);
        
        if (lightId >= 0)
        {
            Log::info("Created directional light with ID: %d", lightId);
        }
        
        // Configure pipeline
        RenderPipelineDeferred::Config config;
        config.enableShadows = true;
        config.enableBloom = true;
        config.enableMotionBlur = false;
        config.enableAntiAliasing = true;
        config.enableTileCulling = true;
        config.enableEarlyZ = true;
        config.shadowQuality = 2; // Medium
        config.msaaLevel = 0; // No MSAA (deferred doesn't need it)
        
        pipeline.setConfig(config);
        
        Log::info("Deferred pipeline configured and ready");
        
        // Example render loop
        for (int frame = 0; frame < 100; ++frame)
        {
            // Update scene (would update transforms, animations, etc.)
            
            // Pre-draw setup
            pipeline.preDraw();
            
            // Execute rendering
            pipeline.draw();
            
            // Get performance stats
            uint64_t geometryTime = pipeline.getGeometryPassTime();
            uint64_t lightingTime = pipeline.getLightingPassTime();
            uint64_t postProcessTime = pipeline.getPostProcessTime();
            uint32_t triangleCount = pipeline.getTriangleCount();
            
            if (frame % 30 == 0)
            {
                Log::info("Frame %d: Geometry=%lluµs, Lighting=%lluµs, Post=%lluµs, Tris=%d",
                         frame, geometryTime, lightingTime, postProcessTime, triangleCount);
            }
        }
        
        Log::info("Deferred rendering example completed");
    }
    
    /**
     * Performance comparison: Forward vs Deferred
     */
    void performanceComparison()
    {
        Log::info("=== Performance Comparison: Forward vs Deferred ===");
        
        // Test scenarios
        const uint32_t testScenes[] = { 100, 500, 1000, 2000 };
        const uint32_t testLights[] = { 1, 4, 8 };
        
        for (auto triangles : testScenes)
        {
            for (auto lights : testLights)
            {
                Log::info("Scene: %d triangles, %d lights", triangles, lights);
                
                // Forward rendering cost: O(triangles * lights)
                uint32_t forwardCost = triangles * lights;
                
                // Deferred rendering cost: O(triangles + pixels * lights)
                // Assuming 320x240 = 76,800 pixels
                uint32_t deferredCost = triangles + (76800 * lights / 100); // Approximate
                
                float speedup = static_cast<float>(forwardCost) / deferredCost;
                
                Log::info("  Forward: %u ops, Deferred: %u ops, Speedup: %.2fx",
                         forwardCost, deferredCost, speedup);
                
                if (speedup > 1.0f)
                {
                    Log::info("  -> Deferred is %.0f%% faster", (speedup - 1.0f) * 100.0f);
                }
                else
                {
                    Log::info("  -> Forward is %.0f%% faster", (1.0f / speedup - 1.0f) * 100.0f);
                }
            }
        }
        
        Log::info("=== Comparison Complete ===");
        Log::info("Note: Deferred rendering excels with many lights and complex materials");
        Log::info("Forward rendering better for simple scenes with few lights");
    }
    
    /**
     * Migration guide from forward to deferred rendering
     */
    void migrationGuide()
    {
        Log::info("=== Migration Guide: Forward to Deferred ===");
        
        Log::info("1. Update scene configuration:");
        Log::info("   - Change pipeline type to DEFERRED");
        Log::info("   - Adjust memory budget for G-buffer");
        
        Log::info("2. Update materials:");
        Log::info("   - Convert forward materials to PBR-inspired cartoon materials");
        Log::info("   - Add roughness/metallic parameters");
        Log::info("   - Configure cartoon banding settings");
        
        Log::info("3. Update lighting:");
        Log::info("   - Convert lights to deferred light structures");
        Log::info("   - Configure shadow settings");
        Log::info("   - Set light ranges and angles");
        
        Log::info("4. Update rendering code:");
        Log::info("   - Replace forward render calls with deferred pipeline");
        Log::info("   - Update culling for tile-based rendering");
        Log::info("   - Adjust post-processing chain");
        
        Log::info("5. Performance tuning:");
        Log::info("   - Enable/disable features based on performance");
        Log::info("   - Adjust tile size for optimal performance");
        Log::info("   - Configure LOD system for distance culling");
        
        Log::info("=== Migration Complete ===");
        Log::info("Benefits:");
        Log::info("  - Support for more lights (8+ vs 1-2 in forward)");
        Log::info("  - Complex materials with less performance cost");
        Log::info("  - Better scalability with scene complexity");
        Log::info("  - Advanced effects (SSAO, motion blur, etc.)");
        
        Log::info("Trade-offs:");
        Log::info("  - Higher memory usage (G-buffer)");
        Log::info("  - Transparency requires special handling");
        Log::info("  - MSAA not compatible (use other anti-aliasing)");
    }
}