import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { FaultToleranceTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

/**
 * IMPORTANT: Fault Tolerance Test Configuration
 *
 * BFT consensus requires >2/3 of voting power online for the network to progress.
 * You MUST adjust `networkShouldProgress` based on your validator count:
 *
 * | Validators | Stop 1 (%) | Stop 2 (%) | Network Halts When |
 * |------------|------------|------------|---------------------|
 * | 4          | 25%        | 50%        | Stop >= 2 (>= 34%)  |
 * | 5          | 20%        | 40%        | Stop >= 2 (>= 34%)  |
 * | 6          | 17%        | 33%        | Stop >= 2 (>= 34%)  |
 * | 7          | 14%        | 29%        | Stop >= 3 (>= 34%)  |
 *
 * Current config assumes 4 validators with equal voting power (1 each):
 * - Stop 0-1: Network continues (>= 75% online)
 * - Stop 2+:  Network halts (< 67% online)
 */

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// Test configuration
const FAULT_TOLERANCE_CONFIG = {
    username: 'ubuntu',
    waitTimeForBlock: Config.test.waitTimeForBlock,
    waitTimeForService: Config.test.waitTimeForService,
    waitTimeLong: Config.test.waitTimeLong,
    timeout: 300000, // 5 minutes timeout
};

describe('Consensus Fault Tolerance Tests', () => {
    let testBuilder: FaultToleranceTestBuilder;

    before(async () => {
        const runtimeManager = new RuntimeManager();
        await runtimeManager.connectToChainFromConfigFile(configPath, envName);
        const blockchain = runtimeManager.getChain(envName);
        if (!blockchain) {
            throw new Error(`Failed to connect to blockchain: ${envName}`);
        }
        testBuilder = new FaultToleranceTestBuilder(blockchain);
        console.log(`\n🔧 Fault Tolerance Test Configuration:`);
        console.log(`   Username: ${FAULT_TOLERANCE_CONFIG.username}`);
        console.log(`   Timeout: ${FAULT_TOLERANCE_CONFIG.timeout / 1000 / 60} minutes`);
    });

    after(async () => {
        await testBuilder.cleanup();
    });

    it('Consensus-FaultTolerance-01: test stop less than 1/3 voting power', async function () {
        this.timeout(FAULT_TOLERANCE_CONFIG.timeout);

        await testBuilder
            .withTestName('Fault Tolerance: Stop Less Than 1/3 Voting Power')
            .withConfiguration({
                'Target voting power': 'less than 1/3 of total',
                'Expected behavior': 'Network should progress',
                Timeout: `${FAULT_TOLERANCE_CONFIG.timeout / 1000 / 60} minutes`,
            })
            .withFaultToleranceParameters({
                scenario: 'less-than-one-third',
                networkShouldProgress: true,
            })
            .initialize()
            .then(builder => builder.getValidatorsToStop())
            .then(builder => builder.stopValidators())
            .then(builder => builder.checkNetworkStatusAfterStop())
            .then(builder => builder.verifyStoppedValidatorsNotAccessible())
            .then(builder => builder.restartValidators())
            .then(builder => builder.checkNetworkStatusAfterRestart())
            .then(builder => builder.analyzeResults());
    });

    it('Consensus-FaultTolerance-02: test stop exactly 1/3 voting power', async function () {
        this.timeout(FAULT_TOLERANCE_CONFIG.timeout);

        // BFT requires >2/3 online to progress
        // With 4 validators (25% each), stopping 1 (25%) leaves 75% online
        // 75% > 66.7%, so network should still progress
        await testBuilder
            .withTestName('Fault Tolerance: Stop Exactly 1/3 Voting Power')
            .withConfiguration({
                'Target voting power': 'exactly 1/3 of total (1 validator)',
                'Expected behavior': 'Network should progress (75% > 66.7% threshold)',
                Timeout: `${FAULT_TOLERANCE_CONFIG.timeout / 1000 / 60} minutes`,
            })
            .withFaultToleranceParameters({
                scenario: 'exactly-one-third',
                networkShouldProgress: true, // Network continues with 75% online
            })
            .initialize()
            .then(builder => builder.getValidatorsToStop())
            .then(builder => builder.stopValidators())
            .then(builder => builder.checkNetworkStatusAfterStop())
            .then(builder => builder.verifyStoppedValidatorsNotAccessible())
            .then(builder => builder.restartValidators())
            .then(builder => builder.checkNetworkStatusAfterRestart())
            .then(builder => builder.analyzeResults());
    });

    it('Consensus-FaultTolerance-03: test stop more than 1/3 voting power', async function () {
        this.timeout(FAULT_TOLERANCE_CONFIG.timeout);

        await testBuilder
            .withTestName('Fault Tolerance: Stop More Than 1/3 Voting Power')
            .withConfiguration({
                'Target voting power': 'more than 1/3 of total',
                'Expected behavior': 'Network should halt',
                Timeout: `${FAULT_TOLERANCE_CONFIG.timeout / 1000 / 60} minutes`,
            })
            .withFaultToleranceParameters({
                scenario: 'more-than-one-third',
                networkShouldProgress: false,
            })
            .initialize()
            .then(builder => builder.getValidatorsToStop())
            .then(builder => builder.stopValidators())
            .then(builder => builder.checkNetworkStatusAfterStop())
            .then(builder => builder.verifyStoppedValidatorsNotAccessible())
            .then(builder => builder.restartValidators())
            .then(builder => builder.checkNetworkStatusAfterRestart())
            .then(builder => builder.analyzeResults());
    });

    it('Consensus-FaultTolerance-04: test stop less than 1/3 voting power and wait for 5 minutes', async function () {
        this.timeout(FAULT_TOLERANCE_CONFIG.timeout * 2); // Extended timeout for 5-minute wait

        await testBuilder
            .withTestName('Fault Tolerance: Stop Less Than 1/3 Voting Power and wait for 5 minutes')
            .withConfiguration({
                'Target voting power': 'less than 1/3 of total',
                'Extended wait': '5 minutes',
                'Expected behavior': 'Network should progress throughout',
                Timeout: `${(FAULT_TOLERANCE_CONFIG.timeout * 2) / 1000 / 60} minutes`,
            })
            .withFaultToleranceParameters({
                scenario: 'less-than-one-third',
                networkShouldProgress: true,
            })
            .initialize()
            .then(builder => builder.getValidatorsToStop())
            .then(builder => builder.stopValidators())
            .then(builder => builder.checkNetworkStatusAfterStop())
            .then(builder => builder.verifyStoppedValidatorsNotAccessible())
            .then(builder => builder.waitForLongPeriod())
            .then(builder => builder.restartValidators())
            .then(builder => builder.checkNetworkStatusAfterRestart())
            .then(builder => builder.analyzeResults());
    });
});
