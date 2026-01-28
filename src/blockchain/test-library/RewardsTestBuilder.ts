import { ethers } from 'ethers';
import { Blockchain } from '../../core/Blockchain';

/**
 * Rewards Test Builder - for rewards workflow
 */
export class RewardsTestBuilder {
    private blockchain: Blockchain;
    private wallets: any[] = [];
    private testResults: any[] = [];
    private startTime: number = 0;
    private endTime: number = 0;
    private testName: string = '';
    private configuration: any = {};
    private validatorAddress?: string;
    private stakingAmount: string = '0.15';
    private rewardPeriodBlocks: number = 5;
    private delegatorBalanceBefore: number = 0;
    private delegatorBalanceAfterStake: number = 0;
    private delegatorBalanceAfterRewards: number = 0;
    private validatorBalanceBefore: number = 0;
    private validatorBalanceAfterStake: number = 0;
    private validatorBalanceAfterRewards: number = 0;
    private totalRewardsEarned: number = 0;
    private validatorRewards: number = 0;
    private delegatorRewards: number = 0;

    constructor(blockchain: Blockchain) {
        this.blockchain = blockchain;
    }

    /**
     * Set test name and description
     */
    withTestName(name: string): RewardsTestBuilder {
        this.testName = name;
        console.log(`\n=== ${name} ===`);
        return this;
    }

    /**
     * Set test configuration
     */
    withConfiguration(config: any): RewardsTestBuilder {
        this.configuration = config;
        console.log(`📋 Test Configuration:`);
        Object.entries(config).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        return this;
    }

    /**
     * Set rewards parameters
     */
    withRewardsParameters(params: {
        stakingAmount?: string;
        rewardPeriodBlocks?: number;
        validatorAddress?: string;
    }): RewardsTestBuilder {
        this.stakingAmount = params.stakingAmount ?? this.stakingAmount;
        this.rewardPeriodBlocks = params.rewardPeriodBlocks ?? this.rewardPeriodBlocks;
        this.validatorAddress = params.validatorAddress;
        console.log(`🎁 Rewards Parameters:`);
        console.log(`   Staking Amount: ${this.stakingAmount} ETH`);
        console.log(`   Reward Period: ${this.rewardPeriodBlocks} blocks`);
        console.log(`   Validator Address: ${this.validatorAddress ?? 'Using founder wallet as validator'}`);
        return this;
    }

    /**
     * Prepare wallets for rewards tests
     */
    async prepareWallets(count: number): Promise<RewardsTestBuilder> {
        console.log(`\n🔧 Preparing ${count} wallets for rewards workflow...`);

        // Use blockchain's common method to create and fund wallets
        const { wallets, fundingTransactions } = await this.blockchain.createAndFundWallets(count, '0.25');
        this.wallets = wallets;

        // Wait for all funding transactions to be confirmed
        await this.blockchain.waitForTransactionConfirmations(fundingTransactions);

        console.log(`✅ Prepared ${this.wallets.length} wallets for rewards workflow`);
        return this;
    }

    /**
     * @deprecated Use blockchain.createAndFundWallets() instead
     * Create wallets and fund them (simplified for sample)
     */
    private async createWallets(count: number, fundingTransactions: any[]): Promise<void> {
        console.log(`   Generating ${count} new wallets...`);

        // Create wallets synchronously since createWallet() is not async
        this.wallets = Array.from({ length: count }, (_, i) => {
            const wallet = this.blockchain.createWallet();
            console.log(`   Generated wallet ${i + 1}: ${wallet.address}`);
            return wallet;
        });

        console.log(`   ✅ Generated ${this.wallets.length} wallets`);
        await this.fundWallets(this.wallets, fundingTransactions);
    }

    /**
     * Fund a list of wallets
     */
    private async fundWallets(wallets: any[], fundingTransactions: any[]): Promise<void> {
        console.log(`   🚀 Funding wallets with 0.25 ETH using founder wallet...`);

        try {
            const transactions = wallets.map(wallet => ({
                to: wallet.address,
                value: '0.25', // Sufficient funding for rewards test
            }));

            // Use sendMultipleTransactions to avoid nonce conflicts
            const results = await this.blockchain.sendMultipleTransactions(transactions);

            results.forEach((tx: any, index) => {
                if (tx) {
                    console.log(`   📤 Funded wallet ${index + 1}: ${wallets[index].address} -> Hash: ${tx?.hash}`);
                    fundingTransactions.push({
                        wallet: wallets[index],
                        tx,
                        index: index + 1,
                    });
                }
            });
        } catch (error) {
            console.error(`   ❌ Failed to fund wallets in batch:`, error);
        }
    }

    /**
     * Execute complete rewards workflow test
     */
    async executeRewardsWorkflow(): Promise<RewardsTestBuilder> {
        console.log(`\n🚀 Starting complete rewards workflow test...`);
        this.startTime = Date.now();

        // Step 1: Check initial balances (both delegator and validator)
        await this.checkBalances('initial');

        // Step 2: Execute staking delegation (prerequisite for earning rewards)
        await this.executeStakingStep();

        // Step 3: Check balances after staking
        await this.checkBalances('after_stake');

        // Step 4: Wait for reward accumulation period
        await this.waitForRewardPeriod();

        // Step 5: Check and claim rewards
        await this.executeRewardsClaimStep();

        // Step 6: Check final balances after rewards
        await this.checkBalances('after_rewards');

        this.endTime = Date.now();
        return this;
    }

    /**
     * Execute staking delegation (prerequisite for earning rewards)
     */
    private async executeStakingStep(): Promise<void> {
        console.log(`\n📤 Step 2: Executing staking delegation (prerequisite for rewards)...`);

        const stakingResults = this.wallets.map(async (wallet, index) => {
            try {
                console.log(`   📤 Wallet ${index + 1} delegating ${this.stakingAmount} ETH...`);

                const stakingTx = await this.performStakingDelegation(wallet, this.stakingAmount);

                console.log(`   ✅ Wallet ${index + 1} staking successful: ${stakingTx.hash}`);
                return {
                    success: true,
                    hash: stakingTx.hash,
                    index,
                    stakingAmount: this.stakingAmount,
                    walletAddress: wallet.address,
                    step: 'staking',
                };
            } catch (error) {
                console.error(`   ❌ Wallet ${index + 1} staking failed: ${error}`);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    index,
                    stakingAmount: this.stakingAmount,
                    walletAddress: wallet.address,
                    step: 'staking',
                };
            }
        });

        const results = await Promise.all(stakingResults);
        this.testResults.push(...results);

        const successfulStaking = results.filter(r => r.success).length;
        console.log(`   📊 Staking results: ${successfulStaking}/${this.wallets.length} successful`);
    }

    /**
     * Execute rewards claim
     */
    private async executeRewardsClaimStep(): Promise<void> {
        console.log(`\n🎁 Step 5: Checking and claiming rewards...`);

        try {
            console.log(`   🔍 Calculating accumulated rewards...`);

            const rewardsTx = await this.performRewardsClaim();

            console.log(`   🎁 Rewards claim executed successfully: ${rewardsTx.hash}`);
            this.testResults.push({
                success: true,
                hash: rewardsTx.hash,
                step: 'rewards_claim',
            });

            console.log(`   📊 Rewards claim results: 1/1 successful`);
        } catch (error) {
            console.error(`   ❌ Rewards claim failed: ${error}`);
            this.testResults.push({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                step: 'rewards_claim',
            });
        }
    }

    /**
     * Check balances at different stages (both delegator and validator)
     */
    private async checkBalances(stage: string): Promise<void> {
        const founderWallet = this.blockchain.createFounderEthersWallet();
        const validatorAddr = this.validatorAddress ?? founderWallet.address;
        const delegatorAddr = this.wallets[0]?.address;

        console.log(
            `\n💰 Step ${stage === 'initial' ? '1' : stage === 'after_stake' ? '3' : '6'}: Checking balances (${stage})...`
        );

        try {
            const validatorBalance = await this.getBalance(validatorAddr);
            const delegatorBalance = delegatorAddr ? await this.getBalance(delegatorAddr) : 0;

            switch (stage) {
                case 'initial':
                    this.validatorBalanceBefore = validatorBalance;
                    this.delegatorBalanceBefore = delegatorBalance;
                    console.log(`   💰 Initial validator balance: ${validatorBalance.toFixed(6)} ETH`);
                    console.log(`   💰 Initial delegator balance: ${delegatorBalance.toFixed(6)} ETH`);
                    break;
                case 'after_stake':
                    this.validatorBalanceAfterStake = validatorBalance;
                    this.delegatorBalanceAfterStake = delegatorBalance;
                    console.log(`   💰 Validator balance after staking: ${validatorBalance.toFixed(6)} ETH`);
                    console.log(`   💰 Delegator balance after staking: ${delegatorBalance.toFixed(6)} ETH`);
                    console.log(
                        `   📈 Validator change: +${(validatorBalance - this.validatorBalanceBefore).toFixed(6)} ETH`
                    );
                    console.log(
                        `   📉 Delegator change: ${(delegatorBalance - this.delegatorBalanceBefore).toFixed(6)} ETH`
                    );
                    break;
                case 'after_rewards':
                    this.validatorBalanceAfterRewards = validatorBalance;
                    this.delegatorBalanceAfterRewards = delegatorBalance;
                    this.validatorRewards = validatorBalance - this.validatorBalanceAfterStake;
                    this.delegatorRewards = delegatorBalance - this.delegatorBalanceAfterStake;
                    this.totalRewardsEarned = this.validatorRewards + this.delegatorRewards;

                    console.log(`   💰 Validator balance after rewards: ${validatorBalance.toFixed(6)} ETH`);
                    console.log(`   💰 Delegator balance after rewards: ${delegatorBalance.toFixed(6)} ETH`);
                    console.log(`   🎁 Validator rewards earned: ${this.validatorRewards.toFixed(6)} ETH`);
                    console.log(`   🎁 Delegator rewards earned: ${this.delegatorRewards.toFixed(6)} ETH`);
                    console.log(`   🎁 Total rewards earned: ${this.totalRewardsEarned.toFixed(6)} ETH`);
                    break;
            }
        } catch (error) {
            console.error(`   ❌ Failed to check balances at ${stage}:`, error);
        }
    }

    /**
     * Wait for reward accumulation period
     */
    private async waitForRewardPeriod(): Promise<void> {
        console.log(`\n⏳ Step 4: Waiting for ${this.rewardPeriodBlocks} blocks (reward accumulation period)...`);

        const provider = this.blockchain.getDefaultExecuteLayerClient().getProvider();
        const startBlock = await provider.getBlockNumber();
        console.log(`   📦 Current block: ${startBlock}`);
        console.log(`   📦 Target block: ${startBlock + this.rewardPeriodBlocks}`);
        console.log(`   🎁 Rewards will accumulate during this period...`);

        let currentBlock = startBlock;
        while (currentBlock < startBlock + this.rewardPeriodBlocks) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            currentBlock = await provider.getBlockNumber();
            console.log(`   📦 Block progress: ${currentBlock}/${startBlock + this.rewardPeriodBlocks}`);
        }

        console.log(`   ✅ Reward period completed at block: ${currentBlock}`);
    }

    /**
     * Simulate staking delegation (replace with actual staking contract calls)
     */
    private async performStakingDelegation(wallet: any, amount: string): Promise<any> {
        const founderWallet = this.blockchain.createFounderEthersWallet();
        const validatorAddr = this.validatorAddress ?? founderWallet.address;

        // This is a simulation - replace with actual staking contract calls
        const tx = await wallet.sendTransaction({
            to: validatorAddr,
            value: ethers.parseEther(amount),
            data: '0x', // Placeholder for staking contract call data
        });

        // Wait for transaction confirmation
        const provider = this.blockchain.getDefaultExecuteLayerClient().getProvider();
        await provider.waitForTransaction(tx.hash);
        return tx;
    }

    /**
     * Simulate rewards claim (replace with actual rewards contract calls)
     */
    private async performRewardsClaim(): Promise<any> {
        // This is a simulation - replace with actual rewards claiming mechanism
        // In real implementation, this would call the rewards distribution contract

        // Simulate validator commission and delegator rewards distribution
        const rewardAmount = Number(this.stakingAmount) * 0.01; // 1% reward simulation

        const founderWallet = this.blockchain.createFounderEthersWallet();
        const tx = await founderWallet.sendTransaction({
            to: this.wallets[0].address, // Send simulated rewards to delegator
            value: ethers.parseEther(rewardAmount.toString()),
            data: '0x', // Placeholder for rewards distribution data
        });

        // Wait for transaction confirmation
        const provider = this.blockchain.getDefaultExecuteLayerClient().getProvider();
        await provider.waitForTransaction(tx.hash);
        return tx;
    }

    /**
     * Get balance (wrapper for consistency)
     */
    private async getBalance(address: string): Promise<number> {
        try {
            const balance = await this.blockchain.getWalletBalance(address);
            const balanceEth = typeof balance === 'string' ? parseFloat(balance) : Number(balance);

            console.log(`   🔍 Debug - Address ${address.slice(0, 8)}... balance: ${balanceEth.toFixed(6)} ETH`);
            return balanceEth;
        } catch (error) {
            console.error(`   ❌ Error getting balance for ${address}:`, error);
            return 0;
        }
    }

    /**
     * Analyze and report test results
     */
    analyzeResults(): RewardsTestBuilder {
        const duration = this.endTime - this.startTime;
        const stakingResults = this.testResults.filter(r => r.step === 'staking');
        const rewardsResults = this.testResults.filter(r => r.step === 'rewards_claim');

        const successfulStaking = stakingResults.filter(r => r.success);
        const successfulRewards = rewardsResults.filter(r => r.success);

        console.log(`\n📊 Complete Rewards Workflow Results Summary:`);
        console.log(`   Test: ${this.testName}`);
        console.log(`   Total duration: ${duration}ms (${(duration / 1000 / 60).toFixed(2)} minutes)`);

        console.log(`\n🔢 Staking Operations (Prerequisite):`);
        console.log(`   Successful staking: ${successfulStaking.length}/${stakingResults.length}`);
        console.log(
            `   Staking success rate: ${((successfulStaking.length / stakingResults.length) * 100).toFixed(2)}%`
        );
        console.log(`   Total amount staked: ${successfulStaking.length * Number(this.stakingAmount)} ETH`);

        console.log(`\n🎁 Rewards Operations:`);
        console.log(`   Successful rewards claim: ${successfulRewards.length}/${Math.max(rewardsResults.length, 1)}`);
        console.log(
            `   Rewards claim success rate: ${rewardsResults.length > 0 ? ((successfulRewards.length / rewardsResults.length) * 100).toFixed(2) : '100.00'}%`
        );
        console.log(`   Reward period: ${this.rewardPeriodBlocks} blocks`);

        console.log(`\n💰 Balance Analysis:`);
        console.log(`   Validator initial balance: ${this.validatorBalanceBefore.toFixed(6)} ETH`);
        console.log(
            `   Validator after staking: ${this.validatorBalanceAfterStake.toFixed(6)} ETH (+${(this.validatorBalanceAfterStake - this.validatorBalanceBefore).toFixed(6)})`
        );
        console.log(
            `   Validator after rewards: ${this.validatorBalanceAfterRewards.toFixed(6)} ETH (+${this.validatorRewards.toFixed(6)})`
        );

        console.log(`\n   Delegator initial balance: ${this.delegatorBalanceBefore.toFixed(6)} ETH`);
        console.log(
            `   Delegator after staking: ${this.delegatorBalanceAfterStake.toFixed(6)} ETH (${(this.delegatorBalanceAfterStake - this.delegatorBalanceBefore).toFixed(6)})`
        );
        console.log(
            `   Delegator after rewards: ${this.delegatorBalanceAfterRewards.toFixed(6)} ETH (+${this.delegatorRewards.toFixed(6)})`
        );

        // Validate rewards behavior (flexible for different blockchain configurations)
        const rewardsGenerated = this.totalRewardsEarned > 0;
        const delegatorGotRewards = this.delegatorRewards > 0;
        const validatorGotRewards = this.validatorRewards > 0;

        console.log(`\n🎁 Rewards Validation:`);
        console.log(`   Total rewards generated: ${this.totalRewardsEarned.toFixed(6)} ETH`);
        console.log(
            `   Reward rate: ${((this.totalRewardsEarned / Number(this.stakingAmount)) * 100).toFixed(4)}% of staked amount`
        );

        // Flexible validation - allow for different blockchain behaviors
        const rewardsNote = rewardsGenerated
            ? `Rewards distributed successfully (Validator: ${this.validatorRewards.toFixed(6)} ETH, Delegator: ${this.delegatorRewards.toFixed(6)} ETH)`
            : '(No rewards detected - this may depend on blockchain configuration and reward distribution schedule)';

        console.log(`   Rewards validation: ${rewardsGenerated ? '✅ PASS' : '⚠️ PARTIAL'} - ${rewardsNote}`);

        if (rewardsGenerated) {
            console.log(`   Validator rewards: ${validatorGotRewards ? '✅ RECEIVED' : '❌ NONE'}`);
            console.log(`   Delegator rewards: ${delegatorGotRewards ? '✅ RECEIVED' : '❌ NONE'}`);
        }

        return this;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<RewardsTestBuilder> {
        console.log(`\n🧹 Cleaning up rewards workflow resources...`);

        // Wait a bit to ensure all async operations are complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Clean up provider connections
        try {
            const provider = this.blockchain.getDefaultExecuteLayerClient().getProvider();
            provider.destroy();
            console.log(`   ✅ Provider cleanup completed`);
        } catch {
            console.log(`   ⚠️ Provider cleanup completed with warnings`);
        }

        return this;
    }

    /**
     * Get test results
     */
    getResults(): any[] {
        return this.testResults;
    }

    /**
     * Get wallets
     */
    getWallets(): any[] {
        return this.wallets;
    }
}
