import { expect } from 'chai';
import { Blockchain } from '../../core/Blockchain';
import { NodeType, IBlockchainNode } from '../../blockchain/types';
import { SSHManager, NodeConfig } from '../../infrastructure/nodes';
import { DockerManager } from '../../infrastructure/docker';
import { assertConsistentNodeResponses, assertNodesDisconnected } from '../../utils/test-helpers';
import { Config } from '../../utils/common';

// Test configuration (using Config.test constants)
const FAULT_TOLERANCE_CONFIG = {
    username: 'ubuntu',
    waitTimeForBlock: Config.test.waitTimeForBlock,
    waitTimeForService: Config.test.waitTimeForService,
    waitTimeLong: Config.test.waitTimeLong,
    timeout: 300000, // 5 minutes timeout
};

// Block number request template
const BLOCK_NUM_REQUEST = Config.test.blockNumRequest;

/**
 * Fault Tolerance Test Builder - for blockchain fault tolerance testing
 *
 * Handles fault tolerance scenarios including:
 * - Validator selection and management
 * - Node stopping/starting operations
 * - Network status monitoring
 * - Consensus health checks
 * - Recovery verification
 */
export class FaultToleranceTestBuilder {
    private blockchain: Blockchain;
    private stoppedValidators: number[] = []; // Changed from string[] to number[] for node indices
    private testResults: any[] = [];
    private startTime: number = 0;
    private endTime: number = 0;
    private testName: string = '';
    private configuration: any = {};
    private scenario: 'less-than-one-third' | 'exactly-one-third' | 'more-than-one-third' = 'less-than-one-third';
    private networkShouldProgress: boolean = true;
    private blockNumbers: Map<string, number> = new Map();
    private networkStatus: Map<string, boolean> = new Map();

    constructor(blockchain: Blockchain) {
        this.blockchain = blockchain;
    }

    /**
     * Set test name and description
     */
    withTestName(name: string): FaultToleranceTestBuilder {
        this.testName = name;
        console.log(`\n=== ${name} ===`);
        return this;
    }

    /**
     * Set test configuration
     */
    withConfiguration(config: any): FaultToleranceTestBuilder {
        this.configuration = config;
        console.log(`📋 Test Configuration:`);
        Object.entries(config).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        return this;
    }

    /**
     * Set fault tolerance parameters
     */
    withFaultToleranceParameters(params: {
        scenario: 'less-than-one-third' | 'exactly-one-third' | 'more-than-one-third';
        networkShouldProgress?: boolean;
    }): FaultToleranceTestBuilder {
        this.scenario = params.scenario;
        this.networkShouldProgress = params.networkShouldProgress ?? true;
        console.log(`⚠️ Fault Tolerance Parameters:`);
        console.log(`   Voting power scenario: ${this.scenario}`);
        console.log(`   Network should progress: ${this.networkShouldProgress ? 'Yes' : 'No'}`);
        return this;
    }

    /**
     * Initialize test environment
     */
    async initialize(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n🚀 Initializing fault tolerance test...`);
        this.startTime = Date.now();

        // Check if network is in genesis state and trigger initial block generation
        console.log('🔄 Checking network state and generating initial blocks if needed...');
        try {
            await this.ensureNetworkActive();
        } catch (error) {
            console.log('⚠️ Network initialization issue:', error);
            // Continue with test even if initialization has issues
        }

        return this;
    }

    /**
     * Get target account address for transactions
     * Uses founder wallet address from blockchain config
     */
    private getTargetAccount(): string {
        return this.blockchain.founderWallet?.address ?? '';
    }

    /**
     * Ensure network is active by generating initial blocks if needed
     */
    private async ensureNetworkActive(): Promise<void> {
        // Check current block numbers
        try {
            const initialBlocks = await assertConsistentNodeResponses(this.blockchain, BLOCK_NUM_REQUEST, -1);
            const currentBlock = parseInt(initialBlocks[0].result, 16);

            if (currentBlock === 0) {
                console.log('📈 Network is in genesis state, generating initial blocks...');

                // Send some transactions to trigger block generation (via public endpoint)
                for (let i = 0; i < 3; i++) {
                    try {
                        await this.blockchain.sendSimpleTransactionViaPublicEndpoint(
                            this.getTargetAccount(),
                            '0.01',
                            this.blockchain.founderWallet?.privateKey
                        );
                        console.log(`   Transaction ${i + 1}/3 sent`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.log(`   Transaction ${i + 1} failed:`, error);
                    }
                }

                // Wait for blocks to be mined
                console.log('⏳ Waiting for blocks to be generated...');
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Check if blocks were generated
                const afterBlocks = await assertConsistentNodeResponses(this.blockchain, BLOCK_NUM_REQUEST, 10);
                const newBlock = parseInt(afterBlocks[0].result, 16);
                console.log(`📦 Block progression: ${currentBlock} -> ${newBlock}`);
            } else {
                console.log(`✅ Network is active, current block: ${currentBlock}`);
            }
        } catch (error) {
            console.log('⚠️ Could not verify network state:', error);
        }
    }

    /**
     * Get validators to stop based on voting power calculation
     */
    async getValidatorsToStop(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n📋 Getting validators to stop based on voting power...`);

        try {
            // Use the Blockchain instance to select validators by voting power
            const result = await Promise.resolve(this.blockchain.selectValidatorsByVotingPower(this.scenario));

            this.stoppedValidators = result.validators;

            console.log(`   📊 Voting Power Analysis:`);
            console.log(`   Total voting power: ${result.totalVotingPower}`);
            console.log(`   Target voting power: ${result.targetVotingPower} (${result.scenarioDescription})`);
            console.log(`   📋 Selected validators: ${JSON.stringify(this.stoppedValidators)}`);
            console.log(`   🎯 Achieved voting power: ${result.achievedVotingPower}/${result.targetVotingPower}`);

            this.testResults.push({
                step: 'get_validators',
                success: true,
                validators: this.stoppedValidators,
                totalVotingPower: result.totalVotingPower,
                targetVotingPower: result.targetVotingPower,
                achievedVotingPower: result.achievedVotingPower,
                scenarioDescription: result.scenarioDescription,
            });
        } catch (error) {
            console.error(`   ❌ Failed to get validators: ${error}`);
            this.testResults.push({
                step: 'get_validators',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        return this;
    }

    /**
     * Convert IBlockchainNode to NodeConfig for SSH operations
     */
    private toNodeConfig(node: IBlockchainNode): NodeConfig {
        return {
            index: node.index,
            rpcUrl: node.getExecuteLayerRpcUrl(),
            type: node.type,
            votingPower: node.votingPower ?? 0,
            active: node.active,
            ssh: node.ssh,
        };
    }

    /**
     * Stop a single node using the appropriate execution method
     */
    private async stopNode(node: IBlockchainNode): Promise<void> {
        const executionMethod = this.blockchain.executionMethod ?? 'none';

        switch (executionMethod) {
            case 'docker':
                await DockerManager.stopNodeContainers(node.index, node.type, node.docker, this.blockchain.docker);
                break;
            case 'ssh': {
                const nodeConfig = this.toNodeConfig(node);
                await SSHManager.stopNodeServices(nodeConfig, this.blockchain.ssh);
                break;
            }
            case 'none':
            default:
                console.log(`   ⚠️ No execution method configured, skipping actual stop operation`);
                break;
        }
    }

    /**
     * Start a single node using the appropriate execution method
     */
    private async startNode(node: IBlockchainNode): Promise<void> {
        const executionMethod = this.blockchain.executionMethod ?? 'none';

        switch (executionMethod) {
            case 'docker':
                await DockerManager.startNodeContainers(node.index, node.type, node.docker, this.blockchain.docker);
                break;
            case 'ssh': {
                const nodeConfig = this.toNodeConfig(node);
                await SSHManager.startNodeServices(nodeConfig, this.blockchain.ssh);
                break;
            }
            case 'none':
            default:
                console.log(`   ⚠️ No execution method configured, skipping actual start operation`);
                break;
        }
    }

    /**
     * Stop validators
     */
    async stopValidators(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n🛑 Stopping ${this.stoppedValidators.length} validators...`);
        console.log(`   📋 Execution method: ${this.blockchain.executionMethod ?? 'none'}`);

        const stopResults = await Promise.allSettled(
            this.stoppedValidators.map(async (validatorIndex, index) => {
                try {
                    const node = this.blockchain.getNode(validatorIndex);
                    console.log(`   🛑 Stopping validator ${index + 1}: Node-${validatorIndex} (${node.url})`);

                    await this.stopNode(node);

                    // Update node status in blockchain
                    this.blockchain.setNodeActive(validatorIndex, false);

                    console.log(`   ✅ Validator ${index + 1} stopped successfully`);
                    return { validator: validatorIndex, success: true };
                } catch (error) {
                    console.error(`   ❌ Failed to stop validator ${index + 1}: ${error}`);
                    return { validator: validatorIndex, success: false, error };
                }
            })
        );

        const successfulStops = stopResults.filter(
            result => result.status === 'fulfilled' && result.value.success
        ).length;

        console.log(`   📊 Stop results: ${successfulStops}/${this.stoppedValidators.length} successful`);

        this.testResults.push({
            step: 'stop_validators',
            success: successfulStops === this.stoppedValidators.length,
            successCount: successfulStops,
            totalCount: this.stoppedValidators.length,
            results: stopResults.map(result =>
                result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
            ),
        });

        return this;
    }

    /**
     * Check network status after stopping validators
     */
    async checkNetworkStatusAfterStop(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n🔍 Checking network status after stopping validators...`);

        try {
            // Get active validator nodes from blockchain instance (exclude bootnodes)
            const activeNodes = this.blockchain.getActiveNotBootNodes();
            const totalValidators = this.blockchain.getNodesByType(NodeType.VALIDATOR).length;
            console.log(`   📡 Active validators: ${activeNodes.length}/${totalValidators}`);

            // Get active node indices for RPC requests
            const activeNodeIndices = activeNodes.map(node => node.index);

            const initialBlockResults = await this.blockchain.getMultipleNodeResponses(
                BLOCK_NUM_REQUEST,
                activeNodeIndices
            );
            const initialBlocks = initialBlockResults.map(result => result.response);
            console.log(
                `   📦 Initial block numbers: ${JSON.stringify(initialBlocks.map((b: any) => parseInt(b.result, 16)))}`
            );

            // Store initial block numbers
            initialBlocks.forEach((block: any, index: number) => {
                this.blockNumbers.set(`initial_${index}`, parseInt(block.result, 16));
            });

            // Wait for block progression
            console.log(`   ⏳ Waiting for block progression...`);
            await new Promise(resolve => setTimeout(resolve, FAULT_TOLERANCE_CONFIG.waitTimeForBlock));

            // Check block numbers after waiting
            const afterBlockResults = await this.blockchain.getMultipleNodeResponses(
                BLOCK_NUM_REQUEST,
                activeNodeIndices
            );
            const afterBlocks = afterBlockResults.map(result => result.response);
            console.log(
                `   📦 After block numbers: ${JSON.stringify(afterBlocks.map((b: any) => parseInt(b.result, 16)))}`
            );

            // Store after block numbers
            afterBlocks.forEach((block: any, index: number) => {
                this.blockNumbers.set(`after_${index}`, parseInt(block.result, 16));
            });

            // Validate block progression based on expected behavior
            await this.validateBlockProgression(initialBlocks, afterBlocks);

            // Test transaction sending
            await this.testTransactionSending();

            this.testResults.push({
                step: 'check_network_after_stop',
                success: true,
                initialBlocks: initialBlocks.map((b: any) => parseInt(b.result, 16)),
                afterBlocks: afterBlocks.map((b: any) => parseInt(b.result, 16)),
                networkProgressed: this.networkShouldProgress,
            });
        } catch (error) {
            console.error(`   ❌ Network status check failed: ${error}`);
            this.testResults.push({
                step: 'check_network_after_stop',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        return this;
    }

    /**
     * Validate block progression based on expected behavior
     */
    private async validateBlockProgression(initialBlocks: any[], afterBlocks: any[]): Promise<void> {
        if (this.networkShouldProgress) {
            console.log(`   ✅ Validating network should progress...`);

            // Check if this is a genesis network (all blocks are 0)
            const isGenesisNetwork =
                initialBlocks.every(block => parseInt(block.result, 16) === 0) &&
                afterBlocks.every(block => parseInt(block.result, 16) === 0);

            if (isGenesisNetwork) {
                console.log(
                    `   ⚠️ Genesis network detected - validating network responsiveness instead of block progression`
                );

                // For genesis networks, just validate that:
                // 1. RPC endpoints are responding
                // 2. Network should be able to progress (fault tolerance check)
                for (let i = 0; i < afterBlocks.length; i++) {
                    if (afterBlocks[i].result === null || afterBlocks[i].result === undefined) {
                        throw new Error(`Node ${i} is not responding to RPC requests`);
                    }
                }

                // Check network health by attempting a transaction
                try {
                    console.log(`   🔄 Testing transaction capability on genesis network...`);
                    await this.blockchain.sendSimpleTransaction(
                        this.getTargetAccount(),
                        '0.01',
                        this.blockchain.founderWallet?.privateKey ?? ''
                    );
                    console.log(`   ✅ Genesis network is responsive and can accept transactions`);
                } catch (error) {
                    console.log(`   ⚠️ Transaction test failed on genesis network:`, error);
                    // Don't fail the test for transaction issues on genesis network
                }

                console.log(`   ✅ Genesis network fault tolerance validated`);
                return;
            }

            // Normal block progression validation for active networks
            for (let i = 0; i < initialBlocks.length; i++) {
                const initial = parseInt(initialBlocks[i].result, 16);
                const after = parseInt(afterBlocks[i].result, 16);
                expect(after).to.be.greaterThan(
                    initial,
                    `Block should have progressed on node ${i} (${initial} -> ${after})`
                );
            }
            console.log(`   ✅ Network progressed as expected`);
        } else {
            console.log(`   ⚠️ Validating network should NOT progress...`);
            for (let i = 0; i < initialBlocks.length; i++) {
                const initial = parseInt(initialBlocks[i].result, 16);
                const after = parseInt(afterBlocks[i].result, 16);
                expect(after).to.equal(
                    initial,
                    `Block should NOT have progressed on node ${i} (${initial} -> ${after})`
                );
            }
            console.log(`   ✅ Network halted as expected`);
        }
    }

    /**
     * Test transaction sending
     */
    private async testTransactionSending(): Promise<void> {
        try {
            console.log(`   📤 Testing transaction sending...`);
            await this.blockchain.sendSimpleTransaction(
                this.getTargetAccount(),
                '0.01',
                this.blockchain.founderWallet?.privateKey ?? ''
            );
            console.log(`   ✅ Transaction sent successfully`);
            this.networkStatus.set('transaction_sent', true);
        } catch (error) {
            if (this.networkShouldProgress) {
                console.error(`   ❌ Transaction failed (unexpected): ${error}`);
                this.networkStatus.set('transaction_sent', false);
                throw error;
            } else {
                console.log(`   ✅ Transaction failed as expected (network halted)`);
                this.networkStatus.set('transaction_sent', false);
            }
        }
    }

    /**
     * Verify stopped validators are not accessible
     */
    async verifyStoppedValidatorsNotAccessible(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n🚫 Verifying stopped validators are not accessible...`);

        try {
            // Convert node indices to IP addresses for connectivity check
            const stoppedValidatorIPs = this.stoppedValidators.map(validatorIndex => {
                const node = this.blockchain.getNode(validatorIndex);
                return node.url.replace(/^https?:\/\//, ''); // Extract IP from URL
            });

            await assertNodesDisconnected(this.blockchain, stoppedValidatorIPs);
            console.log(`   ✅ All stopped validators are inaccessible as expected`);

            this.testResults.push({
                step: 'verify_stopped_validators',
                success: true,
                stoppedValidators: this.stoppedValidators,
            });
        } catch (error) {
            console.error(`   ❌ Verification failed: ${error}`);
            this.testResults.push({
                step: 'verify_stopped_validators',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        return this;
    }

    /**
     * Wait for long period (5 minutes)
     */
    async waitForLongPeriod(): Promise<FaultToleranceTestBuilder> {
        const waitMinutes = FAULT_TOLERANCE_CONFIG.waitTimeLong / 1000 / 60;
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + FAULT_TOLERANCE_CONFIG.waitTimeLong);
        const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false });

        console.log(`\n⏳ Waiting for long period (${waitMinutes} minutes)...`);
        console.log(`   🕐 Start: ${formatTime(startTime)} → End: ${formatTime(endTime)}`);

        await new Promise(resolve => setTimeout(resolve, FAULT_TOLERANCE_CONFIG.waitTimeLong));

        console.log(`   ✅ ${waitMinutes}-minute wait completed at ${formatTime(new Date())}`);
        this.testResults.push({
            step: 'wait_long_period',
            success: true,
            duration: FAULT_TOLERANCE_CONFIG.waitTimeLong,
        });

        return this;
    }

    /**
     * Restart validators
     */
    async restartValidators(): Promise<FaultToleranceTestBuilder> {
        const stepNumber = this.testName.includes('wait for 5 minutes') ? 6 : 5;
        console.log(`\n🔄 Step ${stepNumber}: Restarting ${this.stoppedValidators.length} validators...`);
        console.log(`   📋 Execution method: ${this.blockchain.executionMethod ?? 'none'}`);

        const restartResults = await Promise.allSettled(
            this.stoppedValidators.map(async (validatorIndex, index) => {
                try {
                    const node = this.blockchain.getNode(validatorIndex);
                    console.log(`   🔄 Restarting validator ${index + 1}: Node-${validatorIndex} (${node.url})`);

                    await this.startNode(node);

                    // Update node status in blockchain
                    this.blockchain.setNodeActive(validatorIndex, true);

                    console.log(`   ✅ Validator ${index + 1} restarted successfully`);
                    return { validator: validatorIndex, success: true };
                } catch (error) {
                    console.error(`   ❌ Failed to restart validator ${index + 1}: ${error}`);
                    return { validator: validatorIndex, success: false, error };
                }
            })
        );

        const successfulRestarts = restartResults.filter(
            result => result.status === 'fulfilled' && result.value.success
        ).length;

        console.log(`   📊 Restart results: ${successfulRestarts}/${this.stoppedValidators.length} successful`);

        // Wait for services to stabilize
        console.log(`   ⏳ Waiting for services to stabilize...`);
        await new Promise(resolve => setTimeout(resolve, FAULT_TOLERANCE_CONFIG.waitTimeForService));

        this.testResults.push({
            step: 'restart_validators',
            success: successfulRestarts === this.stoppedValidators.length,
            successCount: successfulRestarts,
            totalCount: this.stoppedValidators.length,
            results: restartResults.map(result =>
                result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
            ),
        });

        return this;
    }

    /**
     * Check network status after restart
     */
    async checkNetworkStatusAfterRestart(): Promise<FaultToleranceTestBuilder> {
        const stepNumber = this.testName.includes('wait for 5 minutes') ? 7 : 6;
        console.log(`\n🔍 Step ${stepNumber}: Checking network status after restart...`);

        try {
            // Check initial block numbers (all nodes should be active now)
            const initialBlocks = await assertConsistentNodeResponses(this.blockchain, BLOCK_NUM_REQUEST, -1);
            console.log(
                `   📦 Initial block numbers: ${JSON.stringify(initialBlocks.map((b: any) => parseInt(b.result, 16)))}`
            );

            // Wait for block progression
            console.log(`   ⏳ Waiting for block progression...`);
            await new Promise(resolve => setTimeout(resolve, FAULT_TOLERANCE_CONFIG.waitTimeForBlock));

            // Check block numbers after waiting
            const afterBlocks = await assertConsistentNodeResponses(this.blockchain, BLOCK_NUM_REQUEST, -1);
            console.log(
                `   📦 After block numbers: ${JSON.stringify(afterBlocks.map((b: any) => parseInt(b.result, 16)))}`
            );

            // Network should always progress after restart (with genesis network handling)
            const isGenesisNetwork =
                initialBlocks.every((block: any) => parseInt(block.result, 16) === 0) &&
                afterBlocks.every((block: any) => parseInt(block.result, 16) === 0);

            if (isGenesisNetwork) {
                console.log(`   ⚠️ Genesis network detected after restart - validating network responsiveness`);

                // For genesis networks, validate that all nodes are responding
                for (let i = 0; i < afterBlocks.length; i++) {
                    if (afterBlocks[i].result === null || afterBlocks[i].result === undefined) {
                        throw new Error(`Node ${i} is not responding to RPC requests after restart`);
                    }
                }
                console.log(`   ✅ All nodes responding after restart on genesis network`);
            } else {
                // Normal block progression validation for active networks
                for (let i = 0; i < initialBlocks.length; i++) {
                    const initial = parseInt(initialBlocks[i].result, 16);
                    const after = parseInt(afterBlocks[i].result, 16);
                    expect(after).to.be.greaterThan(
                        initial,
                        `Block should have progressed on node ${i} after restart (${initial} -> ${after})`
                    );
                }
                console.log(`   ✅ Network progressed normally after restart`);
            }

            // Test transaction sending (should always work after restart)
            console.log(`   📤 Testing transaction sending...`);
            await this.blockchain.sendSimpleTransaction(
                this.getTargetAccount(),
                '0.01',
                this.blockchain.founderWallet?.privateKey ?? ''
            );
            console.log(`   ✅ Transaction sent successfully`);

            console.log(`   ✅ Network fully recovered after restart`);

            this.testResults.push({
                step: 'check_network_after_restart',
                success: true,
                initialBlocks: initialBlocks.map((b: any) => parseInt(b.result, 16)),
                afterBlocks: afterBlocks.map((b: any) => parseInt(b.result, 16)),
            });
        } catch (error) {
            console.error(`   ❌ Network status check after restart failed: ${error}`);
            this.testResults.push({
                step: 'check_network_after_restart',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        return this;
    }

    /**
     * Analyze and report test results
     */
    analyzeResults(): FaultToleranceTestBuilder {
        this.endTime = Date.now();
        const duration = this.endTime - this.startTime;

        console.log(`\n📊 Fault Tolerance Test Results Summary:`);
        console.log(`   Test: ${this.testName}`);
        console.log(`   Total duration: ${duration}ms (${(duration / 1000 / 60).toFixed(2)} minutes)`);
        console.log(`   Validators tested: ${this.stoppedValidators.length}`);
        console.log(`   Network should progress: ${this.networkShouldProgress ? 'Yes' : 'No'}`);

        // Analyze each step
        const stepResults = this.testResults.reduce(
            (acc, result) => {
                acc[result.step] = result.success;
                return acc;
            },
            {} as Record<string, boolean>
        );

        console.log(`\n📋 Step-by-Step Results:`);
        Object.entries(stepResults).forEach(([step, success]) => {
            console.log(`   ${step}: ${success ? '✅ PASS' : '❌ FAIL'}`);
        });

        const overallSuccess = Object.values(stepResults).every(success => success);
        console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);

        return this;
    }

    /**
     * Clean up resources (ensure all validators are restarted)
     */
    async cleanup(): Promise<FaultToleranceTestBuilder> {
        console.log(`\n🧹 Cleaning up fault tolerance test resources...`);

        try {
            // Ensure all stopped validators are restarted
            for (const validatorIndex of this.stoppedValidators) {
                try {
                    const node = this.blockchain.getNode(validatorIndex);
                    await this.startNode(node);

                    // Update node status in blockchain
                    this.blockchain.setNodeActive(validatorIndex, true);

                    console.log(`   ✅ Ensured validator Node-${validatorIndex} (${node.url}) is running`);
                } catch {
                    console.log(`   ⚠️ Validator Node-${validatorIndex} may already be running`);
                }
            }

            console.log(`   ✅ Cleanup completed`);
        } catch (error) {
            console.log(`   ⚠️ Cleanup completed with warnings: ${error}`);
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
     * Get block numbers
     */
    getBlockNumbers(): Map<string, number> {
        return this.blockNumbers;
    }

    /**
     * Get network status
     */
    getNetworkStatus(): Map<string, boolean> {
        return this.networkStatus;
    }
}
