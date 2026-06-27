/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 */
#pragma once

#include <cstdint>
#include <cstddef>
#include <cstring>
#include <algorithm>
#include <functional>

#include <libdragon.h>
#include <t3d/t3d.h>
#include "../memory/MemoryManager.h"

namespace P64 {
namespace Deferred {

// Forward declaration
namespace Memory {
    enum class RegionType;
}

// Alias for backward compatibility
using MemoryRegion = Memory::RegionType;

/**
 * Compact G-buffer format optimized for N64 hardware constraints
 * Total: 128 bits/pixel (16 bytes) for 320x240 = 1.2MB
 */
class GBuffer
{
private:
    // G-buffer surfaces
    surface_t surfDepthNormal;    // Surface 0: Depth + Normal + Material
    surface_t surfColorAttributes; // Surface 1: Color + Attributes
    
    // Screen dimensions
    uint16_t width;
    uint16_t height;
    
    // Memory region for G-buffer
    MemoryRegion memoryRegion;
    
    // Tile configuration (16x16 tiles for 320x240 = 20x15 tiles)
    static constexpr uint8_t TILE_SIZE = 16;
    uint8_t tilesX;
    uint8_t tilesY;
    
    // Tile visibility mask (bit per tile)
    uint32_t* tileVisibilityMask;
    
public:
    GBuffer(uint16_t screenWidth, uint16_t screenHeight, MemoryRegion region = MemoryRegion::RDRAM);
    ~GBuffer();
    
    // No copy/move
    GBuffer(const GBuffer&) = delete;
    GBuffer& operator=(const GBuffer&) = delete;
    GBuffer(GBuffer&&) = delete;
    GBuffer& operator=(GBuffer&&) = delete;
    
    /**
     * Initialize G-buffer surfaces
     */
    void init();
    
    /**
     * Clear G-buffer for new frame
     */
    void clear();
    
    /**
     * Attach G-buffer for geometry pass rendering
     */
    void attachForGeometryPass();
    
    /**
     * Detach G-buffer after geometry pass
     */
    void detachAfterGeometryPass();
    
    /**
     * Get G-buffer surface pointers for lighting pass
     */
    [[nodiscard]] surface_t* getDepthNormalSurface() const { return &surfDepthNormal; }
    [[nodiscard]] surface_t* getColorAttributesSurface() const { return &surfColorAttributes; }
    
    /**
     * Update tile visibility based on rendered geometry
     * @param tileX Tile X coordinate (0-19 for 320 width)
     * @param tileY Tile Y coordinate (0-14 for 240 height)
     */
    void markTileVisible(uint8_t tileX, uint8_t tileY);
    
    /**
     * Check if tile contains any geometry
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @return True if tile is visible (contains geometry)
     */
    [[nodiscard]] bool isTileVisible(uint8_t tileX, uint8_t tileY) const;
    
    /**
     * Get tile count in X direction
     */
    [[nodiscard]] uint8_t getTilesX() const { return tilesX; }
    
    /**
     * Get tile count in Y direction
     */
    [[nodiscard]] uint8_t getTilesY() const { return tilesY; }
    
    /**
     * Get screen width
     */
    [[nodiscard]] uint16_t getWidth() const { return width; }
    
    /**
     * Get screen height
     */
    [[nodiscard]] uint16_t getHeight() const { return height; }
    
    /**
     * Get total memory usage of G-buffer
     */
    [[nodiscard]] size_t getMemoryUsage() const;
    
    /**
     * Debug: Dump G-buffer contents to file (development only)
     */
    void debugDump(const char* filename) const;
    
private:
    /**
     * Calculate tile index from coordinates
     */
    [[nodiscard]] uint16_t getTileIndex(uint8_t tileX, uint8_t tileY) const;
    
    /**
     * Calculate memory address for tile
     */
    [[nodiscard]] void* getTileMemoryAddress(uint8_t tileX, uint8_t tileY) const;
    
    /**
     * Setup RDP state for G-buffer rendering
     */
    void setupRDPState() const;
};

/**
 * Utility functions for packing/unpacking G-buffer data
 */
namespace GBufferPacking
{
    /**
     * Pack depth value (0.0-1.0) into 16-bit format
     */
    [[nodiscard]] uint16_t packDepth(float depth);
    
    /**
     * Unpack 16-bit depth to float (0.0-1.0)
     */
    [[nodiscard]] float unpackDepth(uint16_t packedDepth);
    
    /**
     * Pack normal vector (x, y, z) into 16 bits (8-bit X, 8-bit Y)
     * Z is reconstructed as sqrt(1 - x² - y²)
     */
    [[nodiscard]] uint16_t packNormal(float nx, float ny);
    
    /**
     * Unpack normal from 16 bits
     */
    [[nodiscard]] void unpackNormal(uint16_t packedNormal, float& nx, float& ny, float& nz);
    
    /**
     * Pack material properties into 8 bits
     * Bits: [0-3: Roughness] [4-7: Metallic]
     */
    [[nodiscard]] uint8_t packMaterial(float roughness, float metallic);
    
    /**
     * Unpack material properties from 8 bits
     */
    [[nodiscard]] void unpackMaterial(uint8_t packedMaterial, float& roughness, float& metallic);
    
    /**
     * Pack RGBA color into RGBA4444 format (16 bits)
     */
    [[nodiscard]] uint16_t packColorRGBA4444(uint8_t r, uint8_t g, uint8_t b, uint8_t a);
    
    /**
     * Unpack RGBA4444 color to 8-bit components
     */
    [[nodiscard]] void unpackColorRGBA4444(uint16_t packedColor, uint8_t& r, uint8_t& g, uint8_t& b, uint8_t& a);
    
    /**
     * Pack velocity vector into 16 bits (8-bit X, 8-bit Y)
     */
    [[nodiscard]] uint16_t packVelocity(float vx, float vy);
    
    /**
     * Unpack velocity from 16 bits
     */
    [[nodiscard]] void unpackVelocity(uint16_t packedVelocity, float& vx, float& vy);
}

/**
 * RSP microcode for G-buffer operations
 */
namespace GBufferRSP
{
    /**
     * Load G-buffer processing microcode
     */
    void loadMicrocode();
    
    /**
     * Process tile for geometry pass
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @param vertexData Pointer to vertex data for this tile
     * @param vertexCount Number of vertices in this tile
     */
    void processGeometryTile(uint8_t tileX, uint8_t tileY, const void* vertexData, uint32_t vertexCount);
    
    /**
     * Process tile for lighting pass
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @param lightData Pointer to light data affecting this tile
     * @param lightCount Number of lights affecting this tile
     */
    void processLightingTile(uint8_t tileX, uint8_t tileY, const void* lightData, uint32_t lightCount);
}

} // namespace Deferred
} // namespace P64