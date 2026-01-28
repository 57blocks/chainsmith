import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { ConsensusTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// Test Runner
describe('Consensus-Basic Tests', () => {
    let testBuilder: ConsensusTestBuilder;

    before(async () => {
        const runtimeManager = new RuntimeManager();
        await runtimeManager.connectToChainFromConfigFile(configPath, envName);
        const blockchain = runtimeManager.getChain(envName);
        if (!blockchain) {
            throw new Error(`Failed to connect to blockchain: ${envName}`);
        }
        testBuilder = new ConsensusTestBuilder(blockchain);

        console.log(`\n🔧 Test Configuration:`);
        console.log(`   Target Blockchain name: ${blockchain.name}`);
    });

    after(async () => {
        await testBuilder.cleanup();
    });

    it('Consensus-Basic-01: nodes have same status after transaction', async () => {
        await testBuilder
            .getTargetClients()
            .testConnectivity()
            .then(builder => builder.assertConnectivity())
            .then(builder => builder.assertBlockHeights())
            .then(builder => builder.sendTransaction())
            .then(builder => builder.assertTransactionSubmitted())
            .then(builder => builder.waitForConfirmation())
            .then(builder => builder.verifyTransactionStatus())
            .then(builder => builder.verifyBlockProgression())
            .then(builder => builder.testPortConnectivity('EVM RPC', 'closed'))
            .then(builder => builder.testPortConnectivity('P2P', 'open'))
            .then(builder => builder.testPortConnectivity('RPC', 'closed'));
    });

    it('Consensus-Basic-02: bootnodes port connectivity test', async function () {
        if (!testBuilder.getBlockchain().hasActiveBootnodes()) {
            this.skip();
        }

        await testBuilder
            .configureBootnodes()
            .testPortConnectivity('EVM RPC', 'closed')
            .then(builder => builder.testPortConnectivity('P2P', 'open'))
            .then(builder => builder.testPortConnectivity('RPC', 'closed'));
    });
});
