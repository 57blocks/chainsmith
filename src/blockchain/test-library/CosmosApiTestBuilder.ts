import chai from 'chai';
import { Blockchain } from '../../core/Blockchain';
import { IConsensusLayerClient } from '../types';

const { expect } = chai;

// ============================================================================
// COSMOS API TEST BUILDER - Using Blockchain object and consensus layer client
// ============================================================================
export class CosmosApiTestBuilder {
    private blockchain: Blockchain;
    private consensusClient: IConsensusLayerClient;
    private testResults: Map<string, any> = new Map();
    private validators: any[] = [];

    constructor(blockchain: Blockchain) {
        this.blockchain = blockchain;
        this.consensusClient = blockchain.getDefaultConsensusLayerClient();
    }

    /**
     * Initialize and test basic connectivity
     */
    async initialize(): Promise<CosmosApiTestBuilder> {
        console.log(`\n🔧 Cosmos API Test Configuration:`);
        console.log(`   REST Endpoint: ${this.consensusClient.restEndpoint}`);
        console.log(`   RPC Endpoint: ${this.consensusClient.rpcEndpoint}`);
        console.log(`   Chain ID: ${this.blockchain.chainId}`);

        // Test basic connectivity using RPC /health endpoint
        const connected = await this.consensusClient.isConnected();
        if (connected) {
            this.testResults.set('connectivity', { success: true });
            console.log(`   ✅ Consensus client connectivity confirmed`);
        } else {
            this.testResults.set('connectivity', { success: false, error: 'RPC health check failed' });
            console.log(`   ⚠️ Consensus client connectivity failed, continuing with available endpoints`);
        }

        return this;
    }

    /**
     * Test Staking Module APIs - Using default paths
     */
    async testStakingModule(): Promise<CosmosApiTestBuilder> {
        console.log(`\n⚡ Testing Staking Module APIs (Default Paths)`);

        try {
            // Get all validators - Using default path
            const validatorsResponse = await this.consensusClient.getStakingValidators();
            this.validators = this.extractValidatorsFromResponse(validatorsResponse);
            this.testResults.set('staking_validators_default', {
                success: true,
                count: this.validators.length,
            });
            console.log(`   ✅ Found ${this.validators.length} validators (default path)`);

            // Get staking parameters - Using default path
            const paramsResponse = await this.consensusClient.getStakingParams();
            this.testResults.set('staking_params_default', {
                success: true,
                data: this.extractParamsFromResponse(paramsResponse),
            });
            console.log(`   ✅ Staking parameters retrieved (default path)`);

            // Get staking pool - Using default path
            const poolResponse = await this.consensusClient.getStakingPool();
            this.testResults.set('staking_pool_default', {
                success: true,
                data: this.extractPoolFromResponse(poolResponse),
            });
            console.log(`   ✅ Staking pool retrieved (default path)`);
        } catch (error: any) {
            this.testResults.set('staking_module_default', { success: false, error: error.message });
            console.log(`   ❌ Staking module tests (default) failed: ${error.message}`);
        }

        return this;
    }

    /**
     * Test Slashing Module APIs
     */
    async testSlashingModule(): Promise<CosmosApiTestBuilder> {
        console.log(`\n⚔️ Testing Slashing Module APIs`);

        try {
            // Get slashing parameters
            const paramsResponse = await this.consensusClient.getSlashingParams();
            this.testResults.set('slashing_params', { success: true, data: paramsResponse });
            console.log(`   ✅ Slashing parameters retrieved`);
        } catch (error: any) {
            this.testResults.set('slashing_module', { success: false, error: error.message });
            console.log(`   ❌ Slashing module tests failed: ${error.message}`);
        }

        return this;
    }

    /**
     * Test Mint Module APIs
     */
    async testMintModule(): Promise<CosmosApiTestBuilder> {
        console.log(`\n🪙 Testing Mint Module APIs`);

        try {
            // Get mint parameters
            const paramsResponse = await this.consensusClient.getMintParams();
            this.testResults.set('mint_params', { success: true, data: paramsResponse });
            console.log(`   ✅ Mint parameters retrieved`);
        } catch (error: any) {
            this.testResults.set('mint_module', { success: false, error: error.message });
            console.log(`   ❌ Mint module tests failed: ${error.message}`);
        }

        return this;
    }

    /**
     * Test Tendermint RPC APIs
     */
    async testTendermintRPC(): Promise<CosmosApiTestBuilder> {
        console.log(`\n🔗 Testing Tendermint RPC APIs`);

        try {
            // Get node status
            const statusResponse = await this.consensusClient.getTendermintStatus();
            this.testResults.set('tendermint_status', { success: true, data: statusResponse });
            console.log(`   ✅ Node status retrieved`);

            // Get latest block
            const blockResponse = await this.consensusClient.getTendermintBlock();
            this.testResults.set('tendermint_block', { success: true, data: blockResponse });
            console.log(`   ✅ Latest block retrieved`);

            // Get validator set
            const validatorsResponse = await this.consensusClient.getTendermintValidators();
            this.testResults.set('tendermint_validators', {
                success: true,
                data: validatorsResponse,
            });
            console.log(`   ✅ Validator set retrieved`);
        } catch (error: any) {
            this.testResults.set('tendermint_rpc', { success: false, error: error.message });
            console.log(`   ❌ Tendermint RPC tests failed: ${error.message}`);
        }

        return this;
    }

    /**
     * Helper method: Extract validator information from response
     */
    private extractValidatorsFromResponse(response: any): any[] {
        if (response.code === 200 && response.msg) {
            return response.msg.validators ?? [];
        } else if (response.validators) {
            return response.validators;
        } else if (response.result?.validators) {
            return response.result.validators;
        }
        return [];
    }

    /**
     * Helper method: Extract parameter information from response
     */
    private extractParamsFromResponse(response: any): any {
        if (response.code === 200 && response.msg) {
            return response.msg.params;
        } else if (response.params) {
            return response.params;
        } else if (response.result?.params) {
            return response.result.params;
        }
        return response;
    }

    /**
     * Helper method: Extract pool information from response
     */
    private extractPoolFromResponse(response: any): any {
        if (response.code === 200 && response.msg) {
            return response.msg.pool;
        } else if (response.pool) {
            return response.pool;
        } else if (response.result?.pool) {
            return response.result.pool;
        }
        return response;
    }

    /**
     * Assert all test results
     */
    assertResults(): CosmosApiTestBuilder {
        console.log(`\n📊 Cosmos API Test Results:`);

        let successCount = 0;
        let totalCount = 0;

        for (const [testName, result] of this.testResults) {
            totalCount++;
            if (result.success) {
                successCount++;
                console.log(`   ✅ ${testName}: PASSED`);
            } else {
                console.log(`   ❌ ${testName}: FAILED - ${result.error}`);
            }
        }

        console.log(`\n📈 Summary: ${successCount}/${totalCount} tests passed`);

        // Assert overall success rate
        const successRate = successCount / totalCount;
        expect(successRate).to.be.greaterThan(
            0.3,
            `Expected at least 30% success rate, got ${(successRate * 100).toFixed(1)}%`
        );

        // Ensure at least some core functions are working properly
        const coreTests = ['staking_validators_default', 'tendermint_status', 'tendermint_block'];
        const coreSuccessCount = coreTests.filter(test => {
            const result = this.testResults.get(test);
            return result?.success;
        }).length;

        expect(coreSuccessCount).to.be.greaterThan(0, 'Expected at least one core test to pass');

        return this;
    }

    /**
     * Generate detailed test report
     */
    generateReport(): CosmosApiTestBuilder {
        console.log(`\n📋 Detailed API Test Report:`);

        if (this.validators.length > 0) {
            console.log(`   Validators: ${this.validators.length} found`);
            this.validators.slice(0, 3).forEach((validator, index) => {
                console.log(
                    `     ${index + 1}. ${validator.description?.moniker ?? 'Unknown'} (${validator.operator_address})`
                );
            });
        }

        // Record successful module tests
        const successfulModules = Array.from(this.testResults.entries())
            .filter(([_, result]) => result.success)
            .map(([name, _]) => name);

        console.log(`   Successful Modules: ${successfulModules.join(', ')}`);

        return this;
    }

    /**
     * Get the result of a specific test
     */
    getTestResult(testName: string): any {
        return this.testResults.get(testName);
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        await Promise.resolve(); // Satisfy the await requirement for async method
        this.testResults.clear();
        this.validators = [];
    }
}
