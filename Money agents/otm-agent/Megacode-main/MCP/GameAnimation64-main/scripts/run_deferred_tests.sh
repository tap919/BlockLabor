#!/bin/bash

# Deferred Pipeline Test Runner
# Run this script to execute all deferred rendering pipeline tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENGINE_DIR="n64/engine"
TEST_EXAMPLE_DIR="n64/examples/deferred_tests"
OUTPUT_DIR="test_results"
REPORT_DIR="$OUTPUT_DIR/reports"
LOG_FILE="$OUTPUT_DIR/test_run_$(date +%Y%m%d_%H%M%S).log"

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$REPORT_DIR"

# Log function
log() {
    echo -e "$1"
    echo -e "$1" >> "$LOG_FILE"
}

# Header
log "${BLUE}========================================${NC}"
log "${BLUE}  Deferred Pipeline Test Suite Runner  ${NC}"
log "${BLUE}========================================${NC}"
log "Date: $(date)"
log "Engine Directory: $ENGINE_DIR"
log "Test Directory: $TEST_EXAMPLE_DIR"
log "Output Directory: $OUTPUT_DIR"
log ""

# Check if we're in the right directory
if [ ! -d "$ENGINE_DIR" ]; then
    log "${RED}Error: Engine directory not found at $ENGINE_DIR${NC}"
    exit 1
fi

# Function to run a test suite
run_test_suite() {
    local suite_name="$1"
    local test_args="$2"
    local output_file="$REPORT_DIR/${suite_name}_results.json"
    
    log "${YELLOW}Running $suite_name tests...${NC}"
    
    cd "$ENGINE_DIR"
    
    # Build test runner if needed
    if [ ! -f "test_deferred_runner" ]; then
        log "Building test runner..."
        make clean
        make DEFERRED_RENDERING=1 TESTING_FRAMEWORK=1
    fi
    
    # Run the tests
    if [ -f "test_deferred_runner" ]; then
        ./test_deferred_runner $test_args --output "$output_file" 2>&1 | tee -a "$LOG_FILE"
        
        # Check if tests passed
        if [ $? -eq 0 ]; then
            log "${GREEN}$suite_name tests completed successfully${NC}"
            
            # Extract pass rate from JSON if available
            if [ -f "$output_file" ]; then
                local pass_rate=$(jq -r '.summary.pass_rate' "$output_file" 2>/dev/null || echo "N/A")
                log "Pass rate: $pass_rate%"
            fi
        else
            log "${RED}$suite_name tests failed${NC}"
            return 1
        fi
    else
        log "${RED}Error: test_deferred_runner not found${NC}"
        return 1
    fi
    
    cd - > /dev/null
    return 0
}

# Function to build test example
build_test_example() {
    log "${YELLOW}Building test example...${NC}"
    
    if [ -d "$TEST_EXAMPLE_DIR" ]; then
        cd "$TEST_EXAMPLE_DIR"
        make clean
        make
        cd - > /dev/null
        log "${GREEN}Test example built successfully${NC}"
    else
        log "${YELLOW}Warning: Test example directory not found at $TEST_EXAMPLE_DIR${NC}"
    fi
}

# Function to generate summary report
generate_summary_report() {
    log "${YELLOW}Generating summary report...${NC}"
    
    local summary_file="$REPORT_DIR/test_summary.md"
    
    cat > "$summary_file" << EOF
# Deferred Pipeline Test Summary

## Test Run Information
- Date: $(date)
- Engine: GameAnimation64/Pyrite64
- Pipeline: Deferred Rendering
- Target FPS: 60
- Target Triangles: 2000/frame

## Test Results

EOF
    
    # Add results for each test suite
    for suite_file in "$REPORT_DIR"/*_results.json; do
        if [ -f "$suite_file" ]; then
            local suite_name=$(basename "$suite_file" _results.json)
            local pass_rate=$(jq -r '.summary.pass_rate' "$suite_file" 2>/dev/null || echo "N/A")
            local total_tests=$(jq -r '.summary.total_tests' "$suite_file" 2>/dev/null || echo "N/A")
            local passed=$(jq -r '.summary.passed' "$suite_file" 2>/dev/null || echo "N/A")
            local failed=$(jq -r '.summary.failed' "$suite_file" 2>/dev/null || echo "N/A")
            
            cat >> "$summary_file" << EOF
### ${suite_name^}
- Total Tests: $total_tests
- Passed: $passed
- Failed: $failed
- Pass Rate: $pass_rate%

EOF
        fi
    done
    
    # Add recommendations
    cat >> "$summary_file" << EOF
## Recommendations

Based on the test results:

EOF
    
    # Check if any tests failed
    local any_failed=false
    for suite_file in "$REPORT_DIR"/*_results.json; do
        if [ -f "$suite_file" ]; then
            local failed=$(jq -r '.summary.failed' "$suite_file" 2>/dev/null || echo "0")
            if [ "$failed" != "0" ] && [ "$failed" != "N/A" ]; then
                any_failed=true
                break
            fi
        fi
    done
    
    if [ "$any_failed" = true ]; then
        cat >> "$summary_file" << EOF
1. **Address Failed Tests**: Review the failed tests in the detailed reports
2. **Check Performance Targets**: Ensure the pipeline meets 60 FPS with 2000 triangles
3. **Validate Memory Usage**: Verify memory usage is within N64 constraints
4. **Review Visual Quality**: Check visual regression test results

**Status**: ❌ Some tests failed - review required
EOF
    else
        cat >> "$summary_file" << EOF
1. **All Tests Passed**: The deferred pipeline is functioning correctly
2. **Performance Targets Met**: Pipeline meets 60 FPS with 2000 triangles
3. **Memory Usage Valid**: Memory usage is within N64 constraints
4. **Visual Quality Maintained**: No visual regressions detected

**Status**: ✅ All tests passed - ready for production
EOF
    fi
    
    log "${GREEN}Summary report generated: $summary_file${NC}"
}

# Main test execution
main() {
    log "${BLUE}Starting deferred pipeline test suite...${NC}"
    
    # Build test example first
    build_test_example
    
    # Run test suites
    local all_passed=true
    
    # Hardware validation tests
    if run_test_suite "hardware" "--suite hardware"; then
        log "${GREEN}✓ Hardware validation tests passed${NC}"
    else
        log "${RED}✗ Hardware validation tests failed${NC}"
        all_passed=false
    fi
    
    # Performance benchmark tests
    if run_test_suite "performance" "--suite performance"; then
        log "${GREEN}✓ Performance benchmark tests passed${NC}"
    else
        log "${RED}✗ Performance benchmark tests failed${NC}"
        all_passed=false
    fi
    
    # Stress tests
    if run_test_suite "stress" "--suite stress"; then
        log "${GREEN}✓ Stress tests passed${NC}"
    else
        log "${RED}✗ Stress tests failed${NC}"
        all_passed=false
    fi
    
    # Visual regression tests
    if run_test_suite "visual" "--suite visual"; then
        log "${GREEN}✓ Visual regression tests passed${NC}"
    else
        log "${RED}✗ Visual regression tests failed${NC}"
        all_passed=false
    fi
    
    # Generate comprehensive report
    log ""
    log "${YELLOW}Generating comprehensive test report...${NC}"
    
    cd "$ENGINE_DIR"
    if [ -f "test_deferred_runner" ]; then
        ./test_deferred_runner --report --output "$REPORT_DIR/test_report.html" 2>&1 | tee -a "$LOG_FILE"
        log "${GREEN}Comprehensive report generated${NC}"
    fi
    cd - > /dev/null
    
    # Generate summary
    generate_summary_report
    
    # Final status
    log ""
    log "${BLUE}========================================${NC}"
    if [ "$all_passed" = true ]; then
        log "${GREEN}✅ ALL TESTS PASSED${NC}"
        log "${GREEN}The deferred pipeline is ready for use!${NC}"
    else
        log "${RED}❌ SOME TESTS FAILED${NC}"
        log "${YELLOW}Review the test reports for details${NC}"
    fi
    log "${BLUE}========================================${NC}"
    log ""
    log "Test results saved to:"
    log "  - Log file: $LOG_FILE"
    log "  - Reports: $REPORT_DIR/"
    log "  - Summary: $REPORT_DIR/test_summary.md"
    
    if [ "$all_passed" = false ]; then
        exit 1
    fi
}

# Run main function
main "$@"