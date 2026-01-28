import '../../setup';
import { RuntimeManager } from '../../src/core/RuntimeManager';
import { SlashingTestBuilder } from '../../src/blockchain/test-library';
import { Config } from '../../src/utils/common';
import path from 'path';

// Configuration
const configPath = path.join(__dirname, '../config.json');
const envName = Config.envName;

// Simple test configuration - no external config file needed
const SLASHING_CONFIG = {
    walletCount: 1, // Number of wallets to test with
    stakingAmount: '0.1', // Amount to stake (in ETH)
    slashingPercentage: 5, // Percentage of stake to slash
    timeout: 120000, // Test timeout in milliseconds (2 minutes)
};

// Slashing Workflow Test
describe('Slashing Workflow Tests', () => {
    describe('Slashing-01: Complete Slashing Workflow', () => {
        it('should execute complete slashing workflow: stake -> validator misbehavior -> slashing -> verify penalty', async function () {
            this.timeout(SLASHING_CONFIG.timeout);

            const runtimeManager = new RuntimeManager();
            await runtimeManager.connectToChainFromConfigFile(configPath, envName);
            const chain = runtimeManager.getChain(envName);
            if (!chain) {
                throw new Error(`Failed to connect to blockchain: ${envName}`);
            }

            const slashingBuilder = new SlashingTestBuilder(chain)
                .withTestName('Complete Slashing Workflow Test')
                .withConfiguration({
                    'Wallets Count': SLASHING_CONFIG.walletCount,
                    'Staking Amount': SLASHING_CONFIG.stakingAmount,
                    'Slashing Percentage': `${SLASHING_CONFIG.slashingPercentage}%`,
                    'Validator Address': 'Using founder wallet',
                    Timeout: `${SLASHING_CONFIG.timeout / 1000 / 60} minutes`,
                })
                .withSlashingParameters({
                    stakingAmount: SLASHING_CONFIG.stakingAmount,
                    slashingPercentage: SLASHING_CONFIG.slashingPercentage,
                    validatorAddress: undefined,
                });

            await slashingBuilder
                .prepareWallets(SLASHING_CONFIG.walletCount)
                .then(builder => builder.executeSlashingWorkflow())
                .then(builder => builder.analyzeResults())
                .then(builder => builder.cleanup());
        });
    });
});
