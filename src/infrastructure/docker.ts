/**
 * Docker infrastructure management utilities
 *
 * Provides container operations for local development and CI/CD environments.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Docker configuration for an environment
export interface EnvironmentDockerConfig {
    // Base path to docker-compose files (optional, for compose-based operations)
    composePath?: string;
    // Container naming pattern: 'validator{index}-geth', 'validator{index}-node'
    // Default patterns follow story-localnet convention
    containerPatterns?: {
        executionLayer: string; // e.g., 'validator{index}-geth' or 'bootnode{index}-geth'
        consensusLayer: string; // e.g., 'validator{index}-node' or 'bootnode{index}-node'
    };
    // Timeout for docker operations (ms)
    timeout?: number;
}

// Node Docker configuration (optional per-node overrides)
export interface NodeDockerConfig {
    // Override container names for this specific node
    executionLayerContainer?: string;
    consensusLayerContainer?: string;
}

// Docker defaults
const DOCKER_DEFAULTS = {
    timeout: 30000,
    containerPatterns: {
        executionLayer: 'validator{index}-geth',
        consensusLayer: 'validator{index}-node',
    },
};

/**
 * Get container name for a node
 */
function getContainerName(
    nodeIndex: number,
    nodeType: string,
    layer: 'executionLayer' | 'consensusLayer',
    nodeDocker?: NodeDockerConfig,
    envDocker?: EnvironmentDockerConfig
): string {
    // Check for explicit container name override
    if (layer === 'executionLayer' && nodeDocker?.executionLayerContainer) {
        return nodeDocker.executionLayerContainer;
    }
    if (layer === 'consensusLayer' && nodeDocker?.consensusLayerContainer) {
        return nodeDocker.consensusLayerContainer;
    }

    // Use pattern from config or default
    const patterns = envDocker?.containerPatterns ?? DOCKER_DEFAULTS.containerPatterns;
    const pattern = patterns[layer];

    // Determine prefix based on node type
    const prefix = nodeType === 'bootnode' ? 'bootnode' : 'validator';

    // Replace placeholders
    return pattern.replace('{index}', String(nodeIndex)).replace('validator', prefix);
}

/**
 * Docker operations manager
 */
export class DockerManager {
    /**
     * Stop containers for a node
     * @param nodeIndex - Node index
     * @param nodeType - Node type ('validator', 'bootnode', etc.)
     * @param nodeDocker - Optional per-node Docker config
     * @param envDocker - Optional environment Docker config
     */
    static async stopNodeContainers(
        nodeIndex: number,
        nodeType: string,
        nodeDocker?: NodeDockerConfig,
        envDocker?: EnvironmentDockerConfig
    ): Promise<void> {
        const gethContainer = getContainerName(nodeIndex, nodeType, 'executionLayer', nodeDocker, envDocker);
        const nodeContainer = getContainerName(nodeIndex, nodeType, 'consensusLayer', nodeDocker, envDocker);
        const timeout = envDocker?.timeout ?? DOCKER_DEFAULTS.timeout;

        console.log(`Stopping containers for node ${nodeIndex}: ${gethContainer}, ${nodeContainer}`);

        try {
            // Stop consensus layer first, then execution layer
            await execAsync(`docker stop ${nodeContainer}`, { timeout });
            console.log(`   Stopped ${nodeContainer}`);
        } catch (error) {
            console.warn(`   Failed to stop ${nodeContainer}:`, error);
        }

        try {
            await execAsync(`docker stop ${gethContainer}`, { timeout });
            console.log(`   Stopped ${gethContainer}`);
        } catch (error) {
            console.warn(`   Failed to stop ${gethContainer}:`, error);
        }
    }

    /**
     * Start containers for a node
     * @param nodeIndex - Node index
     * @param nodeType - Node type ('validator', 'bootnode', etc.)
     * @param nodeDocker - Optional per-node Docker config
     * @param envDocker - Optional environment Docker config
     */
    static async startNodeContainers(
        nodeIndex: number,
        nodeType: string,
        nodeDocker?: NodeDockerConfig,
        envDocker?: EnvironmentDockerConfig
    ): Promise<void> {
        const gethContainer = getContainerName(nodeIndex, nodeType, 'executionLayer', nodeDocker, envDocker);
        const nodeContainer = getContainerName(nodeIndex, nodeType, 'consensusLayer', nodeDocker, envDocker);
        const timeout = envDocker?.timeout ?? DOCKER_DEFAULTS.timeout;

        console.log(`Starting containers for node ${nodeIndex}: ${gethContainer}, ${nodeContainer}`);

        try {
            // Start execution layer first, then consensus layer
            await execAsync(`docker start ${gethContainer}`, { timeout });
            console.log(`   Started ${gethContainer}`);
        } catch (error) {
            console.warn(`   Failed to start ${gethContainer}:`, error);
        }

        try {
            await execAsync(`docker start ${nodeContainer}`, { timeout });
            console.log(`   Started ${nodeContainer}`);
        } catch (error) {
            console.warn(`   Failed to start ${nodeContainer}:`, error);
        }
    }

    /**
     * Check if containers for a node are running
     * @param nodeIndex - Node index
     * @param nodeType - Node type
     * @param nodeDocker - Optional per-node Docker config
     * @param envDocker - Optional environment Docker config
     */
    static async isNodeRunning(
        nodeIndex: number,
        nodeType: string,
        nodeDocker?: NodeDockerConfig,
        envDocker?: EnvironmentDockerConfig
    ): Promise<{ geth: boolean; node: boolean }> {
        const gethContainer = getContainerName(nodeIndex, nodeType, 'executionLayer', nodeDocker, envDocker);
        const nodeContainer = getContainerName(nodeIndex, nodeType, 'consensusLayer', nodeDocker, envDocker);

        let gethRunning = false;
        let nodeRunning = false;

        try {
            const { stdout: gethStatus } = await execAsync(
                `docker inspect -f '{{.State.Running}}' ${gethContainer} 2>/dev/null`
            );
            gethRunning = gethStatus.trim() === 'true';
        } catch {
            gethRunning = false;
        }

        try {
            const { stdout: nodeStatus } = await execAsync(
                `docker inspect -f '{{.State.Running}}' ${nodeContainer} 2>/dev/null`
            );
            nodeRunning = nodeStatus.trim() === 'true';
        } catch {
            nodeRunning = false;
        }

        return { geth: gethRunning, node: nodeRunning };
    }

    /**
     * Execute command in a container
     * @param containerName - Container name
     * @param command - Command to execute
     * @param timeout - Timeout in ms
     */
    static async execInContainer(
        containerName: string,
        command: string,
        timeout: number = DOCKER_DEFAULTS.timeout
    ): Promise<{ stdout: string; stderr: string }> {
        const { stdout, stderr } = await execAsync(`docker exec ${containerName} ${command}`, { timeout });
        return { stdout, stderr };
    }

    /**
     * Get container logs
     * @param containerName - Container name
     * @param lines - Number of lines (default: 50)
     */
    static async getContainerLogs(containerName: string, lines: number = 50): Promise<string> {
        const { stdout } = await execAsync(`docker logs --tail ${lines} ${containerName}`);
        return stdout;
    }
}

// Export utilities
export const stopNodeContainers = DockerManager.stopNodeContainers.bind(DockerManager);
export const startNodeContainers = DockerManager.startNodeContainers.bind(DockerManager);
export const isNodeRunning = DockerManager.isNodeRunning.bind(DockerManager);
