import { ethers } from 'ethers';
import { Blockchain } from '../../core/Blockchain';
import { BlockchainType } from '../types';

// Wallet configuration (for direct private key in config - local testing only)
interface WalletConfig {
    privateKey: string;
}

// Load Stress Test Configuration
export interface LoadStressConfig {
    createNewWallet: boolean;
    fundingAmount: string;
    testTransactionAmount: string;
    // Option 1: Direct wallet configs (for local testing only, not recommended for non-local)
    wallets?: WalletConfig[];
    // Option 2: Load from environment variables (recommended for testnet/qa)
    walletEnvPrefix?: string; // e.g., "LOAD_WALLET_PK" -> reads LOAD_WALLET_PK_1, LOAD_WALLET_PK_2, ...
    walletCount?: number; // Number of wallets to load from env
}

// Load Stress Test Builder
export class LoadStressTestBuilder {
    private blockchain: Blockchain;
    private wallets: any[] = [];
    private testResults: any[] = [];
    private startTime: number = 0;
    private endTime: number = 0;
    private testName: string = '';
    private configuration: any = {};
    private loadStressConfig: LoadStressConfig;
    private existingWalletKeys: string[] = [];

    constructor(blockchain: Blockchain, config?: Partial<LoadStressConfig>) {
        // Validate blockchain type
        if (blockchain.executeLayer !== BlockchainType.EVM) {
            throw new Error(`LoadStressTestBuilder only supports EVM blockchains, got: ${blockchain.executeLayer}`);
        }
        this.blockchain = blockchain;

        // Default configuration
        this.loadStressConfig = {
            createNewWallet: true,
            fundingAmount: '0.1',
            testTransactionAmount: '0.001',
            ...config,
        };

        // Load wallet keys from environment variables (preferred for non-local)
        if (this.loadStressConfig.walletEnvPrefix && this.loadStressConfig.walletCount) {
            this.existingWalletKeys = this.loadWalletsFromEnv(
                this.loadStressConfig.walletEnvPrefix,
                this.loadStressConfig.walletCount
            );
            if (this.existingWalletKeys.length > 0) {
                console.log(`   📂 Loaded ${this.existingWalletKeys.length} wallet keys from environment variables`);
            }
        }
        // Fallback: Load wallet keys from config (for local testing)
        else if (this.loadStressConfig.wallets && Array.isArray(this.loadStressConfig.wallets)) {
            this.existingWalletKeys = this.loadStressConfig.wallets
                .map((w: WalletConfig) => w.privateKey)
                .filter((key: string) => key && !key.includes('YOUR_PRIVATE_KEY'));
            if (this.existingWalletKeys.length > 0) {
                console.log(`   📂 Loaded ${this.existingWalletKeys.length} wallet keys from config`);
            }
        }
    }

    /**
     * Load wallet private keys from environment variables
     * @param prefix - Environment variable prefix (e.g., "LOAD_WALLET_PK")
     * @param count - Number of wallets to load
     * @returns Array of private keys
     */
    private loadWalletsFromEnv(prefix: string, count: number): string[] {
        const wallets: string[] = [];
        const missingVars: string[] = [];

        for (let i = 1; i <= count; i++) {
            const envVar = `${prefix}_${i}`;
            const privateKey = process.env[envVar];
            if (privateKey) {
                wallets.push(privateKey.trim());
            } else {
                missingVars.push(envVar);
            }
        }

        if (missingVars.length > 0) {
            console.warn(`   ⚠️ Missing environment variables: ${missingVars.join(', ')}`);
        }

        return wallets;
    }

    /**
     * Get test transaction amount
     */
    getTestTransactionAmount(): string {
        return this.loadStressConfig.testTransactionAmount;
    }

    /**
     * Get provider for blockchain operations
     */
    private getProvider() {
        return this.blockchain.getDefaultExecuteLayerClient().getProvider();
    }

    /**
     * Set test name and description
     *
     * @param name - Test name
     * @returns LoadStressTestBuilder for fluent chaining
     */
    withTestName(name: string): LoadStressTestBuilder {
        this.testName = name;
        console.log(`\n=== ${name} ===`);
        return this;
    }

    /**
     * Set test configuration
     *
     * @param config - Configuration object
     * @returns LoadStressTestBuilder for fluent chaining
     */
    withConfiguration(config: any): LoadStressTestBuilder {
        this.configuration = config;
        console.log(`📋 Test Configuration:`);
        Object.entries(config).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        return this;
    }

    /**
     * Prepare wallets for testing
     *
     * @param count - Number of wallets to prepare
     * @param createNew - Whether to create new wallets or use existing ones
     * @param needsFunding - Whether to fund the wallets
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async prepareWallets(
        count: number,
        createNew: boolean = false,
        needsFunding: boolean = true
    ): Promise<LoadStressTestBuilder> {
        console.log(`\n🔧 Preparing ${count} wallets...`);

        this.wallets = [];
        const fundingTransactions: any[] = [];
        const FUNDING_AMOUNT = '0.1';

        if (createNew) {
            await this.createNewWallets(count, needsFunding, FUNDING_AMOUNT, fundingTransactions);
        } else {
            await this.prepareExistingWallets(count, needsFunding, FUNDING_AMOUNT, fundingTransactions);
        }

        // Wait for all funding transactions to be confirmed
        await this.blockchain.waitForTransactionConfirmations(fundingTransactions);

        console.log(`✅ Prepared ${this.wallets.length} wallets`);
        return this;
    }

    /**
     * Create new wallets and optionally fund them
     */
    private async createNewWallets(
        count: number,
        needsFunding: boolean,
        fundingAmount: string,
        fundingTransactions: any[]
    ): Promise<void> {
        console.log(`   Generating ${count} new wallets...`);

        // Create all wallets connected to public endpoint (for load testing via load balancer)
        this.wallets = Array.from({ length: count }, (_, i) => {
            const randomWallet = this.blockchain.createWalletViaPublicEndpoint();
            console.log(`   Generated wallet ${i + 1}: ${randomWallet.address}`);
            return randomWallet;
        });
        console.log(`   ✅ Generated ${this.wallets.length} wallets`);

        if (needsFunding) {
            await this.fundWallets(this.wallets, fundingAmount, fundingTransactions, 'all wallets');
        } else {
            console.log(`   ⏭️ Skipping funding for wallets (needsFunding = false)`);
        }
    }

    /**
     * Prepare existing wallets and optionally fund them
     */
    private async prepareExistingWallets(
        count: number,
        needsFunding: boolean,
        fundingAmount: string,
        fundingTransactions: any[]
    ): Promise<void> {
        const existingWalletCount = Math.min(count, this.existingWalletKeys.length);
        console.log(`   Using ${existingWalletCount} existing wallets`);

        // Handle additional wallets if needed
        if (count > this.existingWalletKeys.length) {
            await this.createAdditionalWallets(count, needsFunding, fundingAmount, fundingTransactions);
        }

        // Load existing wallets
        await this.loadExistingWallets(existingWalletCount, needsFunding, fundingAmount, fundingTransactions);
    }

    /**
     * Create additional wallets when existing ones are insufficient
     */
    private async createAdditionalWallets(
        count: number,
        needsFunding: boolean,
        fundingAmount: string,
        fundingTransactions: any[]
    ): Promise<void> {
        const additionalCount = count - this.existingWalletKeys.length;
        console.log(`   Generating ${additionalCount} additional wallets...`);

        // Create additional wallets connected to public endpoint
        const additionalWallets = Array.from({ length: additionalCount }, (_, i) => {
            const randomWallet = this.blockchain.createWalletViaPublicEndpoint();
            console.log(`   Generated additional wallet ${i + 1}: ${randomWallet.address}`);
            return randomWallet;
        });
        this.wallets.push(...additionalWallets);

        if (needsFunding) {
            await this.fundWallets(additionalWallets, fundingAmount, fundingTransactions, 'additional wallets');
        } else {
            console.log(`   ⏭️ Skipping funding for additional wallets (needsFunding = false)`);
        }
    }

    /**
     * Load existing wallets from private keys
     */
    private async loadExistingWallets(
        count: number,
        needsFunding: boolean,
        fundingAmount: string,
        fundingTransactions: any[]
    ): Promise<void> {
        console.log(`   Loading ${count} existing wallets...`);

        // Load existing wallets connected to public endpoint
        const existingWalletList = Array.from({ length: count }, (_, j) => {
            const randomWallet = this.blockchain.createWalletViaPublicEndpoint(this.existingWalletKeys[j].trim());
            console.log(`   ✅ Loaded existing wallet ${j + 1}: ${randomWallet.address}`);
            return randomWallet;
        });
        this.wallets.push(...existingWalletList);

        if (needsFunding) {
            await this.checkAndFundExistingWallets(existingWalletList, fundingAmount, fundingTransactions);
        } else {
            console.log(`   ⏭️ Skipping funding for existing wallets (needsFunding = false)`);
        }
    }

    /**
     * Check balances and fund existing wallets if needed
     */
    private async checkAndFundExistingWallets(
        existingWallets: any[],
        fundingAmount: string,
        fundingTransactions: any[]
    ): Promise<void> {
        console.log(`   🔍 Checking balances and funding existing wallets...`);

        const balanceCheckPromises = existingWallets.map(async (wallet, index) => {
            const balance = await this.blockchain.getWalletBalance(wallet.address);
            const balanceEth = typeof balance === 'string' ? parseFloat(balance) : ethers.formatEther(balance);
            console.log(`   💰 Wallet ${index + 1} balance: ${balanceEth} ETH`);

            if (Number(balanceEth) < 0.05) {
                // Fund if balance is less than 0.05 ETH (via public endpoint)
                const sendValue = (0.1 - Number(balanceEth)).toString();
                try {
                    const tx = await this.blockchain.sendSimpleTransactionViaPublicEndpoint(
                        wallet.address,
                        sendValue,
                        this.blockchain.founderWallet?.privateKey
                    );
                    console.log(`   📤 Funded existing wallet ${index + 1}: ${wallet.address} -> Hash: ${tx?.hash}`);
                    return { wallet, tx, index: index + 1 };
                } catch (error) {
                    console.error(`   ❌ Failed to fund existing wallet ${index + 1}: ${wallet.address}`, error);
                    return { wallet, tx: null, index: index + 1, error };
                }
            } else {
                console.log(`   ✅ Existing wallet ${index + 1} has sufficient balance: ${balanceEth} ETH`);
                return { wallet, tx: null, index: index + 1, sufficientBalance: true };
            }
        });

        const balanceCheckResults = await Promise.all(balanceCheckPromises);
        balanceCheckResults.forEach(result => {
            if (result.tx) {
                fundingTransactions.push(result);
            }
        });
    }

    /**
     * Fund a list of wallets using batch transactions
     */
    private async fundWallets(
        wallets: any[],
        fundingAmount: string,
        fundingTransactions: any[],
        walletType: string
    ): Promise<void> {
        console.log(`   🚀 Funding ${walletType} with ${fundingAmount} ETH using founder wallet...`);
        const fundingStartTime = Date.now();

        try {
            // Prepare all transactions
            const transactions = wallets.map(wallet => ({
                to: wallet.address,
                value: fundingAmount,
            }));

            // Send all transactions in batch using founder wallet
            const results = await this.blockchain.sendMultipleTransactionsConcurrent(transactions);

            // Process results
            results.forEach((tx: any, index: number) => {
                console.log(`   📤 Funded ${walletType} ${index + 1}: ${wallets[index].address} -> Hash: ${tx?.hash}`);
                fundingTransactions.push({
                    wallet: wallets[index],
                    tx,
                    index: index + 1,
                });
            });

            const fundingEndTime = Date.now();
            const fundingDuration = fundingEndTime - fundingStartTime;
            console.log(`   ⏱️ Funding completed in ${fundingDuration}ms (${wallets.length} wallets)`);
        } catch (error) {
            console.error(`   ❌ Failed to fund ${walletType} in batch:`, error);
        }
    }

    /**
     * Execute concurrent load test
     *
     * @param destAddress - Destination address
     * @param amount - Transaction amount
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async executeConcurrentLoadTest(destAddress: string, amount?: string): Promise<LoadStressTestBuilder> {
        const transactionAmount = amount ?? this.getTestTransactionAmount();
        console.log(`\n🚀 Starting concurrent load test...`);
        console.log(`   Destination: ${destAddress}`);
        console.log(`   Amount: ${transactionAmount} ETH`);
        this.startTime = Date.now();

        const transactions = this.wallets.map(async (wallet, index) => {
            try {
                const tx = await wallet.sendTransaction({
                    to: destAddress,
                    value: ethers.parseEther(transactionAmount),
                });
                console.log(`   Transaction ${index + 1}: ${wallet.address} -> ${destAddress} (${tx.hash})`);
                return { success: true, hash: tx.hash, index };
            } catch (error) {
                console.error(`   ❌ Transaction ${index + 1} failed: ${error}`);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    index,
                };
            }
        });

        this.testResults = await Promise.all(transactions);
        this.endTime = Date.now();

        return this;
    }

    /**
     * Execute batch transaction test
     *
     * @param destAddress - Destination address
     * @param batchSize - Size of each batch
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async executeBatchTransactionTest(destAddress: string, batchSize: number = 10): Promise<LoadStressTestBuilder> {
        console.log(`\n🚀 Starting batch transaction test...`);
        console.log(`   Batch size: ${batchSize}`);
        console.log(`   Destination: ${destAddress}`);
        this.startTime = Date.now();

        const batches: any[][] = [];
        for (let i = 0; i < this.wallets.length; i += batchSize) {
            const batch = this.wallets.slice(i, i + batchSize);
            batches.push(batch);
        }

        console.log(`   Created ${batches.length} batches`);

        const _successfulBatches = 0;
        const _totalTransactions = 0;
        const allResults: any[] = [];

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`   Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} transactions)`);

            const batchTransactions = batch.map(async (wallet, index) => {
                try {
                    const tx = await wallet.sendTransaction({
                        to: destAddress,
                        value: ethers.parseEther(this.getTestTransactionAmount()),
                    });
                    return { success: true, hash: tx.hash };
                } catch (error) {
                    console.error(`   ❌ Batch ${batchIndex + 1}, Transaction ${index + 1} failed: ${error}`);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                    };
                }
            });

            const batchResults = await Promise.all(batchTransactions);
            const successfulInBatch = batchResults.filter(result => result.success).length;
            const _successfulBatches = successfulInBatch > 0 ? 1 : 0;
            const _totalTransactions = successfulInBatch;
            allResults.push(...batchResults);

            console.log(`   ✅ Batch ${batchIndex + 1} completed: ${successfulInBatch}/${batch.length} successful`);

            // Small delay between batches
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.testResults = allResults;
        this.endTime = Date.now();

        return this;
    }

    /**
     * Execute gas price optimization test
     *
     * @param destAddress - Destination address
     * @param gasPrices - Array of gas prices to test
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async executeGasPriceOptimizationTest(destAddress: string, gasPrices: bigint[]): Promise<LoadStressTestBuilder> {
        console.log(`\n🚀 Starting gas price optimization test...`);
        console.log(`   Destination: ${destAddress}`);
        console.log(`   Gas prices to test: ${gasPrices.length}`);
        this.startTime = Date.now();

        const allResults: any[] = [];

        for (const gasPrice of gasPrices) {
            console.log(`\n   --- Testing gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei ---`);
            const gasStartTime = Date.now();

            const transactions = this.wallets.map(async (wallet, index) => {
                try {
                    const tx = await wallet.sendTransaction({
                        to: destAddress,
                        value: ethers.parseEther(this.getTestTransactionAmount()),
                        gasPrice: gasPrice,
                    });
                    return {
                        success: true,
                        hash: tx.hash,
                        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
                    };
                } catch (error) {
                    console.error(
                        `   ❌ Transaction ${index + 1} failed with gas price ${ethers.formatUnits(gasPrice, 'gwei')} Gwei: ${error}`
                    );
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
                    };
                }
            });

            const gasResults = await Promise.all(transactions);
            const gasEndTime = Date.now();
            const gasDuration = gasEndTime - gasStartTime;

            const successfulGasTransactions = gasResults.filter(result => result.success).length;

            console.log(`   Gas price ${ethers.formatUnits(gasPrice, 'gwei')} Gwei results:`);
            console.log(`   - Successful transactions: ${successfulGasTransactions}/${this.wallets.length}`);
            console.log(`   - Success rate: ${((successfulGasTransactions / this.wallets.length) * 100).toFixed(2)}%`);
            console.log(`   - Duration: ${gasDuration}ms`);
            console.log(
                `   - Transactions per second: ${(successfulGasTransactions / (gasDuration / 1000)).toFixed(2)}`
            );

            allResults.push(...gasResults);

            // Delay between gas price tests
            if (gasPrice !== gasPrices[gasPrices.length - 1]) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        this.testResults = allResults;
        this.endTime = Date.now();

        return this;
    }

    /**
     * Execute sustained load test
     *
     * @param destAddress - Destination address
     * @param duration - Test duration in minutes
     * @param batchSize - Number of transactions per batch (default 10)
     * @param batchIntervalMs - Interval between batches in milliseconds (default 500)
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async executeSustainedLoadTest(
        destAddress: string,
        duration: number = 5,
        batchSize: number = 10,
        batchIntervalMs: number = 500
    ): Promise<LoadStressTestBuilder> {
        console.log(`\n🚀 Starting sustained load test...`);
        console.log(`   Duration: ${duration} minutes`);
        console.log(`   Destination: ${destAddress}`);
        this.startTime = Date.now();

        const totalDuration = duration * 60 * 1000; // Convert to milliseconds
        const allResults: any[] = [];
        let transactionCount = 0;
        let successCount = 0;
        let failureCount = 0;

        // Ensure batchSize is within reasonable limits
        const actualBatchSize = Math.min(Math.max(1, batchSize), this.wallets.length);
        const actualInterval = Math.max(100, batchIntervalMs); // Minimum 100ms interval

        console.log(`   📊 Starting sustained transaction sending...`);
        console.log(`   ⏱️ Test will run for ${duration} minutes (${totalDuration}ms)`);
        console.log(`   📦 Batch size: ${actualBatchSize} transactions per batch`);
        console.log(`   ⏱️ Batch interval: ${actualInterval}ms`);
        console.log(`   🎯 Theoretical max TPS: ${(actualBatchSize * (1000 / actualInterval)).toFixed(2)}`);

        const startTime = Date.now();
        const endTime = startTime + totalDuration;

        while (Date.now() < endTime) {
            const batchStartTime = Date.now();

            // Send a batch of transactions concurrently
            const batchTransactions: Promise<any>[] = [];
            for (let i = 0; i < actualBatchSize; i++) {
                const walletIndex = (transactionCount + i) % this.wallets.length;
                const currentWallet = this.wallets[walletIndex];

                const txPromise = currentWallet
                    .sendTransaction({
                        to: destAddress,
                        value: ethers.parseEther(this.getTestTransactionAmount()),
                    })
                    .then((tx: any) => {
                        transactionCount++;
                        successCount++;
                        return {
                            success: true,
                            hash: tx.hash,
                            timestamp: Date.now(),
                            walletIndex: walletIndex,
                        };
                    })
                    .catch((error: any) => {
                        transactionCount++;
                        failureCount++;
                        console.error(`   ❌ Transaction failed (wallet ${walletIndex}): ${error}`);
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            timestamp: Date.now(),
                            walletIndex: walletIndex,
                        };
                    });

                batchTransactions.push(txPromise);
            }

            // Wait for all transactions in the batch to complete
            const batchResults = await Promise.all(batchTransactions);
            allResults.push(...batchResults);

            const batchEndTime = Date.now();
            const batchDuration = batchEndTime - batchStartTime;

            if (transactionCount % (actualBatchSize * 5) === 0) {
                // Log every 5 batches
                const elapsed = Date.now() - startTime;
                const actualTPS = (transactionCount / (elapsed / 1000)).toFixed(2);
                const successRate = ((successCount / transactionCount) * 100).toFixed(2);
                console.log(
                    `   📈 Progress: ${transactionCount} transactions, ${actualTPS} TPS, ${successRate}% success rate, ${failureCount} failures`
                );
            }

            // Wait for the next batch interval
            const waitTime = Math.max(0, actualInterval - batchDuration);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.endTime = Date.now();
        this.testResults = allResults;

        return this;
    }

    /**
     * Analyze and report test results
     *
     * @returns LoadStressTestBuilder for fluent chaining
     */
    analyzeResults(): LoadStressTestBuilder {
        const duration = this.endTime - this.startTime;
        const successfulTransactions = this.testResults.filter(result => result.success);
        const failedTransactions = this.testResults.filter(result => !result.success);
        const actualTPS = (this.testResults.length / (duration / 1000)).toFixed(2);

        console.log(`\n📊 Test Results Summary:`);
        console.log(`   Test: ${this.testName}`);
        console.log(`   Total transactions: ${this.testResults.length}`);
        console.log(`   Successful transactions: ${successfulTransactions.length}`);
        console.log(`   Failed transactions: ${failedTransactions.length}`);
        console.log(
            `   Success rate: ${((successfulTransactions.length / this.testResults.length) * 100).toFixed(2)}%`
        );
        console.log(`   Total duration: ${duration}ms (${(duration / 1000 / 60).toFixed(2)} minutes)`);
        console.log(`   Actual TPS: ${actualTPS}`);
        console.log(`   Average time per transaction: ${(duration / this.testResults.length).toFixed(2)}ms`);

        if (successfulTransactions.length > 0) {
            const avgBlockNumber =
                successfulTransactions
                    .filter(result => result.blockNumber)
                    .reduce((sum, result) => sum + result.blockNumber, 0) /
                successfulTransactions.filter(result => result.blockNumber).length;

            if (!isNaN(avgBlockNumber)) {
                console.log(`   Average block number: ${avgBlockNumber.toFixed(0)}`);
            }
        }

        return this;
    }

    /**
     * Clean up resources
     *
     * @returns LoadStressTestBuilder for fluent chaining
     */
    async cleanup(): Promise<LoadStressTestBuilder> {
        console.log(`\n🧹 Cleaning up resources...`);

        // Wait a bit to ensure all async operations are complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Note: Don't destroy the provider here because:
        // 1. Provider is owned by EVMExecuteClient, not LoadStressTestBuilder
        // 2. Multiple tests share the same blockchain instance
        // 3. Destroying here would break subsequent tests
        // Provider lifecycle is managed by Blockchain/EVMExecuteClient

        console.log(`   ✅ Cleanup completed`);
        return this;
    }

    /**
     * Get test results
     *
     * @returns Test results array
     */
    getResults(): any[] {
        return this.testResults;
    }

    /**
     * Get wallets
     *
     * @returns Wallets array
     */
    getWallets(): any[] {
        return this.wallets;
    }
}
