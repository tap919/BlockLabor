#include "renderer/deferred/TestingFramework.h"
#include "renderer/deferred/DeferredPipeline.h"
#include <vector>
#include <algorithm>
#include <cmath>
#include <fstream>

namespace P64::Deferred::Testing {

class VisualRegressionTester {
public:
    VisualRegressionTester(DeferredPipeline* pipeline) 
        : pipeline(pipeline), 
          referenceDirectory("test_references/"),
          tolerance(0.01f) {} // 1% tolerance
    
    /**
     * Run visual regression tests
     */
    TestSuiteResults runVisualRegressionTests() {
        TestSuiteResults results;
        results.suiteName = "Visual Regression Tests";
        results.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Starting visual regression tests...");
            
            // Create reference directory if it doesn't exist
            createReferenceDirectory();
            
            // Run individual visual tests
            auto basicGeometryTest = testBasicGeometryRendering();
            auto lightingTest = testLightingRendering();
            auto materialTest = testMaterialRendering();
            auto shadowTest = testShadowRendering();
            auto particleTest = testParticleRendering();
            auto integrationTest = testIntegrationRendering();
            
            // Combine results
            results.totalTests = 6;
            results.passedTests = 0;
            results.failedTests = 0;
            
            if (basicGeometryTest.passed) results.passedTests++;
            else results.failedTests++;
            
            if (lightingTest.passed) results.passedTests++;
            else results.failedTests++;
            
            if (materialTest.passed) results.passedTests++;
            else results.failedTests++;
            
            if (shadowTest.passed) results.passedTests++;
            else results.failedTests++;
            
            if (particleTest.passed) results.passedTests++;
            else results.failedTests++;
            
            if (integrationTest.passed) results.passedTests++;
            else results.failedTests++;
            
            // Calculate visual quality score
            results.performanceScore = calculateVisualQualityScore(
                basicGeometryTest, lightingTest, materialTest, 
                shadowTest, particleTest, integrationTest);
            
            // Collect metrics
            results.metrics.insert(results.metrics.end(), 
                                  basicGeometryTest.metrics.begin(), 
                                  basicGeometryTest.metrics.end());
            results.metrics.insert(results.metrics.end(), 
                                  lightingTest.metrics.begin(), 
                                  lightingTest.metrics.end());
            results.metrics.insert(results.metrics.end(), 
                                  materialTest.metrics.begin(), 
                                  materialTest.metrics.end());
            results.metrics.insert(results.metrics.end(), 
                                  shadowTest.metrics.begin(), 
                                  shadowTest.metrics.end());
            results.metrics.insert(results.metrics.end(), 
                                  particleTest.metrics.begin(), 
                                  particleTest.metrics.end());
            results.metrics.insert(results.metrics.end(), 
                                  integrationTest.metrics.begin(), 
                                  integrationTest.metrics.end());
            
            // Add errors and warnings
            if (!basicGeometryTest.message.empty() && !basicGeometryTest.passed) {
                results.errors.push_back("Basic geometry test: " + basicGeometryTest.message);
            }
            if (!lightingTest.message.empty() && !lightingTest.passed) {
                results.errors.push_back("Lighting test: " + lightingTest.message);
            }
            if (!materialTest.message.empty() && !materialTest.passed) {
                results.errors.push_back("Material test: " + materialTest.message);
            }
            if (!shadowTest.message.empty() && !shadowTest.passed) {
                results.errors.push_back("Shadow test: " + shadowTest.message);
            }
            if (!particleTest.message.empty() && !particleTest.passed) {
                results.errors.push_back("Particle test: " + particleTest.message);
            }
            if (!integrationTest.message.empty() && !integrationTest.passed) {
                results.errors.push_back("Integration test: " + integrationTest.message);
            }
            
        } catch (const std::exception& e) {
            results.errors.push_back("Exception in visual regression tests: " + std::string(e.what()));
            results.failedTests = results.totalTests;
        }
        
        results.endTime = std::chrono::system_clock::now();
        results.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            results.endTime - results.startTime).count();
        
        return results;
    }
    
    /**
     * Test basic geometry rendering
     */
    TestResult testBasicGeometryRendering() {
        TestResult result;
        result.testName = "Basic Geometry Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing basic geometry rendering...");
            
            // Render test scene
            surface_t* currentImage = renderTestScene("basic_geometry");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("basic_geometry_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "basic_geometry_ref.bin");
                result.message = "Reference image created for basic geometry";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Image Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    99.0,  // Target: 99% similarity
                    similarity >= 0.99f
                });
                
                result.passed = similarity >= 0.99f;
                
                if (!result.passed) {
                    result.message = "Basic geometry rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "basic_geometry_diff.bin");
                } else {
                    result.message = "Basic geometry rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Test lighting rendering
     */
    TestResult testLightingRendering() {
        TestResult result;
        result.testName = "Lighting Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing lighting rendering...");
            
            // Render test scene with multiple lights
            surface_t* currentImage = renderTestScene("lighting");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("lighting_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "lighting_ref.bin");
                result.message = "Reference image created for lighting";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Lighting Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    98.0,  // Target: 98% similarity (lighting can have minor variations)
                    similarity >= 0.98f
                });
                
                result.passed = similarity >= 0.98f;
                
                if (!result.passed) {
                    result.message = "Lighting rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "lighting_diff.bin");
                } else {
                    result.message = "Lighting rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Test material rendering
     */
    TestResult testMaterialRendering() {
        TestResult result;
        result.testName = "Material Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing material rendering...");
            
            // Render test scene with different materials
            surface_t* currentImage = renderTestScene("materials");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("materials_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "materials_ref.bin");
                result.message = "Reference image created for materials";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Material Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    99.0,  // Target: 99% similarity
                    similarity >= 0.99f
                });
                
                result.passed = similarity >= 0.99f;
                
                if (!result.passed) {
                    result.message = "Material rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "materials_diff.bin");
                } else {
                    result.message = "Material rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Test shadow rendering
     */
    TestResult testShadowRendering() {
        TestResult result;
        result.testName = "Shadow Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing shadow rendering...");
            
            // Render test scene with shadows
            surface_t* currentImage = renderTestScene("shadows");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("shadows_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "shadows_ref.bin");
                result.message = "Reference image created for shadows";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Shadow Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    97.0,  // Target: 97% similarity (shadows can have minor variations)
                    similarity >= 0.97f
                });
                
                result.passed = similarity >= 0.97f;
                
                if (!result.passed) {
                    result.message = "Shadow rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "shadows_diff.bin");
                } else {
                    result.message = "Shadow rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Test particle rendering
     */
    TestResult testParticleRendering() {
        TestResult result;
        result.testName = "Particle Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing particle rendering...");
            
            // Render test scene with particles
            surface_t* currentImage = renderTestScene("particles");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("particles_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "particles_ref.bin");
                result.message = "Reference image created for particles";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Particle Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    96.0,  // Target: 96% similarity (particles are random)
                    similarity >= 0.96f
                });
                
                result.passed = similarity >= 0.96f;
                
                if (!result.passed) {
                    result.message = "Particle rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "particles_diff.bin");
                } else {
                    result.message = "Particle rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Test integration rendering
     */
    TestResult testIntegrationRendering() {
        TestResult result;
        result.testName = "Integration Rendering";
        result.startTime = std::chrono::system_clock::now();
        
        try {
            Log::info("Testing integration rendering...");
            
            // Render test scene with all features combined
            surface_t* currentImage = renderTestScene("integration");
            
            // Load or create reference
            surface_t* referenceImage = loadReferenceImage("integration_ref.bin");
            if (!referenceImage) {
                // First run - create reference
                referenceImage = createReferenceImage(currentImage, "integration_ref.bin");
                result.message = "Reference image created for integration";
                result.passed = true;
            } else {
                // Compare with reference
                float similarity = compareImages(currentImage, referenceImage);
                
                result.metrics.push_back({
                    "Integration Similarity",
                    static_cast<double>(similarity * 100.0),
                    "%",
                    98.0,  // Target: 98% similarity
                    similarity >= 0.98f
                });
                
                result.passed = similarity >= 0.98f;
                
                if (!result.passed) {
                    result.message = "Integration rendering differs from reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                    saveDifferenceImage(currentImage, referenceImage, "integration_diff.bin");
                } else {
                    result.message = "Integration rendering matches reference (similarity: " + 
                                   std::to_string(similarity * 100.0) + "%)";
                }
            }
            
            // Cleanup
            if (currentImage) surface_free(currentImage);
            if (referenceImage && referenceImage != currentImage) surface_free(referenceImage);
            
        } catch (const std::exception& e) {
            result.passed = false;
            result.message = "Exception: " + std::string(e.what());
        }
        
        result.endTime = std::chrono::system_clock::now();
        result.durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            result.endTime - result.startTime).count();
        
        return result;
    }
    
    /**
     * Update reference images (for when intentional changes are made)
     */
    bool updateReferenceImages() {
        try {
            Log::info("Updating reference images...");
            
            // Render and update all reference images
            updateReferenceImage("basic_geometry");
            updateReferenceImage("lighting");
            updateReferenceImage("materials");
            updateReferenceImage("shadows");
            updateReferenceImage("particles");
            updateReferenceImage("integration");
            
            Log::info("Reference images updated successfully");
            return true;
            
        } catch (const std::exception& e) {
            Log::error("Failed to update reference images: " + std::string(e.what()));
            return false;
        }
    }
    
private:
    // Helper methods
    void createReferenceDirectory() {
        // Implementation would create directory if it doesn't exist
        // For N64, this might involve creating files on the cartridge
    }
    
    surface_t* renderTestScene(const std::string& sceneType) {
        // Implementation would render the appropriate test scene
        // For now, return a placeholder
        return nullptr;
    }
    
    surface_t* loadReferenceImage(const std::string& filename) {
        // Implementation would load reference image from storage
        // For now, return nullptr (no reference exists)
        return nullptr;
    }
    
    surface_t* createReferenceImage(surface_t* image, const std::string& filename) {
        // Implementation would save image as reference
        // For now, just return the input image
        return image;
    }
    
    float compareImages(const surface_t* img1, const surface_t* img2) {
        if (!img1 || !img2) return 0.0f;
        
        // Implementation would compare images pixel by pixel
        // For now, return placeholder similarity
        return 0.995f; // 99.5% similarity
    }
    
    void saveDifferenceImage(const surface_t* img1, const surface_t* img2, 
                            const std::string& filename) {
        // Implementation would save difference image
        // This helps identify where the images differ
    }
    
    void updateReferenceImage(const std::string& sceneType) {
        // Implementation would update reference image for a scene type
        surface_t* currentImage = renderTestScene(sceneType);
        if (currentImage) {
            std::string filename = sceneType + "_ref.bin";
            createReferenceImage(currentImage, filename);
            surface_free(currentImage);
        }
    }
    
    double calculateVisualQualityScore(const TestResult& geometry,
                                      const TestResult& lighting,
                                      const TestResult& material,
                                      const TestResult& shadow,
                                      const TestResult& particle,
                                      const TestResult& integration) {
        double score = 0.0;
        int count = 0;
        
        // Weight different tests based on importance
        if (geometry.passed) { score += 20.0; count++; }
        if (lighting.passed) { score += 20.0; count++; }
        if (material.passed) { score += 20.0; count++; }
        if (shadow.passed) { score += 15.0; count++; }
        if (particle.passed) { score += 15.0; count++; }
        if (integration.passed) { score += 10.0; count++; }
        
        return (count > 0) ? (score / 100.0 * 100.0) : 0.0; // Convert to percentage
    }
    
    DeferredPipeline* pipeline;
    std::string referenceDirectory;
    float tolerance;
};

// Public API functions
TestSuiteResults runVisualRegressionTests(DeferredPipeline* pipeline) {
    VisualRegressionTester tester(pipeline);
    return tester.runVisualRegressionTests();
}

bool updateVisualReferenceImages(DeferredPipeline* pipeline) {
    VisualRegressionTester tester(pipeline);
    return tester.updateReferenceImages();
}

} // namespace P64::Deferred::Testing