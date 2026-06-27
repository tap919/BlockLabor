/**
 * @copyright 2025 - GameAnimation64 Engine
 * @license MIT
 * 
 * Comprehensive test runner for deferred rendering pipeline
 * This is the main entry point for running all tests and benchmarks
 */

#include <libdragon.h>
#include "debug/overlay.h"
#include "lib/logger.h"
#include "renderer/deferred/TestingFramework.h"
#include "renderer/deferred/DeferredPipeline.h"
#include "scene/scene.h"
#include <string>
#include <vector>

using namespace P64;
using namespace P64::Deferred;
using namespace P64::Deferred::Testing;

/**
 * Test runner configuration
 */
struct TestRunnerConfig
{
    bool runHardwareTests = true;
    bool runPerformanceBenchmarks = true;
    bool runValidationSuite = true;
    bool runVisualTests = true;
    bool compareWithForward = true;
    bool runAllTestCases = true;
    
    uint32_t visualTestDuration = 300; // 5 seconds per visual test
    uint32_t benchmarkWarmupFrames = 60;
    uint32_t benchmarkMeasurementFrames = 300;
    
    std::string outputFile = "test_results.txt";
    bool verboseLogging = true;
};

/**
 * Test runner results
 */
struct TestRunnerResults
{
    uint32_t totalTests = 0;
    uint32_t passedTests = 0;
    uint32_t failedTests = 0;
    uint32_t skippedTests = 0;
    
    float overallScore = 0.0f;
    std::string summary;
    
    std::vector<TestResult> testResults;
    BenchmarkResult benchmarkResult;
    ValidationResult validationResult;
    ComparisonResult comparisonResult;
};

/**
 * Main test runner class
 */
class DeferredTestRunner
{
private:
    TestRunnerConfig config;
    TestRunnerResults results;
    TestingFramework* testFramework;
    uint32_t frameCount = 0;
    
public:
    DeferredTestRunner(const TestRunnerConfig& cfg)
        : config(cfg)
        , testFramework(nullptr)
    {
    }
    
    /**
     * Initialize test runner
     */
    bool init()
    {
        Logger::info("[TestRunner] Initializing deferred rendering test runner...");
        
        // Initialize debug systems
        debug_init_isviewer();
        debug_init_usblog();
        
        // Initialize libdragon
        dfs_init(DFS_DEFAULT_LOCATION);
        rdpq_init();
        t3d_init();
        tpx_init();
        joypad_init();
        
        // Create testing framework
        testFramework = new TestingFramework();
        testFramework->init();
        
        Logger::info("[TestRunner] Test runner initialized successfully");
        return true;
    }
    
    /**
     * Run all tests
     */
    TestRunnerResults runAllTests()
    {
        Logger::info("[TestRunner] ===== STARTING COMPREHENSIVE TEST SUITE =====");
        
        // Run hardware tests
        if (config.runHardwareTests) {
            runHardwareTests();
        }
        
        // Run performance benchmarks
        if (config.runPerformanceBenchmarks) {
            runPerformanceBenchmarks();
        }
        
        // Run validation suite
        if (config.runValidationSuite) {
            runValidationSuite();
        }
        
        // Run visual tests
        if (config.runVisualTests) {
            runVisualTests();
        }
        
        // Compare with forward rendering
        if (config.compareWithForward) {
            compareWithForwardRendering();
        }
        
        // Run all test cases
        if (config.runAllTestCases) {
            runAllTestCases();
        }
        
        // Generate final summary
        generateSummary();
        
        Logger::info("[TestRunner] ===== TEST SUITE COMPLETED =====");
        
        return results;
    }
    
    /**
     * Run hardware tests
     */
    void runHardwareTests()
    {
        Logger::info("[TestRunner] Running hardware tests...");
        
        TestResult result = testFramework->runHardwareTests();
        results.testResults.push_back(result);
        
        if (result.status == TestStatus::PASSED) {
            results.passedTests++;
            Logger::info("[TestRunner] ✅ Hardware tests PASSED");
        } else {
            results.failedTests++;
            Logger::error("[TestRunner] ❌ Hardware tests FAILED: %s", 
                         result.errorMessage.c_str());
        }
        
        results.totalTests++;
    }
    
    /**
     * Run performance benchmarks
     */
    void runPerformanceBenchmarks()
    {
        Logger::info("[TestRunner] Running performance benchmarks...");
        
        results.benchmarkResult = testFramework->runPerformanceBenchmarks();
        
        // Evaluate benchmark results
        if (results.benchmarkResult.overallScore >= 80.0f) {
            Logger::info("[TestRunner] ✅ Performance benchmarks: GOOD (%.1f/100)", 
                        results.benchmarkResult.overallScore);
        } else if (results.benchmarkResult.overallScore >= 60.0f) {
            Logger::info("[TestRunner] ⚠ Performance benchmarks: ACCEPTABLE (%.1f/100)", 
                        results.benchmarkResult.overallScore);
        } else {
            Logger::warn("[TestRunner] ❌ Performance benchmarks: POOR (%.1f/100)", 
                        results.benchmarkResult.overallScore);
        }
        
        results.overallScore = results.benchmarkResult.overallScore;
    }
    
    /**
     * Run validation suite
     */
    void runValidationSuite()
    {
        Logger::info("[TestRunner] Running validation suite...");
        
        results.validationResult = testFramework->runValidationSuite();
        
        if (results.validationResult.status == ValidationStatus::PASSED) {
            results.passedTests++;
            Logger::info("[TestRunner] ✅ Validation suite PASSED (%.1f%%)", 
                        results.validationResult.passRate);
        } else {
            results.failedTests++;
            Logger::error("[TestRunner] ❌ Validation suite FAILED (%.1f%%)", 
                         results.validationResult.passRate);
        }
        
        results.totalTests++;
    }
    
    /**
     * Run visual tests
     */
    void runVisualTests()
    {
        Logger::info("[TestRunner] Running visual tests (%u frames)...", 
                    config.visualTestDuration);
        
        // Create test surface
        surface_t testSurface = surface_alloc(FMT_RGBA16, 320, 240);
        if (!testSurface.buffer) {
            Logger::error("[TestRunner] Failed to allocate test surface for visual tests");
            results.skippedTests++;
            return;
        }
        
        // Run visual tests for specified duration
        uint32_t startFrame = frameCount;
        
        while ((frameCount - startFrame) < config.visualTestDuration) {
            // Update input
            joypad_poll();
            
            // Run visual test pattern
            testFramework->runVisualTestPatterns(frameCount);
            
            // Wait for vertical blank
            vi_wait();
            
            frameCount++;
            
            // Show progress every second
            if ((frameCount - startFrame) % 60 == 0) {
                uint32_t seconds = (frameCount - startFrame) / 60;
                uint32_t totalSeconds = config.visualTestDuration / 60;
                Logger::info("[TestRunner] Visual tests: %u/%u seconds", 
                            seconds, totalSeconds);
            }
        }
        
        // Clean up
        surface_free(&testSurface);
        
        Logger::info("[TestRunner] ✅ Visual tests completed");
        results.passedTests++;
        results.totalTests++;
    }
    
    /**
     * Compare with forward rendering
     */
    void compareWithForwardRendering()
    {
        Logger::info("[TestRunner] Comparing with forward rendering...");
        
        results.comparisonResult = testFramework->compareWithForwardRendering();
        
        // Analyze improvements
        float avgImprovement = 0.0f;
        int numImprovements = 0;
        
        for (const auto& improvement : results.comparisonResult.improvements) {
            avgImprovement += improvement.second;
            numImprovements++;
        }
        
        if (numImprovements > 0) {
            avgImprovement /= numImprovements;
            
            if (avgImprovement > 20.0f) {
                Logger::info("[TestRunner] ✅ SIGNIFICANT IMPROVEMENT over forward: +%.1f%%", 
                            avgImprovement);
            } else if (avgImprovement > 0.0f) {
                Logger::info("[TestRunner] ⚠ MODEST IMPROVEMENT over forward: +%.1f%%", 
                            avgImprovement);
            } else if (avgImprovement > -10.0f) {
                Logger::info("[TestRunner] ⚠ SIMILAR PERFORMANCE to forward: %.1f%%", 
                            avgImprovement);
            } else {
                Logger::warn("[TestRunner] ❌ PERFORMANCE REGRESSION vs forward: %.1f%%", 
                            avgImprovement);
            }
        }
        
        results.totalTests++;
        
        if (avgImprovement > 0.0f) {
            results.passedTests++;
        } else {
            results.failedTests++;
        }
    }
    
    /**
     * Run all test cases
     */
    void runAllTestCases()
    {
        Logger::info("[TestRunner] Running all individual test cases...");
        
        std::vector<TestResult> testResults = testFramework->runAllTestCases();
        
        // Add to overall results
        for (const auto& result : testResults) {
            results.testResults.push_back(result);
            
            switch (result.status) {
                case TestStatus::PASSED:
                    results.passedTests++;
                    break;
                case TestStatus::FAILED:
                    results.failedTests++;
                    break;
                case TestStatus::SKIPPED:
                    results.skippedTests++;
                    break;
                default:
                    break;
            }
            
            results.totalTests++;
        }
    }
    
    /**
     * Generate final summary
     */
    void generateSummary()
    {
        std::string summary;
        
        summary += "=== DEFERRED RENDERING PIPELINE TEST SUMMARY ===\n\n";
        
        // Overall statistics
        summary += "Overall Statistics:\n";
        summary += "  Total Tests: " + std::to_string(results.totalTests) + "\n";
        summary += "  Passed: " + std::to_string(results.passedTests) + "\n";
        summary += "  Failed: " + std::to_string(results.failedTests) + "\n";
        summary += "  Skipped: " + std::to_string(results.skippedTests) + "\n";
        
        float passRate = (results.totalTests > 0) ? 
            (static_cast<float>(results.passedTests) / results.totalTests * 100.0f) : 0.0f;
        
        summary += "  Pass Rate: " + std::to_string(passRate) + "%\n";
        summary += "  Overall Score: " + std::to_string(results.overallScore) + "/100\n\n";
        
        // Performance benchmarks
        summary += "Performance Benchmarks:\n";
        summary += "  Overall Score: " + std::to_string(results.benchmarkResult.overallScore) + "/100\n";
        
        for (const auto& benchmark : results.benchmarkResult.benchmarks) {
            summary += "  " + benchmark.name + ": " +
                      std::to_string(benchmark.metric1) + ", " +
                      std::to_string(benchmark.metric2) + "µs, " +
                      std::to_string(benchmark.metric3) + " FPS\n";
        }
        summary += "\n";
        
        // Validation results
        summary += "Validation Suite:\n";
        summary += "  Status: " + 
                  ((results.validationResult.status == ValidationStatus::PASSED) ? "PASSED" : "FAILED") + "\n";
        summary += "  Pass Rate: " + std::to_string(results.validationResult.passRate) + "%\n\n";
        
        // Comparison results
        if (!results.comparisonResult.improvements.empty()) {
            summary += "Comparison with Forward Rendering:\n";
            
            float avgImprovement = 0.0f;
            int numImprovements = 0;
            
            for (const auto& improvement : results.comparisonResult.improvements) {
                summary += "  " + improvement.first + ": " + 
                          std::to_string(improvement.second) + "%\n";
                
                avgImprovement += improvement.second;
                numImprovements++;
            }
            
            if (numImprovements > 0) {
                avgImprovement /= numImprovements;
                summary += "  Average Improvement: " + std::to_string(avgImprovement) + "%\n";
            }
            summary += "\n";
        }
        
        // Test case details
        summary += "Detailed Test Results:\n";
        for (const auto& testResult : results.testResults) {
            std::string statusStr;
            switch (testResult.status) {
                case TestStatus::PASSED: statusStr = "PASSED"; break;
                case TestStatus::FAILED: statusStr = "FAILED"; break;
                case TestStatus::WARNING: statusStr = "WARNING"; break;
                case TestStatus::SKIPPED: statusStr = "SKIPPED"; break;
                default: statusStr = "UNKNOWN"; break;
            }
            
            summary += "  " + testResult.testName + ": " + statusStr;
            
            if (!testResult.errorMessage.empty()) {
                summary += " (" + testResult.errorMessage + ")";
            }
            
            summary += "\n";
        }
        summary += "\n";
        
        // Final assessment
        summary += "FINAL ASSESSMENT:\n";
        
        if (passRate >= 95.0f && results.overallScore >= 80.0f) {
            summary += "✅ EXCELLENT - Deferred pipeline is production ready\n";
            summary += "   All tests passed with high performance scores\n";
        } else if (passRate >= 80.0f && results.overallScore >= 60.0f) {
            summary += "⚠ GOOD - Deferred pipeline is functional\n";
            summary += "   Some minor issues but generally working well\n";
        } else if (passRate >= 60.0f) {
            summary += "⚠ ACCEPTABLE - Deferred pipeline needs improvement\n";
            summary += "   Several issues need to be addressed\n";
        } else {
            summary += "❌ POOR - Deferred pipeline is not ready\n";
            summary += "   Major issues need to be fixed\n";
        }
        
        summary += "\n=== END OF TEST SUMMARY ===\n";
        
        results.summary = summary;
        
        // Log summary
        Logger::info("\n%s", summary.c_str());
        
        // Save to file if requested
        if (!config.outputFile.empty()) {
            saveSummaryToFile(summary);
        }
    }
    
    /**
     * Save summary to file
     */
    void saveSummaryToFile(const std::string& summary)
    {
        // In a real implementation, this would write to a file
        // For now, just log that we would save it
        Logger::info("[TestRunner] Test summary would be saved to: %s", 
                    config.outputFile.c_str());
    }
    
    /**
     * Clean up test runner
     */
    ~DeferredTestRunner()
    {
        if (testFramework) {
            delete testFramework;
            testFramework = nullptr;
        }
        
        Logger::info("[TestRunner] Test runner cleaned up");
    }
};

/**
 * Command-line test runner
 */
extern "C" void run_deferred_tests_command(int argc, char* argv[])
{
    Logger::info("[TestRunner] Deferred Rendering Pipeline Test Runner");
    Logger::info("[TestRunner] Command-line arguments: %d", argc);
    
    // Parse command line arguments
    TestRunnerConfig config;
    
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        
        if (arg == "--no-hardware") {
            config.runHardwareTests = false;
        } else if (arg == "--no-benchmarks") {
            config.runPerformanceBenchmarks = false;
        } else if (arg == "--no-validation") {
            config.runValidationSuite = false;
        } else if (arg == "--no-visual") {
            config.runVisualTests = false;
        } else if (arg == "--no-comparison") {
            config.compareWithForward = false;
        } else if (arg == "--quick") {
            config.visualTestDuration = 60; // 1 second
            config.benchmarkMeasurementFrames = 60;
        } else if (arg == "--verbose") {
            config.verboseLogging = true;
        } else if (arg == "--output") {
            if (i + 1 < argc) {
                config.outputFile = argv[++i];
            }
        } else if (arg == "--help") {
            Logger::info("Usage: test_deferred_runner [options]");
            Logger::info("Options:");
            Logger::info("  --no-hardware      Skip hardware tests");
            Logger::info("  --no-benchmarks    Skip performance benchmarks");
            Logger::info("  --no-validation    Skip validation suite");
            Logger::info("  --no-visual        Skip visual tests");
            Logger::info("  --no-comparison    Skip comparison with forward rendering");
            Logger::info("  --quick            Run quick tests (shorter duration)");
            Logger::info("  --verbose          Enable verbose logging");
            Logger::info("  --output <file>    Save results to file");
            Logger::info("  --help             Show this help message");
            return;
        }
    }
    
    // Create and run test runner
    DeferredTestRunner runner(config);
    
    if (runner.init()) {
        TestRunnerResults results = runner.runAllTests();
        
        // Exit with appropriate code
        float passRate = (results.totalTests > 0) ? 
            (static_cast<float>(results.passedTests) / results.totalTests * 100.0f) : 0.0f;
        
        if (passRate >= 80.0f && results.overallScore >= 60.0f) {
            Logger::info("[TestRunner] ✅ Test suite completed successfully");
        } else {
            Logger::error("[TestRunner] ❌ Test suite completed with issues");
        }
    } else {
        Logger::error("[TestRunner] ❌ Failed to initialize test runner");
    }
}

/**
 * Simple test function (for quick testing)
 */
extern "C" void test_deferred_pipeline_quick()
{
    Logger::info("[QuickTest] Running quick deferred pipeline test...");
    
    TestRunnerConfig config;
    config.runHardwareTests = true;
    config.runPerformanceBenchmarks = true;
    config.runValidationSuite = true;
    config.runVisualTests = false; // Skip visual for quick test
    config.compareWithForward = false;
    config.runAllTestCases = false;
    config.visualTestDuration = 0;
    config.benchmarkMeasurementFrames = 60;
    
    DeferredTestRunner runner(config);
    
    if (runner.init()) {
        runner.runAllTests();
        Logger::info("[QuickTest] Quick test completed");
    } else {
        Logger::error("[QuickTest] Quick test failed to initialize");
    }
}

/**
 * Main entry point for standalone test runner
 */
extern "C" void deferred_test_runner_main()
{
    Logger::info("=== GameAnimation64 Deferred Rendering Test Runner ===");
    Logger::info("Starting comprehensive test suite...");
    
    // Default configuration
    TestRunnerConfig config;
    
    // Create and run test runner
    DeferredTestRunner runner(config);
    
    if (runner.init()) {
        runner.runAllTests();
        Logger::info("Test runner completed successfully");
    } else {
        Logger::error("Test runner failed to initialize");
    }
    
    // Keep running to show results
    while (true) {
        joypad_poll();
        vi_wait();
    }
}

/**
 * Minimal test for build verification
 */
extern "C" void verify_deferred_build()
{
    Logger::info("[BuildVerify] Verifying deferred rendering pipeline build...");
    
    // Test 1: Create testing framework
    TestingFramework* framework = new TestingFramework();
    framework->init();
    
    // Test 2: Run hardware tests
    TestResult hardwareTest = framework->testMemory();
    
    if (hardwareTest.status == TestStatus::PASSED) {
        Logger::info("[BuildVerify] ✅ Memory test passed");
    } else {
        Logger::error("[BuildVerify] ❌ Memory test failed: %s", 
                     hardwareTest.errorMessage.c_str());
    }
    
    // Test 3: Run validation
    ValidationResult validation = framework->validateGBuffer();
    
    if (validation.status == ValidationStatus::PASSED) {
        Logger::info("[BuildVerify] ✅ G-buffer validation passed (%.1f%%)", 
                    validation.passRate);
    } else {
        Logger::error("[BuildVerify] ❌ G-buffer validation failed (%.1f%%)", 
                     validation.passRate);
    }
    
    delete framework;
    
    Logger::info("[BuildVerify] Build verification completed");
}