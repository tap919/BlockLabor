# Deferred Rendering Pipeline Design for N64

## Overview
This document outlines the design for a deferred rendering pipeline optimized for Nintendo 64 hardware constraints. The goal is to achieve 60 FPS with 2000 triangles/frame while supporting advanced lighting and material features.

## N64 Hardware Constraints

### Memory Limitations
- **RDRAM**: 4MB (8MB with Expansion Pak)
- **RSP DMEM**: 4KB instruction + 4KB data
- **Texture Cache**: Limited to 4KB per tile
- **Frame Buffer**: 320x240 (NTSC) or 384x288 (PAL) resolution

### Performance Targets
- **Target FPS**: 60 FPS (16.67ms per frame)
- **Triangle Budget**: 2000 triangles/frame (up from 800)
- **Light Count**: Support for 8 dynamic lights + 1 directional
- **Material Complexity**: PBR-inspired cartoon materials

## Architecture Design

### Multi-Pass Deferred Pipeline

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Geometry Pass │    │   Lighting Pass │    │  Post-Process   │
│  (G-Buffer Fill)│───▶│ (Deferred Shade)│───▶│   (Final Comp)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### G-Buffer Layout (Optimized for N64)

Due to memory constraints, we use a compact G-buffer format:

**Surface 0: RGBA16 (64 bits/pixel)**
- **R**: Depth (16-bit, normalized 0.0-1.0)
- **G**: Normal X (8-bit) + Material ID (8-bit)
- **B**: Normal Y (8-bit) + Roughness (4-bit) + Metallic (4-bit)
- **A**: Base Color (RGBA4444)

**Surface 1: RGBA16 (64 bits/pixel)**
- **RG**: Emissive Color (RGBA4444)
- **B**: AO (4-bit) + Specular (4-bit) + Unused (8-bit)
- **A**: Velocity X (8-bit) + Velocity Y (8-bit)

**Total**: 128 bits/pixel (16 bytes) for 320x240 = 1.2MB

### Memory Allocation Strategy

```
┌─────────────────────────────────────────────────┐
│                    RDRAM (4MB)                  │
├─────────────────────────────────────────────────┤
│  G-Buffer (1.2MB) │ Frame Buffer (300KB) │ ... │
├─────────────────────────────────────────────────┤
│   Depth Buffer    │   Shadow Maps       │ ... │
└─────────────────────────────────────────────────┘
```

## Pipeline Stages

### Stage 1: Geometry Pass
- Render all opaque geometry to G-buffer
- Use RSP microcode for efficient attribute packing
- Implement early-Z culling
- Output: Compact G-buffer surfaces

### Stage 2: Lighting Pass
- Read G-buffer and compute lighting
- Support for multiple light types:
  - Directional (1x, main sun/moon)
  - Point (up to 8)
  - Spot (up to 4)
- Use tiled lighting for performance
- Implement cartoon banding for cel-shading

### Stage 3: Post-Processing
- Apply bloom/HDR (existing system)
- Add motion blur (velocity buffer)
- Apply anti-aliasing (edge detection + blur)
- Final tone mapping

## Integration with Existing Systems

### ECS Integration
```cpp
// New ECS Components
struct RenderableComponent {
    uint32_t materialId;
    uint32_t meshId;
    bool castsShadows;
    bool receivesShadows;
};

struct LightComponent {
    enum Type { DIRECTIONAL, POINT, SPOT };
    Type type;
    color_t color;
    float intensity;
    float range; // for point/spot
    float angle; // for spot
};

// New ECS Systems
class GeometryRenderSystem : public System {
    void update(Coordinator& coordinator) override;
};

class LightingSystem : public System {
    void update(Coordinator& coordinator) override;
};
```

### Memory Manager Integration
```cpp
// Use existing memory allocators
auto gBufferMemory = MemoryManager::allocate(
    MemoryRegion::RDRAM,
    gBufferSize,
    MemoryAllocator::POOL
);

// Frame-based allocation for temporary buffers
auto tempBuffer = MemoryManager::allocateFrame(
    MemoryRegion::RDRAM,
    tempSize
);
```

### Job System Integration
```cpp
// Parallel rendering tasks
JobSystem::submit(JobType::RSP, []() {
    // RSP microcode for geometry processing
});

JobSystem::submit(JobType::CPU, []() {
    // CPU-side culling and batching
});

JobSystem::submit(JobType::DMA, []() {
    // DMA transfers for texture loading
});
```

## Performance Optimizations

### 1. Tile-Based Rendering
- Divide screen into 16x16 tiles (20x15 tiles for 320x240)
- Process tiles in parallel using RSP
- Early rejection of empty tiles

### 2. Visibility Culling
- Hierarchical Z-buffer (HZB) for occlusion culling
- Frustum culling with spatial partitioning
- Distance-based LOD system

### 3. Texture Streaming
- Adaptive texture resolution based on distance
- Mipmap generation on-the-fly
- Texture compression (CI4/CI8 formats)

### 4. RSP Microcode Optimization
- Custom microcode for G-buffer packing
- SIMD operations for lighting calculations
- Pipeline state minimization

## Material System

### PBR-Inspired Cartoon Materials
```cpp
struct Material {
    // Base Properties
    color_t baseColor;
    float roughness; // Banded for cartoon effect
    float metallic;  // Simple 0/1 for cartoon
    
    // Cartoon-specific
    uint8_t shadeBands;      // 2, 3, or 4 bands
    color_t outlineColor;    // Cel outline
    float outlineThreshold;  // Depth/normal threshold
    
    // Advanced Features
    bool emissive;           // Glow effect
    float subsurfaceScattering; // For skin/translucent
};
```

### Shader Variants
- **Standard**: Basic cartoon shading
- **Emissive**: Self-illuminated objects
- **Transparent**: Alpha-blended materials
- **Cutout**: Alpha-tested materials (foliage)

## Shadow System

### Cascaded Shadow Maps (Directional)
- 2 cascades for near/far splits
- 256x256 resolution per cascade
- Percentage-closer filtering (PCF)

### Omnidirectional Shadows (Point)
- Cube map rendering (64x64 per face)
- Limited to 2 point light shadows
- Distance-based falloff

## Particle System Upgrade

### GPU-Accelerated Particles
- Use RSP for particle simulation
- Support for up to 1024 particles
- Physics integration (wind, gravity, collisions)
- Sprite sheets for animated particles

### Particle Types
- **Billboard**: Standard 2D sprites
- **Mesh**: 3D geometry particles
- **Trail**: Ribbon/beam effects
- **Decal**: Screen-space effects

## Implementation Phases

### Phase 1: Foundation (Current)
- ✅ ECS system
- ✅ Memory management
- ✅ Job system
- G-buffer rendering
- Basic lighting pass

### Phase 2: Advanced Features
- Shadow mapping
- Particle system upgrade
- Material system
- Post-processing chain

### Phase 3: Optimization
- Tile-based rendering
- Visibility culling
- Texture streaming
- RSP microcode tuning

### Phase 4: Integration
- Editor support
- Asset pipeline
- Performance profiling
- Documentation

## Testing & Validation

### Performance Metrics
- Frame time breakdown
- Triangle count per frame
- Memory usage per frame
- RSP/CPU utilization

### Quality Metrics
- Visual comparison with forward rendering
- Lighting accuracy
- Shadow quality
- Anti-aliasing effectiveness

### Hardware Testing
- N64 console (with/without Expansion Pak)
- Emulators (Ares, gopher64)
- Development hardware (64Drive, EverDrive)

## Backward Compatibility

### Migration Path
1. Existing scenes use forward rendering by default
2. Opt-in to deferred rendering via scene config
3. Automatic material conversion
4. Fallback for unsupported features

### Feature Flags
```cpp
struct RenderFeatures {
    bool deferredRendering : 1;
    bool shadowMapping : 1;
    bool hdrBloom : 1;
    bool motionBlur : 1;
    bool antiAliasing : 1;
};
```

## Conclusion

This deferred rendering pipeline design balances N64 hardware constraints with modern rendering features. By leveraging the existing ECS, memory management, and job systems, we can achieve significant performance improvements while adding advanced lighting and material capabilities.

The key innovations are:
1. Compact G-buffer format optimized for N64 memory
2. Tile-based rendering for parallel processing
3. PBR-inspired cartoon materials
4. GPU-accelerated particle system
5. Seamless integration with existing architecture