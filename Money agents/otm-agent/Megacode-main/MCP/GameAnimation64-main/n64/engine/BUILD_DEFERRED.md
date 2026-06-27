# Deferred Rendering Pipeline Build Instructions

This document explains how to build and integrate the deferred rendering pipeline with the existing Pyrite64/GameAnimation64 engine.

## Overview

The deferred rendering pipeline is a complete implementation of modern rendering techniques optimized for N64 hardware constraints. It includes:

1. **Deferred Pipeline Core** - Main rendering pipeline class
2. **G-buffer System** - Multiple render target storage
3. **Lighting System** - Tile-based deferred lighting with cartoon banding
4. **Shadow Mapping** - Cascaded shadows, point light shadows, PCF filtering
5. **Material System** - PBR-inspired cartoon materials
6. **Particle System** - GPU-accelerated particles
7. **Integration System** - ECS integration with existing scene system
8. **Performance Tools** - Profiling and optimization utilities
9. **Testing Framework** - Hardware testing and validation

## Build Configuration

### 1. Update Makefile

The main engine Makefile has been updated to include deferred rendering source files:

```makefile
# Added to src variable:
src += $(wildcard src/renderer/deferred/*.cpp)
```

### 2. Source Files

The following source files are included:

- `src/renderer/deferred/pipelineDeferred.cpp` - Main pipeline implementation
- `src/renderer/deferred/GBuffer.cpp` - G-buffer implementation
- (Additional implementation files to be added as needed)

### 3. Header Files

All header files are located in `include/renderer/deferred/`:

- `Common.h` - Common definitions and forward declarations
- `DeferredPipeline.h` - Main pipeline class
- `GBuffer.h` - G-buffer system
- `LightingSystem.h` - Lighting calculations
- `MaterialSystem.h` - Material management
- `shadows/ShadowMapping.h` - Shadow mapping system
- `ParticleSystem.h` - Particle system
- `IntegrationSystem.h` - ECS integration
- `PerformanceTools.h` - Performance profiling
- `TestingFramework.h` - Testing and validation
- `ExampleIntegration.h` - Usage examples

## Integration with Existing Engine

### 1. Scene Configuration

To use the deferred pipeline, update your scene configuration:

```cpp
#include "renderer/deferred/DeferredPipeline.h"

// Create scene with deferred pipeline
Scene scene(SceneConf{
    .screenWidth = 320,
    .screenHeight = 240,
    .pipeline = SceneConf::Pipeline::DEFAULT, // Will be overridden
    // ... other configuration
});

// Create deferred pipeline
Deferred::RenderPipelineDeferred* deferredPipeline = 
    new Deferred::RenderPipelineDeferred(scene);

// Initialize pipeline
deferredPipeline->init();

// Use pipeline for rendering
deferredPipeline->preDraw();
deferredPipeline->draw();
```

### 2. ECS Integration

The deferred pipeline integrates with the existing ECS system:

```cpp
#include "ecs/Coordinator.h"
#include "renderer/deferred/IntegrationSystem.h"

// Create ECS coordinator
ECS::Coordinator coordinator;
coordinator.init();

// Create integration manager
Deferred::Integration::IntegrationManager* integrationManager = 
    new Deferred::Integration::IntegrationManager(
        deferredPipeline, &coordinator, nullptr, nullptr);
integrationManager->init();

// Register deferred components
integrationManager->registerComponents();

// Create systems
integrationManager->createSystems();
```

### 3. Memory Management

The deferred pipeline uses the existing memory management system:

```cpp
#include "memory/MemoryManager.h"

// Create memory manager
MemoryManager memoryManager;
memoryManager.init();

// Configure memory regions for deferred rendering
memoryManager.setRegionBudget(Memory::RegionType::RDRAM, 2 * 1024 * 1024); // 2MB
memoryManager.setRegionBudget(Memory::RegionType::TEXTURE, 1 * 1024 * 1024); // 1MB
```

## Building with N64 Toolchain

### 1. Prerequisites

- N64 development toolchain (gcc-mips64-elf)
- libdragon library
- tiny3d library
- Existing Pyrite64 build environment

### 2. Build Command

```bash
# Navigate to engine directory
cd products/GameAnimation64-main/n64/engine

# Build engine with deferred pipeline
make clean
make

# The output will be build/engine.a
```

### 3. Linking with Your Game

Add the deferred pipeline to your game's Makefile:

```makefile
# Link with deferred pipeline
N64_LDFLAGS += -Lengine/build -lengine

# Include deferred headers
N64_CFLAGS += -Iengine/include/renderer/deferred
```

## Example Usage

### 1. Simple Example

See `examples/deferred_example.cpp` for a complete example:

```cpp
// Run the example
deferred_example_main();

// Or test the pipeline
test_deferred_pipeline();
```

### 2. Performance Monitoring

The pipeline includes built-in performance monitoring:

```cpp
// Get performance statistics
uint64_t geometryTime = pipeline->getGeometryPassTime();
uint64_t lightingTime = pipeline->getLightingPassTime();
uint32_t triangles = pipeline->getTriangleCount();

// Convert to microseconds
uint32_t geometryUs = (uint32_t)(geometryTime / TICKS_PER_USEC);
uint32_t lightingUs = (uint32_t)(lightingTime / TICKS_PER_USEC);

// Calculate FPS
float fps = 1000000.0f / (geometryUs + lightingUs);
```

### 3. Configuration

Configure the pipeline for different quality levels:

```cpp
// Get current configuration
auto config = pipeline->getConfig();

// Update configuration
config.enableShadows = true;
config.enableBloom = true;
config.shadowQuality = 2; // Medium
config.msaaLevel = 0; // No MSAA

pipeline->setConfig(config);
```

## Performance Targets

The deferred pipeline is designed to meet these performance targets on N64 hardware:

| Metric | Target | Notes |
|--------|--------|-------|
| Frame Time | 16,667 µs | 60 FPS |
| Triangles/Frame | 2,000 | 2.5× improvement from 800 |
| Memory Usage | < 4MB | Fits in standard N64 RAM |
| G-buffer Size | 128 bits/pixel | Optimized for N64 RDP |
| Max Lights | 9 | 8 dynamic + 1 directional |
| Max Materials | 64 | With texture streaming |

## Testing

### 1. Unit Tests

Run the built-in test framework:

```cpp
#include "renderer/deferred/TestingFramework.h"

// Create test framework
Deferred::Testing::TestingFramework testFramework;
testFramework.init();

// Run hardware tests
testFramework.runHardwareTests();

// Run performance benchmarks
testFramework.runPerformanceBenchmarks();
```

### 2. Validation Tests

Validate the pipeline against reference implementations:

```cpp
// Run validation suite
testFramework.runValidationSuite();

// Compare with forward rendering
testFramework.compareWithForwardRendering();
```

## Troubleshooting

### 1. Build Errors

- **Missing headers**: Ensure all deferred headers are in `include/renderer/deferred/`
- **Linker errors**: Check that all source files are included in the Makefile
- **Memory errors**: Verify memory region configurations

### 2. Runtime Issues

- **Performance issues**: Use the performance tools to identify bottlenecks
- **Visual artifacts**: Check G-buffer format and lighting calculations
- **Memory exhaustion**: Monitor memory usage with built-in profiler

### 3. Integration Problems

- **Scene compatibility**: Ensure scene objects use compatible materials
- **ECS conflicts**: Check component registration order
- **Pipeline switching**: Properly clean up between pipeline changes

## Advanced Features

### 1. Custom Materials

Create custom materials using the material system:

```cpp
#include "renderer/deferred/MaterialSystem.h"

// Create material manager
Deferred::Materials::MaterialManager materialManager;

// Create custom material
Deferred::Materials::MaterialProperties props;
props.albedoColor = {255, 200, 100, 255};
props.roughness = 0.3f;
props.metallic = 0.8f;
props.shadeBands = 3;

int32_t materialId = materialManager.createMaterial(
    props, Deferred::Materials::MaterialType::METALLIC);
```

### 2. Advanced Lighting

Configure advanced lighting features:

```cpp
// Add point light
Deferred::LightData pointLight;
pointLight.type = Deferred::LightData::POINT;
pointLight.position = {0.0f, 5.0f, 0.0f};
pointLight.color = {255, 100, 50, 255};
pointLight.intensity = 2.0f;
pointLight.range = 10.0f;
pointLight.castsShadows = true;

pipeline->addLight(pointLight);
```

### 3. Particle Effects

Use the GPU-accelerated particle system:

```cpp
#include "renderer/deferred/ParticleSystem.h"

// Create particle system
Deferred::Particles::ParticleSystemManager particleManager;

// Configure particle emitter
Deferred::Particles::EmitterConfig emitterConfig;
emitterConfig.type = Deferred::Particles::ParticleType::BILLBOARD;
emitterConfig.maxParticles = 1000;
emitterConfig.emissionRate = 50.0f;

particleManager.createEmitter(emitterConfig);
```

## Conclusion

The deferred rendering pipeline provides a modern, feature-rich rendering solution for N64 development while maintaining compatibility with the existing Pyrite64/GameAnimation64 engine. Follow these instructions to integrate it into your project and take advantage of advanced rendering features optimized for N64 hardware constraints.