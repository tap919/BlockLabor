/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include "./Common.h"
#include "./GBuffer.h"
#include "../../jobs/JobSystem.h"

namespace P64::Deferred
{
    /**
     * Lighting calculation system for deferred rendering
     * Supports multiple light types with cartoon banding
     */
    class LightingSystem
    {
    private:
        // Reference to G-buffer
        GBuffer* gBuffer;
        
        // Job system for parallel lighting
        JobSystem* jobSystem;
        
        // Light data (passed from pipeline)
        struct LightData* lights;
        uint32_t lightCount;
        
        // Tile light lists (which lights affect which tiles)
        struct TileLightList* tileLightLists;
        
        // Lighting buffer (output)
        surface_t* lightingBuffer;
        
        // Configuration
        struct Config
        {
            bool enableCartoonBanding : 1;
            bool enableShadows : 1;
            bool enableSpecular : 1;
            bool enableAmbientOcclusion : 1;
            
            uint8_t bandCount; // 2, 3, or 4 bands for cartoon shading
            float bandThresholds[3]; // Thresholds between bands
            
            float ambientIntensity;
            color_t ambientColor;
            
            uint8_t padding[2];
        } config;
        
        // Performance counters
        uint64_t lightingTime;
        uint32_t tilesProcessed;
        uint32_t lightsProcessed;
        
    public:
        LightingSystem(GBuffer* buffer, JobSystem* jobs = nullptr);
        ~LightingSystem();
        
        // No copy/move
        LightingSystem(const LightingSystem&) = delete;
        LightingSystem& operator=(const LightingSystem&) = delete;
        LightingSystem(LightingSystem&&) = delete;
        LightingSystem& operator=(LightingSystem&&) = delete;
        
        /**
         * Initialize lighting system
         */
        void init();
        
        /**
         * Execute lighting pass for entire screen
         * @param outputBuffer Target surface for lighting result
         * @param lights Array of light data
         * @param count Number of lights
         */
        void executeLightingPass(surface_t* outputBuffer, const LightData* lights, uint32_t count);
        
        /**
         * Execute lighting for a single tile
         * @param tileX Tile X coordinate
         * @param tileY Tile Y coordinate
         * @param outputBuffer Target surface for lighting result
         */
        void executeTileLighting(uint8_t tileX, uint8_t tileY, surface_t* outputBuffer);
        
        /**
         * Calculate lighting for a single pixel
         * @param x Pixel X coordinate
         * @param y Pixel Y coordinate
         * @param lights Array of lights affecting this pixel
         * @param lightCount Number of lights
         * @return Computed color for this pixel
         */
        [[nodiscard]] color_t calculatePixelLighting(uint16_t x, uint16_t y, const LightData* lights, uint32_t lightCount) const;
        
        /**
         * Apply cartoon banding to lighting result
         * @param buffer Surface to apply banding to
         */
        void applyCartoonBanding(surface_t* buffer);
        
        /**
         * Get configuration
         */
        [[nodiscard]] const Config& getConfig() const { return config; }
        
        /**
         * Update configuration
         */
        void setConfig(const Config& newConfig) { config = newConfig; }
        
        /**
         * Get performance counters
         */
        [[nodiscard]] uint64_t getLightingTime() const { return lightingTime; }
        [[nodiscard]] uint32_t getTilesProcessed() const { return tilesProcessed; }
        [[nodiscard]] uint32_t getLightsProcessed() const { return lightsProcessed; }
        
        /**
         * Reset performance counters
         */
        void resetPerformanceCounters();
        
        /**
         * Debug: Visualize light influence
         */
        void debugVisualizeLightInfluence();
        
    private:
        /**
         * Calculate ambient lighting contribution
         */
        [[nodiscard]] color_t calculateAmbientLight(const MaterialData& material) const;
        
        /**
         * Calculate directional light contribution
         */
        [[nodiscard]] color_t calculateDirectionalLight(const LightData& light, const MaterialData& material,
                                                       const fm_vec3_t& normal, const fm_vec3_t& viewDir) const;
        
        /**
         * Calculate point light contribution
         */
        [[nodiscard]] color_t calculatePointLight(const LightData& light, const MaterialData& material,
                                                 const fm_vec3_t& position, const fm_vec3_t& normal,
                                                 const fm_vec3_t& viewDir) const;
        
        /**
         * Calculate spot light contribution
         */
        [[nodiscard]] color_t calculateSpotLight(const LightData& light, const MaterialData& material,
                                                const fm_vec3_t& position, const fm_vec3_t& normal,
                                                const fm_vec3_t& viewDir) const;
        
        /**
         * Calculate specular contribution (Blinn-Phong)
         */
        [[nodiscard]] color_t calculateSpecular(const LightData& light, const MaterialData& material,
                                               const fm_vec3_t& normal, const fm_vec3_t& viewDir,
                                               const fm_vec3_t& lightDir) const;
        
        /**
         * Apply attenuation for point/spot lights
         */
        [[nodiscard]] float calculateAttenuation(const LightData& light, float distance) const;
        
        /**
         * Apply spot light cone attenuation
         */
        [[nodiscard]] float calculateSpotCone(const LightData& light, const fm_vec3_t& lightDir) const;
        
        /**
         * Sample G-buffer at pixel coordinates
         */
        [[nodiscard]] bool sampleGBuffer(uint16_t x, uint16_t y, MaterialData& material,
                                        fm_vec3_t& position, fm_vec3_t& normal) const;
        
        /**
         * Reconstruct world position from depth
         */
        [[nodiscard]] fm_vec3_t reconstructPosition(uint16_t x, uint16_t y, float depth) const;
        
        /**
         * Quantize color to bands (cartoon shading)
         */
        [[nodiscard]] color_t quantizeToBands(color_t color) const;
        
        /**
         * Setup RDP state for lighting operations
         */
        void setupRDPState() const;
        
        /**
         * Process lighting tile using RSP (hardware acceleration)
         */
        void processTileWithRSP(uint8_t tileX, uint8_t tileY);
        
        /**
         * Process lighting tile using CPU (fallback)
         */
        void processTileWithCPU(uint8_t tileX, uint8_t tileY, surface_t* outputBuffer);
    };
    
    /**
     * RSP microcode for lighting calculations
     */
    namespace LightingRSP
    {
        /**
         * Load lighting microcode
         */
        void loadMicrocode();
        
        /**
         * Calculate lighting for tile using RSP
         * @param tileX Tile X coordinate
         * @param tileY Tile Y coordinate
         * @param gBufferData Pointer to G-buffer data for tile
         * @param lightData Pointer to light data affecting tile
         * @param lightCount Number of lights
         * @param outputData Pointer to output buffer for tile
         */
        void calculateTileLighting(uint8_t tileX, uint8_t tileY,
                                  const void* gBufferData,
                                  const void* lightData, uint32_t lightCount,
                                  void* outputData);
        
        /**
         * Apply cartoon banding using RSP
         * @param tileX Tile X coordinate
         * @param tileY Tile Y coordinate
         * @param inputData Pointer to input lighting data
         * @param outputData Pointer to output banded data
         * @param bandCount Number of bands (2, 3, or 4)
         */
        void applyCartoonBanding(uint8_t tileX, uint8_t tileY,
                                const void* inputData, void* outputData,
                                uint8_t bandCount);
    }
    
    /**
     * Utility functions for lighting calculations
     */
    namespace LightingUtils
    {
        /**
         * Calculate diffuse lighting (Lambert)
         */
        [[nodiscard]] float calculateDiffuse(const fm_vec3_t& normal, const fm_vec3_t& lightDir);
        
        /**
         * Calculate specular lighting (Blinn-Phong)
         */
        [[nodiscard]] float calculateSpecular(const fm_vec3_t& normal, const fm_vec3_t& viewDir,
                                             const fm_vec3_t& lightDir, float roughness);
        
        /**
         * Calculate Fresnel term
         */
        [[nodiscard]] float calculateFresnel(const fm_vec3_t& viewDir, const fm_vec3_t& halfDir,
                                            float metallic);
        
        /**
         * Calculate normal distribution (GGX/Trowbridge-Reitz)
         */
        [[nodiscard]] float calculateNDF(const fm_vec3_t& normal, const fm_vec3_t& halfDir,
                                        float roughness);
        
        /**
         * Calculate geometry shadowing (Smith)
         */
        [[nodiscard]] float calculateGeometry(const fm_vec3_t& normal, const fm_vec3_t& viewDir,
                                             const fm_vec3_t& lightDir, float roughness);
        
        /**
         * Convert linear to sRGB
         */
        [[nodiscard]] float linearToSRGB(float linear);
        
        /**
         * Convert sRGB to linear
         */
        [[nodiscard]] float sRGBToLinear(float srgb);
        
        /**
         * Apply tone mapping (Reinhard)
         */
        [[nodiscard]] color_t applyToneMapping(color_t color, float exposure);
        
        /**
         * Apply gamma correction
         */
        [[nodiscard]] color_t applyGammaCorrection(color_t color, float gamma);
        
        /**
         * Blend colors with alpha
         */
        [[nodiscard]] color_t blendColors(color_t src, color_t dst, float alpha);
        
        /**
         * Calculate light bounding sphere for culling
         */
        [[nodiscard]] bool lightAffectsTile(const LightData& light,
                                           uint8_t tileX, uint8_t tileY,
                                           uint16_t screenWidth, uint16_t screenHeight);
    }
}