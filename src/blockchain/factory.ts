/**
 * Blockchain Client Factory
 */

import {
    IExecuteLayerClient,
    IConsensusLayerClient,
    IBlockchainClient,
    IBaseBlockchain,
    BlockchainType,
    IBlockchainNode,
    IWallet,
    EVMWallet,
    CosmosWallet,
    IBlockchain,
} from './types';
import { EVMExecuteClient } from './clients/evm-execute-client';
import { CosmosConsensusClient } from './clients/cosmos-consensus-client';

export class BlockchainFactory {
    /**
     * Create execution layer client
     */
    static createExecuteLayerClientFromNode(node: IBlockchainNode): IExecuteLayerClient {
        const endpoint = node.getExecuteLayerRpcUrl();

        switch (node.blockchain.executeLayer) {
            case BlockchainType.EVM:
                return new EVMExecuteClient(node.getClientConfig(), endpoint);
            case BlockchainType.COSMOS:
                // Cosmos typically uses EVM as execution layer
                return new EVMExecuteClient(node.getClientConfig(), endpoint);
            default:
                throw new Error(`Unsupported execute layer type: ${node.blockchain.executeLayer}`);
        }
    }

    /**
     * Create a consensus layer client from a blockchain node
     */
    static createConsensusLayerClientFromNode(node: IBlockchainNode): IConsensusLayerClient {
        const restEndpoint = node.getConsensusLayerRestUrl();
        const rpcEndpoint = node.getConsensusLayerRpcUrl();
        const pathPrefix = node.blockchain.consensusRestApiPathPrefix;
        const apiVersion = node.blockchain.consensusRestApiVersion;

        switch (node.blockchain.consensusLayer) {
            case BlockchainType.COSMOS:
                return new CosmosConsensusClient(
                    node.getClientConfig(),
                    restEndpoint,
                    rpcEndpoint,
                    pathPrefix,
                    apiVersion
                );
            case BlockchainType.EVM:
                // EVM chains typically also have consensus layer information, which can be accessed through Cosmos client
                return new CosmosConsensusClient(
                    node.getClientConfig(),
                    restEndpoint,
                    rpcEndpoint,
                    pathPrefix,
                    apiVersion
                );
            default:
                throw new Error(`Unsupported consensus layer type: ${node.blockchain.consensusLayer}`);
        }
    }

    /**
     * Create CompositeClient (backward compatible)
     * @param node Node instance
     * @returns CompositeClient instance
     */
    static createClientFromNode(node: IBlockchainNode): IBlockchainClient {
        const executeLayerClient = this.createExecuteLayerClientFromNode(node);
        const consensusLayerClient = this.createConsensusLayerClientFromNode(node);

        // Create a simple composite object that implements the IBlockchainClient interface
        return {
            config: executeLayerClient.config,

            // Connection management
            async isConnected() {
                return (await executeLayerClient.isConnected()) && (await consensusLayerClient.isConnected());
            },
            async connect() {
                await Promise.all([executeLayerClient.connect(), consensusLayerClient.connect()]);
            },
            async disconnect() {
                await Promise.all([executeLayerClient.disconnect(), consensusLayerClient.disconnect()]);
            },

            // Execution layer methods
            async getAccount(address: string) {
                return await executeLayerClient.getAccount(address);
            },
            async createAccount(privateKey?: string) {
                return await executeLayerClient.createAccount(privateKey);
            },
            async sendTransaction(request: any, privateKey: string) {
                return await executeLayerClient.sendTransaction(request, privateKey);
            },
            async getTransaction(hash: string) {
                return await executeLayerClient.getTransaction(hash);
            },
            async waitForTransaction(hash: string, confirmations?: number) {
                return await executeLayerClient.waitForTransaction(hash, confirmations);
            },
            async estimateGas(request: any) {
                return await executeLayerClient.estimateGas(request);
            },
            async getBlockHeight() {
                return await executeLayerClient.getBlockHeight();
            },
            async getBlock(height?: number) {
                return await executeLayerClient.getBlock(height);
            },
            isValidAddress(address: string) {
                return executeLayerClient.isValidAddress(address);
            },
            formatAmount(amount: string) {
                return executeLayerClient.formatAmount(amount);
            },
            parseAmount(amount: string) {
                return executeLayerClient.parseAmount(amount);
            },

            // Consensus layer methods
            async getNetworkInfo() {
                return await consensusLayerClient.getNetworkInfo();
            },
            async getValidators() {
                return await consensusLayerClient.getValidators();
            },
        } as IBlockchainClient;
    }

    /**
     * Create client from configuration (backward compatible)
     */
    static createClientFromConfig(config: IBlockchain): IBlockchainClient {
        const activeNode = config.nodes.find(node => node.active);
        if (!activeNode) {
            throw new Error(`No active nodes found in blockchain config: ${config.name}`);
        }
        return this.createClientFromNode(activeNode);
    }

    /**
     * Create clients for all nodes (backward compatible)
     */
    static createClientsByNodes(config: IBlockchain): Map<string, IBlockchainClient> {
        const clients = new Map<string, IBlockchainClient>();
        for (const node of config.nodes) {
            if (node.active) {
                const client = this.createClientFromNode(node);
                const name = `${node.type}-${node.index}`;
                clients.set(name, client);
                console.log(`Created client for ${node.url} with name ${name}`);
            }
        }
        return clients;
    }

    /**
     * Validate blockchain configuration
     */
    static validateConfig(config: IBaseBlockchain): boolean {
        if (!config.chainType || !config.name || !config.executeLayerHttpRpcUrl) {
            return false;
        }

        // Type-specific validation
        switch (config.chainType) {
            case BlockchainType.EVM:
                // EVM requires chainId for transaction signing
                return config.chainId !== undefined;

            case BlockchainType.COSMOS:
                // Cosmos should have denom and prefix configured
                return true; // These can have defaults

            default:
                return true;
        }
    }

    /**
     * Get supported blockchain types
     */
    static getSupportedTypes(): BlockchainType[] {
        return [
            BlockchainType.EVM,
            BlockchainType.COSMOS,
            // Add more as they're implemented
        ];
    }
}

export class WalletFactory {
    static createWallet(type: BlockchainType, privateKey?: string): IWallet {
        switch (type) {
            case BlockchainType.EVM:
                return EVMWallet.createRandom(privateKey);
            case BlockchainType.COSMOS:
                return CosmosWallet.createRandom(privateKey);
            // Future blockchain types can be added here
            // case BlockchainType.SOLANA:
            //     throw new Error('Solana wallet not implemented yet');
            // case BlockchainType.POLKADOT:
            //     throw new Error('Polkadot wallet not implemented yet');
            default:
                throw new Error(`Unsupported blockchain type for wallet: ${type}`);
        }
    }

    /**
     * Create wallet from configuration
     */
    static createWalletFromConfig(type: BlockchainType, cfg: IWallet): IWallet {
        switch (type) {
            case BlockchainType.EVM:
                return EVMWallet.createFromCfg(cfg);
            case BlockchainType.COSMOS:
                return CosmosWallet.createFromCfg(cfg);
            default:
                throw new Error(`Unsupported blockchain type for wallet config: ${type}`);
        }
    }

    /**
     * Create multiple random wallets
     */
    static createRandomWallets(type: BlockchainType, count: number): IWallet[] {
        switch (type) {
            case BlockchainType.EVM:
                return EVMWallet.createRandoms(count);
            case BlockchainType.COSMOS:
                return CosmosWallet.createRandoms(count);
            default:
                throw new Error(`Unsupported blockchain type for multiple wallets: ${type}`);
        }
    }
}
