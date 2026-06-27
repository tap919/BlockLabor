#include "globalSetup.h"
#include "renderer/deferred/TestingFramework.h"
#include "renderer/deferred/DeferredRenderer.h"
#include <string>
#include <vector>

using namespace P64;

class DeferredTestRunner : public CodeComponent {
public:
    DeferredTestRunner() : currentTest(0), testRunning(false), testComplete(false) {}
    
    void init() override {
        Log::info("Deferred Test Runner Initialized");
        
        testResults.clear();
        currentTest = 0;
        testRunning = false;
        testComplete = false;
        
        setupTestFramework();
    }
    
    void update() override {
        if (!testRunning && !testComplete) {
            startNextTest();
        }
        
        if (testRunning) {
            runCurrentTest();
        }
    }
    
private:
    void setupTestFramework() {
        Log::info("Setting up deferred testing framework");
        
        testFramework = std::make_unique<DeferredTestingFramework>();
        
        testFramework->setOutputCallback([this](const std::string& message, TestResultLevel level) {
            handleTestOutput(message, level);
        });
        
        testFramework->setCompletionCallback([this](const TestSuiteResults& results) {
            handleTestCompletion(results);
        });
    }
    
    void startNextTest() {
        if (currentTest >= testSuites.size()) {
            testComplete = true;
            Log::info("All tests completed");
            return;
        }
        
        testRunning = true;
        Log::info("Starting test: " + testSuites[currentTest].name);
        
        testFramework->startTestSuite(testSuites[currentTest]);
    }
    
    void runCurrentTest() {
        testFramework->update();
        
        if (testFramework->isTestSuiteComplete()) {
            testRunning = false;
            currentTest++;
        }
    }
    
    void handleTestOutput(const std::string& message, TestResultLevel level) {
        switch (level) {
            case TestResultLevel::INFO:
                Log::info("[TEST] " + message);
                break;
            case TestResultLevel::WARNING:
                Log::warning("[TEST] " + message);
                break;
            case TestResultLevel::ERROR:
                Log::error("[TEST] " + message);
                break;
            case TestResultLevel::SUCCESS:
                Log::info("[TEST SUCCESS] " + message);
                break;
        }
    }
    
    void handleTestCompletion(const TestSuiteResults& results) {
        testResults.push_back(results);
        
        Log::info("Test suite completed: " + results.suiteName);
        Log::info("  Passed: " + std::to_string(results.passedTests));
        Log::info("  Failed: " + std::to_string(results.failedTests));
        Log::info("  Total: " + std::to_string(results.totalTests));
        
        if (results.failedTests > 0) {
            Log::warning("Test suite has failures!");
        }
    }
    
    std::unique_ptr<DeferredTestingFramework> testFramework;
    std::vector<TestSuiteResults> testResults;
    std::vector<TestSuiteConfig> testSuites = {
        {
            "Hardware Validation",
            {
                TestType::HARDWARE_MEMORY,
                TestType::HARDWARE_RSP,
                TestType::HARDWARE_RDP,
                TestType::HARDWARE_TEXTURE_MEMORY,
                TestType::HARDWARE_FRAMEBUFFER
            },
            1000
        },
        {
            "Performance Benchmarks",
            {
                TestType::PERFORMANCE_GEOMETRY_PASS,
                TestType::PERFORMANCE_LIGHTING_PASS,
                TestType::PERFORMANCE_SHADOW_MAPPING,
                TestType::PERFORMANCE_PARTICLE_SYSTEM,
                TestType::PERFORMANCE_MEMORY_USAGE,
                TestType::PERFORMANCE_FULL_PIPELINE
            },
            5000
        },
        {
            "Visual Validation",
            {
                TestType::VISUAL_G_BUFFER,
                TestType::VISUAL_LIGHTING,
                TestType::VISUAL_SHADOW_MAPPING,
                TestType::VISUAL_MATERIAL_SYSTEM,
                TestType::VISUAL_PARTICLE_SYSTEM,
                TestType::VISUAL_INTEGRATION
            },
            3000
        }
    };
    
    size_t currentTest;
    bool testRunning;
    bool testComplete;
};

extern "C" void* createDeferredTestRunner() {
    return new DeferredTestRunner();
}