# Cosmos API Methods - Guide

## Overview

We have introduced a series of Cosmos SDK API methods in the `IConsensusLayerClient` interface. These methods support custom path configuration, providing maximum flexibility to adapt to different versions of the Cosmos SDK and custom API structures.

## New API Methods

### 1. Staking Module APIs

```typescript
// Get the list of validators
async getStakingValidators(customPath?: string): Promise<any>
async getStakingParams(customPath?: string): Promise<any>
async getStakingPool(customPath?: string): Promise<any>
```

**Default Paths:**

- `/staking/validators`
- `/staking/params`
- `/staking/pool`

**Usage Examples:**

```typescript
const consensusClient = blockchain.getDefaultConsensusLayerClient();

// Use default paths
const validators = await consensusClient.getStakingValidators();

// Use custom paths (to adapt to newer versions of Cosmos SDK)
const validators = await consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');

// Use custom paths (to adapt to specific chain API structures)
const validators = await consensusClient.getStakingValidators('/api/v1/staking/validators');
```

### 2. Slashing Module APIs

```typescript
async getSlashingParams(customPath?: string): Promise<any>
async getSlashingSigningInfos(customPath?: string): Promise<any>
```

**Default Paths:**

- `/slashing/params`
- `/slashing/signing_infos`

**Usage Examples:**

```typescript
// Use default paths
const slashingParams = await consensusClient.getSlashingParams();

// Use newer Cosmos SDK paths
const signingInfos = await consensusClient.getSlashingSigningInfos('/cosmos/slashing/v1beta1/signing_infos');
```

### 3. Mint Module APIs

```typescript
async getMintParams(customPath?: string): Promise<any>
```

**Default Paths:**

- `/mint/params`

**Usage Examples:**

```typescript
// Use default paths
const mintParams = await consensusClient.getMintParams();

// Use custom paths
const mintParams = await consensusClient.getMintParams('/cosmos/mint/v1beta1/params');
```

### 4. Node Information APIs

```typescript
async getNodeInfo(customPath?: string): Promise<any>
async getChainStatus(): Promise<any>
```

**Default Paths:**

- `/base/tendermint/v1beta1/node_info`

**Usage Examples:**

```typescript
// Use default paths
const nodeInfo = await consensusClient.getNodeInfo();

// Use custom paths (to adapt to older versions)
const nodeInfo = await consensusClient.getNodeInfo('/node_info');
```

### 5. Tendermint RPC APIs

```typescript
async getTendermintStatus(): Promise<any>
async getTendermintBlock(height?: string): Promise<any>
async getTendermintValidators(height?: string): Promise<any>
```

**Usage Examples:**

```typescript
// Get node status
const status = await consensusClient.getTendermintStatus();

// Get the latest block
const latestBlock = await consensusClient.getTendermintBlock();

// Get a block at a specific height
const specificBlock = await consensusClient.getTendermintBlock('12345');

// Get the validator set
const validators = await consensusClient.getTendermintValidators();
```

## Path Configuration Strategy

### 1. Path Mapping for Different Cosmos SDK Versions

| Module             | Legacy Path           | New Path                             |
| ------------------ | --------------------- | ------------------------------------ |
| Staking Validators | `/staking/validators` | `/cosmos/staking/v1beta1/validators` |
| Staking Params     | `/staking/params`     | `/cosmos/staking/v1beta1/params`     |
| Staking Pool       | `/staking/pool`       | `/cosmos/staking/v1beta1/pool`       |
| Slashing Params    | `/slashing/params`    | `/cosmos/slashing/v1beta1/params`    |
| Mint Params        | `/mint/params`        | `/cosmos/mint/v1beta1/params`        |

### 2. Adaptive Path Detection Example

```typescript
class CosmosApiHelper {
    private consensusClient: IConsensusLayerClient;

    constructor(consensusClient: IConsensusLayerClient) {
        this.consensusClient = consensusClient;
    }

    async getValidatorsWithFallback(): Promise<any> {
        // Try the new version path
        try {
            return await this.consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');
        } catch (error) {
            console.log('New path failed, trying legacy path...');
            // Fallback to the legacy path
            return await this.consensusClient.getStakingValidators('/staking/validators');
        }
    }
}
```

### 3. Configuration-Driven Path Management

```typescript
interface CosmosApiConfig {
    stakingValidators: string;
    stakingParams: string;
    stakingPool: string;
    slashingParams: string;
    mintParams: string;
}

// Configurations for different chains
const CHAIN_CONFIGS = {
    // Cosmos Hub configuration
    cosmoshub: {
        stakingValidators: '/cosmos/staking/v1beta1/validators',
        stakingParams: '/cosmos/staking/v1beta1/params',
        stakingPool: '/cosmos/staking/v1beta1/pool',
        slashingParams: '/cosmos/slashing/v1beta1/params',
        mintParams: '/cosmos/mint/v1beta1/params',
    },
    // Legacy chain configuration
    legacy: {
        stakingValidators: '/staking/validators',
        stakingParams: '/staking/params',
        stakingPool: '/staking/pool',
        slashingParams: '/slashing/params',
        mintParams: '/mint/params',
    },
    // Custom chain configuration
    custom: {
        stakingValidators: '/api/v1/staking/validators',
        stakingParams: '/api/v1/staking/params',
        stakingPool: '/api/v1/staking/pool',
        slashingParams: '/api/v1/slashing/params',
        mintParams: '/api/v1/mint/params',
    },
};

class ConfigurableCosmosClient {
    private consensusClient: IConsensusLayerClient;
    private config: CosmosApiConfig;

    constructor(consensusClient: IConsensusLayerClient, chainType: keyof typeof CHAIN_CONFIGS) {
        this.consensusClient = consensusClient;
        this.config = CHAIN_CONFIGS[chainType];
    }

    async getValidators(): Promise<any> {
        return await this.consensusClient.getStakingValidators(this.config.stakingValidators);
    }

    async getStakingParams(): Promise<any> {
        return await this.consensusClient.getStakingParams(this.config.stakingParams);
    }
}
```

## Migration Guide

### Migrating from Hardcoded HTTP Calls to Client Methods

**Before (Hardcoded):**

```typescript
// Request directly using axios
const response = await axios.get(`${restEndpoint}/staking/validators`);
const validators = response.data;
```

**After (Using Client Methods):**

```typescript
// Use the consensus layer client
const validators = await consensusClient.getStakingValidators();

// Or use a custom path
const validators = await consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');
```

### CosmosApiTestBuilder Refactoring Example

Refer to the `tests/restapi/cosmos-api-refactored.sample.test.ts` file to see how to:

1. Obtain a client using `blockchain.getDefaultConsensusLayerClient()`
2. Replace hardcoded API calls with client method calls
3. Support testing with default and custom paths
4. Maintain backward compatibility

## Best Practices

### 1. Progressive Path Probing

```typescript
async function getStakingValidatorsRobust(consensusClient: IConsensusLayerClient): Promise<any> {
    const paths = [
        '/cosmos/staking/v1beta1/validators', // New version
        '/staking/validators', // Legacy version
        '/api/v1/staking/validators', // Custom
    ];

    for (const path of paths) {
        try {
            const result = await consensusClient.getStakingValidators(path);
            console.log(`✅ Successfully used path: ${path}`);
            return result;
        } catch (error) {
            console.log(`❌ Failed path: ${path}`);
        }
    }

    throw new Error('All validator paths failed');
}
```

### 2. Error Handling and Logging

```typescript
async function safeApiCall<T>(apiCall: () => Promise<T>, context: string): Promise<T | null> {
    try {
        return await apiCall();
    } catch (error) {
        console.warn(`API call failed for ${context}:`, error);
        return null;
    }
}

// Usage example
const validators = await safeApiCall(
    () => consensusClient.getStakingValidators('/custom/path'),
    'custom staking validators'
);
```

### 3. Performance Optimization

```typescript
class CachedCosmosClient {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private readonly CACHE_TTL = 30000; // 30-second cache

    async getCachedStakingValidators(customPath?: string): Promise<any> {
        const cacheKey = `validators_${customPath || 'default'}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        const data = await this.consensusClient.getStakingValidators(customPath);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });

        return data;
    }
}
```

## Summary

By adding support for custom paths, we have achieved:

1. **Backward Compatibility**: Default paths maintain existing behavior
2. **Flexibility**: Supports path formats across different versions of the Cosmos SDK
3. **Extensibility**: Adapts to custom API structures
4. **Usability**: Clean interfaces with optional path parameters
5. **Maintainability**: Centralizes API call logic to avoid hardcoding

This design enables the framework to adapt to a wide variety of blockchain networks in the Cosmos ecosystem, regardless of the SDK version or custom API structure they use.
