/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Upgraded particle system with GPU acceleration and deferred rendering support
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include <t3d/tpx.h>
#include "./Common.h"
#include "../../ecs/Coordinator.h"
#include "../../jobs/JobSystem.h"
#include "../../memory/MemoryManager.h"

namespace P64::Deferred::Particles
{
    /**
     * Particle types for upgraded system
     */
    enum class ParticleType : uint8_t
    {
        BILLBOARD = 0,      // Standard 2D sprites (facing camera)
        MESH = 1,           // 3D geometry particles
        TRAIL = 2,          // Ribbon/beam effects
        DECAL = 3,          // Screen-space decals
        LIGHT = 4,          // Light-emitting particles
        VOLUMETRIC = 5      // Volumetric effects (fog, smoke)
    };
    
    /**
     * Particle simulation mode
     */
    enum class SimulationMode : uint8_t
    {
        CPU = 0,            // CPU simulation (compatibility)
        RSP = 1,            // RSP hardware acceleration
        HYBRID = 2          // CPU + RSP hybrid
    };
    
    /**
     * Particle physics parameters
     */
    struct PhysicsParams
    {
        fm_vec3_t gravity;          // Gravity force
        fm_vec3_t wind;             // Wind force
        float drag;                 // Air resistance
        float bounce;               // Bounce coefficient (0-1)
        float friction;             // Surface friction
        
        uint8_t padding[12];
    };
    
    /**
     * Particle emitter configuration
     */
    struct EmitterConfig
    {
        ParticleType type;
        SimulationMode simulation;
        
        // Emission properties
        uint32_t maxParticles;      // Maximum particles in system
        float emissionRate;         // Particles per second
        float lifetime;             // Particle lifetime in seconds
        float lifetimeVariance;     // Lifetime randomness
        
        // Initial properties
        fm_vec3_t initialVelocity;
        fm_vec3_t velocityVariance;
        fm_vec3_t initialScale;
        fm_vec3_t scaleVariance;
        color_t initialColor;
        color_t colorVariance;
        
        // Physics
        PhysicsParams physics;
        
        // Animation
        bool animateTexture;        // Sprite sheet animation
        uint16_t textureColumns;    // Columns in sprite sheet
        uint16_t textureRows;       // Rows in sprite sheet
        float animationSpeed;       // Frames per second
        
        // Deferred rendering integration
        bool castsShadows;          // Particles cast shadows
        bool receivesLighting;      // Particles receive deferred lighting
        bool isEmissive;            // Particles emit light
        float emissiveIntensity;    // Light emission intensity
        
        uint8_t padding[11];
    };
    
    /**
     * Particle data structure (optimized for RSP processing)
     */
    struct ParticleData
    {
        // Position and velocity (16 bytes)
        fm_vec3_t position;
        float age;                  // Current age (0 to lifetime)
        
        fm_vec3_t velocity;
        float lifetime;             // Total lifetime
        
        // Visual properties (16 bytes)
        fm_vec3_t scale;
        float rotation;
        
        color_t color;
        float alpha;                // Separate alpha for blending
        
        // Animation state (8 bytes)
        uint16_t frameIndex;        // Current sprite frame
        uint16_t randomSeed;        // Random seed for variations
        float animationTime;        // Animation timer
        
        uint8_t padding[4];
    };
    
    /**
     * Upgraded particle system with GPU acceleration
     */
    class ParticleSystem
    {
    private:
        // Core data
        ParticleData* particles;
        uint32_t particleCount;
        uint32_t maxParticles;
        
        // Emitter configuration
        EmitterConfig config;
        
        // Resources
        sprite_t* sprite;           // For billboard particles
        t3d_mesh_t* mesh;           // For mesh particles
        surface_t* texture;         // Particle texture
        
        // RSP acceleration
        void* rspCode;              // RSP microcode for particle simulation
        void* rspDataBuffer;        // Buffer for RSP particle data
        
        // Job system integration
        JobSystem* jobSystem;
        
        // Performance tracking
        uint64_t simulationTime;
        uint64_t renderTime;
        uint32_t particlesRendered;
        uint32_t particlesSimulated;
        
        // Deferred rendering integration
        bool integratedWithDeferred;
        uint32_t materialId;        // Material ID for deferred rendering
        
    public:
        ParticleSystem(const EmitterConfig& config, JobSystem* jobs = nullptr);
        ~ParticleSystem();
        
        // No copy/move
        ParticleSystem(const ParticleSystem&) = delete;
        ParticleSystem& operator=(const ParticleSystem&) = delete;
        ParticleSystem(ParticleSystem&&) = delete;
        ParticleSystem& operator=(ParticleSystem&&) = delete;
        
        /**
         * Initialize particle system
         */
        void init();
        
        /**
         * Update particle simulation
         * @param deltaTime Time since last update
         * @param emitterPosition Current emitter position
         */
        void update(float deltaTime, const fm_vec3_t& emitterPosition);
        
        /**
         * Render particles
         * @param deltaTime Time since last frame (for animation)
         */
        void render(float deltaTime);
        
        /**
         * Render particles with deferred rendering pipeline
         * @param gBuffer G-buffer to render to
         */
        void renderDeferred(GBuffer* gBuffer);
        
        /**
         * Emit new particles
         * @param count Number of particles to emit
         * @param position Emission position
         * @param direction Emission direction (optional)
         */
        void emit(uint32_t count, const fm_vec3_t& position, const fm_vec3_t& direction = {0, 0, 0});
        
        /**
         * Clear all particles
         */
        void clear();
        
        /**
         * Set emitter configuration
         */
        void setConfig(const EmitterConfig& newConfig);
        
        /**
         * Get current configuration
         */
        [[nodiscard]] const EmitterConfig& getConfig() const { return config; }
        
        /**
         * Set particle texture
         */
        void setTexture(sprite_t* newTexture);
        
        /**
         * Set particle mesh (for MESH type particles)
         */
        void setMesh(t3d_mesh_t* newMesh);
        
        /**
         * Get performance statistics
         */
        [[nodiscard]] uint64_t getSimulationTime() const { return simulationTime; }
        [[nodiscard]] uint64_t getRenderTime() const { return renderTime; }
        [[nodiscard]] uint32_t getParticlesRendered() const { return particlesRendered; }
        [[nodiscard]] uint32_t getParticlesSimulated() const { return particlesSimulated; }
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Enable/disable deferred rendering integration
         */
        void setDeferredIntegration(bool enabled) { integratedWithDeferred = enabled; }
        
        /**
         * Set material ID for deferred rendering
         */
        void setMaterialId(uint32_t id) { materialId = id; }
        
        /**
         * Debug: Visualize particle bounds
         */
        void debugVisualizeBounds();
        
        /**
         * Debug: Dump particle data to log
         */
        void debugDumpParticleData() const;
        
    private:
        /**
         * Simulate particles on CPU
         */
        void simulateCPU(float deltaTime, const fm_vec3_t& emitterPosition);
        
        /**
         * Simulate particles on RSP
         */
        void simulateRSP(float deltaTime, const fm_vec3_t& emitterPosition);
        
        /**
         * Simulate particles using hybrid approach
         */
        void simulateHybrid(float deltaTime, const fm_vec3_t& emitterPosition);
        
        /**
         * Render billboard particles
         */
        void renderBillboards(float deltaTime);
        
        /**
         * Render mesh particles
         */
        void renderMeshes(float deltaTime);
        
        /**
         * Render trail particles
         */
        void renderTrails(float deltaTime);
        
        /**
         * Render particles to G-buffer (deferred)
         */
        void renderToGBuffer(GBuffer* gBuffer);
        
        /**
         * Update particle animation
         */
        void updateParticleAnimation(ParticleData& particle, float deltaTime);
        
        /**
         * Apply physics to particle
         */
        void applyPhysics(ParticleData& particle, float deltaTime);
        
        /**
         * Check particle collisions
         */
        bool checkCollision(ParticleData& particle, float deltaTime);
        
        /**
         * Spawn new particle
         */
        void spawnParticle(const fm_vec3_t& position, const fm_vec3_t& direction);
        
        /**
         * Remove dead particle
         */
        void removeParticle(uint32_t index);
        
        /**
         * Load RSP microcode for particle simulation
         */
        void loadRSPMicrocode();
        
        /**
         * Setup RDP state for particle rendering
         */
        void setupRDPState(bool deferred = false) const;
        
        /**
         * Calculate particle bounding sphere
         */
        [[nodiscard]] bool calculateBoundingSphere(fm_vec3_t& center, float& radius) const;
    };
    
    /**
     * ECS Components for particle systems
     */
    namespace ECSComponents
    {
        /**
         * Particle emitter component
         */
        struct ParticleEmitter
        {
            uint32_t systemId;          // Reference to particle system
            bool isActive;              // Emitter active state
            bool isLooping;             // Continuous emission
            float emitTimer;            // Timer for rate-based emission
            
            fm_vec3_t position;         // Current emitter position
            fm_vec3_t velocity;         // Emitter movement velocity
            
            uint8_t padding[10];
        };
        
        /**
         * Particle receiver component (for particle collisions)
         */
        struct ParticleReceiver
        {
            bool receivesParticles;     // Can receive particle collisions
            float bounceFactor;         // Bounce coefficient (0-1)
            float frictionFactor;       // Friction coefficient (0-1)
            
            uint8_t padding[10];
        };
    }
    
    /**
     * ECS Systems for particle management
     */
    namespace ECSSystems
    {
        /**
         * Particle emission system
         * Manages particle emitters and spawns new particles
         */
        class ParticleEmissionSystem : public ECS::System
        {
        private:
            std::vector<ParticleSystem*>& particleSystems;
            
        public:
            explicit ParticleEmissionSystem(std::vector<ParticleSystem*>& systems)
                : particleSystems(systems) {}
            
            void update(ECS::Coordinator& coordinator) override
            {
                auto view = coordinator.view<ECSComponents::ParticleEmitter>();
                
                for (auto entity : view)
                {
                    auto& emitter = coordinator.getComponent<ECSComponents::ParticleEmitter>(entity);
                    
                    if (emitter.isActive && emitter.systemId < particleSystems.size())
                    {
                        ParticleSystem* system = particleSystems[emitter.systemId];
                        
                        // Update emitter position
                        emitter.position.x += emitter.velocity.x;
                        emitter.position.y += emitter.velocity.y;
                        emitter.position.z += emitter.velocity.z;
                        
                        // Emit particles based on timer
                        // (Implementation would calculate emission count based on rate)
                    }
                }
            }
        };
        
        /**
         * Particle simulation system
         * Updates particle physics and animation
         */
        class ParticleSimulationSystem : public ECS::System
        {
        private:
            std::vector<ParticleSystem*>& particleSystems;
            
        public:
            explicit ParticleSimulationSystem(std::vector<ParticleSystem*>& systems)
                : particleSystems(systems) {}
            
            void update(ECS::Coordinator& coordinator) override
            {
                float deltaTime = 1.0f / 60.0f; // Would come from frame timing
                
                for (auto system : particleSystems)
                {
                    if (system)
                    {
                        // Get emitter position from ECS
                        // (Would look up corresponding emitter entity)
                        fm_vec3_t emitterPosition = {0, 0, 0};
                        
                        system->update(deltaTime, emitterPosition);
                    }
                }
            }
        };
        
        /**
         * Particle collision system
         * Handles particle collisions with receivers
         */
        class ParticleCollisionSystem : public ECS::System
        {
        public:
            void update(ECS::Coordinator& coordinator) override
            {
                // This would check particle collisions with receiver entities
                // and apply bounce/friction physics
            }
        };
    }
    
    /**
     * Particle system manager
     * Manages multiple particle systems and provides global control
     */
    class ParticleSystemManager
    {
    private:
        std::vector<ParticleSystem*> systems;
        JobSystem* jobSystem;
        
        // Performance limits
        uint32_t maxTotalParticles;
        uint32_t maxSystems;
        
        // Memory management
        MemoryRegion memoryRegion;
        
    public:
        ParticleSystemManager(JobSystem* jobs = nullptr, 
                             uint32_t maxParticles = 4096, 
                             uint32_t maxSys = 16,
                             MemoryRegion region = MemoryRegion::RDRAM);
        ~ParticleSystemManager();
        
        /**
         * Create new particle system
         */
        [[nodiscard]] ParticleSystem* createSystem(const EmitterConfig& config);
        
        /**
         * Destroy particle system
         */
        void destroySystem(ParticleSystem* system);
        
        /**
         * Update all particle systems
         */
        void updateAll(float deltaTime);
        
        /**
         * Render all particle systems
         */
        void renderAll(float deltaTime);
        
        /**
         * Render all particle systems with deferred pipeline
         */
        void renderAllDeferred(GBuffer* gBuffer);
        
        /**
         * Clear all particle systems
         */
        void clearAll();
        
        /**
         * Get total particle count across all systems
         */
        [[nodiscard]] uint32_t getTotalParticleCount() const;
        
        /**
         * Get memory usage of all particle systems
         */
        [[nodiscard]] size_t getTotalMemoryUsage() const;
        
        /**
         * Set global particle limits
         */
        void setLimits(uint32_t maxParticles, uint32_t maxSys);
        
        /**
         * Get performance statistics
         */
        void getPerformanceStats(uint64_t& totalSimTime, uint64_t& totalRenderTime,
                                uint32_t& totalParticles) const;
        
        /**
         * Debug: Dump all system information
         */
        void debugDumpAllSystems() const;
    };
    
    /**
     * Example particle effects
     */
    namespace ExampleEffects
    {
        /**
         * Create fire effect
         */
        [[nodiscard]] EmitterConfig createFireEffect();
        
        /**
         * Create smoke effect
         */
        [[nodiscard]] EmitterConfig createSmokeEffect();
        
        /**
         * Create spark effect
         */
        [[nodiscard]] EmitterConfig createSparkEffect();
        
        /**
         * Create magic effect
         */
        [[nodiscard]] EmitterConfig createMagicEffect();
        
        /**
         * Create rain effect
         */
        [[nodiscard]] EmitterConfig createRainEffect();
        
        /**
         * Create snow effect
         */
        [[nodiscard]] EmitterConfig createSnowEffect();
    }
}