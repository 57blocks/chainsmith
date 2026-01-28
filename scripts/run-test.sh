#!/bin/bash
# Run tests with dynamic report filename based on CHAIN_ENV
# Usage: ./scripts/run-test.sh <test-type> <test-file> <timeout>
# Example: ./scripts/run-test.sh basic tests/basic/basic-edsl.test.ts 60000

set -e

TEST_TYPE="$1"
TEST_FILE="$2"
TIMEOUT="${3:-60000}"

if [ -z "$TEST_TYPE" ] || [ -z "$TEST_FILE" ]; then
    echo "Usage: $0 <test-type> <test-file> [timeout]"
    echo "Example: $0 basic tests/basic/basic-edsl.test.ts 60000"
    exit 1
fi

# Get CHAIN_ENV, default to 'local' if not set
CHAIN_ENV="${CHAIN_ENV:-chain-1}"

# Build report filename with chain name
REPORT_FILENAME="${TEST_TYPE}-${CHAIN_ENV}"

echo "Running ${TEST_TYPE} tests on ${CHAIN_ENV}..."
echo "Report will be saved as: tests/test-report/${REPORT_FILENAME}.html"

mocha -r ts-node/register -r mocha-steps "$TEST_FILE" \
    --reporter mochawesome \
    --reporter-options "reportDir=tests/test-report,reportFilename=${REPORT_FILENAME}" \
    --timeout "$TIMEOUT" \
    --exit
