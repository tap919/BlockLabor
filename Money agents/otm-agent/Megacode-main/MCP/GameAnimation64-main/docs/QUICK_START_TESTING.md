# Quick Start: Deferred Pipeline Testing

This guide will help you quickly set up and run the deferred pipeline testing framework.

## 1. Prerequisites

### Required Tools
- **N64 Toolchain**: Installed and in PATH
- **Make**: Build system
- **Git**: Version control
- **Python 3**: For scripts (optional)

### Verify Installation
```bash
# Check N64 toolchain
which n64-toolchain

# Check make
make --version

# Check git
git --version
```

## 2. One-Time Setup

### Clone and Build
```bash
# Clone the repository (if not already done)
git clone https://github.com/your-org/GameAnimation64.git
cd GameAnimation64

# Build the engine with testing support
cd n64/engine
make clean
make DEFERRED_RENDERING=1 TESTING_FRAMEWORK=1

# Build the test runner
make test_deferred_runner
```

### Build Test Examples
```bash
cd ../examples/deferred_tests
make clean
make
```

## 3. Running Tests

### Quick Test (All Suites)
```bash
# From the project root
./scripts/run_deferred_tests.sh
```

### Individual Test Suites
```bash
cd n64/engine

# Hardware validation
./test_deferred_runner --suite hardware

# Performance benchmarks
./test_deferred_runner --suite performance

# Stress tests
./test_deferred_runner --suite stress

# Visual regression
./test_deferred_runner --suite visual
```

### Generate Reports
```bash
# Generate HTML report
./test_deferred_runner --report --output test_report.html

# View in browser (if available)
open test_report.html
```

## 4. Understanding Results

### Check Test Status
After running tests, check the output directory:
```bash
ls -la test_results/
```

### View Reports
- **HTML Report**: `test_results/reports/test_report.html`
- **JSON Results**: `test_results/reports/*_results.json`
- **Log File**: `test_results/test_run_*.log`
- **Summary**: `test_results/reports/test_summary.md`

### Interpret Results
- **Green**: Tests passed
- **Yellow**: Tests passed with warnings
- **Red**: Tests failed
- **Performance Score**: 90-100% = excellent, 70-89% = good, below 70% = needs work

## 5. Common Tasks

### Update Reference Images
When you make intentional visual changes:
```bash
cd n64/engine
./test_deferred_runner --update-references
```

### Run Specific Test
```bash
cd n64/engine
./test_deferred_runner --test "Geometry Pass Performance"
```

### Verbose Output
```bash
cd n64/engine
./test_deferred_runner --suite hardware --verbose
```

## 6. Troubleshooting

### First Run Issues
```bash
# If tests fail on first run due to missing references
cd n64/engine
./test_deferred_runner --suite visual --update-references
```

### Build Issues
```bash
# Clean and rebuild
cd n64/engine
make clean
make DEFERRED_RENDERING=1 TESTING_FRAMEWORK=1
```

### Permission Issues
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

## 7. Next Steps

### Explore Test Scenes
Check out the example test scenes:
```bash
ls n64/examples/deferred_tests/data/scenes/
```

### Review Documentation
- Full documentation: `docs/TESTING_FRAMEWORK.md`
- API reference: Check header files in `n64/engine/include/renderer/deferred/`

### Integrate with Your Project
See `docs/TESTING_FRAMEWORK.md` section "Integration with Existing Projects"

## 8. Getting Help

### Check Logs
```bash
tail -f test_results/test_run_*.log
```

### Examine Failed Tests
```bash
cat test_results/reports/*_results.json | jq '.errors'
```

### Contact Support
- GitHub Issues: Report bugs and request features
- Documentation: Review `docs/TESTING_FRAMEWORK.md`
- Code Examples: Check existing test implementations

## 9. Quick Reference

### Common Commands
```bash
# Run all tests
./scripts/run_deferred_tests.sh

# Run specific suite
cd n64/engine && ./test_deferred_runner --suite hardware

# Generate report
cd n64/engine && ./test_deferred_runner --report

# Update references
cd n64/engine && ./test_deferred_runner --update-references
```

### Key Files
- **Test Runner**: `n64/engine/test_deferred_runner`
- **Test Script**: `scripts/run_deferred_tests.sh`
- **Test Scenes**: `n64/examples/deferred_tests/data/scenes/`
- **Documentation**: `docs/TESTING_FRAMEWORK.md`

### Performance Targets
- **Frame Rate**: 60 FPS
- **Triangles**: 2000/frame
- **Memory**: 4MB (8MB with Expansion Pak)
- **Lights**: 8+ dynamic lights

## 10. Success Checklist

- [ ] Engine builds with testing framework
- [ ] Test runner compiles successfully
- [ ] All test suites run without errors
- [ ] Performance meets targets (60 FPS, 2000 triangles)
- [ ] Visual regression tests pass
- [ ] Reports generate correctly
- [ ] CI/CD pipeline runs successfully

---

**Need more help?** Check the full documentation in `docs/TESTING_FRAMEWORK.md` or contact the development team.