/**
 * Test helper utilities for consensus and RPC testing
 */

import { expect } from 'chai';
import { Request } from '../blockchain/types';
import { Blockchain } from '../core/Blockchain';

// Re-export removeNode for convenience
export { removeNode } from './common';

/**
 * Assert that specified nodes are disconnected (for testing only)
 */
export async function assertNodesDisconnected(blockchain: Blockchain, nodeIps: string[]): Promise<void> {
    const connectivityResults = await blockchain.checkNodesConnectivity(nodeIps);

    for (const [, connectivity] of connectivityResults) {
        expect(connectivity.evmConnected).to.be.false;
        expect(connectivity.consensusConnected).to.be.false;
    }
}

/**
 * Assert that multiple node responses are consistent (for testing only)
 */
export async function assertConsistentNodeResponses(
    blockchain: Blockchain,
    request: Request,
    faultTolerance: number = 0,
    nodeIndices?: number[]
): Promise<any[]> {
    const responses = await blockchain.getMultipleNodeResponses(request, nodeIndices);

    // Filter out successful responses
    const successfulResponses = responses.filter(r => !r.error).map(r => r.response);

    if (successfulResponses.length < 2) {
        throw new Error('Not enough successful responses to verify consistency');
    }

    // Perform consistency assertion
    if (faultTolerance === 0) {
        // Strict comparison - all responses must be identical
        successfulResponses.slice(1).forEach(response => {
            const nodeInfo = responses.find(r => r.response === response);
            expect(response).to.deep.equal(
                successfulResponses[0],
                `Node ${nodeInfo?.nodeIndex} vs Node ${responses[0]?.nodeIndex}`
            );
        });
    } else if (faultTolerance > 0) {
        // Allow some tolerance in numeric results
        const resultArray = successfulResponses.map(response => response.result);
        resultArray.slice(1).forEach(result => {
            if (result.startsWith('0x')) {
                const resultDecimal = parseInt(result, 16);
                const firstResult = parseInt(resultArray[0], 16);
                const nodeInfo = responses.find(r => r.response?.result === result);
                expect(Math.abs(resultDecimal - firstResult)).to.be.lessThan(
                    faultTolerance,
                    `Node ${nodeInfo?.nodeIndex} vs Node ${responses[0]?.nodeIndex}`
                );
            } else {
                const nodeInfo = responses.find(r => r.response?.result === result);
                expect(result).to.deep.equal(
                    resultArray[0],
                    `Node ${nodeInfo?.nodeIndex} vs Node ${responses[0]?.nodeIndex}`
                );
            }
        });
    }

    return successfulResponses;
}

/**
 * Wait for a specified amount of time
 * @param milliseconds - Time to wait in milliseconds
 */
export async function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
