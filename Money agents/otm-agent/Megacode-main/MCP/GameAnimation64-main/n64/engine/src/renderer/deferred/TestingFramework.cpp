/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Testing and benchmarking framework implementation for deferred rendering pipeline
 */

#include "renderer/deferred/TestingFramework.h"
#include "renderer/deferred/PerformanceTools.h"
#include "debug/overlay.h"
#include "lib/logger.h"
#include <cstring>
#include <cmath>

using namespace P64::Deferred::Testing;

// Static instance for global access
static TestingFramework* g_testFramework = nullptr;

/**
 * Initialize testing framework
 */
TestingFramework::TestingFramework()
    : currentTestIndex(0)
    , totalTestsPassed(0)
    , totalTestsFailed(0)
    , totalTestsSkipped(0)
    , isRunning(false)
    , currentPlatform(TestPlatform::DEVELOPMENT)
    , requireExpansionPak(false)
{
    // Initialize test cases
    initializeTestCases();
    
    // Initialize hardware configurations
    initializeHardwareConfigs();
}

/**
 * Clean up testing framework
 */
TestingFramework::~TestingFramework()
{
    if (g_testFramework == this) {
        g_testFramework = nullptr;
    }
}

/**
 * Initialize test framework
 */
void TestingFramework::init()
{
    // Detect current platform
    detectPlatform();
    
    // Check hardware requirements
    checkHardwareRequirements();
    
    // Initialize performance profiler
    performanceProfiler.init();
    
    // Set as global instance
    g_testFramework = this;
    
    Logger::info("[TestingFramework] Initialized");
    Logger::info("[TestingFramework] Platform: %s", getPlatformName(currentPlatform).c_str());
}

/**
 * Run all hardware tests
 */
TestResult TestingFramework::runHardwareTests()
{
    Logger::info("[TestingFramework] Running hardware tests...");
    
    TestResult overallResult;
    overallResult.status = TestStatus::PASSED;
    overallResult.testName = "Hardware Test Suite";
    overallResult.startTime = timer_ticks();
    
    // Run memory tests
    TestResult memoryTest = testMemory();
    overallResult.subResults.push_back(memoryTest);
    
    // Run RSP tests
    TestResult rspTest = testRSP();
    overallResult.subResults.push_back(rspTest);
    
    // Run RDP tests
    TestResult rdpTest = testRDP();
    overallResult.subResults.push_back(rdpTest);
    
    // Run texture memory tests
    TestResult textureTest = testTextureMemory();
    overallResult.subResults.push_back(textureTest);
    
    // Run framebuffer tests
    TestResult fbTest = testFramebuffer();
    overallResult.subResults.push_back(fbTest);
    
    // Update overall status
    overallResult.endTime = timer_ticks();
    overallResult.duration = overallResult.endTime - overallResult.startTime;
    
    // Check if any sub-test failed
    for (const auto& subResult : overallResult.subResults) {
        if (subResult.status == TestStatus::FAILED) {
            overallResult.status = TestStatus::FAILED;
            overallResult.errorMessage = "One or more hardware tests failed";
            break;
        }
    }
    
    // Log results
    logTestResult(overallResult);
    
    return overallResult;
}

/**
 * Run performance benchmarks
 */
BenchmarkResult TestingFramework::runPerformanceBenchmarks()
{
    Logger::info("[TestingFramework] Running performance benchmarks...");
    
    BenchmarkResult result;
    result.platform = currentPlatform;
    result.timestamp = timer_ticks();
    
    // Run geometry pass benchmark
    BenchmarkData geometryBenchmark = benchmarkGeometryPass();
    result.benchmarks.push_back(geometryBenchmark);
    
    // Run lighting pass benchmark
    BenchmarkData lightingBenchmark = benchmarkLightingPass();
    result.benchmarks.push_back(lightingBenchmark);
    
    // Run shadow mapping benchmark
    BenchmarkData shadowBenchmark = benchmarkShadowMapping();
    result.benchmarks.push_back(shadowBenchmark);
    
    // Run particle system benchmark
    BenchmarkData particleBenchmark = benchmarkParticleSystem();
    result.benchmarks.push_back(particleBenchmark);
    
    // Run memory benchmark
    BenchmarkData memoryBenchmark = benchmarkMemoryUsage();
    result.benchmarks.push_back(memoryBenchmark);
    
    // Run full pipeline benchmark
    BenchmarkData pipelineBenchmark = benchmarkFullPipeline();
    result.benchmarks.push_back(pipelineBenchmark);
    
    // Calculate overall score
    result.overallScore = calculateBenchmarkScore(result);
    
    // Save benchmark results
    saveBenchmarkResult(result);
    
    return result;
}

/**
 * Run validation test suite
 */
ValidationResult TestingFramework::runValidationSuite()
{
    Logger::info("[TestingFramework] Running validation suite...");
    
    ValidationResult result;
    result.suiteName = "Deferred Pipeline Validation";
    result.startTime = timer_ticks();
    
    // Validate G-buffer
    ValidationResult gbufferValidation = validateGBuffer();
    result.subResults.push_back(gbufferValidation);
    
    // Validate lighting calculations
    ValidationResult lightingValidation = validateLighting();
    result.subResults.push_back(lightingValidation);
    
    // Validate shadow mapping
    ValidationResult shadowValidation = validateShadowMapping();
    result.subResults.push_back(shadowValidation);
    
    // Validate material system
    ValidationResult materialValidation = validateMaterialSystem();
    result.subResults.push_back(materialValidation);
    
    // Validate particle system
    ValidationResult particleValidation = validateParticleSystem();
    result.subResults.push_back(particleValidation);
    
    // Validate integration
    ValidationResult integrationValidation = validateIntegration();
    result.subResults.push_back(integrationValidation);
    
    // Update overall result
    result.endTime = timer_ticks();
    result.duration = result.endTime - result.startTime;
    
    // Calculate pass rate
    uint32_t passed = 0;
    uint32_t total = 0;
    
    for (const auto& subResult : result.subResults) {
        if (subResult.status == ValidationStatus::PASSED) {
            passed++;
        }
        total++;
    }
    
    result.passRate = (total > 0) ? (static_cast<float>(passed) / total * 100.0f) : 0.0f;
    result.status = (result.passRate >= 95.0f) ? ValidationStatus::PASSED : ValidationStatus::FAILED;
    
    // Log results
    Logger::info("[TestingFramework] Validation suite completed: %.1f%% passed", result.passRate);
    
    return result;
}

/**
 * Compare with forward rendering
 */
ComparisonResult TestingFramework::compareWithForwardRendering()
{
    Logger::info("[TestingFramework] Comparing with forward rendering...");
    
    ComparisonResult result;
    result.comparisonName = "Deferred vs Forward Rendering";
    result.timestamp = timer_ticks();
    
    // Benchmark deferred rendering
    BenchmarkResult deferredBenchmark = runPerformanceBenchmarks();
    result.deferredResults = deferredBenchmark;
    
    // Note: Forward rendering benchmark would require actual forward pipeline
    // For now, we'll use reference values
    BenchmarkResult forwardBenchmark;
    forwardBenchmark.platform = currentPlatform;
    forwardBenchmark.timestamp = timer_ticks();
    
    // Reference values for forward rendering (based on typical N64 performance)
    BenchmarkData forwardGeometry = {
        "Forward Geometry",
        800,  // triangles/frame
        5000, // µs per frame
        60.0f // FPS
    };
    
    BenchmarkData forwardLighting = {
        "Forward Lighting",
        8,    // lights
        3000, // µs per frame  
        60.0f // FPS
    };
    
    forwardBenchmark.benchmarks.push_back(forwardGeometry);
    forwardBenchmark.benchmarks.push_back(forwardLighting);
    forwardBenchmark.overallScore = 75.0f; // Reference score
    
    result.forwardResults = forwardBenchmark;
    
    // Calculate improvements
    result.improvements = calculateImprovements(result.deferredResults, result.forwardResults);
    
    // Generate report
    result.report = generateComparisonReport(result);
    
    return result;
}

/**
 * Run specific test case
 */
TestResult TestingFramework::runTestCase(const std::string& testName)
{
    Logger::info("[TestingFramework] Running test case: %s", testName.c_str());
    
    // Find test case
    auto it = std::find_if(testCases.begin(), testCases.end(),
        [&testName](const TestCase& tc) { return tc.name == testName; });
    
    if (it == testCases.end()) {
        TestResult result;
        result.testName = testName;
        result.status = TestStatus::FAILED;
        result.errorMessage = "Test case not found";
        return result;
    }
    
    const TestCase& testCase = *it;
    TestResult result;
    result.testName = testCase.name;
    result.startTime = timer_ticks();
    
    try {
        // Execute test based on type
        if (testCase.isPerformanceTest) {
            result = executePerformanceTest(testCase);
        } else if (testCase.isStressTest) {
            result = executeStressTest(testCase);
        } else {
            result = executeFunctionalTest(testCase);
        }
        
        result.endTime = timer_ticks();
        result.duration = result.endTime - result.startTime;
        
    } catch (const std::exception& e) {
        result.status = TestStatus::FAILED;
        result.errorMessage = std::string("Exception: ") + e.what();
        result.endTime = timer_ticks();
        result.duration = result.endTime - result.startTime;
    }
    
    // Update statistics
    updateTestStatistics(result);
    
    // Log result
    logTestResult(result);
    
    return result;
}

/**
 * Run all test cases
 */
std::vector<TestResult> TestingFramework::runAllTestCases()
{
    Logger::info("[TestingFramework] Running all test cases (%zu total)", testCases.size());
    
    std::vector<TestResult> results;
    totalTestsPassed = 0;
    totalTestsFailed = 0;
    totalTestsSkipped = 0;
    
    for (const auto& testCase : testCases) {
        TestResult result = runTestCase(testCase.name);
        results.push_back(result);
        
        // Update counters
        switch (result.status) {
            case TestStatus::PASSED:
                totalTestsPassed++;
                break;
            case TestStatus::FAILED:
                totalTestsFailed++;
                break;
            case TestStatus::SKIPPED:
                totalTestsSkipped++;
                break;
            default:
                break;
        }
    }
    
    // Print summary
    printTestSummary();
    
    return results;
}

/**
 * Initialize test cases
 */
void TestingFramework::initializeTestCases()
{
    testCases.clear();
    
    // Basic functionality tests
    testCases.push_back({
        "GBuffer Creation",
        "Test G-buffer allocation and initialization",
        60, 0, false, false,
        10, 1, 5, 100,
        true, false, false, true, true
    });
    
    testCases.push_back({
        "Light Addition",
        "Test adding and removing lights",
        60, 0, false, false,
        5, 5, 3, 0,
        false, false, false, false, true
    });
    
    testCases.push_back({
        "Material Creation",
        "Test material creation and binding",
        60, 0, false, false,
        10, 0, 10, 0,
        false, true, false, false, false
    });
    
    // Performance tests
    testCases.push_back({
        "Geometry Pass Performance",
        "Test geometry pass rendering performance",
        300, 60, true, false,
        100, 0, 10, 0,
        false, false, false, false, true
    });
    
    testCases.push_back({
        "Lighting Pass Performance",
        "Test deferred lighting performance",
        300, 60, true, false,
        50, 8, 10, 0,
        true, false, false, false, true
    });
    
    testCases.push_back({
        "Shadow Mapping Performance",
        "Test shadow mapping performance",
        300, 60, true, false,
        20, 3, 5, 0,
        true, false, false, false, false
    });
    
    // Stress tests
    testCases.push_back({
        "High Triangle Count",
        "Stress test with high triangle count",
        180, 30, false, true,
        500, 0, 10, 0,
        false, false, false, false, true
    });
    
    testCases.push_back({
        "Many Lights",
        "Stress test with many lights",
        180, 30, false, true,
        50, 16, 10, 0,
        true, false, false, false, true
    });
    
    testCases.push_back({
        "Many Particles",
        "Stress test with many particles",
        180, 30, false, true,
        10, 2, 5, 5000,
        false, false, true, false, false
    });
    
    // Integration tests
    testCases.push_back({
        "ECS Integration",
        "Test ECS integration with deferred pipeline",
        120, 30, false, false,
        30, 3, 10, 100,
        true, true, true, true, true
    });
    
    testCases.push_back({
        "Memory Management",
        "Test memory allocation and deallocation",
        60, 0, false, false,
        20, 0, 5, 0,
        false, false, false, false, false
    });
}

/**
 * Initialize hardware configurations
 */
void TestingFramework::initializeHardwareConfigs()
{
    hardwareConfigs.clear();
    
    // N64 Console (4MB RAM)
    hardwareConfigs.push_back({
        TestPlatform::N64_CONSOLE,
        false, false, false,
        4 * 1024 * 1024,  // 4MB
        4 * 1024 * 1024,
        20000,  // 50 FPS target
        30, 60,
        500,    // Reduced triangle budget
        80.0f   // Max 80% memory usage
    });
    
    // N64 with Expansion Pak (8MB RAM)
    hardwareConfigs.push_back({
        TestPlatform::N64_EXPANSION,
        true, false, false,
        8 * 1024 * 1024,  // 8MB
        8 * 1024 * 1024,
        16667,  // 60 FPS target
        60, 60,
        2000,   // Full triangle budget
        80.0f   // Max 80% memory usage
    });
    
    // Development hardware
    hardwareConfigs.push_back({
        TestPlatform::DEVELOPMENT,
        false, false, false,
        16 * 1024 * 1024, // 16MB (generous for development)
        16 * 1024 * 1024,
        16667,  // 60 FPS target
        60, 60,
        2000,   // Full triangle budget
        90.0f   // Higher memory usage allowed
    });
}

/**
 * Detect current platform
 */
void TestingFramework::detectPlatform()
{
    // In a real implementation, this would detect actual hardware
    // For now, we'll default to development platform
    
    // Check for Expansion Pak (simulated)
    size_t availableMemory = 4 * 1024 * 1024; // Default 4MB
    
    // Try to allocate more memory to detect Expansion Pak
    void* testAlloc = malloc(8 * 1024 * 1024);
    if (testAlloc) {
        availableMemory = 8 * 1024 * 1024;
        free(testAlloc);
        requireExpansionPak = true;
        currentPlatform = TestPlatform::N64_EXPANSION;
        Logger::info("[TestingFramework] Detected Expansion Pak (8MB RAM)");
    } else {
        requireExpansionPak = false;
        currentPlatform = TestPlatform::N64_CONSOLE;
        Logger::info("[TestingFramework] Detected standard N64 (4MB RAM)");
    }
    
    // Override for development
    #ifdef DEVELOPMENT_BUILD
    currentPlatform = TestPlatform::DEVELOPMENT;
    Logger::info("[TestingFramework] Development build detected");
    #endif
}

/**
 * Check hardware requirements
 */
bool TestingFramework::checkHardwareRequirements()
{
    // Find configuration for current platform
    auto it = std::find_if(hardwareConfigs.begin(), hardwareConfigs.end(),
        [this](const HardwareTestConfig& config) {
            return config.platform == currentPlatform;
        });
    
    if (it == hardwareConfigs.end()) {
        Logger::warn("[TestingFramework] No hardware configuration for platform");
        return false;
    }
    
    const HardwareTestConfig& config = *it;
    
    // Check memory
    size_t availableMemory = getAvailableMemory();
    if (availableMemory < config.minMemory) {
        Logger::error("[TestingFramework] Insufficient memory: %zu < %zu",
                     availableMemory, config.minMemory);
        return false;
    }
    
    // Check Expansion Pak requirement
    if (config.requireExpansionPak && !requireExpansionPak) {
        Logger::error("[TestingFramework] Expansion Pak required but not detected");
        return false;
    }
    
    Logger::info("[TestingFramework] Hardware requirements met");
    Logger::info("[TestingFramework] Available memory: %zu bytes", availableMemory);
    
    return true;
}

/**
 * Get available memory
 */
size_t TestingFramework::getAvailableMemory() const
{
    // In a real implementation, this would query system memory
    // For now, return simulated values based on platform
    
    switch (currentPlatform) {
        case TestPlatform::N64_CONSOLE:
            return 4 * 1024 * 1024; // 4MB
        case TestPlatform::N64_EXPANSION:
            return 8 * 1024 * 1024; // 8MB
        case TestPlatform::DEVELOPMENT:
            return 16 * 1024 * 1024; // 16MB
        default:
            return 4 * 1024 * 1024; // Default 4MB
    }
}

/**
 * Get platform name as string
 */
std::string TestingFramework::getPlatformName(TestPlatform platform) const
{
    switch (platform) {
        case TestPlatform::N64_CONSOLE: return "N64 Console";
        case TestPlatform::N64_EXPANSION: return "N64 with Expansion Pak";
        case TestPlatform::EMULATOR_ARES: return "Ares Emulator";
        case TestPlatform::EMULATOR_GOPHER64: return "gopher64 Emulator";
        case TestPlatform::EMULATOR_PJ64: return "Project64 Emulator";
        case TestPlatform::DEVELOPMENT: return "Development Hardware";
        default: return "Unknown";
    }
}

/**
 * Log test result
 */
void TestingFramework::logTestResult(const TestResult& result) const
{
    const char* statusStr = "";
    switch (result.status) {
        case TestStatus::PASSED: statusStr = "PASSED"; break;
        case TestStatus::FAILED: statusStr = "FAILED"; break;
        case TestStatus::WARNING: statusStr = "WARNING"; break;
        case TestStatus::SKIPPED: statusStr = "SKIPPED"; break;
        case TestStatus::RUNNING: statusStr = "RUNNING"; break;
        default: statusStr = "UNKNOWN"; break;
    }
    
    uint32_t durationMs = static_cast<uint32_t>(result.duration / (TICKS_PER_USEC * 1000));
    
    Logger::info("[Test] %s: %s (%u ms)", 
                 result.testName.c_str(), statusStr, durationMs);
    
    if (!result.errorMessage.empty()) {
        Logger::error("[Test] Error: %s", result.errorMessage.c_str());
    }
    
    if (!result.warningMessage.empty()) {
        Logger::warn("[Test] Warning: %s", result.warningMessage.c_str());
    }
}

/**
 * Print test summary
 */
void TestingFramework::printTestSummary() const
{
    Logger::info("[TestingFramework] ===== TEST SUMMARY =====");
    Logger::info("[TestingFramework] Total Tests: %zu", testCases.size());
    Logger::info("[TestingFramework] Passed: %u", totalTestsPassed);
    Logger::info("[TestingFramework] Failed: %u", totalTestsFailed);
    Logger::info("[TestingFramework] Skipped: %u", totalTestsSkipped);
    
    float passRate = (testCases.size() > 0) ? 
        (static_cast<float>(totalTestsPassed) / testCases.size() * 100.0f) : 0.0f;
    
    Logger::info("[TestingFramework] Pass Rate: %.1f%%", passRate);
    
    if (passRate >= 95.0f) {
        Logger::info("[TestingFramework] ✅ SUCCESS: All tests passed");
    } else if (passRate >= 80.0f) {
        Logger::info("[TestingFramework] ⚠ WARNING: Some tests failed");
    } else {
        Logger::info("[TestingFramework] ❌ FAILURE: Many tests failed");
    }
}

// Static helper functions
extern "C" TestingFramework* get_test_framework()
{
    if (!g_testFramework) {
        g_testFramework = new TestingFramework();
        g_testFramework->init();
    }
    return g_testFramework;
}

extern "C" void run_all_deferred_tests()
{
    TestingFramework* framework = get_test_framework();
    if (framework) {
        framework->runAllTestCases();
    }
}

extern "C" void run_deferred_benchmarks()
{
    TestingFramework* framework = get_test_framework();
    if (framework) {
        framework->runPerformanceBenchmarks();
    }
}

extern "C" void validate_deferred_pipeline()
{
    TestingFramework* framework = get_test_framework();
    if (framework) {
        framework->runValidationSuite();
    }
}