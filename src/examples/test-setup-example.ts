/**
 * Example: Unified test configuration loader
 *
 * This is an example of how to create a helper module for loading blockchain configuration.
 * Users can copy and adapt this for their own test setup.
 */
import path from 'path';
import { RuntimeManager } from '../core/RuntimeManager';
import { Blockchain } from '../core/Blockchain';
import { Config } from '../utils/common';

// Configuration path - centralized in tests/config.json
// Adjust this path based on where you place your config file
export const CONFIG_PATH = path.join(__dirname, '../../tests/config.json');

export const ENV_NAME = Config.envName;

/**
 * Connect to blockchain using unified configuration
 * @param envName - Optional environment name override
 */
export async function connectToBlockchain(envName?: string): Promise<{
    runtimeManager: RuntimeManager;
    blockchain: Blockchain;
}> {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string should use default
    const targetEnv = envName || ENV_NAME;
    const runtimeManager = new RuntimeManager();

    await runtimeManager.connectToChainFromConfigFile(CONFIG_PATH, targetEnv);

    const blockchain = runtimeManager.getChain(targetEnv);
    if (!blockchain) {
        throw new Error(`Failed to connect to blockchain environment: ${targetEnv}`);
    }

    return { runtimeManager, blockchain };
}

/**
 * Get the configuration path for tests
 * @returns The absolute path to the test configuration file
 */
export function getConfigPath(): string {
    return CONFIG_PATH;
}

/**
 * Get the current environment name
 * @returns The environment name being used
 */
export function getEnvName(): string {
    return ENV_NAME;
}
