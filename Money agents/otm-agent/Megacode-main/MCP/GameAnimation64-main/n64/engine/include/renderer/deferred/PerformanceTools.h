/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Performance profiling and optimization tools for deferred rendering pipeline
 */
#pragma once

#include <libdragon.h>
#include <t3d/t3d.h>
#include "./Common.h"
#include "../../debug/overlay.h"
#include "../../lib/logger.h"
#include "./DeferredPipeline.h"
#include "./shadows/ShadowMapping.h"
#include "./MaterialSystem.h"
#include "./ParticleSystem.h"
#include "./IntegrationSystem.h"

namespace P64::Deferred::Performance
{
    /**
     * Performance measurement units
     */
    enum class MeasurementUnit : uint8_t
    {
        MICROSECONDS = 0,   // Microseconds (µs)
        MILLISECONDS = 1,   // Milliseconds (ms)
        PERCENT = 2,        // Percentage (%)
        COUNT = 3,          // Raw count
        BYTES = 4,          // Bytes
        MEGABYTES = 5       // Megabytes
    };
    
    /**
     * Performance measurement point
     */
    struct MeasurementPoint
    {
        const char* name;           // Measurement name
        uint64_t value;             // Measured value
        MeasurementUnit unit;       // Measurement unit
        uint64_t timestamp;         // Timestamp (frame number)
        
        // Statistics
        uint64_t minValue;          // Minimum value
        uint64_t maxValue;          // Maximum value
        uint64_t totalValue;        // Total for averaging
        uint32_t sampleCount;       // Number of samples
        
        uint8_t padding[12];
    };
    
    /**
     * Performance profiler for deferred rendering pipeline
     */
    class PerformanceProfiler
    {
    private:
        // Measurement points
        std::vector<MeasurementPoint> measurements;
        uint32_t maxMeasurements;
        
        // Frame timing
        uint64_t frameStartTime;
        uint64_t frameEndTime;
        uint64_t lastFrameTime;
        uint32_t frameNumber;
        
        // History buffers for graphs
        static constexpr uint32_t HISTORY_SIZE = 120; // 2 seconds at 60 FPS
        uint64_t frameTimeHistory[HISTORY_SIZE];
        uint32_t triangleHistory[HISTORY_SIZE];
        uint32_t memoryHistory[HISTORY_SIZE];
        uint32_t historyIndex;
        
        // System references for profiling
        RenderPipelineDeferred* deferredPipeline;
        Shadows::ShadowManager* shadowManager;
        Materials::MaterialManager* materialManager;
        Particles::ParticleSystemManager* particleManager;
        Integration::IntegrationManager* integrationManager;
        
        // Configuration
        bool enabled;
        bool recordHistory;
        bool showOverlay;
        uint32_t updateInterval;    // Frames between updates
        
        // Overlay display
        Debug::Overlay* overlay;
        uint32_t overlayLines;
        
    public:
        PerformanceProfiler(uint32_t maxPoints = 64);
        ~PerformanceProfiler();
        
        /**
         * Initialize profiler
         */
        void init();
        
        /**
         * Start frame measurement
         */
        void beginFrame();
        
        /**
         * End frame measurement
         */
        void endFrame();
        
        /**
         * Start measurement for a specific operation
         */
        void beginMeasurement(const char* name);
        
        /**
         * End measurement for a specific operation
         */
        void endMeasurement(const char* name);
        
        /**
         * Record measurement value
         */
        void recordMeasurement(const char* name, uint64_t value, MeasurementUnit unit);
        
        /**
         * Update system references for automatic profiling
         */
        void updateSystemReferences(RenderPipelineDeferred* pipeline = nullptr,
                                  Shadows::ShadowManager* shadows = nullptr,
                                  Materials::MaterialManager* materials = nullptr,
                                  Particles::ParticleSystemManager* particles = nullptr,
                                  Integration::IntegrationManager* integration = nullptr);
        
        /**
         * Perform automatic profiling of all systems
         */
        void profileAllSystems();
        
        /**
         * Update performance overlay
         */
        void updateOverlay();
        
        /**
         * Show/hide performance overlay
         */
        void setOverlayVisible(bool visible);
        
        /**
         * Get measurement by name
         */
        [[nodiscard]] const MeasurementPoint* getMeasurement(const char* name) const;
        
        /**
         * Get frame time statistics
         */
        void getFrameTimeStats(uint64_t& avg, uint64_t& min, uint64_t& max) const;
        
        /**
         * Get memory usage statistics
         */
        void getMemoryStats(size_t& used, size_t& total, float& percent) const;
        
        /**
         * Get performance report as string
         */
        [[nodiscard]] std::string getPerformanceReport() const;
        
        /**
         * Save performance data to file
         */
        bool saveToFile(const char* filename) const;
        
        /**
         * Load performance data from file
         */
        bool loadFromFile(const char* filename);
        
        /**
         * Reset all measurements
         */
        void reset();
        
        /**
         * Enable/disable profiling
         */
        void setEnabled(bool enable) { enabled = enable; }
        
        /**
         * Check if profiling is enabled
         */
        [[nodiscard]] bool isEnabled() const { return enabled; }
        
        /**
         * Debug: Dump all measurements
         */
        void debugDumpMeasurements() const;
        
    private:
        /**
         * Find measurement index by name
         */
        [[nodiscard]] int32_t findMeasurementIndex(const char* name) const;
        
        /**
         * Create new measurement point
         */
        [[nodiscard]] MeasurementPoint* createMeasurement(const char* name, MeasurementUnit unit);
        
        /**
         * Update measurement statistics
         */
        void updateMeasurementStats(MeasurementPoint& point, uint64_t value);
        
        /**
         * Convert value to string with unit
         */
        [[nodiscard]] std::string valueToString(uint64_t value, MeasurementUnit unit) const;
        
        /**
         * Update history buffers
         */
        void updateHistory();
        
        /**
         * Draw performance graphs
         */
        void drawGraphs(surface_t* target) const;
        
        /**
         * Get current time in microseconds
         */
        [[nodiscard]] uint64_t getCurrentTime() const;
    };
    
    /**
     * Optimization advisor for deferred rendering
     */
    class OptimizationAdvisor
    {
    private:
        // Performance thresholds
        struct Thresholds
        {
            uint64_t targetFrameTime;       // Target frame time (µs)
            uint64_t warningFrameTime;      // Warning frame time (µs)
            uint64_t criticalFrameTime;     // Critical frame time (µs)
            
            size_t targetMemoryUsage;       // Target memory usage (bytes)
            size_t warningMemoryUsage;      // Warning memory usage (bytes)
            size_t criticalMemoryUsage;     // Critical memory usage (bytes)
            
            uint32_t targetTriangleCount;   // Target triangles per frame
            uint32_t warningTriangleCount;  // Warning triangles per frame
            uint32_t criticalTriangleCount; // Critical triangles per frame
            
            uint8_t padding[12];
        } thresholds;
        
        // System references
        PerformanceProfiler* profiler;
        RenderPipelineDeferred* deferredPipeline;
        
        // Optimization suggestions
        struct OptimizationSuggestion
        {
            const char* issue;              // Performance issue
            const char* suggestion;         // Optimization suggestion
            uint8_t priority;               // Priority (1-10, 10 = highest)
            bool applied;                   // Suggestion has been applied
            
            uint8_t padding[6];
        };
        
        std::vector<OptimizationSuggestion> suggestions;
        
        // Configuration
        bool autoApplySuggestions;          // Automatically apply optimizations
        uint32_t checkInterval;             // Frames between checks
        
    public:
        OptimizationAdvisor(PerformanceProfiler* profilerRef,
                          RenderPipelineDeferred* pipeline = nullptr);
        ~OptimizationAdvisor();
        
        /**
         * Initialize advisor with default thresholds
         */
        void init();
        
        /**
         * Analyze performance and generate suggestions
         */
        void analyzePerformance();
        
        /**
         * Apply optimization suggestions
         */
        void applyOptimizations();
        
        /**
         * Get optimization suggestions
         */
        [[nodiscard]] const std::vector<OptimizationSuggestion>& getSuggestions() const {
            return suggestions;
        }
        
        /**
         * Get specific suggestion by issue
         */
        [[nodiscard]] const OptimizationSuggestion* getSuggestion(const char* issue) const;
        
        /**
         * Set performance thresholds
         */
        void setThresholds(const Thresholds& newThresholds);
        
        /**
         * Get current thresholds
         */
        [[nodiscard]] const Thresholds& getThresholds() const { return thresholds; }
        
        /**
         * Enable/disable auto-apply
         */
        void setAutoApply(bool enable) { autoApplySuggestions = enable; }
        
        /**
         * Check if auto-apply is enabled
         */
        [[nodiscard]] bool isAutoApplyEnabled() const { return autoApplySuggestions; }
        
        /**
         * Generate optimization report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Save optimization report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Reset advisor state
         */
        void reset();
        
        /**
         * Debug: Dump all suggestions
         */
        void debugDumpSuggestions() const;
        
    private:
        /**
         * Check frame time performance
         */
        void checkFrameTime();
        
        /**
         * Check memory usage
         */
        void checkMemoryUsage();
        
        /**
         * Check triangle count
         */
        void checkTriangleCount();
        
        /**
         * Check lighting performance
         */
        void checkLightingPerformance();
        
        /**
         * Check shadow performance
         */
        void checkShadowPerformance();
        
        /**
         * Check material performance
         */
        void checkMaterialPerformance();
        
        /**
         * Check particle performance
         */
        void checkParticlePerformance();
        
        /**
         * Add optimization suggestion
         */
        void addSuggestion(const char* issue, const char* suggestion, uint8_t priority);
        
        /**
         * Apply frame time optimizations
         */
        void applyFrameTimeOptimizations();
        
        /**
         * Apply memory optimizations
         */
        void applyMemoryOptimizations();
        
        /**
         * Apply triangle count optimizations
         */
        void applyTriangleOptimizations();
        
        /**
         * Apply lighting optimizations
         */
        void applyLightingOptimizations();
        
        /**
         * Apply shadow optimizations
         */
        void applyShadowOptimizations();
        
        /**
         * Apply material optimizations
         */
        void applyMaterialOptimizations();
        
        /**
         * Apply particle optimizations
         */
        void applyParticleOptimizations();
    };
    
    /**
     * Performance testing framework
     */
    class PerformanceTestFramework
    {
    private:
        // Test configurations
        struct TestConfig
        {
            const char* name;               // Test name
            uint32_t durationFrames;        // Test duration in frames
            uint32_t warmupFrames;          // Warmup frames before measurement
            
            // Test parameters
            uint32_t objectCount;           // Number of objects
            uint32_t lightCount;            // Number of lights
            uint32_t materialCount;         // Number of materials
            uint32_t particleCount;         // Number of particles
            
            bool enableShadows;             // Enable shadows
            bool enableBloom;               // Enable bloom/HDR
            bool enableAA;                  // Enable anti-aliasing
            
            uint8_t padding[10];
        };
        
        std::vector<TestConfig> testConfigs;
        
        // Test results
        struct TestResult
        {
            const char* testName;           // Test name
            uint64_t avgFrameTime;          // Average frame time (µs)
            uint64_t minFrameTime;          // Minimum frame time (µs)
            uint64_t maxFrameTime;          // Maximum frame time (µs)
            uint32_t avgTriangles;          // Average triangles per frame
            uint32_t avgObjects;            // Average objects per frame
            size_t avgMemory;               // Average memory usage (bytes)
            float fps;                      // Average FPS
            
            uint8_t padding[12];
        };
        
        std::vector<TestResult> testResults;
        
        // System references
        Integration::IntegrationManager* integrationManager;
        PerformanceProfiler* profiler;
        
        // Test state
        bool isRunning;
        uint32_t currentTest;
        uint32_t currentFrame;
        uint32_t totalFrames;
        
    public:
        PerformanceTestFramework(Integration::IntegrationManager* integration,
                               PerformanceProfiler* profilerRef);
        ~PerformanceTestFramework();
        
        /**
         * Initialize test framework with default tests
         */
        void init();
        
        /**
         * Add test configuration
         */
        void addTest(const TestConfig& config);
        
        /**
         * Run all tests
         */
        void runAllTests();
        
        /**
         * Run specific test
         */
        void runTest(uint32_t testIndex);
        
        /**
         * Update test framework (call each frame)
         */
        void update();
        
        /**
         * Get test results
         */
        [[nodiscard]] const std::vector<TestResult>& getResults() const {
            return testResults;
        }
        
        /**
         * Generate test report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Save test report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Compare test results
         */
        [[nodiscard]] std::string compareResults(uint32_t test1, uint32_t test2) const;
        
        /**
         * Check if tests are running
         */
        [[nodiscard]] bool isTestRunning() const { return isRunning; }
        
        /**
         * Get current test progress (0.0-1.0)
         */
        [[nodiscard]] float getProgress() const;
        
        /**
         * Reset test framework
         */
        void reset();
        
        /**
         * Debug: Dump all test results
         */
        void debugDumpResults() const;
        
    private:
        /**
         * Setup test scene
         */
        void setupTestScene(const TestConfig& config);
        
        /**
         * Run test frame
         */
        void runTestFrame();
        
        /**
         * Collect test results
         */
        void collectResults(const TestConfig& config);
        
        /**
         * Calculate test statistics
         */
        void calculateStatistics(TestResult& result);
        
        /**
         * Create test scene with objects
         */
        void createTestObjects(uint32_t count);
        
        /**
         * Create test lights
         */
        void createTestLights(uint32_t count);
        
        /**
         * Create test materials
         */
        void createTestMaterials(uint32_t count);
        
        /**
         * Create test particles
         */
        void createTestParticles(uint32_t count);
        
        /**
         * Cleanup test scene
         */
        void cleanupTestScene();
    };
    
    /**
     * Memory profiler for deferred rendering
     */
    class MemoryProfiler
    {
    private:
        // Memory allocation tracking
        struct AllocationInfo
        {
            void* address;                  // Allocation address
            size_t size;                    // Allocation size
            const char* tag;                // Allocation tag
            MemoryRegion region;            // Memory region
            uint64_t timestamp;             // Allocation timestamp
            
            uint8_t padding[12];
        };
        
        std::vector<AllocationInfo> allocations;
        
        // Memory usage by system
        struct SystemMemoryUsage
        {
            const char* systemName;         // System name
            size_t currentUsage;            // Current memory usage
            size_t peakUsage;               // Peak memory usage
            size_t totalAllocations;        // Total allocations
            size_t totalFrees;              // Total frees
            
            uint8_t padding[12];
        };
        
        std::vector<SystemMemoryUsage> systemUsage;
        
        // System references
        RenderPipelineDeferred* deferredPipeline;
        Shadows::ShadowManager* shadowManager;
        Materials::MaterialManager* materialManager;
        Particles::ParticleSystemManager* particleManager;
        
        // Configuration
        bool trackAllocations;
        bool detectLeaks;
        uint32_t updateInterval;
        
    public:
        MemoryProfiler();
        ~MemoryProfiler();
        
        /**
         * Initialize memory profiler
         */
        void init();
        
        /**
         * Track memory allocation
         */
        void trackAllocation(void* address, size_t size, const char* tag,
                            MemoryRegion region = MemoryRegion::RDRAM);
        
        /**
         * Track memory free
         */
        void trackFree(void* address);
        
        /**
         * Update system memory usage
         */
        void updateSystemUsage();
        
        /**
         * Get total memory usage
         */
        [[nodiscard]] size_t getTotalUsage() const;
        
        /**
         * Get memory usage by region
         */
        [[nodiscard]] size_t getUsageByRegion(MemoryRegion region) const;
        
        /**
         * Get memory usage by system
         */
        [[nodiscard]] const SystemMemoryUsage* getSystemUsage(const char* systemName) const;
        
        /**
         * Check for memory leaks
         */
        [[nodiscard]] std::vector<AllocationInfo> checkLeaks() const;
        
        /**
         * Generate memory report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Save memory report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Reset memory profiler
         */
        void reset();
        
        /**
         * Enable/disable allocation tracking
         */
        void setTrackingEnabled(bool enable) { trackAllocations = enable; }
        
        /**
         * Enable/disable leak detection
         */
        void setLeakDetectionEnabled(bool enable) { detectLeaks = enable; }
        
        /**
         * Debug: Dump all allocations
         */
        void debugDumpAllocations() const;
        
    private:
        /**
         * Find allocation by address
         */
        [[nodiscard]] int32_t findAllocationIndex(void* address) const;
        
        /**
         * Find system usage by name
         */
        [[nodiscard]] int32_t findSystemUsageIndex(const char* systemName) const;
        
        /**
         * Update system usage entry
         */
        void updateSystemUsageEntry(const char* systemName, size_t usage);
        
        /**
         * Get current timestamp
         */
        [[nodiscard]] uint64_t getCurrentTimestamp() const;
    };
    
    /**
     * Example performance optimization scenarios
     */
    namespace ExampleOptimizations
    {
        /**
         * Optimize for low memory (4MB RDRAM)
         */
        void optimizeForLowMemory(RenderPipelineDeferred* pipeline,
                                 Shadows::ShadowManager* shadows,
                                 Materials::MaterialManager* materials);
        
        /**
         * Optimize for high performance (60 FPS target)
         */
        void optimizeForHighPerformance(RenderPipelineDeferred* pipeline,
                                       Shadows::ShadowManager* shadows,
                                       Materials::MaterialManager* materials);
        
        /**
         * Optimize for visual quality
         */
        void optimizeForVisualQuality(RenderPipelineDeferred* pipeline,
                                     Shadows::ShadowManager* shadows,
                                     Materials::MaterialManager* materials);
        
        /**
         * Optimize for complex scenes (many objects)
         */
        void optimizeForComplexScenes(RenderPipelineDeferred* pipeline,
                                     Shadows::ShadowManager* shadows,
                                     Materials::MaterialManager* materials);
        
        /**
         * Optimize for many lights
         */
        void optimizeForManyLights(RenderPipelineDeferred* pipeline,
                                  Shadows::ShadowManager* shadows);
        
        /**
         * Optimize for particle effects
         */
        void optimizeForParticles(Particles::ParticleSystemManager* particles);
    }
}