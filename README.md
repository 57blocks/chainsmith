# ChainSmith - Blockchain Test Framework

A comprehensive test framework for validating blockchain nodes with **EVM execution layer** and **Cosmos/CometBFT consensus layer**.

## Background

ChainSmith is designed to test blockchains that combine:

- **Execution Layer**: EVM-compatible (Ethereum JSON-RPC)
- **Consensus Layer**: Cosmos SDK / CometBFT (Tendermint)

This architecture is used by chains like Evmos and similar EVM+Cosmos hybrid blockchains.

## Current Test Scope

| Category            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| **Basic**           | Connectivity validation, block height, chain ID         |
| **EVM RPC**         | Ethereum JSON-RPC compliance testing                    |
| **CometBFT RPC**    | Tendermint/CometBFT RPC compliance testing              |
| **Cosmos API**      | Cosmos SDK module API testing (staking, slashing, mint) |
| **Fault Tolerance** | Consensus recovery under validator failures             |
| **Performance**     | Transaction throughput and latency                      |
| **Load/Stress**     | Concurrent and sustained load testing                   |

> **Note**: Staking, slashing, and rewards tests require customization based on the specific blockchain's rules (e.g., unbonding period, slashing conditions, reward distribution parameters).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Action (optional)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  CLI tool for running tests                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Test Suites                          │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │   Protocol Compliance   │  │     Chain Behavior      │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│                      │    │         BlockchainFactory        │
│    RuntimeManager    │◄──►│  ┌──────────┐  ┌──────────┐      │
│                      │    │  │  Cosmos  │  │   EVM    │      │
│                      │    │  └──────────┘  └──────────┘      │
└──────────────────────┘    └──────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Test Reports                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Dependencies                         │
│      Ethers.js      Mocha      Chai      Axios              │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

```
src/
├── core/                    # Core classes
│   ├── RuntimeManager.ts    # Config loader, entry point
│   ├── Blockchain.ts        # Blockchain network abstraction
│   └── BlockchainNode.ts    # Individual node with clients
├── blockchain/
│   ├── clients/             # Layer-specific clients
│   │   ├── evm-execute-client.ts      # EVM execution layer
│   │   └── cosmos-consensus-client.ts # Cosmos consensus layer
│   ├── test-library/        # Test builders
│   └── factory.ts           # Client factory
├── infrastructure/          # Node operations (Docker, SSH)
└── utils/                   # Utilities
```

## Quick Start

### Prerequisites

- **Supported OS**: Linux, macOS, Windows (WSL or Git Bash)
- Node.js v18+
- pnpm package manager
- Running blockchain nodes (local or remote)

### Installation

```bash
git clone https://github.com/57blocks/chainsmith.git
cd chainsmith
pnpm install
```

### Configuration

1. **Initialize config from template:**

```bash
pnpm init:tests
```

This creates `tests/config.json` from `tests/config.local.example.json`.

2. **Edit `tests/config.json`** to match your blockchain setup:

```json
{
    "chain-1": {
        "description": "Local Test chain",
        "consensusLayer": "cosmos",
        "executeLayer": "evm",
        "chainId": 1399,
        "executeLayerHttpRpcUrl": "http://localhost:8545",
        "consensusLayerRpcUrl": "http://localhost:26657",
        "consensusLayerHttpRestApiUrl": "http://localhost:1317",
        "nodes": [
            {
                "index": 1,
                "url": "http://localhost",
                "type": "validator",
                "votingPower": 1,
                "active": true,
                "executeLayerHttpRpcPort": 8545,
                "consensusLayerRpcPort": 26657,
                "consensusLayerHttpRestApiPort": 1317
            }
        ],
        "founderWallet": {
            "name": "faucet",
            "address": "0x...",
            "privateKey": "0x...",
            "privateKeySource": "local"
        }
    }
}
```

### Running Tests

**Prerequisites before running tests:**

1. Start your local blockchain (or ensure remote nodes are accessible)
2. Edit `tests/config.json` to match your blockchain's configuration (RPC ports, chain ID, founder wallet, etc.)

```bash
# Set environment (matches key in config.json)
export CHAIN_ENV=chain-1

# Basic connectivity test
pnpm test:basic

# RPC compliance tests
pnpm test:rpc:evm
pnpm test:rpc:cometbft

# Cosmos API tests
pnpm test:cosmos:api:sample

# Fault tolerance (requires multiple validator nodes)
pnpm test:fault-tolerance

# Performance tests
pnpm test:performance
```

## Available Test Commands

| Command                       | Description          |
| ----------------------------- | -------------------- |
| `pnpm test:basic`             | Basic connectivity   |
| `pnpm test:rpc:evm`           | EVM JSON-RPC         |
| `pnpm test:rpc:cometbft`      | CometBFT RPC         |
| `pnpm test:cosmos:api:sample` | Cosmos SDK APIs      |
| `pnpm test:fault-tolerance`   | Consensus recovery   |
| `pnpm test:performance`       | Throughput testing   |
| `pnpm test:load:stress`       | Load testing         |
| `pnpm test:staking:sample`    | Staking workflow \*  |
| `pnpm test:slashing:sample`   | Slashing workflow \* |
| `pnpm test:rewards:sample`    | Rewards workflow \*  |

\* These tests require customization based on the specific blockchain's rules.

## Configuration Reference

### Environment Selection

Use `CHAIN_ENV` to select which environment from `config.json`:

```bash
CHAIN_ENV=chain-1 pnpm test:basic      # Uses config.json["chain-1"]
CHAIN_ENV=chain-2 pnpm test:basic      # Uses config.json["chain-2"]
```

### Node Configuration

| Field                           | Type         | Description                                 |
| ------------------------------- | ------------ | ------------------------------------------- |
| `index`                         | number       | Node identifier                             |
| `rpcUrl`                        | string       | Full EVM RPC URL with port                  |
| `type`                          | string       | `validator`, `non-validator`, or `bootnode` |
| `votingPower`                   | number       | Voting power (for fault tolerance tests)    |
| `active`                        | boolean      | Whether to include in tests                 |
| `executeLayerHttpRpcPort`       | number\|null | EVM RPC port (optional override)            |
| `consensusLayerRpcPort`         | number\|null | CometBFT RPC port (optional override)       |
| `consensusLayerHttpRestApiPort` | number\|null | Cosmos REST API port (optional override)    |

### Execution Method

For fault tolerance tests that need to stop/start nodes:

```json
{
    "executionMethod": "docker",
    "docker": {
        "containerPatterns": {
            "executionLayer": "validator{index}-geth",
            "consensusLayer": "validator{index}-node"
        },
        "timeout": 30000
    }
}
```

Options: `docker`, `ssh`, or `none`

## Test Reports

Reports are generated in `tests/test-report/` with the naming format `<test-name>-<chain-name>.<ext>`:

```
tests/test-report/
├── basic-chain-1.html           # Human-readable report
├── basic-chain-1.json           # Machine-readable for CI/CD
├── rpc-evm-chain-1.html
├── rpc-evm-chain-1.json
├── cosmos-api-chain-2.html
├── cosmos-api-chain-2.json
└── ...
```

## Writing Custom Tests

The framework provides Test Builders for writing custom tests. See the `tests/` directory for example implementations.

**Example using EVMRpcTestBuilder:**

```typescript
import { RuntimeManager } from '../src/core/RuntimeManager';
import { Blockchain } from '../src/core/Blockchain';
import { EVMRpcTestBuilder } from '../src/blockchain/test-library';
import path from 'path';

const configPath = path.join(__dirname, '../tests/config.json');

describe('My Custom EVM Tests', function () {
    let blockchain: Blockchain;
    let builder: EVMRpcTestBuilder;

    before(async function () {
        const runtimeManager = new RuntimeManager();
        await runtimeManager.connectToChainFromConfigFile(configPath, 'chain-1');
        blockchain = runtimeManager.getChain('chain-1')!;
        builder = new EVMRpcTestBuilder(blockchain);
    });

    it('should get block number', async function () {
        await builder.testGetBlockNumber();
    });

    it('should get chain ID', async function () {
        await builder.testChainId();
    });
});
```

**Available Test Builders:**

| Builder                     | Purpose                                |
| --------------------------- | -------------------------------------- |
| `EVMRpcTestBuilder`         | EVM JSON-RPC method testing            |
| `CometBFTTestBuilder`       | CometBFT RPC testing                   |
| `CosmosApiTestBuilder`      | Cosmos SDK module API testing          |
| `FaultToleranceTestBuilder` | Node stop/start and consensus recovery |
| `PerformanceTestBuilder`    | Transaction throughput testing         |
| `LoadStressTestBuilder`     | Concurrent load testing                |
| `StakingTestBuilder`        | Staking workflow testing               |
| `SlashingTestBuilder`       | Slashing workflow testing              |
| `RewardsTestBuilder`        | Rewards distribution testing           |

## Load/Stress Testing

Load and stress tests require additional wallet configuration in `tests/load-stress.config.json`:

```bash
cp tests/load-stress.config.example.json tests/load-stress.config.json
```

### Wallet Configuration

```json
{
    "environments": {
        "chain-1": {
            "createNewWallet": true,
            "fundingAmount": "0.1",
            "testTransactionAmount": "0.001"
        },
        "chain-2": {
            "createNewWallet": false,
            "wallets": [{ "privateKey": "0x..." }, { "privateKey": "0x..." }]
        }
    }
}
```

### Wallet Modes

| Mode                     | Use Case      | Description                                                  |
| ------------------------ | ------------- | ------------------------------------------------------------ |
| `createNewWallet: true`  | Local testing | Wallets created and funded automatically from founder wallet |
| `createNewWallet: false` | QA/Production | Uses pre-configured wallets that persist between runs        |

### Run Load Tests

```bash
CHAIN_ENV=chain-1 pnpm test:load:stress
```

## License

MIT License
