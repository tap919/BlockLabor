/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Testing and benchmarking framework for deferred rendering pipeline
 * Includes hardware testing, emulator validation, and performance benchmarks
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
#include "./PerformanceTools.h"

namespace P64::Deferred::Testing
{
    /**
     * Test hardware platforms
     */
    enum class TestPlatform : uint8_t
    {
        N64_CONSOLE = 0,           // Actual N64 console
        N64_EXPANSION = 1,         // N64 with Expansion Pak
        EMULATOR_ARES = 2,         // Ares emulator
        EMULATOR_GOPHER64 = 3,     // gopher64 emulator
        EMULATOR_PJ64 = 4,         // Project64 emulator
        DEVELOPMENT = 5            // Development hardware (64Drive, EverDrive)
    };
    
    /**
     * Test result status
     */
    enum class TestStatus : uint8_t
    {
        NOT_RUN = 0,               // Test not yet run
        PASSED = 1,                // Test passed
        FAILED = 2,                // Test failed
        WARNING = 3,               // Test passed with warnings
        SKIPPED = 4,               // Test skipped
        RUNNING = 5                // Test currently running
    };
    
    /**
     * Hardware test configuration
     */
    struct HardwareTestConfig
    {
        TestPlatform platform;     // Platform to test on
        bool requireExpansionPak;  // Require Expansion Pak
        bool requireRumblePak;     // Require Rumble Pak
        bool requireTransferPak;   // Require Transfer Pak
        
        // Memory configuration
        size_t minMemory;          // Minimum memory required (bytes)
        size_t maxMemory;          // Maximum memory available (bytes)
        
        // Performance requirements
        uint64_t maxFrameTime;     // Maximum allowed frame time (µs)
        uint32_t minFPS;           // Minimum required FPS
        uint32_t targetFPS;        // Target FPS
        
        // Quality requirements
        float minTriangleBudget;   // Minimum triangle budget
        float maxMemoryUsage;      // Maximum memory usage percentage
        
        uint8_t padding[12];
    };
    
    /**
     * Test case definition
     */
    struct TestCase
    {
        const char* name;          // Test case name
        const char* description;   // Test description
        
        // Test configuration
        uint32_t durationFrames;   // Test duration in frames
        uint32_t warmupFrames;     // Warmup frames
        bool isPerformanceTest;    // Performance test (vs functional test)
        bool isStressTest;         // Stress test (pushes limits)
        
        // Test parameters
        uint32_t objectCount;      // Number of objects
        uint32_t lightCount;       // Number of lights
        uint32_t materialCount;    // Number of materials
        uint32_t particleCount;    // Number of particles
        
        // Features to test
        bool testShadows;          // Test shadow mapping
        bool testBloom;            // Test bloom/HDR
        bool testParticles;        // Test particle system
        bool testMaterials;        // Test material system
        bool testLighting;         // Test lighting system
        
        uint8_t padding[10];
    };
    
    /**
     * Test result data
     */
    struct TestResult
    {
        const char* testName;      // Test name
        TestStatus status;         // Test status
        TestPlatform platform;     // Test platform
        
        // Performance metrics
        uint64_t avgFrameTime;     // Average frame time (µs)
        uint64_t minFrameTime;     // Minimum frame time (µs)
        uint64_t maxFrameTime;     // Maximum frame time (µs)
        uint32_t avgFPS;           // Average FPS
        uint32_t minFPS;           // Minimum FPS
        uint32_t maxFPS;           // Maximum FPS
        
        // Resource usage
        uint32_t avgTriangles;     // Average triangles per frame
        size_t avgMemory;          // Average memory usage (bytes)
        size_t peakMemory;         // Peak memory usage (bytes)
        
        // Quality metrics
        float shadowQuality;       // Shadow quality score (0-1)
        float lightingQuality;     // Lighting quality score (0-1)
        float materialQuality;     // Material quality score (0-1)
        
        // Error information
        const char* errorMessage;  // Error message if failed
        uint32_t errorCode;        // Error code
        
        uint8_t padding[12];
    };
    
    /**
     * Hardware testing framework
     */
    class HardwareTestFramework
    {
    private:
        // Test configurations
        std::vector<HardwareTestConfig> hardwareConfigs;
        std::vector<TestCase> testCases;
        std::vector<TestResult> testResults;
        
        // System references
        Integration::IntegrationManager* integrationManager;
        Performance::PerformanceProfiler* profiler;
        Performance::PerformanceTestFramework* perfTests;
        
        // Current test state
        TestPlatform currentPlatform;
        HardwareTestConfig currentConfig;
        TestCase currentTestCase;
        TestResult currentResult;
        
        bool isTesting;
        bool isCalibrating;
        uint32_t currentFrame;
        uint32_t totalFrames;
        uint32_t currentTestIndex;
        
        // Calibration data
        struct CalibrationData
        {
            uint64_t baseFrameTime;    // Base frame time (no rendering)
            size_t baseMemoryUsage;    // Base memory usage
            uint32_t systemOverhead;   // System overhead in microseconds
            
            uint8_t padding[12];
        } calibration;
        
        // Error logging
        std::vector<std::string> errorLog;
        
    public:
        HardwareTestFramework(Integration::IntegrationManager* integration,
                            Performance::PerformanceProfiler* profilerRef,
                            Performance::PerformanceTestFramework* perfTestRef);
        ~HardwareTestFramework();
        
        /**
         * Initialize test framework
         */
        void init();
        
        /**
         * Detect current hardware platform
         */
        [[nodiscard]] TestPlatform detectPlatform() const;
        
        /**
         * Calibrate system for testing
         */
        void calibrateSystem();
        
        /**
         * Run all tests for current platform
         */
        void runAllTests();
        
        /**
         * Run specific test case
         */
        void runTestCase(uint32_t testIndex);
        
        /**
         * Run hardware compatibility tests
         */
        void runCompatibilityTests();
        
        /**
         * Run performance regression tests
         */
        void runRegressionTests();
        
        /**
         * Run stress tests
         */
        void runStressTests();
        
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
         * Get results for specific platform
         */
        [[nodiscard]] std::vector<TestResult> getResultsForPlatform(TestPlatform platform) const;
        
        /**
         * Generate test report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Generate compatibility matrix
         */
        [[nodiscard]] std::string generateCompatibilityMatrix() const;
        
        /**
         * Save test report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Compare results across platforms
         */
        [[nodiscard]] std::string comparePlatforms() const;
        
        /**
         * Check if testing is in progress
         */
        [[nodiscard]] bool isTestInProgress() const { return isTesting; }
        
        /**
         * Get current test progress (0.0-1.0)
         */
        [[nodiscard]] float getProgress() const;
        
        /**
         * Get calibration data
         */
        [[nodiscard]] const CalibrationData& getCalibrationData() const { return calibration; }
        
        /**
         * Reset test framework
         */
        void reset();
        
        /**
         * Add error to log
         */
        void logError(const char* message, uint32_t code = 0);
        
        /**
         * Get error log
         */
        [[nodiscard]] const std::vector<std::string>& getErrorLog() const { return errorLog; }
        
        /**
         * Clear error log
         */
        void clearErrorLog();
        
        /**
         * Debug: Dump all test results
         */
        void debugDumpResults() const;
        
    private:
        /**
         * Setup test for current platform
         */
        void setupTestPlatform();
        
        /**
         * Setup test scene for test case
         */
        void setupTestScene();
        
        /**
         * Run test frame
         */
        void runTestFrame();
        
        /**
         * Collect test results
         */
        void collectResults();
        
        /**
         * Validate test results
         */
        [[nodiscard]] TestStatus validateResults() const;
        
        /**
         * Calculate quality metrics
         */
        void calculateQualityMetrics();
        
        /**
         * Check hardware compatibility
         */
        [[nodiscard]] bool checkHardwareCompatibility() const;
        
        /**
         * Check memory availability
         */
        [[nodiscard]] bool checkMemoryAvailability() const;
        
        /**
         * Check performance requirements
         */
        [[nodiscard]] bool checkPerformanceRequirements() const;
        
        /**
         * Run calibration test
         */
        void runCalibrationTest();
        
        /**
         * Create test scene with objects
         */
        void createTestSceneObjects();
        
        /**
         * Create test scene lights
         */
        void createTestSceneLights();
        
        /**
         * Create test scene materials
         */
        void createTestSceneMaterials();
        
        /**
         * Create test scene particles
         */
        void createTestSceneParticles();
        
        /**
         * Cleanup test scene
         */
        void cleanupTestScene();
        
        /**
         * Get platform name
         */
        [[nodiscard]] const char* getPlatformName(TestPlatform platform) const;
    };
    
    /**
     * Benchmark comparison framework
     */
    class BenchmarkComparison
    {
    private:
        // Benchmark data
        struct BenchmarkData
        {
            const char* name;              // Benchmark name
            TestPlatform platform;         // Platform
            uint64_t frameTime;            // Frame time (µs)
            uint32_t triangleCount;        // Triangle count
            size_t memoryUsage;            // Memory usage (bytes)
            float qualityScore;            // Quality score (0-1)
            
            uint8_t padding[12];
        };
        
        std::vector<BenchmarkData> benchmarks;
        
        // Reference data (forward rendering baseline)
        BenchmarkData forwardBaseline;
        BenchmarkData deferredBaseline;
        
        // Comparison results
        struct ComparisonResult
        {
            const char* benchmark;
            float speedup;                  // Speedup factor (>1 = faster)
            float memoryOverhead;           // Memory overhead factor
            float qualityImprovement;       // Quality improvement factor
            
            uint8_t padding[12];
        };
        
        std::vector<ComparisonResult> comparisons;
        
    public:
        BenchmarkComparison();
        ~BenchmarkComparison();
        
        /**
         * Initialize with baseline data
         */
        void init();
        
        /**
         * Add benchmark data
         */
        void addBenchmark(const BenchmarkData& data);
        
        /**
         * Set forward rendering baseline
         */
        void setForwardBaseline(const BenchmarkData& baseline);
        
        /**
         * Set deferred rendering baseline
         */
        void setDeferredBaseline(const BenchmarkData& baseline);
        
        /**
         * Compare all benchmarks
         */
        void compareAll();
        
        /**
         * Compare specific benchmarks
         */
        [[nodiscard]] ComparisonResult compareBenchmarks(const char* name1, const char* name2) const;
        
        /**
         * Compare deferred vs forward rendering
         */
        [[nodiscard]] ComparisonResult compareDeferredVsForward() const;
        
        /**
         * Generate comparison report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Generate performance summary
         */
        [[nodiscard]] std::string generatePerformanceSummary() const;
        
        /**
         * Generate memory usage summary
         */
        [[nodiscard]] std::string generateMemorySummary() const;
        
        /**
         * Generate quality comparison
         */
        [[nodiscard]] std::string generateQualityComparison() const;
        
        /**
         * Save comparison report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Get all benchmarks
         */
        [[nodiscard]] const std::vector<BenchmarkData>& getBenchmarks() const {
            return benchmarks;
        }
        
        /**
         * Get comparison results
         */
        [[nodiscard]] const std::vector<ComparisonResult>& getComparisons() const {
            return comparisons;
        }
        
        /**
         * Reset benchmark data
         */
        void reset();
        
        /**
         * Debug: Dump all benchmarks
         */
        void debugDumpBenchmarks() const;
        
    private:
        /**
         * Calculate speedup factor
         */
        [[nodiscard]] float calculateSpeedup(const BenchmarkData& ref, const BenchmarkData& test) const;
        
        /**
         * Calculate memory overhead
         */
        [[nodiscard]] float calculateMemoryOverhead(const BenchmarkData& ref, const BenchmarkData& test) const;
        
        /**
         * Calculate quality improvement
         */
        [[nodiscard]] float calculateQualityImprovement(const BenchmarkData& ref, const BenchmarkData& test) const;
        
        /**
         * Find benchmark by name
         */
        [[nodiscard]] const BenchmarkData* findBenchmark(const char* name) const;
    };
    
    /**
     * Validation test suite
     */
    class ValidationTestSuite
    {
    private:
        // Test results
        struct ValidationResult
        {
            const char* testName;
            TestStatus status;
            const char* message;
            uint32_t errorCode;
            
            uint8_t padding[12];
        };
        
        std::vector<ValidationResult> results;
        
        // System references
        RenderPipelineDeferred* deferredPipeline;
        Shadows::ShadowManager* shadowManager;
        Materials::MaterialManager* materialManager;
        Particles::ParticleSystemManager* particleManager;
        
    public:
        ValidationTestSuite(RenderPipelineDeferred* pipeline = nullptr,
                          Shadows::ShadowManager* shadows = nullptr,
                          Materials::MaterialManager* materials = nullptr,
                          Particles::ParticleSystemManager* particles = nullptr);
        ~ValidationTestSuite();
        
        /**
         * Run all validation tests
         */
        void runAllTests();
        
        /**
         * Run pipeline validation tests
         */
        void runPipelineTests();
        
        /**
         * Run shadow validation tests
         */
        void runShadowTests();
        
        /**
         * Run material validation tests
         */
        void runMaterialTests();
        
        /**
         * Run particle validation tests
         */
        void runParticleTests();
        
        /**
         * Run memory validation tests
         */
        void runMemoryTests();
        
        /**
         * Run performance validation tests
         */
        void runPerformanceTests();
        
        /**
         * Get validation results
         */
        [[nodiscard]] const std::vector<ValidationResult>& getResults() const {
            return results;
        }
        
        /**
         * Check if all tests passed
         */
        [[nodiscard]] bool allTestsPassed() const;
        
        /**
         * Generate validation report
         */
        [[nodiscard]] std::string generateReport() const;
        
        /**
         * Save validation report to file
         */
        bool saveReportToFile(const char* filename) const;
        
        /**
         * Reset validation suite
         */
        void reset();
        
        /**
         * Debug: Dump validation results
         */
        void debugDumpResults() const;
        
    private:
        /**
         * Add test result
         */
        void addResult(const char* testName, TestStatus status,
                      const char* message = nullptr, uint32_t errorCode = 0);
        
        /**
         * Test G-buffer integrity
         */
        void testGBufferIntegrity();
        
        /**
         * Test lighting calculations
         */
        void testLightingCalculations();
        
        /**
         * Test shadow map accuracy
         */
        void testShadowMapAccuracy();
        
        /**
         * Test material rendering
         */
        void testMaterialRendering();
        
        /**
         * Test particle simulation
         */
        void testParticleSimulation();
        
        /**
         * Test memory allocation
         */
        void testMemoryAllocation();
        
        /**
         * Test performance consistency
         */
        void testPerformanceConsistency();
        
        /**
         * Test error handling
         */
        void testErrorHandling();
    };
    
    /**
     * Example test configurations
     */
    namespace ExampleTests
    {
        /**
         * Create basic performance test
         */
        [[nodiscard]] TestCase createBasicPerformanceTest();
        
        /**
         * Create shadow quality test
         */
        [[nodiscard]] TestCase createShadowQualityTest();
        
        /**
         * Create material quality test
         */
        [[nodiscard]] TestCase createMaterialQualityTest();
        
        /**
         * Create particle performance test
         */
        [[nodiscard]] TestCase createParticlePerformanceTest();
        
        /**
         * Create memory stress test
         */
        [[nodiscard]] TestCase createMemoryStressTest();
        
        /**
         * Create triangle stress test
         */
        [[nodiscard]] TestCase createTriangleStressTest();
        
        /**
         * Create lighting stress test
         */
        [[nodiscard]] TestCase createLightingStressTest();
        
        /**
         * Create comprehensive test suite
         */
        [[nodiscard]] std::vector<TestCase> createComprehensiveTestSuite();
    }
    
    /**
     * Test utilities and helpers
     */
    namespace TestUtils
    {
        /**
         * Measure frame time accurately
         */
        [[nodiscard]] uint64_t measureFrameTime();
        
        /**
         * Measure memory usage
         */
        [[nodiscard]] size_t measureMemoryUsage();
        
        /**
         * Count rendered triangles
         */
        [[nodiscard]] uint32_t countRenderedTriangles();
        
        /**
         * Check if Expansion Pak is present
         */
        [[nodiscard]] bool hasExpansionPak();
        
        /**
         * Check if Rumble Pak is present
         */
        [[nodiscard]] bool hasRumblePak();
        
        /**
         * Get available memory
         */
        [[nodiscard]] size_t getAvailableMemory();
        
        /**
         * Get system overhead
         */
        [[nodiscard]] uint64_t getSystemOverhead();
        
        /**
         * Create test pattern for visual validation
         */
        void createTestPattern(surface_t* target);
        
        /**
         * Compare images for regression testing
         */
        [[nodiscard]] float compareImages(const surface_t* img1, const surface_t* img2);
        
        /**
         * Save image for reference
         */
        bool saveImage(const surface_t* image, const char* filename);
        
        /**
         * Load reference image
         */
        [[nodiscard]] surface_t* loadImage(const char* filename);
    }
    
    /**
     * Test result reporting functions
     */
    
    /**
     * Report test suite results
     */
    void reportTestSuiteResults(const TestSuiteResults& results);
    
    /**
     * Report individual test result
     */
    void reportIndividualTestResult(const TestResult& result);
    
    /**
     * Generate comprehensive test summary report
     */
    void generateTestSummaryReport();
    
    /**
     * Get the complete test report as string
     */
    [[nodiscard]] std::string getTestReport();
}