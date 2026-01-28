# Cosmos API Methods - 使用自定义路径配置指南

## 概述

我们在 `IConsensusLayerClient` 接口中新增了一系列 Cosmos SDK API 方法，这些方法支持自定义路径配置，提供了最大的灵活性来适应不同版本的 Cosmos SDK 和自定义的 API 结构。

## 新增的 API 方法

### 1. Staking Module APIs

```typescript
// 获取验证者列表
async getStakingValidators(customPath?: string): Promise<any>
async getStakingParams(customPath?: string): Promise<any>
async getStakingPool(customPath?: string): Promise<any>
```

**默认路径:**

- `/staking/validators`
- `/staking/params`
- `/staking/pool`

**使用示例:**

```typescript
const consensusClient = blockchain.getDefaultConsensusLayerClient();

// 使用默认路径
const validators = await consensusClient.getStakingValidators();

// 使用自定义路径 (适配新版本 Cosmos SDK)
const validators = await consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');

// 使用自定义路径 (适配特殊链的API结构)
const validators = await consensusClient.getStakingValidators('/api/v1/staking/validators');
```

### 2. Slashing Module APIs

```typescript
async getSlashingParams(customPath?: string): Promise<any>
async getSlashingSigningInfos(customPath?: string): Promise<any>
```

**默认路径:**

- `/slashing/params`
- `/slashing/signing_infos`

**使用示例:**

```typescript
// 使用默认路径
const slashingParams = await consensusClient.getSlashingParams();

// 使用新版本 Cosmos SDK 路径
const signingInfos = await consensusClient.getSlashingSigningInfos('/cosmos/slashing/v1beta1/signing_infos');
```

### 3. Mint Module APIs

```typescript
async getMintParams(customPath?: string): Promise<any>
```

**默认路径:**

- `/mint/params`

**使用示例:**

```typescript
// 使用默认路径
const mintParams = await consensusClient.getMintParams();

// 使用自定义路径
const mintParams = await consensusClient.getMintParams('/cosmos/mint/v1beta1/params');
```

### 4. Node Information APIs

```typescript
async getNodeInfo(customPath?: string): Promise<any>
async getChainStatus(): Promise<any>
```

**默认路径:**

- `/base/tendermint/v1beta1/node_info`

**使用示例:**

```typescript
// 使用默认路径
const nodeInfo = await consensusClient.getNodeInfo();

// 使用自定义路径 (适配老版本)
const nodeInfo = await consensusClient.getNodeInfo('/node_info');
```

### 5. Tendermint RPC APIs

```typescript
async getTendermintStatus(): Promise<any>
async getTendermintBlock(height?: string): Promise<any>
async getTendermintValidators(height?: string): Promise<any>
```

**使用示例:**

```typescript
// 获取节点状态
const status = await consensusClient.getTendermintStatus();

// 获取最新区块
const latestBlock = await consensusClient.getTendermintBlock();

// 获取特定高度的区块
const specificBlock = await consensusClient.getTendermintBlock('12345');

// 获取验证者集合
const validators = await consensusClient.getTendermintValidators();
```

## 路径配置策略

### 1. 不同 Cosmos SDK 版本的路径映射

| 模块               | 老版本路径            | 新版本路径                           |
| ------------------ | --------------------- | ------------------------------------ |
| Staking Validators | `/staking/validators` | `/cosmos/staking/v1beta1/validators` |
| Staking Params     | `/staking/params`     | `/cosmos/staking/v1beta1/params`     |
| Staking Pool       | `/staking/pool`       | `/cosmos/staking/v1beta1/pool`       |
| Slashing Params    | `/slashing/params`    | `/cosmos/slashing/v1beta1/params`    |
| Mint Params        | `/mint/params`        | `/cosmos/mint/v1beta1/params`        |

### 2. 自适应路径检测示例

```typescript
class CosmosApiHelper {
    private consensusClient: IConsensusLayerClient;

    constructor(consensusClient: IConsensusLayerClient) {
        this.consensusClient = consensusClient;
    }

    async getValidatorsWithFallback(): Promise<any> {
        // 尝试新版本路径
        try {
            return await this.consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');
        } catch (error) {
            console.log('New path failed, trying legacy path...');
            // 回退到旧版本路径
            return await this.consensusClient.getStakingValidators('/staking/validators');
        }
    }
}
```

### 3. 配置驱动的路径管理

```typescript
interface CosmosApiConfig {
    stakingValidators: string;
    stakingParams: string;
    stakingPool: string;
    slashingParams: string;
    mintParams: string;
}

// 不同链的配置
const CHAIN_CONFIGS = {
    // Cosmos Hub 配置
    cosmoshub: {
        stakingValidators: '/cosmos/staking/v1beta1/validators',
        stakingParams: '/cosmos/staking/v1beta1/params',
        stakingPool: '/cosmos/staking/v1beta1/pool',
        slashingParams: '/cosmos/slashing/v1beta1/params',
        mintParams: '/cosmos/mint/v1beta1/params',
    },
    // 老版本链的配置
    legacy: {
        stakingValidators: '/staking/validators',
        stakingParams: '/staking/params',
        stakingPool: '/staking/pool',
        slashingParams: '/slashing/params',
        mintParams: '/mint/params',
    },
    // 自定义链的配置
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

## 迁移指南

### 从硬编码 HTTP 调用迁移到客户端方法

**之前 (硬编码):**

```typescript
// 直接使用 axios 调用
const response = await axios.get(`${restEndpoint}/staking/validators`);
const validators = response.data;
```

**之后 (使用客户端方法):**

```typescript
// 使用共识层客户端
const validators = await consensusClient.getStakingValidators();

// 或者使用自定义路径
const validators = await consensusClient.getStakingValidators('/cosmos/staking/v1beta1/validators');
```

### CosmosApiTestBuilder 重构示例

参考 `tests/restapi/cosmos-api-refactored.sample.test.ts` 文件，看如何：

1. 使用 `blockchain.getDefaultConsensusLayerClient()` 获取客户端
2. 替换硬编码的 API 调用为客户端方法调用
3. 支持默认路径和自定义路径的测试
4. 保持向后兼容性

## 最佳实践

### 1. 渐进式路径探测

```typescript
async function getStakingValidatorsRobust(consensusClient: IConsensusLayerClient): Promise<any> {
    const paths = [
        '/cosmos/staking/v1beta1/validators', // 新版本
        '/staking/validators', // 旧版本
        '/api/v1/staking/validators', // 自定义
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

### 2. 错误处理和日志记录

```typescript
async function safeApiCall<T>(apiCall: () => Promise<T>, context: string): Promise<T | null> {
    try {
        return await apiCall();
    } catch (error) {
        console.warn(`API call failed for ${context}:`, error);
        return null;
    }
}

// 使用示例
const validators = await safeApiCall(
    () => consensusClient.getStakingValidators('/custom/path'),
    'custom staking validators'
);
```

### 3. 性能优化

```typescript
class CachedCosmosClient {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private readonly CACHE_TTL = 30000; // 30秒缓存

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

## 总结

通过添加自定义路径支持，我们实现了：

1. **向后兼容性**: 默认路径保持现有行为不变
2. **灵活性**: 支持不同版本 Cosmos SDK 的路径格式
3. **可扩展性**: 可以适配自定义 API 结构
4. **易用性**: 简洁的接口，可选的路径参数
5. **维护性**: 集中管理API调用逻辑，避免硬编码

这种设计让框架能够适应各种 Cosmos 生态系统中的区块链网络，无论它们使用什么版本的 SDK 或自定义的 API 结构。
