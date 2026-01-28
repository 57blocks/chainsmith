import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { CosmosApiTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// ============================================================================
// 测试套件
// ============================================================================
describe('Cosmos API Tests', () => {
    let testBuilder: CosmosApiTestBuilder;

    beforeEach(async () => {
        const runtimeManager = new RuntimeManager();
        await runtimeManager.connectToChainFromConfigFile(configPath, envName);
        const blockchain = runtimeManager.getChain(envName);
        if (!blockchain) {
            throw new Error(`Failed to connect to blockchain: ${envName}`);
        }
        testBuilder = new CosmosApiTestBuilder(blockchain);
    });

    afterEach(async () => {
        await testBuilder.cleanup();
    });

    it('should test all major Cosmos SDK modules', async () => {
        await testBuilder
            .initialize()
            .then(builder => builder.testStakingModule())
            .then(builder => builder.testSlashingModule())
            .then(builder => builder.testMintModule())
            .then(builder => builder.testTendermintRPC())
            .then(builder => builder.assertResults())
            .then(builder => builder.generateReport());
    });

    it('should test core blockchain functionality', async () => {
        await testBuilder
            .initialize()
            .then(builder => builder.testStakingModule())
            .then(builder => builder.testTendermintRPC())
            .then(builder => builder.assertResults());
    });
});
