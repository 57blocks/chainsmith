/**
 * Default blockchain network configuration constants
 */

export const DEFAULT_PORTS = {
    EXECUTE_LAYER_HTTP_RPC: 8545,
    CONSENSUS_LAYER_HTTP_REST_API: 1317,
    CONSENSUS_LAYER_RPC: 26657,
    CONSENSUS_LAYER_P2P_COMM: 26656,
} as const;
