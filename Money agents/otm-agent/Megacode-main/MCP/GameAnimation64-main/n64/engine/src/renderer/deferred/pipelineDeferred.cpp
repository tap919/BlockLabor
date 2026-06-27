/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Deferred rendering pipeline implementation
 * Integrates with existing Pyrite64 scene system
 */

#include "debug/overlay.h"
#include "renderer/pipeline.h"
#include "debug/debugDraw.h"
#include "lib/memory.h"
#include "renderer/drawLayer.h"
#include "scene/globalState.h"
#include "scene/scene.h"
#include "vi/swapChain.h"
#include "renderer/deferred/DeferredPipeline.h"
#include "renderer/deferred/IntegrationSystem.h"
#include "ecs/Coordinator.h"
#include "jobs/JobSystem.h"
#include "memory/MemoryManager.h"

using namespace P64;

// Static instance for global access (similar to other pipelines)
static Deferred::RenderPipelineDeferred* g_deferredPipeline = nullptr;
static Deferred::Integration::IntegrationManager* g_integrationManager = nullptr;
static ECS::Coordinator* g_ecsCoordinator = nullptr;
static JobSystem* g_jobSystem = nullptr;
static MemoryManager* g_memoryManager = nullptr;

/**
 * Initialize deferred rendering pipeline
 */
void Deferred::RenderPipelineDeferred::init()
{
    // Get screen size from global state
    uint16_t screenWidth = state.screenSize[0];
    uint16_t screenHeight = state.screenSize[1];
    
    // Allocate framebuffers (similar to default pipeline)
    tex_format_t fmt = (scene.getConf().flags & SceneConf::FLAG_SCR_32BIT) ? FMT_RGBA32 : FMT_RGBA16;
    
    // Create lighting buffer (final output before post-process)
    lightingBuffer = surface_alloc(fmt, screenWidth, screenHeight);
    
    // Initialize G-buffer
    gBuffer = new GBuffer(screenWidth, screenHeight);
    gBuffer->init();
    
    // Initialize tile light lists for tile-based lighting
    uint8_t tilesX = (screenWidth + TILE_SIZE - 1) / TILE_SIZE;
    uint8_t tilesY = (screenHeight + TILE_SIZE - 1) / TILE_SIZE;
    uint32_t totalTiles = tilesX * tilesY;
    
    tileLightLists = new TileLightList[totalTiles];
    memset(tileLightLists, 0, sizeof(TileLightList) * totalTiles);
    
    // Initialize systems if not already initialized
    if (!g_ecsCoordinator) {
        g_ecsCoordinator = new ECS::Coordinator();
        g_ecsCoordinator->init();
    }
    
    if (!g_jobSystem) {
        g_jobSystem = new JobSystem();
        g_jobSystem->init();
    }
    
    if (!g_memoryManager) {
        g_memoryManager = new MemoryManager();
        g_memoryManager->init();
    }
    
    if (!g_integrationManager) {
        g_integrationManager = new Deferred::Integration::IntegrationManager(
            this, g_ecsCoordinator, g_jobSystem, g_memoryManager);
        g_integrationManager->init();
    }
    
    // Set up swap chain for deferred rendering
    VI::SwapChain::setFrameBuffers(&lightingBuffer, 1);
    
    VI::SwapChain::setDrawPass([this](surface_t *surf, uint32_t fbIndex, auto done) {
        surfColor = surf;
        surfDepth = &Mem::allocDepthBuffer(state.screenSize[0], state.screenSize[1]);
        
        // Execute deferred rendering pipeline
        rdpq_attach(surf, surfDepth);
        draw();
        
        // Draw debug overlay
        Debug::Overlay::draw(scene, surf);
        rdpq_detach_cb((void(*)(void*))((void*)done), (void*)fbIndex);
    });
    
    // Set default configuration
    config.enableShadows = true;
    config.enableBloom = true;
    config.enableMotionBlur = false;
    config.enableAntiAliasing = true;
    config.enableTileCulling = true;
    config.enableEarlyZ = true;
    config.shadowQuality = 2; // Medium
    config.msaaLevel = 0; // No MSAA initially
    
    // Create default directional light
    LightData directionalLight;
    directionalLight.type = LightData::DIRECTIONAL;
    directionalLight.color = {255, 255, 255, 255};
    directionalLight.intensity = 1.0f;
    directionalLight.direction = {0.0f, -1.0f, 0.0f}; // Down
    directionalLight.castsShadows = true;
    directionalLight.shadowBias = 0.001f;
    
    addLight(directionalLight);
    
    // Create default material
    MaterialData defaultMaterial;
    defaultMaterial.baseColor = {200, 200, 200, 255};
    defaultMaterial.roughness = 0.5f;
    defaultMaterial.metallic = 0.0f;
    defaultMaterial.emissiveIntensity = 0.0f;
    defaultMaterial.shadeBands = 3;
    defaultMaterial.outlineColor = {0, 0, 0, 255};
    defaultMaterial.outlineThreshold = 0.1f;
    defaultMaterial.albedoTextureId = 0;
    defaultMaterial.normalTextureId = 0;
    defaultMaterial.roughnessTextureId = 0;
    defaultMaterial.isTransparent = false;
    defaultMaterial.isCutout = false;
    defaultMaterial.isEmissive = false;
    defaultMaterial.receivesShadows = true;
    
    addMaterial(defaultMaterial);
    
    g_deferredPipeline = this;
}

/**
 * Clean up deferred rendering pipeline
 */
Deferred::RenderPipelineDeferred::~RenderPipelineDeferred()
{
    // Clean up G-buffer
    if (gBuffer) {
        delete gBuffer;
        gBuffer = nullptr;
    }
    
    // Clean up tile light lists
    if (tileLightLists) {
        delete[] tileLightLists;
        tileLightLists = nullptr;
    }
    
    // Clean up lighting buffer
    if (lightingBuffer.buffer) {
        surface_free(&lightingBuffer);
    }
    
    // Clean up global instances (only if we created them)
    if (g_deferredPipeline == this) {
        g_deferredPipeline = nullptr;
        
        if (g_integrationManager) {
            delete g_integrationManager;
            g_integrationManager = nullptr;
        }
        
        // Note: We don't delete g_ecsCoordinator, g_jobSystem, g_memoryManager
        // as they might be used by other systems
    }
}

/**
 * Pre-draw setup (called before geometry pass)
 */
void Deferred::RenderPipelineDeferred::preDraw()
{
    // Reset performance counters for new frame
    resetPerformanceCounters();
    
    // Clear G-buffer
    if (gBuffer) {
        gBuffer->clear();
    }
    
    // Update integration manager
    if (g_integrationManager) {
        g_integrationManager->update(scene);
    }
    
    // Setup RDP state for geometry pass
    setupRDPStateGeometry();
}

/**
 * Main draw function (executes full deferred pipeline)
 */
void Deferred::RenderPipelineDeferred::draw()
{
    // Execute geometry pass (fill G-buffer)
    executeGeometryPass();
    
    // Build tile light lists (assign lights to tiles)
    buildTileLightLists();
    
    // Execute lighting pass (deferred shading)
    executeLightingPass();
    
    // Execute post-processing pass
    executePostProcessPass();
    
    // Update performance counters
    updatePerformanceCounters();
}

/**
 * Execute geometry pass (fill G-buffer)
 */
void Deferred::RenderPipelineDeferred::executeGeometryPass()
{
    // Start timing geometry pass
    uint64_t startTime = timer_ticks();
    
    // Setup for geometry rendering
    rdpq_set_mode_standard();
    rdpq_mode_zbuf(true, true);
    rdpq_mode_persp(true);
    
    // Render all objects in the scene to G-buffer
    // In a real implementation, this would iterate through scene objects
    // and render them with appropriate materials to the G-buffer
    
    // For now, we'll just clear to show the pipeline works
    rdpq_clear({0, 0, 0, 255});
    
    // Update geometry pass time
    geometryPassTime = timer_ticks() - startTime;
}

/**
 * Execute lighting pass (deferred shading)
 */
void Deferred::RenderPipelineDeferred::executeLightingPass()
{
    // Start timing lighting pass
    uint64_t startTime = timer_ticks();
    
    // In a real implementation, this would:
    // 1. For each tile, gather lights affecting that tile
    // 2. Calculate lighting using G-buffer data
    // 3. Apply cartoon banding if enabled
    // 4. Output to lighting buffer
    
    // For now, we'll just fill with a simple color
    rdpq_set_mode_standard();
    rdpq_mode_zbuf(false, false);
    
    // Draw a simple gradient to show lighting pass works
    rdpq_set_prim_color({100, 150, 200, 255});
    rdpq_fill_rectangle(0, 0, state.screenSize[0], state.screenSize[1]);
    
    // Update lighting pass time
    lightingPassTime = timer_ticks() - startTime;
}

/**
 * Execute post-processing pass
 */
void Deferred::RenderPipelineDeferred::executePostProcessPass()
{
    // Start timing post-process pass
    uint64_t startTime = timer_ticks();
    
    // In a real implementation, this would:
    // 1. Apply bloom if enabled
    // 2. Apply motion blur if enabled
    // 3. Apply anti-aliasing if enabled
    // 4. Apply tone mapping and gamma correction
    
    // For now, just copy lighting buffer to output
    rdpq_mode_blender(BLENDER_DEFAULT);
    rdpq_texture_copy(NULL, 0, 0, NULL, 0, 0, 
                      state.screenSize[0], state.screenSize[1]);
    
    // Update post-process time
    postProcessTime = timer_ticks() - startTime;
}

/**
 * Build tile light lists (assign lights to tiles)
 */
void Deferred::RenderPipelineDeferred::buildTileLightLists()
{
    // In a real implementation, this would:
    // 1. For each light, calculate which tiles it affects
    // 2. Add light to tile's light list
    // 3. Sort lights by importance for each tile
    
    // For now, just mark all tiles as affected by light 0 (directional)
    uint8_t tilesX = (state.screenSize[0] + TILE_SIZE - 1) / TILE_SIZE;
    uint8_t tilesY = (state.screenSize[1] + TILE_SIZE - 1) / TILE_SIZE;
    
    for (uint8_t y = 0; y < tilesY; y++) {
        for (uint8_t x = 0; x < tilesX; x++) {
            uint32_t tileIndex = y * tilesX + x;
            tileLightLists[tileIndex].lightIndices[0] = 0;
            tileLightLists[tileIndex].lightCount = 1;
        }
    }
    
    visibleTileCount = tilesX * tilesY;
}

/**
 * Setup RDP state for geometry pass
 */
void Deferred::RenderPipelineDeferred::setupRDPStateGeometry()
{
    rdpq_mode_begin();
    rdpq_set_mode_standard();
    rdpq_mode_antialias(AA_NONE);
    rdpq_mode_zbuf(true, true);
    rdpq_mode_persp(true);
    rdpq_mode_filter(FILTER_BILINEAR);
    rdpq_mode_dithering(DITHER_NONE_NONE);
    rdpq_mode_blender(0);
    rdpq_mode_fog(0);
    rdpq_mode_end();
}

/**
 * Setup RDP state for lighting pass
 */
void Deferred::RenderPipelineDeferred::setupRDPStateLighting()
{
    rdpq_mode_begin();
    rdpq_set_mode_standard();
    rdpq_mode_antialias(AA_NONE);
    rdpq_mode_zbuf(false, false);
    rdpq_mode_persp(false);
    rdpq_mode_filter(FILTER_BILINEAR);
    rdpq_mode_dithering(DITHER_NONE_NONE);
    rdpq_mode_blender(BLENDER_DEFAULT);
    rdpq_mode_fog(0);
    rdpq_mode_end();
}

/**
 * Setup RDP state for post-processing
 */
void Deferred::RenderPipelineDeferred::setupRDPStatePostProcess()
{
    rdpq_mode_begin();
    rdpq_set_mode_standard();
    rdpq_mode_antialias(AA_NONE);
    rdpq_mode_zbuf(false, false);
    rdpq_mode_persp(false);
    rdpq_mode_filter(FILTER_BILINEAR);
    rdpq_mode_dithering(DITHER_NONE_NONE);
    rdpq_mode_blender(BLENDER_DEFAULT);
    rdpq_mode_fog(0);
    rdpq_mode_end();
}

/**
 * Update performance counters
 */
void Deferred::RenderPipelineDeferred::updatePerformanceCounters()
{
    // In a real implementation, this would update counters
    // based on actual rendering statistics
    triangleCount = 1000; // Example value
}

/**
 * Reset performance counters for new frame
 */
void Deferred::RenderPipelineDeferred::resetPerformanceCounters()
{
    geometryPassTime = 0;
    lightingPassTime = 0;
    postProcessTime = 0;
    triangleCount = 0;
    visibleTileCount = 0;
}

/**
 * Add light to the scene
 */
int32_t Deferred::RenderPipelineDeferred::addLight(const LightData& light)
{
    if (lightCount >= MAX_LIGHTS) {
        return -1;
    }
    
    lights[lightCount] = light;
    return lightCount++;
}

/**
 * Remove light from the scene
 */
void Deferred::RenderPipelineDeferred::removeLight(uint32_t lightId)
{
    if (lightId >= lightCount) {
        return;
    }
    
    // Shift remaining lights
    for (uint32_t i = lightId; i < lightCount - 1; i++) {
        lights[i] = lights[i + 1];
    }
    
    lightCount--;
}

/**
 * Update existing light
 */
void Deferred::RenderPipelineDeferred::updateLight(uint32_t lightId, const LightData& light)
{
    if (lightId >= lightCount) {
        return;
    }
    
    lights[lightId] = light;
}

/**
 * Add material to the database
 */
int32_t Deferred::RenderPipelineDeferred::addMaterial(const MaterialData& material)
{
    if (materialCount >= MAX_MATERIALS) {
        return -1;
    }
    
    materials[materialCount] = material;
    return materialCount++;
}

/**
 * Get material by ID
 */
const Deferred::MaterialData* Deferred::RenderPipelineDeferred::getMaterial(uint32_t materialId) const
{
    if (materialId >= materialCount) {
        return nullptr;
    }
    
    return &materials[materialId];
}

/**
 * Update material
 */
void Deferred::RenderPipelineDeferred::updateMaterial(uint32_t materialId, const MaterialData& material)
{
    if (materialId >= materialCount) {
        return;
    }
    
    materials[materialId] = material;
}

/**
 * Debug: Visualize G-buffer channels
 */
void Deferred::RenderPipelineDeferred::debugVisualizeGBuffer(uint8_t channel)
{
    // In a real implementation, this would render G-buffer channels
    // for debugging purposes
}

/**
 * Debug: Toggle wireframe mode
 */
void Deferred::RenderPipelineDeferred::debugToggleWireframe()
{
    // In a real implementation, this would toggle wireframe rendering
}

// Static helper function to create deferred pipeline
extern "C" P64::RenderPipeline* createDeferredPipeline(P64::Scene& scene)
{
    return new Deferred::RenderPipelineDeferred(scene);
}