/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Integration system for connecting deferred rendering pipeline
 * with existing ECS and scene systems
 */
#pragma once

#include "./Common.h"
#include "../../ecs/Coordinator.h"
#include "../../ecs/example/TransformComponent.h"
#include "../../scene/scene.h"
#include "./DeferredPipeline.h"
#include "./shadows/ShadowMapping.h"
#include "./MaterialSystem.h"
#include "./ParticleSystem.h"

namespace P64::Deferred::Integration
{
    /**
     * ECS components for deferred rendering integration
     */
    namespace ECSComponents
    {
        /**
         * Deferred renderable component
         * Extends basic transform with deferred-specific data
         */
        struct DeferredRenderable
        {
            uint32_t materialId;        // Material ID from MaterialManager
            uint32_t meshId;            // Mesh ID from asset system
            uint32_t instanceId;        // Instance ID for instanced rendering
            
            // Rendering flags
            bool isVisible : 1;         // Object is visible
            bool castsShadows : 1;      // Object casts shadows
            bool receivesShadows : 1;   // Object receives shadows
            bool isStatic : 1;          // Object doesn't move (optimization)
            bool isTransparent : 1;     // Object uses transparency
            bool isEmissive : 1;        // Object emits light
            
            // LOD information
            uint8_t lodLevel;           // Current LOD level (0 = highest)
            float lodDistance;          // Distance for LOD switching
            
            // Bounding volume for culling
            fm_vec3_t boundingCenter;   // Bounding sphere center
            float boundingRadius;       // Bounding sphere radius
            
            // Instance data (for instanced rendering)
            uint32_t instanceCount;     // Number of instances
            void* instanceData;         // Instance transform data
            
            uint8_t padding[10];
        };
        
        /**
         * Deferred light component
         * Connects ECS entities with deferred pipeline lights
         */
        struct DeferredLight
        {
            uint32_t lightId;           // Light ID in deferred pipeline
            LightData::Type lightType;  // Light type
            
            // Dynamic properties
            color_t color;              // Light color
            float intensity;            // Light intensity
            float range;                // Light range (point/spot)
            float angle;                // Light angle (spot)
            
            // Shadow configuration
            bool castsShadows : 1;      // Light casts shadows
            bool isEnabled : 1;         // Light is enabled
            bool isDynamic : 1;         // Light moves/changes
            
            // Performance optimization
            float importance;           // Light importance for culling
            uint32_t lastVisibleFrame;  // Last frame light was visible
            
            uint8_t padding[10];
        };
        
        /**
         * Deferred camera component
         * Camera settings for deferred rendering
         */
        struct DeferredCamera
        {
            // Camera properties
            float fov;                  // Field of view (radians)
            float nearPlane;            // Near clipping plane
            float farPlane;             // Far clipping plane
            
            // Deferred rendering settings
            bool enableDeferred : 1;    // Use deferred rendering
            bool enableShadows : 1;     // Enable shadow mapping
            bool enableBloom : 1;       // Enable bloom/HDR
            bool enableAA : 1;          // Enable anti-aliasing
            
            // Performance settings
            uint8_t shadowQuality;      // Shadow quality level
            uint8_t textureQuality;     // Texture quality level
            
            // View frustum for culling
            fm_vec4_t frustumPlanes[6]; // View frustum planes
            
            uint8_t padding[10];
        };
        
        /**
         * Particle system component
         * Connects ECS entities with particle systems
         */
        struct ParticleSystemComponent
        {
            uint32_t systemId;          // Particle system ID
            Particles::EmitterConfig config; // Emitter configuration
            
            // Runtime state
            bool isActive : 1;          // System is active
            bool isLooping : 1;         // System loops continuously
            bool isWorldSpace : 1;      // Particles in world space
            
            // Emission control
            float emitTimer;            // Timer for rate-based emission
            uint32_t burstCount;        // Particles to emit in burst
            
            // Performance
            uint32_t maxParticles;      // Maximum particles allowed
            float distanceScale;        // Distance-based scaling
            
            uint8_t padding[10];
        };
    }
    
    /**
     * ECS systems for deferred rendering integration
     */
    namespace ECSSystems
    {
        /**
         * Deferred rendering system
         * Main system that coordinates deferred pipeline with ECS
         */
        class DeferredRenderingSystem : public ECS::System
        {
        private:
            // Core systems
            RenderPipelineDeferred* deferredPipeline;
            Shadows::ShadowManager* shadowManager;
            Materials::MaterialManager* materialManager;
            Particles::ParticleSystemManager* particleManager;
            
            // Scene reference
            Scene* scene;
            
            // Performance tracking
            uint64_t frameTime;
            uint32_t visibleObjects;
            uint32_t visibleLights;
            
        public:
            DeferredRenderingSystem(RenderPipelineDeferred* pipeline,
                                  Shadows::ShadowManager* shadows,
                                  Materials::MaterialManager* materials,
                                  Particles::ParticleSystemManager* particles,
                                  Scene* sceneRef);
            
            void update(ECS::Coordinator& coordinator) override;
            
            /**
             * Execute full deferred rendering frame
             */
            void renderFrame(ECS::Coordinator& coordinator);
            
            /**
             * Get performance statistics
             */
            [[nodiscard]] uint64_t getFrameTime() const { return frameTime; }
            [[nodiscard]] uint32_t getVisibleObjects() const { return visibleObjects; }
            [[nodiscard]] uint32_t getVisibleLights() const { return visibleLights; }
            
            /**
             * Reset performance counters
             */
            void resetPerformanceCounters();
            
        private:
            /**
             * Update camera from ECS
             */
            void updateCamera(ECS::Coordinator& coordinator);
            
            /**
             * Update lights from ECS
             */
            void updateLights(ECS::Coordinator& coordinator);
            
            /**
             * Update materials from ECS
             */
            void updateMaterials(ECS::Coordinator& coordinator);
            
            /**
             * Update particle systems from ECS
             */
            void updateParticleSystems(ECS::Coordinator& coordinator);
            
            /**
             * Perform frustum culling
             */
            void performFrustumCulling(ECS::Coordinator& coordinator);
            
            /**
             * Perform occlusion culling
             */
            void performOcclusionCulling(ECS::Coordinator& coordinator);
            
            /**
             * Perform LOD selection
             */
            void performLODSelection(ECS::Coordinator& coordinator);
            
            /**
             * Sort renderables for efficient rendering
             */
            void sortRenderables(ECS::Coordinator& coordinator);
            
            /**
             * Batch renderables for instanced rendering
             */
            void batchRenderables(ECS::Coordinator& coordinator);
        };
        
        /**
         * Shadow update system
         * Updates shadow maps based on light and camera positions
         */
        class ShadowUpdateSystem : public ECS::System
        {
        private:
            Shadows::ShadowManager* shadowManager;
            Scene* scene;
            
        public:
            ShadowUpdateSystem(Shadows::ShadowManager* shadows, Scene* sceneRef);
            
            void update(ECS::Coordinator& coordinator) override;
            
        private:
            /**
             * Update directional light shadows
             */
            void updateDirectionalShadows(ECS::Coordinator& coordinator);
            
            /**
             * Update point light shadows
             */
            void updatePointLightShadows(ECS::Coordinator& coordinator);
            
            /**
             * Update spot light shadows
             */
            void updateSpotLightShadows(ECS::Coordinator& coordinator);
            
            /**
             * Cull lights for shadow rendering
             */
            void cullLightsForShadows(ECS::Coordinator& coordinator);
        };
        
        /**
         * Material update system
         * Updates material states and manages texture streaming
         */
        class MaterialUpdateSystem : public ECS::System
        {
        private:
            Materials::MaterialManager* materialManager;
            
        public:
            explicit MaterialUpdateSystem(Materials::MaterialManager* materials);
            
            void update(ECS::Coordinator& coordinator) override;
            
        private:
            /**
             * Update material LOD based on distance
             */
            void updateMaterialLOD(ECS::Coordinator& coordinator);
            
            /**
             * Stream textures based on visibility
             */
            void streamTextures(ECS::Coordinator& coordinator);
            
            /**
             * Update material animation (if any)
             */
            void updateMaterialAnimation(ECS::Coordinator& coordinator);
        };
        
        /**
         * Particle update system
         * Updates particle systems and handles emission
         */
        class ParticleUpdateSystem : public ECS::System
        {
        private:
            Particles::ParticleSystemManager* particleManager;
            
        public:
            explicit ParticleUpdateSystem(Particles::ParticleSystemManager* particles);
            
            void update(ECS::Coordinator& coordinator) override;
            
        private:
            /**
             * Update particle emission
             */
            void updateParticleEmission(ECS::Coordinator& coordinator);
            
            /**
             * Update particle simulation
             */
            void updateParticleSimulation(ECS::Coordinator& coordinator);
            
            /**
             * Handle particle collisions
             */
            void handleParticleCollisions(ECS::Coordinator& coordinator);
        };
    }
    
    /**
     * Integration manager
     * Main class that connects all deferred rendering systems
     */
    class IntegrationManager
    {
    private:
        // Core systems
        ECS::Coordinator* ecsCoordinator;
        RenderPipelineDeferred* deferredPipeline;
        Shadows::ShadowManager* shadowManager;
        Materials::MaterialManager* materialManager;
        Particles::ParticleSystemManager* particleManager;
        
        // ECS systems
        ECSSystems::DeferredRenderingSystem* renderingSystem;
        ECSSystems::ShadowUpdateSystem* shadowUpdateSystem;
        ECSSystems::MaterialUpdateSystem* materialUpdateSystem;
        ECSSystems::ParticleUpdateSystem* particleUpdateSystem;
        
        // Scene reference
        Scene* scene;
        
        // Configuration
        struct Config
        {
            bool enableDeferred : 1;
            bool enableShadows : 1;
            bool enableParticles : 1;
            bool enableMaterials : 1;
            bool enableCulling : 1;
            bool enableInstancing : 1;
            
            uint8_t maxLights;          // Maximum active lights
            uint8_t shadowQuality;      // Global shadow quality
            uint8_t textureQuality;     // Global texture quality
            
            uint16_t padding;
        } config;
        
        // Performance tracking
        uint64_t totalFrameTime;
        uint32_t totalFrames;
        uint32_t averageTriangleCount;
        
    public:
        IntegrationManager(Scene* sceneRef,
                          ECS::Coordinator* coordinator = nullptr,
                          JobSystem* jobSystem = nullptr);
        ~IntegrationManager();
        
        /**
         * Initialize integration manager
         */
        void init();
        
        /**
         * Update all systems (called each frame)
         * @param deltaTime Time since last frame
         */
        void update(float deltaTime);
        
        /**
         * Render frame using deferred pipeline
         */
        void render();
        
        /**
         * Register ECS components
         */
        void registerECSComponents();
        
        /**
         * Create ECS systems
         */
        void createECSSystems();
        
        /**
         * Setup default scene with deferred rendering
         */
        void setupDefaultScene();
        
        /**
         * Convert existing scene objects to deferred rendering
         */
        void convertSceneToDeferred();
        
        /**
         * Get configuration
         */
        [[nodiscard]] const Config& getConfig() const { return config; }
        
        /**
         * Update configuration
         */
        void setConfig(const Config& newConfig);
        
        /**
         * Get performance statistics
         */
        void getPerformanceStats(uint64_t& avgFrameTime,
                                uint32_t& avgTriangles,
                                uint32_t& avgObjects,
                                uint32_t& avgLights) const;
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Debug: Dump integration state
         */
        void debugDumpState() const;
        
        /**
         * Debug: Visualize rendering pipeline
         */
        void debugVisualizePipeline(surface_t* target) const;
        
    private:
        /**
         * Initialize deferred pipeline
         */
        void initDeferredPipeline();
        
        /**
         * Initialize shadow manager
         */
        void initShadowManager();
        
        /**
         * Initialize material manager
         */
        void initMaterialManager();
        
        /**
         * Initialize particle manager
         */
        void initParticleManager();
        
        /**
         * Create default materials
         */
        void createDefaultMaterials();
        
        /**
         * Create default lights
         */
        void createDefaultLights();
        
        /**
         * Setup camera for deferred rendering
         */
        void setupDeferredCamera();
        
        /**
         * Update performance tracking
         */
        void updatePerformanceTracking();
    };
    
    /**
     * Migration utilities for converting from forward to deferred rendering
     */
    namespace Migration
    {
        /**
         * Convert forward material to deferred material
         * @param forwardMaterial Forward rendering material
         * @param materialManager Material manager for deferred
         * @return Deferred material ID or -1 if failed
         */
        [[nodiscard]] int32_t convertMaterial(const void* forwardMaterial,
                                             Materials::MaterialManager* materialManager);
        
        /**
         * Convert forward light to deferred light
         * @param forwardLight Forward rendering light
         * @param deferredPipeline Deferred pipeline
         * @return Deferred light ID or -1 if failed
         */
        [[nodiscard]] int32_t convertLight(const void* forwardLight,
                                          RenderPipelineDeferred* deferredPipeline);
        
        /**
         * Convert forward object to deferred renderable
         * @param forwardObject Forward rendering object
         * @param ecsCoordinator ECS coordinator
         * @param materialId Deferred material ID
         * @return ECS entity ID or -1 if failed
         */
        [[nodiscard]] ECS::Entity convertObject(const void* forwardObject,
                                               ECS::Coordinator* ecsCoordinator,
                                               uint32_t materialId);
        
        /**
         * Convert entire scene from forward to deferred rendering
         * @param scene Scene to convert
         * @param integrationManager Integration manager
         * @return True if conversion successful
         */
        [[nodiscard]] bool convertScene(Scene* scene,
                                       IntegrationManager* integrationManager);
        
        /**
         * Create compatibility layer for mixed rendering
         * Allows forward and deferred rendering to coexist
         */
        class CompatibilityLayer
        {
        private:
            IntegrationManager* deferredManager;
            Scene* scene;
            
            // Forward rendering fallback for unsupported features
            bool useForwardFallback;
            
        public:
            CompatibilityLayer(IntegrationManager* manager, Scene* sceneRef);
            
            /**
             * Render object using appropriate pipeline
             */
            void renderObject(ECS::Entity entity, const void* objectData);
            
            /**
             * Check if feature is supported in deferred pipeline
             */
            [[nodiscard]] bool isFeatureSupported(const char* featureName) const;
            
            /**
             * Get fallback rendering method for unsupported feature
             */
            [[nodiscard]] void* getFallbackRenderer(const char* featureName) const;
        };
    }
    
    /**
     * Example integration setup
     */
    namespace Example
    {
        /**
         * Setup complete deferred rendering pipeline with ECS
         */
        [[nodiscard]] IntegrationManager* setupDeferredPipeline(Scene* scene,
                                                               ECS::Coordinator* coordinator = nullptr,
                                                               JobSystem* jobSystem = nullptr);
        
        /**
         * Create example scene with deferred rendering
         */
        void createExampleScene(IntegrationManager* manager,
                               ECS::Coordinator* coordinator);
        
        /**
         * Run performance test on deferred pipeline
         */
        void runPerformanceTest(IntegrationManager* manager,
                               uint32_t frameCount = 300);
        
        /**
         * Compare forward vs deferred rendering
         */
        void compareRenderingMethods(Scene* scene,
                                    uint32_t testFrames = 60);
    }
}