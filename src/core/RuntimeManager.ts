import { Blockchain } from './Blockchain';

export class RuntimeManager {
    private defaultChain!: Blockchain;
    private chains: Blockchain[] = [];

    async connectToChainFromConfigFile(
        configFilePath: string,
        networkName?: string,
        options?: {
            /** Whether to throw on validation errors (default: true) */
            throwOnValidationError?: boolean;
        }
    ): Promise<void> {
        const opts = {
            throwOnValidationError: true,
            enableLogging: true,
            ...options,
        };

        try {
            // Step 1: Read and parse the configuration file
            // config will be an object containing blockchain configurations
            const config = await this.loadAndParseConfigFile(configFilePath);

            // Step 2: Extract the specified network's configuration
            if (networkName) {
                const blockchainConfig = this.extractBlockchainConfig(networkName, config);
                const chain = Blockchain.connectNetworkFromConfigFile(networkName, blockchainConfig);
                this.defaultChain ??= chain;
                this.chains.push(chain);
            } else {
                // get all networks and set the first one as default
                for (const [name, blockchainConfig] of Object.entries(config)) {
                    const chain = Blockchain.connectNetworkFromConfigFile(name, blockchainConfig as any);
                    this.defaultChain ??= chain;
                    this.chains.push(chain);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (opts.enableLogging) {
                const target = networkName ? `network "${networkName}"` : 'networks';
                console.error(`❌ Failed to connect to ${target} from config: ${errorMessage}`);
            }

            if (opts.throwOnValidationError) {
                throw error;
            }
        }
    }

    getChain(name: string): Blockchain | undefined {
        return this.chains.find(chain => chain.name === name);
    }

    getDefaultChain(): Blockchain {
        if (!this.defaultChain) {
            throw new Error('No default chain is set. Please connect to a chain first.');
        }
        return this.defaultChain;
    }

    /**
     * Load and parse a configuration file
     * @private
     */
    private async loadAndParseConfigFile(configFilePath: string): Promise<any> {
        const fs = await import('fs');

        if (!fs.existsSync(configFilePath)) {
            throw new Error(`Configuration file not found: ${configFilePath}`);
        }

        try {
            const rawConfig = fs.readFileSync(configFilePath, 'utf-8');
            return JSON.parse(rawConfig);
        } catch (parseError) {
            throw new Error(
                `Failed to parse configuration file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
            );
        }
    }

    /**
     * Extract network configuration from validated config content
     * @private
     */
    private extractBlockchainConfig(networkName: string, configContent: any): any {
        if (!Object.prototype.hasOwnProperty.call(configContent, networkName)) {
            throw new Error(`Required network "${networkName}" not found in configuration`);
        }

        const blockchainConfig = configContent[networkName];

        if (!blockchainConfig) {
            throw new Error(`Blockchain configuration for "${networkName}" is empty or invalid`);
        }

        return blockchainConfig;
    }
}
