#!/bin/bash
# Initialize test configuration
# Usage: pnpm init:tests OR ./scripts/init-tests.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TESTS_DIR="$PROJECT_ROOT/tests"

echo "ChainSmith Test Configuration Setup"
echo "===================================="
echo ""

# --- Setup .env ---
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Note: .env already exists, skipping."
else
    echo "Creating .env with default settings..."
    cat > "$PROJECT_ROOT/.env" << 'EOF'
# Environment name (matches key in tests/config.json)
CHAIN_ENV=chain-1

# Wallet private keys (only needed when privateKeySource: "env" in config.json)
# FOUNDER_WALLET_PK=0x_your_founder_wallet_private_key
# COSMOS_FOUNDER_WALLET_PK=your_cosmos_founder_wallet_private_key

# Load test wallets (only needed for load/stress tests with walletEnvPrefix)
# LOAD_WALLET_PK_1=0x_your_load_test_wallet_1_private_key
# LOAD_WALLET_PK_2=0x_your_load_test_wallet_2_private_key
# LOAD_WALLET_PK_3=0x_your_load_test_wallet_3_private_key
EOF
    echo "Created .env"
fi

echo ""

# --- Setup tests/config.json ---
if [ -f "$TESTS_DIR/config.json" ]; then
    echo "Note: tests/config.json already exists, skipping."
elif [ -f "$TESTS_DIR/config.local.example.json" ]; then
    echo "Creating tests/config.json from config.local.example.json..."
    cp "$TESTS_DIR/config.local.example.json" "$TESTS_DIR/config.json"
    echo "Created tests/config.json"
else
    echo "Error: tests/config.local.example.json not found."
    echo "Please ensure you have cloned the repository correctly."
    exit 1
fi

echo ""
echo "Done! Next steps:"
echo "1. Edit .env to set wallet private keys"
echo "2. Edit tests/config.json to match your local blockchain setup"
echo "3. Start your local blockchain nodes"
echo "4. Run tests with: CHAIN_ENV=chain-1 pnpm test:basic"
echo ""
echo "Available test commands:"
echo "  pnpm test:basic              - Basic connectivity"
echo "  pnpm test:rpc:evm            - EVM JSON-RPC"
echo "  pnpm test:rpc:cometbft       - CometBFT RPC"
echo "  pnpm test:cosmos:api:sample  - Cosmos SDK APIs"
echo "  pnpm test:fault-tolerance    - Consensus recovery"
echo "  pnpm test:performance        - Throughput testing"
echo "  pnpm test:load:stress        - Load testing"
echo "  pnpm test:staking:sample     - Staking workflow *"
echo "  pnpm test:slashing:sample    - Slashing workflow *"
echo "  pnpm test:rewards:sample     - Rewards workflow *"
echo ""
echo "* These tests require customization based on the specific blockchain's rules."
echo ""
