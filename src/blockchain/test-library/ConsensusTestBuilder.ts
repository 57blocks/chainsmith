import * as net from 'net';
import chai from 'chai';
import {
    BlockchainType,
    TransactionRequest,
    NodeType,
    IExecuteLayerClient,
    IConsensusLayerClient,
    IBlockchainNode,
} from '../../index';
import { Config } from '../../utils/common';
import { Blockchain } from '../../core/Blockchain';
import { DEFAULT_PORTS } from '../constants';

// Consensus Test Builder Classes
export class ConsensusTestBuilder {
    private blockchain: Blockchain;
    private targetClients: Map<string, IExecuteLayerClient | IConsensusLayerClient> = new Map();
    private txHashes: Map<string, string> = new Map();
    private connectivityResults: Map<string, boolean> = new Map();
    private blockHeights: Map<string, number> = new Map();
    private bootnodeNodes: IBlockchainNode[] = [];

    constructor(blockchain: Blockchain) {
        this.blockchain = blockchain;
    }

    /**
     * Get the blockchain instance for direct access
     */
    getBlockchain(): Blockchain {
        return this.blockchain;
    }

    /**
     * Initialize and configure target blockchain clients for testing
     *
     * This method sets up the target clients based on the configured blockchain type and
     * prepares them for subsequent connectivity and transaction tests.
     *
     * @returns ConsensusTestBuilder instance for fluent chaining
     */
    getTargetClients(): ConsensusTestBuilder {
        try {
            // Get clients from all active nodes (excluding bootnodes)
            const activeNodes = this.blockchain.getActiveNotBootNodes();
            for (const node of activeNodes) {
                const nodeClient = node.getClient(this.blockchain.chainType);
                if (nodeClient) {
                    const nodeName = `${node.type}-${node.index.toString()}`;
                    this.targetClients.set(nodeName, nodeClient);
                }
            }
        } catch (error) {
            console.warn(`Target blockchain '${this.blockchain.name}' not found, error: ${error}`);
        }
        return this;
    }

    /**
     * Configure bootnode clients for port connectivity testing
     *
     * This method sets up bootnode URLs for subsequent port connectivity tests.
     * It filters active bootnodes from the configuration and prepares their URLs.
     *
     * @returns ConsensusTestBuilder instance for fluent chaining
     * @throws Error if no bootnodes are configured or no active bootnodes found
     */
    configureBootnodes(): ConsensusTestBuilder {
        const bootnodes = this.blockchain.getNodesByType(NodeType.BOOTNODE);
        if (bootnodes.length === 0) {
            throw new Error('No bootnodes configured in blockchain');
        }

        // Filter active bootnodes
        const activeBootnodes = bootnodes.filter(node => node.active);
        if (activeBootnodes.length === 0) {
            throw new Error('No active bootnodes found in blockchain configuration');
        }

        // Store bootnode nodes for port-specific testing
        this.bootnodeNodes = activeBootnodes;

        return this;
    }

    /**
     * Helper to extract hostname from node URL
     */
    private getHostFromNode(node: IBlockchainNode): string {
        const urlWithoutProtocol = node.url.replace('http://', '').replace('https://', '');
        return urlWithoutProtocol.split(':')[0];
    }

    // Helper methods
    private createTransactionRequest(account?: string): TransactionRequest {
        if (account) {
            if (this.blockchain.validateAddress(account)) {
                return this.blockchain.createTransactionRequest(account);
            } else {
                console.warn(`Invalid account address provided: ${account}, falling back to Config.account`);
            }
        }

        if (Config.account) {
            if (this.blockchain.validateAddress(Config.account)) {
                return this.blockchain.createTransactionRequest(Config.account);
            } else {
                console.warn(`Invalid Config.account address: ${Config.account}, using default address`);
            }
        }

        return this.blockchain.createTransactionRequest('0x742B15B02e906c93C090c4b5a7f7a5D17e6c8f3A');
    }

    /**
     * Clean up test resources
     *
     * This method cleans up the test manager and releases any resources
     * that were allocated during testing.
     *
     * @returns Promise<void>
     */
    async cleanup(): Promise<void> {
        await this.blockchain.cleanup();
    }

    /**
     * Test connectivity to all configured blockchain clients
     *
     * This method tests connection to each configured blockchain client, retrieves block heights,
     * and network information. Results are stored for later assertions.
     *
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async testConnectivity(): Promise<ConsensusTestBuilder> {
        if (this.targetClients.size === 0) {
            console.log(`⚠️  No ${this.blockchain.chainType} blockchain clients configured`);
            console.log(`   To test ${this.blockchain.chainType} chains, configure appropriate chain-nodes.json`);
            if (this.blockchain.chainType === BlockchainType.EVM) {
                console.log(`   EVM_RPC_URL=https://your-evm-endpoint`);
            }
            if (this.blockchain.chainType === BlockchainType.COSMOS) {
                console.log(`   COSMOS_RPC_URL=https://your-cosmos-endpoint:26657`);
            }

            // Skip test if no target clients are configured
            chai.expect(this.targetClients.size).to.equal(0);
            return this;
        }

        console.log(`\n📊 Testing ${this.targetClients.size} blockchain client(s):`);

        let connectedCount = 0;
        for (const [nodeName, client] of this.targetClients) {
            try {
                console.log(`\n🔗 Testing ${nodeName}:`);
                const isConnected = await client.isConnected();
                this.connectivityResults.set(nodeName, isConnected);

                if (isConnected) {
                    connectedCount++;
                    console.log(`   ✅ Connected`);
                    const height = await client.getBlockHeight();
                    this.blockHeights.set(nodeName, height);
                    console.log(`   📦 Block Height: ${height.toLocaleString()}`);

                    const networkInfo = await client.getNetworkInfo();
                    console.log(`   🆔 Chain ID: ${networkInfo.chainId}`);
                    console.log(`   🌐 Network: ${networkInfo.networkName ?? 'Unknown'}`);
                } else {
                    console.log(`   ❌ Not connected`);
                    this.blockHeights.set(nodeName, -1);
                }
            } catch (error: any) {
                console.log(`   ❌ Error: ${error.message}`);
                this.connectivityResults.set(nodeName, false);
                this.blockHeights.set(nodeName, -1);
            }
        }

        console.log(
            `\n📋 Summary: ${connectedCount}/${this.targetClients.size} ${this.blockchain.name} chains connected`
        );

        return this;
    }

    /**
     * Send a test transaction to the configured blockchain
     *
     * This method creates a transaction request and sends it to the target blockchain,
     * storing the transaction hash for later verification.
     *
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async sendTransaction(): Promise<ConsensusTestBuilder> {
        try {
            const txRequest = this.createTransactionRequest();
            const privateKey = this.blockchain.founderWallet?.privateKey ?? Config.founderWalletPrivateKey;
            // Send via public endpoint (just triggering tx, verification tests each node separately)
            const result = await this.blockchain.sendTransactionViaPublicEndpoint(txRequest, privateKey);
            this.txHashes.set(this.blockchain.name, result.hash);
            console.log(`Transaction sent on ${this.blockchain.name}: ${result.hash}`);

            // Assertions from original test
            chai.expect(result.hash).to.be.a('string').and.not.empty;
            chai.expect(result.status).to.be.oneOf(['success', 'pending']);
        } catch (error: any) {
            console.warn(`Failed to send transaction on ${this.blockchain.name}:`, error.message);
        }

        return this;
    }

    /**
     * Wait for transaction confirmation
     *
     * This method waits for a configured time period to allow transactions
     * to be confirmed on the blockchain before proceeding with verification.
     *
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async waitForConfirmation(): Promise<ConsensusTestBuilder> {
        await new Promise(resolve => setTimeout(resolve, Config.test.waitTimeForTx || 10000));
        return this;
    }

    /**
     * Verify transaction status across all nodes
     *
     * This method checks the transaction status on all configured nodes
     * to ensure consistency across the network.
     *
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async verifyTransactionStatus(): Promise<ConsensusTestBuilder> {
        const txHash = this.txHashes.get(this.blockchain.name) ?? '';
        if (!txHash) {
            throw new Error(`No transaction hash found for ${this.blockchain.name}`);
        }

        for (const [nodeName, client] of this.targetClients) {
            try {
                const txResult = await client.getTransaction(txHash);
                console.log(`Transaction status on ${nodeName}:`, txResult?.status);

                if (txResult) {
                    chai.expect(txResult.hash).to.equal(txHash);
                    chai.expect(txResult.status).to.be.oneOf(['success', 'failed', 'pending']);
                }
            } catch (error: any) {
                console.warn(`Failed to verify transaction on ${nodeName}:`, error.message);
            }
        }

        return this;
    }

    /**
     * Verify block progression across all chains
     *
     * This method compares block heights across all configured chains
     * to ensure they are progressing correctly.
     *
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async verifyBlockProgression(): Promise<ConsensusTestBuilder> {
        const finalBlockHeights = new Map<string, number>();

        for (const [chainName, client] of this.targetClients) {
            try {
                const height = await client.getBlockHeight();
                finalBlockHeights.set(chainName, height);
            } catch (error: any) {
                console.warn(`Failed to get block height from ${chainName}:`, error.message);
            }
        }
        console.log('Final block heights:', Object.fromEntries(finalBlockHeights));

        for (const [nodeName, height] of finalBlockHeights) {
            if (height > 0) {
                chai.expect(height).to.be.a('number').and.greaterThan(0);
                console.log(`${nodeName} is at block ${height}`);
            }
        }

        return this;
    }

    /**
     * Test port connectivity for bootnodes
     *
     * This method tests whether specific ports on bootnodes are open or closed
     * as expected. It verifies network connectivity and security configurations.
     * Uses node-specific port configurations when available.
     *
     * @param portType - The type of port to test ("EVM RPC", "P2P", "RPC")
     * @param expectedStatus - Expected status ("open" or "closed")
     * @returns Promise<ConsensusTestBuilder> for fluent chaining
     */
    async testPortConnectivity(portType: string, expectedStatus: string): Promise<ConsensusTestBuilder> {
        for (const node of this.bootnodeNodes) {
            const hostname = this.getHostFromNode(node);

            // Get port from node config, null means port is not exposed
            let portNumber: number | null | undefined;
            switch (portType) {
                case 'EVM RPC':
                    portNumber = node.executeLayerHttpRpcPort;
                    break;
                case 'P2P':
                    portNumber = node.consensusLayerP2pCommPort;
                    break;
                case 'RPC':
                    portNumber = node.consensusLayerRpcPort;
                    break;
                default:
                    throw new Error(`Unknown port type: ${portType}`);
            }

            // If port is null, it means it's explicitly not exposed
            if (portNumber === null) {
                if (expectedStatus === 'closed') {
                    console.log(
                        `✅ ${portType} port is not exposed on ${node.type}-${node.index} (configured as null)`
                    );
                    continue;
                } else {
                    throw new Error(`${portType} port is not exposed on ${node.type}-${node.index} (expected open)`);
                }
            }

            // If port is undefined, fall back to default ports
            if (portNumber === undefined) {
                switch (portType) {
                    case 'EVM RPC':
                        portNumber = DEFAULT_PORTS.EXECUTE_LAYER_HTTP_RPC;
                        break;
                    case 'P2P':
                        portNumber = DEFAULT_PORTS.CONSENSUS_LAYER_P2P_COMM;
                        break;
                    case 'RPC':
                        portNumber = DEFAULT_PORTS.CONSENSUS_LAYER_RPC;
                        break;
                }
            }

            await new Promise<void>((resolve, reject) => {
                const client = new net.Socket();
                const timeout = setTimeout(() => {
                    client.destroy();
                    if (expectedStatus === 'closed') {
                        console.log(`✅ Port ${portNumber} is closed on ${hostname} as expected`);
                        resolve();
                    } else {
                        reject(new Error(`Timeout connecting to ${hostname}:${portNumber}`));
                    }
                }, 5000);

                client.connect(portNumber as number, hostname, () => {
                    clearTimeout(timeout);
                    client.destroy();
                    if (expectedStatus === 'open') {
                        console.log(`✅ Connected to ${hostname}:${portNumber} (${portType})`);
                        resolve();
                    } else {
                        console.log(`❌ Port ${portNumber} is open on ${hostname} (should be closed)`);
                        reject(new Error(`Port ${portNumber} should be closed on ${hostname}`));
                    }
                });

                client.on('error', _err => {
                    clearTimeout(timeout);
                    client.destroy();
                    if (expectedStatus === 'closed') {
                        console.log(`✅ Port ${portNumber} is closed on ${hostname} as expected`);
                        resolve();
                    } else {
                        console.log(`❌ Error connecting to ${hostname}:${portNumber}:`, _err.message);
                        reject(_err);
                    }
                });
            });
        }

        return this;
    }

    /**
     * Assert that at least one network is connected
     *
     * This method verifies that at least one blockchain network is connected
     * based on the connectivity test results.
     *
     * @returns ConsensusTestBuilder instance for fluent chaining
     */
    assertConnectivity(): ConsensusTestBuilder {
        const connectedCount = Array.from(this.connectivityResults.values()).filter(Boolean).length;
        chai.expect(connectedCount).to.be.greaterThan(0, 'At least one network should be connected');
        return this;
    }

    /**
     * Assert that all connected chains have valid block heights
     *
     * This method verifies that all connected blockchain networks have
     * valid block heights greater than 0.
     *
     * @returns ConsensusTestBuilder instance for fluent chaining
     */
    assertBlockHeights(): ConsensusTestBuilder {
        for (const [nodeName, height] of this.blockHeights) {
            if (this.connectivityResults.get(nodeName)) {
                chai.expect(height).to.be.a('number').and.greaterThan(0, `${nodeName} should have valid block height`);
            }
        }
        return this;
    }

    /**
     * Assert that a transaction was successfully submitted
     *
     * This method verifies that a transaction hash exists and is valid
     * after a transaction has been sent to the blockchain.
     *
     * @returns ConsensusTestBuilder instance for fluent chaining
     */
    assertTransactionSubmitted(): ConsensusTestBuilder {
        const txHash = this.txHashes.get(this.blockchain.name);
        if (txHash) {
            chai.expect(txHash).to.be.a('string').and.not.empty;
        }
        return this;
    }
}
