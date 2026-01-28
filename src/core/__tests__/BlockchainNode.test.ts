import { expect } from 'chai';
import { DEFAULT_PORTS } from '../../blockchain/constants';
import { NodeType } from '../../blockchain/types';

describe('BlockchainNode', () => {
    describe('DEFAULT_PORTS', () => {
        it('should have correct default execute layer RPC port', () => {
            expect(DEFAULT_PORTS.EXECUTE_LAYER_HTTP_RPC).to.equal(8545);
        });

        it('should have correct default consensus layer REST API port', () => {
            expect(DEFAULT_PORTS.CONSENSUS_LAYER_HTTP_REST_API).to.equal(1317);
        });

        it('should have correct default consensus layer RPC port', () => {
            expect(DEFAULT_PORTS.CONSENSUS_LAYER_RPC).to.equal(26657);
        });

        it('should have correct default consensus layer P2P port', () => {
            expect(DEFAULT_PORTS.CONSENSUS_LAYER_P2P_COMM).to.equal(26656);
        });
    });

    describe('NodeType', () => {
        it('should have validator type', () => {
            expect(NodeType.VALIDATOR).to.equal('validator');
        });

        it('should have non-validator type', () => {
            expect(NodeType.NON_VALIDATOR).to.equal('non-validator');
        });

        it('should have bootnode type', () => {
            expect(NodeType.BOOTNODE).to.equal('bootnode');
        });
    });
});
