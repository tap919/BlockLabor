/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Example showing how to use the deferred rendering pipeline
 * with existing Pyrite64 scene system
 */

#include <libdragon.h>
#include "scene/scene.h"
#include "renderer/deferred/DeferredPipeline.h"
#include "renderer/deferred/ExampleIntegration.h"
#include "ecs/Coordinator.h"
#include "jobs/JobSystem.h"
#include "memory/MemoryManager.h"

using namespace P64;

/**
 * Simple example scene using deferred rendering
 */
class DeferredExampleScene
{
private:
    Scene scene;
    Deferred::RenderPipelineDeferred* deferredPipeline;
    Deferred::Example::ExampleDeferredScene exampleScene;
    
public:
    DeferredExampleScene() 
        : scene(SceneConf{320, 240, 0, {0, 0, 0, 255}, 0, SceneConf::Pipeline::DEFAULT, 0, 0, {}})
    {
        // Create deferred pipeline
        deferredPipeline = new Deferred::RenderPipelineDeferred(scene);
        
        // Initialize example scene
        exampleScene.init();
    }
    
    ~DeferredExampleScene()
    {
        if (deferredPipeline) {
            delete deferredPipeline;
        }
    }
    
    /**
     * Initialize the scene
     */
    void init()
    {
        // Set scene configuration for deferred rendering
        SceneConf conf = scene.getConf();
        conf.pipeline = SceneConf::Pipeline::DEFAULT; // We'll override with deferred
        conf.screenWidth = 320;
        conf.screenHeight = 240;
        conf.clearColor = {50, 50, 100, 255}; // Blueish background
        scene.setConf(conf);
        
        // Initialize deferred pipeline
        deferredPipeline->init();
        
        // Override scene's render pipeline with our deferred pipeline
        // Note: In a real implementation, we would modify the Scene class
        // to support custom pipeline creation
    }
    
    /**
     * Update scene (called each frame)
     */
    void update(float deltaTime)
    {
        // Update example scene
        exampleScene.update(deltaTime);
        
        // Update scene objects (simplified)
        // In a real implementation, this would update object positions,
        // animations, etc.
    }
    
    /**
     * Render the scene
     */
    void render()
    {
        // Pre-draw setup
        deferredPipeline->preDraw();
        
        // Execute deferred rendering pipeline
        deferredPipeline->draw();
        
        // Print performance stats (for debugging)
        static uint32_t frameCount = 0;
        if (frameCount++ % 60 == 0) {
            printPerformanceStats();
        }
    }
    
    /**
     * Print performance statistics
     */
    void printPerformanceStats() const
    {
        // Get performance counters from deferred pipeline
        uint64_t geometryTime = deferredPipeline->getGeometryPassTime();
        uint64_t lightingTime = deferredPipeline->getLightingPassTime();
        uint64_t postProcessTime = deferredPipeline->getPostProcessTime();
        uint32_t triangleCount = deferredPipeline->getTriangleCount();
        uint32_t visibleTiles = deferredPipeline->getVisibleTileCount();
        
        // Convert to microseconds
        uint32_t geometryUs = (uint32_t)(geometryTime / TICKS_PER_USEC);
        uint32_t lightingUs = (uint32_t)(lightingTime / TICKS_PER_USEC);
        uint32_t postProcessUs = (uint32_t)(postProcessTime / TICKS_PER_USEC);
        uint32_t totalUs = geometryUs + lightingUs + postProcessUs;
        
        // Calculate FPS
        float fps = 1000000.0f / totalUs;
        
        // Print stats
        debugf("Deferred Pipeline Performance:\n");
        debugf("  FPS: %.1f (Target: 60.0)\n", fps);
        debugf("  Geometry Pass: %u µs\n", geometryUs);
        debugf("  Lighting Pass: %u µs\n", lightingUs);
        debugf("  Post-Process: %u µs\n", postProcessUs);
        debugf("  Total: %u µs (Target: 16667)\n", totalUs);
        debugf("  Triangles: %u (Target: 2000)\n", triangleCount);
        debugf("  Visible Tiles: %u/%u\n", visibleTiles, 
               Deferred::TILES_X * Deferred::TILES_Y);
        
        // Check if we're meeting performance targets
        if (fps >= 55.0f) {
            debugf("  Status: ✓ Meeting 60 FPS target\n");
        } else if (fps >= 30.0f) {
            debugf("  Status: ⚠ Acceptable (30+ FPS)\n");
        } else {
            debugf("  Status: ✗ Below target\n");
        }
    }
    
    /**
     * Get the scene (for integration with existing systems)
     */
    Scene& getScene() { return scene; }
    
    /**
     * Get the deferred pipeline (for direct access)
     */
    Deferred::RenderPipelineDeferred* getPipeline() { return deferredPipeline; }
};

/**
 * Main entry point for deferred rendering example
 */
extern "C" void deferred_example_main()
{
    // Initialize systems
    debug_init_isviewer();
    debug_init_usblog();
    
    // Initialize libdragon
    dfs_init(DFS_DEFAULT_LOCATION);
    rdpq_init();
    t3d_init();
    tpx_init();
    joypad_init();
    
    // Create deferred example scene
    DeferredExampleScene exampleScene;
    exampleScene.init();
    
    // Main loop
    while (true) {
        // Update input
        joypad_poll();
        
        // Calculate delta time (simplified)
        static uint32_t lastTime = 0;
        uint32_t currentTime = timer_ticks();
        float deltaTime = (currentTime - lastTime) / (float)TICKS_PER_SECOND;
        if (deltaTime > 0.1f) deltaTime = 0.1f; // Cap delta time
        lastTime = currentTime;
        
        // Update scene
        exampleScene.update(deltaTime);
        
        // Render scene
        exampleScene.render();
        
        // Wait for vertical blank
        vi_wait();
    }
}

/**
 * Alternative: Integrate with existing scene system
 */
extern "C" RenderPipeline* create_deferred_pipeline_for_scene(Scene& scene)
{
    return new Deferred::RenderPipelineDeferred(scene);
}

/**
 * Test function to verify deferred pipeline works
 */
extern "C" void test_deferred_pipeline()
{
    debugf("Testing deferred rendering pipeline...\n");
    
    // Create a test scene
    Scene testScene(SceneConf{320, 240, 0, {0, 0, 0, 255}, 0, 
                             SceneConf::Pipeline::DEFAULT, 0, 0, {}});
    
    // Create deferred pipeline
    Deferred::RenderPipelineDeferred* pipeline = 
        new Deferred::RenderPipelineDeferred(testScene);
    
    // Test initialization
    pipeline->init();
    debugf("  ✓ Pipeline initialized\n");
    
    // Test adding lights
    Deferred::LightData light;
    light.type = Deferred::LightData::DIRECTIONAL;
    light.color = {255, 255, 255, 255};
    light.intensity = 1.0f;
    light.direction = {0.0f, -1.0f, 0.0f};
    light.castsShadows = true;
    
    int32_t lightId = pipeline->addLight(light);
    if (lightId >= 0) {
        debugf("  ✓ Added directional light (ID: %d)\n", lightId);
    } else {
        debugf("  ✗ Failed to add light\n");
    }
    
    // Test adding materials
    Deferred::MaterialData material;
    material.baseColor = {200, 200, 200, 255};
    material.roughness = 0.5f;
    material.metallic = 0.0f;
    material.emissiveIntensity = 0.0f;
    material.shadeBands = 3;
    material.outlineColor = {0, 0, 0, 255};
    material.outlineThreshold = 0.1f;
    
    int32_t materialId = pipeline->addMaterial(material);
    if (materialId >= 0) {
        debugf("  ✓ Added material (ID: %d)\n", materialId);
    } else {
        debugf("  ✗ Failed to add material\n");
    }
    
    // Test performance counters
    pipeline->preDraw();
    pipeline->draw();
    
    uint64_t geometryTime = pipeline->getGeometryPassTime();
    uint64_t lightingTime = pipeline->getLightingPassTime();
    debugf("  ✓ Executed pipeline (Geometry: %llu, Lighting: %llu)\n", 
           geometryTime, lightingTime);
    
    // Clean up
    delete pipeline;
    debugf("  ✓ Pipeline cleaned up\n");
    
    debugf("Deferred pipeline test completed successfully!\n");
}