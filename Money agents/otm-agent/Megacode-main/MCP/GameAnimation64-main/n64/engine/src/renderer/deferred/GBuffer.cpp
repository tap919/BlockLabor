/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * G-buffer implementation for deferred rendering
 */

#include "renderer/deferred/GBuffer.h"
#include "lib/memory.h"
#include <cstring>

using namespace P64::Deferred;

/**
 * Initialize G-buffer with given dimensions
 */
GBuffer::GBuffer(uint16_t width, uint16_t height) 
    : width(width), height(height)
{
    // Calculate memory requirements
    size_t pixelCount = width * height;
    size_t bufferSize = pixelCount * sizeof(GBufferPixel);
    
    // Allocate G-buffer memory
    buffer = new GBufferPixel[pixelCount];
    
    // Create surfaces for individual channels (for debugging/visualization)
    albedoSurface = surface_alloc(FMT_RGBA16, width, height);
    normalSurface = surface_alloc(FMT_RGBA16, width, height);
    depthSurface = surface_alloc(FMT_RGBA16, width, height);
    materialSurface = surface_alloc(FMT_RGBA16, width, height);
}

/**
 * Clean up G-buffer
 */
GBuffer::~GBuffer()
{
    // Free G-buffer memory
    if (buffer) {
        delete[] buffer;
        buffer = nullptr;
    }
    
    // Free surfaces
    if (albedoSurface.buffer) {
        surface_free(&albedoSurface);
    }
    if (normalSurface.buffer) {
        surface_free(&normalSurface);
    }
    if (depthSurface.buffer) {
        surface_free(&depthSurface);
    }
    if (materialSurface.buffer) {
        surface_free(&materialSurface);
    }
}

/**
 * Initialize G-buffer
 */
void GBuffer::init()
{
    // Clear G-buffer
    clear();
    
    // Initialize surfaces
    memset(albedoSurface.buffer, 0, surface_get_size(&albedoSurface));
    memset(normalSurface.buffer, 0, surface_get_size(&normalSurface));
    memset(depthSurface.buffer, 0, surface_get_size(&depthSurface));
    memset(materialSurface.buffer, 0, surface_get_size(&materialSurface));
}

/**
 * Clear G-buffer
 */
void GBuffer::clear()
{
    if (!buffer) {
        return;
    }
    
    size_t pixelCount = width * height;
    memset(buffer, 0, pixelCount * sizeof(GBufferPixel));
    
    // Mark as cleared
    isCleared = true;
}

/**
 * Write pixel data to G-buffer
 */
void GBuffer::writePixel(uint16_t x, uint16_t y, const GBufferPixel& pixel)
{
    if (x >= width || y >= height || !buffer) {
        return;
    }
    
    uint32_t index = y * width + x;
    buffer[index] = pixel;
    isCleared = false;
}

/**
 * Read pixel data from G-buffer
 */
GBufferPixel GBuffer::readPixel(uint16_t x, uint16_t y) const
{
    if (x >= width || y >= height || !buffer || isCleared) {
        return GBufferPixel{};
    }
    
    uint32_t index = y * width + x;
    return buffer[index];
}

/**
 * Get albedo color at pixel coordinates
 */
color_t GBuffer::getAlbedo(uint16_t x, uint16_t y) const
{
    GBufferPixel pixel = readPixel(x, y);
    color_t color;
    color.r = pixel.albedoR;
    color.g = pixel.albedoG;
    color.b = pixel.albedoB;
    color.a = pixel.albedoA;
    return color;
}

/**
 * Get normal vector at pixel coordinates
 */
fm_vec3_t GBuffer::getNormal(uint16_t x, uint16_t y) const
{
    GBufferPixel pixel = readPixel(x, y);
    fm_vec3_t normal;
    
    // Decode normal from 16-bit packed format
    // Normal is stored as two 8-bit components (x, y), z is reconstructed
    float nx = (pixel.normalX / 127.5f) - 1.0f;
    float ny = (pixel.normalY / 127.5f) - 1.0f;
    
    // Reconstruct z component (assuming normalized vector)
    float nz_sq = 1.0f - (nx * nx + ny * ny);
    float nz = (nz_sq > 0.0f) ? sqrtf(nz_sq) : 0.0f;
    
    normal.x = nx;
    normal.y = ny;
    normal.z = nz;
    
    return normal;
}

/**
 * Get depth at pixel coordinates
 */
float GBuffer::getDepth(uint16_t x, uint16_t y) const
{
    GBufferPixel pixel = readPixel(x, y);
    
    // Decode depth from 16-bit fixed point
    float depth = pixel.depth / 65535.0f;
    return depth;
}

/**
 * Get material properties at pixel coordinates
 */
MaterialData GBuffer::getMaterial(uint16_t x, uint16_t y) const
{
    GBufferPixel pixel = readPixel(x, y);
    
    MaterialData material;
    material.baseColor.r = pixel.albedoR;
    material.baseColor.g = pixel.albedoG;
    material.baseColor.b = pixel.albedoB;
    material.baseColor.a = pixel.albedoA;
    
    material.roughness = pixel.roughness / 255.0f;
    material.metallic = pixel.metallic / 255.0f;
    material.emissiveIntensity = pixel.emissive / 255.0f;
    
    material.shadeBands = pixel.shadeBands;
    material.outlineColor.r = pixel.outlineR;
    material.outlineColor.g = pixel.outlineG;
    material.outlineColor.b = pixel.outlineB;
    material.outlineColor.a = 255;
    material.outlineThreshold = pixel.outlineThreshold / 255.0f;
    
    material.albedoTextureId = pixel.albedoTextureId;
    material.normalTextureId = pixel.normalTextureId;
    material.roughnessTextureId = pixel.roughnessTextureId;
    
    material.isTransparent = (pixel.flags & GBUFFER_FLAG_TRANSPARENT) != 0;
    material.isCutout = (pixel.flags & GBUFFER_FLAG_CUTOUT) != 0;
    material.isEmissive = (pixel.flags & GBUFFER_FLAG_EMISSIVE) != 0;
    material.receivesShadows = (pixel.flags & GBUFFER_FLAG_RECEIVES_SHADOWS) != 0;
    
    return material;
}

/**
 * Get world position at pixel coordinates (reconstructed from depth)
 */
fm_vec3_t GBuffer::getWorldPosition(uint16_t x, uint16_t y, const float viewProjectionMatrix[4][4]) const
{
    // This is a simplified version - in a real implementation,
    // we would need the inverse view-projection matrix
    float depth = getDepth(x, y);
    
    // Convert screen coordinates to normalized device coordinates
    float ndcX = (2.0f * x / width) - 1.0f;
    float ndcY = 1.0f - (2.0f * y / height); // Flip Y
    
    // For now, return a simple position based on depth
    fm_vec3_t position;
    position.x = ndcX * depth;
    position.y = ndcY * depth;
    position.z = depth;
    
    return position;
}

/**
 * Update debug surfaces for visualization
 */
void GBuffer::updateDebugSurfaces()
{
    if (!buffer || isCleared) {
        return;
    }
    
    size_t pixelCount = width * height;
    
    // Update albedo surface
    uint16_t* albedoData = (uint16_t*)albedoSurface.buffer;
    for (size_t i = 0; i < pixelCount; i++) {
        GBufferPixel pixel = buffer[i];
        uint16_t r = (pixel.albedoR >> 3) & 0x1F;
        uint16_t g = (pixel.albedoG >> 3) & 0x1F;
        uint16_t b = (pixel.albedoB >> 3) & 0x1F;
        uint16_t a = (pixel.albedoA >> 7) & 0x01;
        
        albedoData[i] = (r << 11) | (g << 6) | (b << 1) | a;
    }
    
    // Update normal surface
    uint16_t* normalData = (uint16_t*)normalSurface.buffer;
    for (size_t i = 0; i < pixelCount; i++) {
        GBufferPixel pixel = buffer[i];
        
        // Convert normal to color for visualization
        uint8_t r = (pixel.normalX + 127);
        uint8_t g = (pixel.normalY + 127);
        
        // Reconstruct z for blue channel
        float nx = (pixel.normalX / 127.5f) - 1.0f;
        float ny = (pixel.normalY / 127.5f) - 1.0f;
        float nz_sq = 1.0f - (nx * nx + ny * ny);
        float nz = (nz_sq > 0.0f) ? sqrtf(nz_sq) : 0.0f;
        uint8_t b = (uint8_t)((nz * 127.5f) + 127.5f);
        
        uint16_t packed = ((r >> 3) << 11) | ((g >> 3) << 6) | ((b >> 3) << 1) | 1;
        normalData[i] = packed;
    }
    
    // Update depth surface
    uint16_t* depthData = (uint16_t*)depthSurface.buffer;
    for (size_t i = 0; i < pixelCount; i++) {
        GBufferPixel pixel = buffer[i];
        uint8_t depthValue = pixel.depth >> 8; // Use high byte for visualization
        uint16_t packed = (depthValue << 8) | (depthValue << 3) | (depthValue >> 2) | 1;
        depthData[i] = packed;
    }
    
    // Update material surface
    uint16_t* materialData = (uint16_t*)materialSurface.buffer;
    for (size_t i = 0; i < pixelCount; i++) {
        GBufferPixel pixel = buffer[i];
        
        // Use roughness for red, metallic for green, emissive for blue
        uint8_t r = pixel.roughness;
        uint8_t g = pixel.metallic;
        uint8_t b = pixel.emissive;
        
        uint16_t packed = ((r >> 3) << 11) | ((g >> 3) << 6) | ((b >> 3) << 1) | 1;
        materialData[i] = packed;
    }
}

/**
 * Bind G-buffer for reading (sets up RDP state)
 */
void GBuffer::bindForReading() const
{
    // In a real implementation, this would set up texture units
    // to read from G-buffer surfaces
    
    // For now, just set a standard rendering mode
    rdpq_set_mode_standard();
    rdpq_mode_filter(FILTER_BILINEAR);
}

/**
 * Bind G-buffer for writing (sets up RDP state)
 */
void GBuffer::bindForWriting() const
{
    // In a real implementation, this would set up MRT (Multiple Render Targets)
    // to write to all G-buffer channels simultaneously
    
    // For now, just set a standard rendering mode
    rdpq_set_mode_standard();
    rdpq_mode_zbuf(true, true);
    rdpq_mode_persp(true);
}

/**
 * Get memory usage in bytes
 */
size_t GBuffer::getMemoryUsage() const
{
    size_t usage = 0;
    
    // G-buffer buffer
    if (buffer) {
        usage += width * height * sizeof(GBufferPixel);
    }
    
    // Debug surfaces
    if (albedoSurface.buffer) {
        usage += surface_get_size(&albedoSurface);
    }
    if (normalSurface.buffer) {
        usage += surface_get_size(&normalSurface);
    }
    if (depthSurface.buffer) {
        usage += surface_get_size(&depthSurface);
    }
    if (materialSurface.buffer) {
        usage += surface_get_size(&materialSurface);
    }
    
    return usage;
}