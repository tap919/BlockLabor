/**
 * Simple compilation test for deferred rendering pipeline
 * This verifies that all headers can be included together without conflicts
 */

// Test basic includes
#include "include/renderer/deferred/Common.h"
#include "include/renderer/deferred/GBuffer.h"
#include "include/renderer/deferred/DeferredPipeline.h"
#include "include/renderer/deferred/LightingSystem.h"
#include "include/renderer/deferred/MaterialSystem.h"
#include "include/renderer/deferred/shadows/ShadowMapping.h"
#include "include/renderer/deferred/ParticleSystem.h"
#include "include/renderer/deferred/IntegrationSystem.h"
#include "include/renderer/deferred/PerformanceTools.h"
#include "include/renderer/deferred/TestingFramework.h"
#include "include/renderer/deferred/ExampleIntegration.h"

// Mock types for compilation test
namespace P64 {
    class Scene {
    public:
        void render() {}
    };
    
    namespace Memory {
        class MemoryManager {
        public:
            void* allocate(size_t) { return nullptr; }
            void free(void*) {}
        };
    }
    
    namespace ECS {
        class Coordinator {
        public:
            template<typename T>
            void registerComponent() {}
            
            template<typename T>
            void registerSystem() {}
            
            P64::ECS::Entity createEntity() { return 0; }
            
            template<typename T>
            void addComponent(P64::ECS::Entity, const T&) {}
        };
        
        class System {
        public:
            virtual void update(Coordinator&) = 0;
            virtual ~System() = default;
        };
    }
    
    class JobSystem {
    public:
        void init() {}
        void shutdown() {}
    };
}

// Mock libdragon types
struct surface_t {};
struct sprite_t {};
struct t3d_mesh_t {};
struct rspq_block_t {};
struct color_t { uint8_t r, g, b, a; };
struct fm_vec3_t { float x, y, z; };
struct fm_quat_t { float x, y, z, w; };
struct fm_vec4_t { float x, y, z, w; };

// Mock debug types
namespace Debug {
    class Overlay {
    public:
        void addLine(const char*) {}
    };
}

// Mock logger
namespace Logger {
    void info(const char*) {}
    void warn(const char*) {}
    void error(const char*) {}
}

int main() {
    // Test that types can be instantiated
    P64::Deferred::MemoryRegion region = P64::Deferred::DEFAULT_MEMORY_REGION;
    
    // Test constants
    uint16_t width = P64::Deferred::SCREEN_WIDTH;
    uint16_t height = P64::Deferred::SCREEN_HEIGHT;
    uint8_t tilesX = P64::Deferred::TILES_X;
    uint8_t tilesY = P64::Deferred::TILES_Y;
    
    // Test performance targets
    uint64_t targetFrameTime = P64::Deferred::TARGET_FRAME_TIME_US;
    uint32_t targetTriangles = P64::Deferred::TARGET_TRIANGLES_PER_FRAME;
    
    // Test memory calculations
    size_t gbufferSize = P64::Deferred::GBUFFER_SIZE_BYTES;
    
    return 0;
}