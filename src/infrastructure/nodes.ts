/**
 * Node infrastructure management utilities
 *
 * Note: Node configuration should be obtained from the Blockchain instance.
 * SSH configuration is now integrated into the environment config (tests/config.json).
 */

import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Types for validator selection
export interface ValidatorSelectionResult {
    validators: number[]; // Node indices
    totalVotingPower: number;
    targetVotingPower: number;
    achievedVotingPower: number;
    scenarioDescription: string;
}

// SSH configuration for a node (optional per-node overrides)
export interface NodeSSHConfig {
    host?: string; // Override: defaults to host extracted from rpcUrl
    username?: string; // Override: defaults to environment ssh.username
    keySource?: 'file' | 'env'; // Override: defaults to environment ssh.keySource
    keyPath?: string; // Override: defaults to environment ssh.keyPath
}

// Node configuration interface (matches Blockchain node config)
export interface NodeConfig {
    index: number;
    rpcUrl: string;
    type: string;
    votingPower: number;
    active: boolean;
    ssh?: NodeSSHConfig; // Optional per-node SSH overrides
}

// Service configuration for start/stop operations
export interface ServiceConfig {
    id: string;
    name?: string;
    displayName?: string;
    startCommand: string;
    stopCommand: string;
    priority?: number;
}

// Environment-level SSH configuration
export interface EnvironmentSSHConfig {
    username?: string; // Default: 'ubuntu'
    keySource?: 'file' | 'env'; // Default: 'env'
    keyPath?: string; // Default: 'SSH_KEY'
    connectionTimeout?: number; // Default: 30000
    execTimeout?: number; // Default: 60000
    services?: ServiceConfig[];
    defaultStartOrder?: string[];
    defaultStopOrder?: string[];
}

// SSH defaults
const SSH_DEFAULTS = {
    username: 'ubuntu',
    keySource: 'env' as const,
    keyPath: 'SSH_KEY',
    connectionTimeout: 30000,
    execTimeout: 60000,
};

/**
 * Extract hostname from URL
 * @param url - URL string (e.g., "http://10.0.1.100:8545")
 * @returns hostname (e.g., "10.0.1.100")
 */
export function extractHostFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        // Fallback: try to extract host manually
        const match = url.match(/^(?:https?:\/\/)?([^:/]+)/);
        return match ? match[1] : url;
    }
}

/**
 * Node management class
 *
 * Note: Most node-related operations should now be done through the Blockchain class.
 * This class is primarily for SSH/infrastructure operations that need direct node access.
 *
 * For validator selection by voting power, use: blockchain.selectValidatorsByVotingPower()
 * For getting node list, use: blockchain.nodes or blockchain.getActiveNodes()
 */
export class NodeManager {
    /**
     * Get list of active node IPs from nodes configuration
     * @param nodes - Array of node configurations (from Blockchain.nodes)
     * @param count - Number of nodes to return
     */
    static getNodeIpList(nodes: NodeConfig[], count: number): string[] {
        const activeUrls: string[] = [];

        for (const node of nodes) {
            if (node.active === true && node.rpcUrl) {
                activeUrls.push(node.rpcUrl);
            }
        }

        return activeUrls.slice(0, count).map(url => url.replace(/^(https?:\/\/)/, ''));
    }

    /**
     * Get SSH host for a node
     * Priority: node.ssh.host > extracted from node.rpcUrl
     * @param node - Node configuration
     */
    static getSSHHost(node: NodeConfig): string {
        if (node.ssh?.host) {
            return node.ssh.host;
        }
        return extractHostFromUrl(node.rpcUrl);
    }

    /**
     * Get SSH username for a node
     * Priority: node.ssh.username > envSSH.username > default
     * @param node - Node configuration
     * @param envSSH - Environment SSH configuration
     */
    static getSSHUsername(node: NodeConfig, envSSH?: EnvironmentSSHConfig): string {
        return node.ssh?.username ?? envSSH?.username ?? SSH_DEFAULTS.username;
    }

    /**
     * Get SSH private key for a node
     * Priority: node.ssh.keyPath > envSSH.keyPath > default
     * @param node - Node configuration
     * @param envSSH - Environment SSH configuration
     */
    static getSSHPrivateKey(node: NodeConfig, envSSH?: EnvironmentSSHConfig): string {
        const keySource = node.ssh?.keySource ?? envSSH?.keySource ?? SSH_DEFAULTS.keySource;
        const keyPath = node.ssh?.keyPath ?? envSSH?.keyPath ?? SSH_DEFAULTS.keyPath;

        if (keySource === 'file') {
            const filePath = process.env[keyPath];
            if (!filePath) {
                throw new Error(`Environment variable ${keyPath} is not set (file path)`);
            }
            if (!fs.existsSync(filePath)) {
                throw new Error(`SSH key file not found at path: ${filePath}`);
            }
            return fs.readFileSync(filePath, 'utf8');
        } else {
            // keySource === 'env'
            const sshKey = process.env[keyPath];
            if (!sshKey) {
                throw new Error(`Environment variable ${keyPath} is not set (SSH key)`);
            }
            return sshKey;
        }
    }

    /**
     * Get SSH connection timeout
     * @param envSSH - Environment SSH configuration
     */
    static getSSHConnectionTimeout(envSSH?: EnvironmentSSHConfig): number {
        return envSSH?.connectionTimeout ?? SSH_DEFAULTS.connectionTimeout;
    }

    /**
     * Get available services for an environment
     * @param envSSH - Environment SSH configuration
     */
    static getAvailableServices(envSSH?: EnvironmentSSHConfig): string[] {
        return envSSH?.services?.map(s => s.id) ?? [];
    }

    /**
     * Get default service order for operations
     * @param envSSH - Environment SSH configuration
     * @param operation - 'start' or 'stop'
     */
    static getDefaultServiceOrder(envSSH: EnvironmentSSHConfig | undefined, operation: 'start' | 'stop'): string[] {
        if (!envSSH) {
            return [];
        }
        return operation === 'start' ? (envSSH.defaultStartOrder ?? []) : (envSSH.defaultStopOrder ?? []);
    }

    /**
     * Get service configuration by ID
     * @param envSSH - Environment SSH configuration
     * @param serviceId - Service ID
     */
    static getServiceConfig(envSSH: EnvironmentSSHConfig | undefined, serviceId: string): ServiceConfig | undefined {
        return envSSH?.services?.find(s => s.id === serviceId);
    }
}

/**
 * SSH operations manager
 */
export class SSHManager {
    private static async createConnection(
        host: string,
        username: string,
        privateKey: string,
        timeout: number = SSH_DEFAULTS.connectionTimeout
    ): Promise<NodeSSH> {
        const client = new NodeSSH();

        try {
            await client.connect({
                host: host,
                username: username,
                privateKey: privateKey,
                timeout: timeout,
            });
            return client;
        } catch (error) {
            console.error(`Failed to connect via SSH to ${host}:`, error);
            throw error;
        }
    }

    private static async executeCommand(
        client: NodeSSH,
        command: string,
        serviceName: string,
        operation: string
    ): Promise<void> {
        console.log(`Executing ${operation} ${serviceName}:`, command);

        try {
            const result = await client.execCommand(command);

            console.log(`${serviceName} ${operation} STDOUT:`, result.stdout);
            if (result.stderr) {
                console.log(`${serviceName} ${operation} STDERR:`, result.stderr);
            }

            if (result.code !== 0) {
                console.warn(`${serviceName} ${operation} command exited with code ${result.code}`);
            }
        } catch (error) {
            console.error(`Error executing ${operation} command for ${serviceName}:`, error);
            throw error;
        }
    }

    /**
     * Stop processes on a node
     * @param node - Node configuration
     * @param envSSH - Environment SSH configuration
     * @param serviceIds - Optional specific services to stop
     * @param existingClient - Optional existing SSH client
     */
    static async stopNodeServices(
        node: NodeConfig,
        envSSH?: EnvironmentSSHConfig,
        serviceIds?: string[],
        existingClient?: NodeSSH
    ): Promise<void> {
        const host = NodeManager.getSSHHost(node);
        const username = NodeManager.getSSHUsername(node, envSSH);
        const privateKey = NodeManager.getSSHPrivateKey(node, envSSH);
        const timeout = NodeManager.getSSHConnectionTimeout(envSSH);

        let client: NodeSSH | undefined;
        let shouldDisposeClient = false;

        try {
            if (existingClient === undefined) {
                client = await this.createConnection(host, username, privateKey, timeout);
                shouldDisposeClient = true;
            } else {
                client = existingClient;
            }

            const servicesToStop = serviceIds ?? NodeManager.getDefaultServiceOrder(envSSH, 'stop');

            if (servicesToStop.length === 0) {
                console.warn(`No services configured to stop for node ${node.index}`);
                return;
            }

            console.log(`Stopping services on node ${node.index} (${host}): ${servicesToStop.join(', ')}`);

            for (const serviceId of servicesToStop) {
                try {
                    const serviceConfig = NodeManager.getServiceConfig(envSSH, serviceId);
                    if (!serviceConfig) {
                        console.warn(`Service '${serviceId}' not found in configuration`);
                        continue;
                    }
                    await this.executeCommand(
                        client,
                        serviceConfig.stopCommand,
                        serviceConfig.displayName ?? serviceId,
                        'stop'
                    );
                } catch (error) {
                    console.error(`Failed to stop service '${serviceId}':`, error);
                }
            }
        } catch (error) {
            console.error('Error during stop process SSH operations:', error);
            throw error;
        } finally {
            if (shouldDisposeClient && client) {
                client.dispose();
            }
        }
    }

    /**
     * Start processes on a node
     * @param node - Node configuration
     * @param envSSH - Environment SSH configuration
     * @param serviceIds - Optional specific services to start
     * @param existingClient - Optional existing SSH client
     */
    static async startNodeServices(
        node: NodeConfig,
        envSSH?: EnvironmentSSHConfig,
        serviceIds?: string[],
        existingClient?: NodeSSH
    ): Promise<void> {
        const host = NodeManager.getSSHHost(node);
        const username = NodeManager.getSSHUsername(node, envSSH);
        const privateKey = NodeManager.getSSHPrivateKey(node, envSSH);
        const timeout = NodeManager.getSSHConnectionTimeout(envSSH);

        let client: NodeSSH | undefined;
        let shouldDisposeClient = false;

        try {
            if (existingClient === undefined) {
                client = await this.createConnection(host, username, privateKey, timeout);
                shouldDisposeClient = true;
            } else {
                client = existingClient;
            }

            const servicesToStart = serviceIds ?? NodeManager.getDefaultServiceOrder(envSSH, 'start');

            if (servicesToStart.length === 0) {
                console.warn(`No services configured to start for node ${node.index}`);
                return;
            }

            console.log(`Starting services on node ${node.index} (${host}): ${servicesToStart.join(', ')}`);

            for (const serviceId of servicesToStart) {
                try {
                    const serviceConfig = NodeManager.getServiceConfig(envSSH, serviceId);
                    if (!serviceConfig) {
                        console.warn(`Service '${serviceId}' not found in configuration`);
                        continue;
                    }
                    await this.executeCommand(
                        client,
                        serviceConfig.startCommand,
                        serviceConfig.displayName ?? serviceId,
                        'start'
                    );
                } catch (error) {
                    console.error(`Failed to start service '${serviceId}':`, error);
                }
            }
        } catch (error) {
            console.error('Error during start process SSH operations:', error);
            throw error;
        } finally {
            if (shouldDisposeClient && client) {
                client.dispose();
            }
        }
    }

    /**
     * Execute arbitrary command on a node
     * @param node - Node configuration
     * @param command - Command to execute
     * @param envSSH - Environment SSH configuration
     */
    static async executeOnNode(
        node: NodeConfig,
        command: string,
        envSSH?: EnvironmentSSHConfig
    ): Promise<{ stdout: string; stderr: string; code: number | null }> {
        const host = NodeManager.getSSHHost(node);
        const username = NodeManager.getSSHUsername(node, envSSH);
        const privateKey = NodeManager.getSSHPrivateKey(node, envSSH);
        const timeout = NodeManager.getSSHConnectionTimeout(envSSH);

        const client = await this.createConnection(host, username, privateKey, timeout);

        try {
            const result = await client.execCommand(command);
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                code: result.code,
            };
        } finally {
            client.dispose();
        }
    }
}

// Exports
export const getNodeIpList = NodeManager.getNodeIpList;
export const extractHost = extractHostFromUrl;
