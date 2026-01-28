import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { RewardsTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// Simple test configuration - no external config file needed
const REWARDS_CONFIG = {
    walletCount: 1, // Number of wallets to test with
    stakingAmount: '0.1', // Amount to stake (in ETH)
    rewardPeriodBlocks: 5, // Number of blocks to wait for rewards
    timeout: 180000, // Test timeout in milliseconds (3 minutes)
};

// Rewards Workflow Test
describe('Rewards Workflow Tests', () => {
    describe('Rewards-01: Complete Rewards Workflow', () => {
        it('should execute complete rewards workflow: stake -> wait for rewards -> claim rewards -> verify distribution', async function () {
            this.timeout(REWARDS_CONFIG.timeout);

            const runtimeManager = new RuntimeManager();
            await runtimeManager.connectToChainFromConfigFile(configPath, envName);
            const chain = runtimeManager.getChain(envName);
            if (!chain) {
                throw new Error(`Failed to connect to blockchain: ${envName}`);
            }

            const rewardsBuilder = new RewardsTestBuilder(chain)
                .withTestName('Complete Rewards Workflow Test')
                .withConfiguration({
                    'Wallets Count': REWARDS_CONFIG.walletCount,
                    'Staking Amount': REWARDS_CONFIG.stakingAmount,
                    'Reward Period': `${REWARDS_CONFIG.rewardPeriodBlocks} blocks`,
                    'Validator Address': 'Using founder wallet',
                    Timeout: `${REWARDS_CONFIG.timeout / 1000 / 60} minutes`,
                })
                .withRewardsParameters({
                    stakingAmount: REWARDS_CONFIG.stakingAmount,
                    rewardPeriodBlocks: REWARDS_CONFIG.rewardPeriodBlocks,
                    validatorAddress: undefined,
                });

            await rewardsBuilder
                .prepareWallets(REWARDS_CONFIG.walletCount)
                .then(builder => builder.executeRewardsWorkflow())
                .then(builder => builder.analyzeResults())
                .then(builder => builder.cleanup());
        });
    });
});
