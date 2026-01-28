import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { StakingTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// Simple test configuration - no external config file needed
const STAKING_CONFIG = {
    walletCount: 1, // Number of wallets to test with (1 is sufficient for sample)
    stakingAmount: '0.1', // Amount to stake (in ETH)
    timeout: 120000, // Test timeout in milliseconds (2 minutes)
};

// Staking Workflow Test
describe('Staking Workflow Tests', () => {
    describe('Staking-01: Complete Staking Workflow', () => {
        it('should execute complete staking workflow: stake -> check voting power -> unstake -> verify voting power changes', async function () {
            this.timeout(STAKING_CONFIG.timeout);

            const runtimeManager = new RuntimeManager();
            await runtimeManager.connectToChainFromConfigFile(configPath, envName);
            const chain = runtimeManager.getChain(envName);
            if (!chain) {
                throw new Error(`Failed to connect to blockchain: ${envName}`);
            }

            const stakingBuilder = new StakingTestBuilder(chain)
                .withTestName('Complete Staking Workflow Test')
                .withConfiguration({
                    'Wallets Count': STAKING_CONFIG.walletCount,
                    'Staking Amount': STAKING_CONFIG.stakingAmount,
                    'Validator Address': 'Using founder wallet',
                    Timeout: `${STAKING_CONFIG.timeout / 1000 / 60} minutes`,
                })
                .withStakingParameters({
                    stakingAmount: STAKING_CONFIG.stakingAmount,
                    validatorAddress: undefined,
                });

            await stakingBuilder
                .prepareWallets(STAKING_CONFIG.walletCount)
                .then(builder => builder.executeStakingWorkflow())
                .then(builder => builder.analyzeResults())
                .then(builder => builder.cleanup());
        });
    });
});
