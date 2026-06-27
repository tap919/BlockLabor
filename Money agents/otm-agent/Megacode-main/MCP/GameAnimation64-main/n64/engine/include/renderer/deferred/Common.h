/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Common definitions and forward declarations for deferred rendering pipeline
 */
#pragma once

#include <cstdint>
#include <cstddef>
#include <cstring>
#include <algorithm>
#include <functional>
#include <vector>
#include <array>
#include <memory>

// Forward declarations for libdragon types
struct surface_t;
struct sprite_t;
struct t3d_mesh_t;
struct rspq_block_t;
typedef struct color_t color_t;
typedef struct fm_vec3_t fm_vec3_t;
typedef struct fm_quat_t fm_quat_t;
typedef struct fm_vec4_t fm_vec4_t;

// Forward declarations for engine types
namespace P64 {
    class Scene;
    namespace Memory {
        enum class RegionType;
    }
    namespace ECS {
        class Coordinator;
        class System;
        using Entity = uint32_t;
    }
    namespace Deferred {
        struct LightData;
        struct MaterialData;
    }
}

// Common aliases
namespace P64::Deferred {
    using MemoryRegion = Memory::RegionType;
    
    // Common constants
    constexpr uint16_t SCREEN_WIDTH = 320;
    constexpr uint16_t SCREEN_HEIGHT = 240;
    constexpr uint8_t TILE_SIZE = 16;
    constexpr uint8_t TILES_X = (SCREEN_WIDTH + TILE_SIZE - 1) / TILE_SIZE;
    constexpr uint8_t TILES_Y = (SCREEN_HEIGHT + TILE_SIZE - 1) / TILE_SIZE;
    
    // Memory regions
    constexpr MemoryRegion DEFAULT_MEMORY_REGION = MemoryRegion::RDRAM;
    
    // Performance targets
    constexpr uint64_t TARGET_FRAME_TIME_US = 16667; // 60 FPS
    constexpr uint32_t TARGET_TRIANGLES_PER_FRAME = 2000;
    constexpr uint32_t MAX_LIGHTS = 9; // 8 dynamic + 1 directional
    constexpr uint32_t MAX_MATERIALS = 64;
    constexpr uint32_t MAX_TEXTURES = 128;
    
    // G-buffer configuration
    constexpr size_t GBUFFER_BITS_PER_PIXEL = 128;
    constexpr size_t GBUFFER_SIZE_BYTES = (SCREEN_WIDTH * SCREEN_HEIGHT * GBUFFER_BITS_PER_PIXEL) / 8;
}