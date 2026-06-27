#include "renderer/deferred/TestingFramework.h"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <ctime>

namespace P64 {

class TestResultReporter {
public:
    TestResultReporter() {
        initializeReport();
    }
    
    ~TestResultReporter() {
        finalizeReport();
    }
    
    void reportTestSuite(const TestSuiteResults& results) {
        std::lock_guard<std::mutex> lock(reportMutex);
        
        testSuites.push_back(results);
        
        std::stringstream ss;
        ss << "\n=== Test Suite: " << results.suiteName << " ===\n";
        ss << "  Start Time: " << formatTime(results.startTime) << "\n";
        ss << "  End Time: " << formatTime(results.endTime) << "\n";
        ss << "  Duration: " << results.durationMs << " ms\n";
        ss << "  Tests: " << results.totalTests << " total, " 
           << results.passedTests << " passed, " 
           << results.failedTests << " failed\n";
        ss << "  Performance Score: " << std::fixed << std::setprecision(2) 
           << results.performanceScore << "\n";
        
        if (!results.errors.empty()) {
            ss << "  Errors:\n";
            for (const auto& error : results.errors) {
                ss << "    - " << error << "\n";
            }
        }
        
        if (!results.warnings.empty()) {
            ss << "  Warnings:\n";
            for (const auto& warning : results.warnings) {
                ss << "    - " << warning << "\n";
            }
        }
        
        ss << "  Metrics:\n";
        for (const auto& metric : results.metrics) {
            ss << "    " << metric.name << ": " << metric.value 
               << " " << metric.unit << " (target: " << metric.targetValue 
               << ", status: " << (metric.passed ? "PASS" : "FAIL") << ")\n";
        }
        
        reportContent += ss.str();
        writeToLogFile(ss.str());
        
        if (results.failedTests > 0) {
            Log::error("Test suite '" + results.suiteName + "' has " + 
                      std::to_string(results.failedTests) + " failures!");
        } else {
            Log::info("Test suite '" + results.suiteName + "' passed all tests!");
        }
    }
    
    void reportIndividualTest(const TestResult& result) {
        std::lock_guard<std::mutex> lock(reportMutex);
        
        std::stringstream ss;
        ss << "  Test: " << result.testName << "\n";
        ss << "    Status: " << (result.passed ? "PASS" : "FAIL") << "\n";
        ss << "    Duration: " << result.durationMs << " ms\n";
        
        if (!result.message.empty()) {
            ss << "    Message: " << result.message << "\n";
        }
        
        if (!result.metrics.empty()) {
            ss << "    Metrics:\n";
            for (const auto& metric : result.metrics) {
                ss << "      " << metric.name << ": " << metric.value 
                   << " " << metric.unit << "\n";
            }
        }
        
        reportContent += ss.str();
        writeToLogFile(ss.str());
    }
    
    void generateSummaryReport() {
        std::lock_guard<std::mutex> lock(reportMutex);
        
        if (testSuites.empty()) {
            Log::warning("No test suites to summarize");
            return;
        }
        
        std::stringstream ss;
        ss << "\n=== TEST SUMMARY REPORT ===\n";
        ss << "Generated: " << getCurrentTime() << "\n";
        ss << "Total Test Suites: " << testSuites.size() << "\n";
        
        size_t totalTests = 0;
        size_t totalPassed = 0;
        size_t totalFailed = 0;
        double totalDuration = 0.0;
        double avgPerformance = 0.0;
        
        for (const auto& suite : testSuites) {
            totalTests += suite.totalTests;
            totalPassed += suite.passedTests;
            totalFailed += suite.failedTests;
            totalDuration += suite.durationMs;
            avgPerformance += suite.performanceScore;
        }
        
        avgPerformance /= testSuites.size();
        
        ss << "Total Tests: " << totalTests << "\n";
        ss << "Passed: " << totalPassed << " (" 
           << std::fixed << std::setprecision(1) 
           << (totalTests > 0 ? (100.0 * totalPassed / totalTests) : 0.0) 
           << "%)\n";
        ss << "Failed: " << totalFailed << " (" 
           << std::fixed << std::setprecision(1) 
           << (totalTests > 0 ? (100.0 * totalFailed / totalTests) : 0.0) 
           << "%)\n";
        ss << "Total Duration: " << totalDuration << " ms\n";
        ss << "Average Performance Score: " << std::fixed << std::setprecision(2) 
           << avgPerformance << "\n";
        
        ss << "\n=== DETAILED SUITE RESULTS ===\n";
        for (size_t i = 0; i < testSuites.size(); ++i) {
            const auto& suite = testSuites[i];
            ss << i + 1 << ". " << suite.suiteName << "\n";
            ss << "   Tests: " << suite.passedTests << "/" << suite.totalTests 
               << " passed (" << std::fixed << std::setprecision(1) 
               << (suite.totalTests > 0 ? (100.0 * suite.passedTests / suite.totalTests) : 0.0) 
               << "%)\n";
            ss << "   Performance: " << std::fixed << std::setprecision(2) 
               << suite.performanceScore << "\n";
            ss << "   Duration: " << suite.durationMs << " ms\n";
        }
        
        ss << "\n=== RECOMMENDATIONS ===\n";
        if (totalFailed == 0) {
            ss << "All tests passed! The deferred pipeline is functioning correctly.\n";
        } else {
            ss << "Some tests failed. Review the detailed error messages above.\n";
            ss << "Focus on fixing the highest priority failures first.\n";
        }
        
        ss << "\n=== PERFORMANCE ANALYSIS ===\n";
        if (avgPerformance >= 90.0) {
            ss << "Excellent performance! The pipeline meets all targets.\n";
        } else if (avgPerformance >= 70.0) {
            ss << "Good performance. Some optimizations may be needed.\n";
        } else if (avgPerformance >= 50.0) {
            ss << "Average performance. Consider optimization efforts.\n";
        } else {
            ss << "Poor performance. Significant optimization required.\n";
        }
        
        reportContent += ss.str();
        writeToLogFile(ss.str());
        
        generateHTMLReport();
        generateJSONReport();
        
        Log::info("Test summary report generated");
    }
    
    std::string getReport() const {
        std::lock_guard<std::mutex> lock(reportMutex);
        return reportContent;
    }
    
private:
    void initializeReport() {
        std::time_t now = std::time(nullptr);
        std::tm* tm = std::localtime(&now);
        
        char timestamp[64];
        std::strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", tm);
        
        logFileName = "test_results_" + std::string(timestamp) + ".log";
        htmlFileName = "test_report_" + std::string(timestamp) + ".html";
        jsonFileName = "test_data_" + std::string(timestamp) + ".json";
        
        std::stringstream ss;
        ss << "=== DEFERRED PIPELINE TEST REPORT ===\n";
        ss << "Generated: " << getCurrentTime() << "\n";
        ss << "Platform: Nintendo 64\n";
        ss << "Engine: GameAnimation64/Pyrite64\n";
        ss << "Render Pipeline: Deferred\n";
        ss << "Target FPS: 60\n";
        ss << "Target Triangles: 2000/frame\n";
        ss << "=====================================\n\n";
        
        reportContent = ss.str();
        writeToLogFile(ss.str());
    }
    
    void finalizeReport() {
        generateSummaryReport();
        Log::info("Test report saved to " + logFileName);
    }
    
    void writeToLogFile(const std::string& content) {
        std::ofstream file(logFileName, std::ios::app);
        if (file.is_open()) {
            file << content;
            file.close();
        }
    }
    
    void generateHTMLReport() {
        std::ofstream file(htmlFileName);
        if (!file.is_open()) return;
        
        file << "<!DOCTYPE html>\n";
        file << "<html>\n";
        file << "<head>\n";
        file << "  <title>Deferred Pipeline Test Report</title>\n";
        file << "  <style>\n";
        file << "    body { font-family: Arial, sans-serif; margin: 20px; }\n";
        file << "    h1 { color: #333; }\n";
        file << "    .suite { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }\n";
        file << "    .passed { color: green; }\n";
        file << "    .failed { color: red; }\n";
        file << "    .metric { margin: 5px 0; }\n";
        file << "    table { border-collapse: collapse; width: 100%; }\n";
        file << "    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n";
        file << "    th { background-color: #f2f2f2; }\n";
        file << "  </style>\n";
        file << "</head>\n";
        file << "<body>\n";
        file << "  <h1>Deferred Pipeline Test Report</h1>\n";
        file << "  <p>Generated: " << getCurrentTime() << "</p>\n";
        file << "  <p>Platform: Nintendo 64</p>\n";
        
        if (!testSuites.empty()) {
            size_t totalTests = 0;
            size_t totalPassed = 0;
            for (const auto& suite : testSuites) {
                totalTests += suite.totalTests;
                totalPassed += suite.passedTests;
            }
            
            double passRate = totalTests > 0 ? (100.0 * totalPassed / totalTests) : 0.0;
            
            file << "  <h2>Summary</h2>\n";
            file << "  <p>Total Tests: " << totalTests << "</p>\n";
            file << "  <p>Passed: " << totalPassed << " (" << std::fixed << std::setprecision(1) << passRate << "%)</p>\n";
            file << "  <p>Failed: " << (totalTests - totalPassed) << "</p>\n";
            
            file << "  <h2>Test Suites</h2>\n";
            for (const auto& suite : testSuites) {
                double suitePassRate = suite.totalTests > 0 ? (100.0 * suite.passedTests / suite.totalTests) : 0.0;
                std::string statusClass = (suite.failedTests == 0) ? "passed" : "failed";
                
                file << "  <div class='suite'>\n";
                file << "    <h3>" << suite.suiteName << " <span class='" << statusClass << "'>(" 
                     << suite.passedTests << "/" << suite.totalTests << " passed, " 
                     << std::fixed << std::setprecision(1) << suitePassRate << "%)</span></h3>\n";
                file << "    <p>Duration: " << suite.durationMs << " ms</p>\n";
                file << "    <p>Performance Score: " << std::fixed << std::setprecision(2) << suite.performanceScore << "</p>\n";
                
                if (!suite.metrics.empty()) {
                    file << "    <h4>Metrics:</h4>\n";
                    file << "    <table>\n";
                    file << "      <tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr>\n";
                    for (const auto& metric : suite.metrics) {
                        std::string metricStatus = metric.passed ? "PASS" : "FAIL";
                        std::string metricClass = metric.passed ? "passed" : "failed";
                        file << "      <tr>\n";
                        file << "        <td>" << metric.name << "</td>\n";
                        file << "        <td>" << metric.value << " " << metric.unit << "</td>\n";
                        file << "        <td>" << metric.targetValue << "</td>\n";
                        file << "        <td class='" << metricClass << "'>" << metricStatus << "</td>\n";
                        file << "      </tr>\n";
                    }
                    file << "    </table>\n";
                }
                file << "  </div>\n";
            }
        }
        
        file << "</body>\n";
        file << "</html>\n";
        file.close();
    }
    
    void generateJSONReport() {
        std::ofstream file(jsonFileName);
        if (!file.is_open()) return;
        
        file << "{\n";
        file << "  \"report\": {\n";
        file << "    \"timestamp\": \"" << getCurrentTime() << "\",\n";
        file << "    \"platform\": \"Nintendo 64\",\n";
        file << "    \"engine\": \"GameAnimation64/Pyrite64\",\n";
        file << "    \"pipeline\": \"deferred\",\n";
        file << "    \"targets\": {\n";
        file << "      \"fps\": 60,\n";
        file << "      \"triangles_per_frame\": 2000\n";
        file << "    },\n";
        
        if (!testSuites.empty()) {
            size_t totalTests = 0;
            size_t totalPassed = 0;
            for (const auto& suite : testSuites) {
                totalTests += suite.totalTests;
                totalPassed += suite.passedTests;
            }
            
            file << "    \"summary\": {\n";
            file << "      \"total_tests\": " << totalTests << ",\n";
            file << "      \"passed\": " << totalPassed << ",\n";
            file << "      \"failed\": " << (totalTests - totalPassed) << ",\n";
            file << "      \"pass_rate\": " << std::fixed << std::setprecision(1) 
                 << (totalTests > 0 ? (100.0 * totalPassed / totalTests) : 0.0) << "\n";
            file << "    },\n";
            
            file << "    \"test_suites\": [\n";
            for (size_t i = 0; i < testSuites.size(); ++i) {
                const auto& suite = testSuites[i];
                file << "      {\n";
                file << "        \"name\": \"" << suite.suiteName << "\",\n";
                file << "        \"total_tests\": " << suite.totalTests << ",\n";
                file << "        \"passed\": " << suite.passedTests << ",\n";
                file << "        \"failed\": " << suite.failedTests << ",\n";
                file << "        \"duration_ms\": " << suite.durationMs << ",\n";
                file << "        \"performance_score\": " << std::fixed << std::setprecision(2) << suite.performanceScore << ",\n";
                
                if (!suite.metrics.empty()) {
                    file << "        \"metrics\": [\n";
                    for (size_t j = 0; j < suite.metrics.size(); ++j) {
                        const auto& metric = suite.metrics[j];
                        file << "          {\n";
                        file << "            \"name\": \"" << metric.name << "\",\n";
                        file << "            \"value\": " << metric.value << ",\n";
                        file << "            \"unit\": \"" << metric.unit << "\",\n";
                        file << "            \"target\": " << metric.targetValue << ",\n";
                        file << "            \"passed\": " << (metric.passed ? "true" : "false") << "\n";
                        file << "          }" << (j < suite.metrics.size() - 1 ? "," : "") << "\n";
                    }
                    file << "        ]\n";
                } else {
                    file << "        \"metrics\": []\n";
                }
                
                file << "      }" << (i < testSuites.size() - 1 ? "," : "") << "\n";
            }
            file << "    ]\n";
        }
        
        file << "  }\n";
        file << "}\n";
        file.close();
    }
    
    std::string getCurrentTime() const {
        std::time_t now = std::time(nullptr);
        std::tm* tm = std::localtime(&now);
        
        char buffer[64];
        std::strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", tm);
        return std::string(buffer);
    }
    
    std::string formatTime(std::chrono::system_clock::time_point time) const {
        std::time_t t = std::chrono::system_clock::to_time_t(time);
        std::tm* tm = std::localtime(&t);
        
        char buffer[64];
        std::strftime(buffer, sizeof(buffer), "%H:%M:%S", tm);
        return std::string(buffer);
    }
    
    mutable std::mutex reportMutex;
    std::vector<TestSuiteResults> testSuites;
    std::string reportContent;
    std::string logFileName;
    std::string htmlFileName;
    std::string jsonFileName;
};

static TestResultReporter g_TestResultReporter;

void reportTestSuiteResults(const TestSuiteResults& results) {
    g_TestResultReporter.reportTestSuite(results);
}

void reportIndividualTestResult(const TestResult& result) {
    g_TestResultReporter.reportIndividualTest(result);
}

void generateTestSummaryReport() {
    g_TestResultReporter.generateSummaryReport();
}

std::string getTestReport() {
    return g_TestResultReporter.getReport();
}

} // namespace P64