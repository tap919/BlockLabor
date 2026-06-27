# Deferred Pipeline Testing Framework

## Overview

The Deferred Pipeline Testing Framework is a comprehensive testing infrastructure for validating the deferred rendering pipeline in the GameAnimation64/Pyrite64 engine. It provides hardware validation, performance benchmarking, stress testing, and visual regression testing to ensure the pipeline meets N64 hardware constraints and performance targets.

## Architecture

### Test Types

1. **Hardware Validation Tests**
   - Memory subsystem validation
   - RSP (Reality Signal Processor) testing
   - RDP (Reality Display Processor) validation
   - Texture memory testing
   - Framebuffer validation

2. **Performance Benchmarks**
   - Geometry pass performance
   - Lighting pass performance
   - Shadow mapping performance
   - Particle system performance
   - Memory usage analysis
   - Full pipeline performance

3. **Visual Validation Tests**
   - G-buffer validation
   - Lighting validation
   - Shadow mapping validation
   - Material system validation
   - Particle system validation
   - Integration validation

4. **Stress Tests**
   - Memory stress testing
   - Performance stress testing
   - Stability testing
   - Boundary condition testing

5. **Visual Regression Tests**
   - Basic geometry rendering
   - Lighting rendering
   - Material rendering
   - Shadow rendering
   - Particle rendering
   - Integration rendering

## Test Targets

### Performance Targets
- **Frame Rate**: 60 FPS target
- **Triangle Count**: 2000 triangles/frame (2.5× improvement from 800)
- **Memory Usage**: Within N64 4MB/8MB (with Expansion Pak) constraints
- **Light Count**: Support for 8+ dynamic lights

### Hardware Constraints
- **RSP**: 62.5 MHz, limited parallel processing
- **RDP**: 62.5 MHz, fixed-function pipeline
- **Memory**: 4MB RDRAM (8MB with Expansion Pak)
- **Bandwidth**: 562.5 MB/s peak

## Getting Started

### Prerequisites

1. **N64 Toolchain**: Installed and configured
2. **GameAnimation64 Engine**: Built with deferred rendering support
3. **Test Dependencies**: Make sure all dependencies are installed

### Building the Testing Framework

```bash
# Build the engine with testing framework
cd n64/engine
make clean
make DEFERRED_RENDERING=1 TESTING_FRAMEWORK=1

# Build the test runner
make test_deferred_runner
```

### Running Tests

#### Using the Test Runner Script

```bash
# Make the script executable
chmod +x scripts/run_deferred_tests.sh

# Run all tests
./scripts/run_deferred_tests.sh
```

#### Running Individual Test Suites

```bash
cd n64/engine

# Hardware validation tests
./test_deferred_runner --suite hardware

# Performance benchmark tests
./test_deferred_runner --suite performance

# Stress tests
./test_deferred_runner --suite stress

# Visual regression tests
./test_deferred_runner --suite visual

# Generate comprehensive report
./test_deferred_runner --report
```

#### Command Line Options

```
Usage: ./test_deferred_runner [options]

Options:
  --suite <name>        Run specific test suite (hardware, performance, stress, visual, all)
  --test <name>         Run specific test by name
  --output <file>       Output results to file (JSON format)
  --report              Generate comprehensive HTML report
  --verbose             Enable verbose output
  --help                Show this help message
```

## Test Scenes

The framework includes example test scenes located in `n64/examples/deferred_tests/data/scenes/`:

1. **Basic Geometry Test** (`1_scene.json`)
   - Tests basic geometry rendering with multiple lights
   - Validates G-buffer generation

2. **Multiple Lights Stress Test** (`2_scene.json`)
   - Tests lighting system under stress
   - Validates light culling and shading

3. **Material System Test** (`3_scene.json`)
   - Tests different material properties
   - Validates material system integration

## Test Results

### Output Formats

1. **JSON Results**: Machine-readable test results
2. **HTML Reports**: Human-readable comprehensive reports
3. **Log Files**: Detailed execution logs
4. **Summary Reports**: Markdown-formatted summaries

### Result Interpretation

#### Performance Scores
- **90-100%**: Excellent performance, meets all targets
- **70-89%**: Good performance, minor optimizations needed
- **50-69%**: Average performance, optimization recommended
- **Below 50%**: Poor performance, significant work needed

#### Test Status
- **PASS**: Test completed successfully
- **FAIL**: Test failed to meet requirements
- **WARNING**: Test passed with minor issues
- **SKIPPED**: Test was skipped (not applicable)
- **ERROR**: Test encountered an error

## Continuous Integration

### GitHub Actions

The framework includes GitHub Actions workflows for automated testing:

1. **Build and Test**: Runs on push and pull requests
2. **Emulator Testing**: Runs in emulator environment
3. **Documentation Deployment**: Deploys test reports to GitHub Pages

### Local CI Scripts

```bash
# Run the full CI pipeline locally
./scripts/run_deferred_tests.sh
```

## Adding New Tests

### 1. Create Test Scene

Create a new test scene JSON file in `n64/examples/deferred_tests/data/scenes/`:

```json
{
  "conf": {
    "name": "Your Test Scene",
    "renderPipeline": 1  // Use deferred pipeline
  },
  "graph": {
    // Scene graph definition
  }
}
```

### 2. Add Test Implementation

Add test implementation in the appropriate file:

- **Hardware Tests**: `TestImplementations.cpp`
- **Performance Tests**: `TestImplementations.cpp`
- **Stress Tests**: `StressTests.cpp`
- **Visual Tests**: `VisualRegression.cpp`

### 3. Register Test

Add the test to the appropriate test suite in `TestingFramework.cpp`:

```cpp
TestSuiteConfig yourTestSuite = {
    "Your Test Suite",
    {
        TestType::YOUR_TEST_TYPE,
        // Add other test types
    },
    1000  // Timeout in milliseconds
};
```

## Best Practices

### 1. Test Design
- **Isolate Tests**: Each test should test one specific feature
- **Use Realistic Data**: Test with realistic N64 constraints
- **Include Edge Cases**: Test boundary conditions and error cases

### 2. Performance Testing
- **Measure Real Performance**: Use actual frame timing
- **Test Under Load**: Test with maximum triangle/light counts
- **Compare Baselines**: Compare against forward rendering baseline

### 3. Visual Testing
- **Use Reference Images**: Store reference images for comparison
- **Set Appropriate Tolerance**: Account for minor rendering variations
- **Update References**: Update references when intentional changes are made

### 4. Reporting
- **Include Metrics**: Report quantitative measurements
- **Provide Context**: Explain what the metrics mean
- **Suggest Actions**: Provide recommendations for failed tests

## Troubleshooting

### Common Issues

1. **Tests Fail on First Run**
   - This may be expected if reference images don't exist
   - Run tests again to establish baselines

2. **Performance Tests Fail**
   - Check if hardware meets requirements
   - Verify test scene complexity
   - Check for background processes affecting performance

3. **Visual Tests Show Minor Differences**
   - Some variation is normal due to floating-point precision
   - Adjust tolerance if needed
   - Verify intentional changes haven't been made

4. **Memory Tests Fail**
   - Check available memory
   - Verify memory allocation patterns
   - Check for memory leaks

### Debugging Tips

1. **Enable Verbose Output**
   ```bash
   ./test_deferred_runner --suite hardware --verbose
   ```

2. **Check Log Files**
   ```bash
   tail -f test_results/test_run_*.log
   ```

3. **Examine JSON Results**
   ```bash
   cat test_results/reports/hardware_results.json | jq '.'
   ```

4. **View HTML Reports**
   Open `test_results/reports/test_report.html` in a browser

## Advanced Usage

### Custom Test Configurations

Create custom test configurations by modifying test parameters:

```cpp
TestConfig customConfig = {
    .targetFPS = 60,
    .targetTriangles = 2000,
    .maxLights = 8,
    .memoryLimitMB = 4,
    .tolerance = 0.01f
};
```

### Integration with Existing Projects

To integrate the testing framework into an existing project:

1. **Include Testing Headers**
   ```cpp
   #include "renderer/deferred/TestingFramework.h"
   ```

2. **Initialize Framework**
   ```cpp
   auto framework = std::make_unique<DeferredTestingFramework>();
   framework->initialize();
   ```

3. **Run Tests**
   ```cpp
   auto results = framework->runTestSuite("hardware");
   ```

4. **Handle Results**
   ```cpp
   if (results.failedTests > 0) {
       // Handle test failures
   }
   ```

### Automated Test Generation

Use the test generation utilities to create tests automatically:

```cpp
// Generate performance test for scene
auto test = PerformanceTestGenerator::generateForScene(scene);
test->run();
```

## Contributing

### Adding New Test Types

1. **Define Test Type**
   ```cpp
   enum class TestType : uint8_t {
       // Existing types...
       YOUR_NEW_TEST = 10
   };
   ```

2. **Implement Test Class**
   ```cpp
   class YourNewTest : public BaseTest {
       // Implementation...
   };
   ```

3. **Register Test Factory**
   ```cpp
   TestFactory::registerTest(TestType::YOUR_NEW_TEST, 
                            []() { return new YourNewTest(); });
   ```

### Reporting Issues

When reporting test failures:

1. **Include Test Output**: Copy the test output
2. **Provide System Information**: Include hardware/software details
3. **Describe Expected Behavior**: Explain what should happen
4. **Include Reproduction Steps**: Steps to reproduce the issue

## License

This testing framework is part of the GameAnimation64/Pyrite64 engine and is licensed under the MIT License.

## Support

For support with the testing framework:

1. **Check Documentation**: Review this document and code comments
2. **Examine Examples**: Look at existing test implementations
3. **Review Test Results**: Analyze failed test outputs
4. **Contact Maintainers**: Reach out to the development team

## Future Enhancements

Planned enhancements for the testing framework:

1. **Network Testing**: Test network multiplayer performance
2. **Audio Testing**: Test audio system integration
3. **Input Testing**: Test controller input handling
4. **Save/Load Testing**: Test save system functionality
5. **Multi-language Testing**: Test internationalization support