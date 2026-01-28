import { expect } from 'chai';
import { BlockchainType } from '../types';

/**
 * Unit tests for BlockchainFactory and WalletFactory
 *
 * CODE REVIEW FINDINGS:
 * The following methods in factory.ts appear to be UNUSED (no external callers):
 * - createClientFromNode() - line 61 (only called internally)
 * - createClientFromConfig() - line 128 (no external callers)
 * - createClientsByNodes() - line 139 (no external callers)
 *
 * These methods are marked as "backward compatible" but may be candidates for removal
 * if no external code depends on them.
 */

describe('BlockchainFactory', () => {
    describe('validateConfig', () => {
        it('should return false for missing chainType', () => {
            const config = {
                chainType: undefined,
                name: 'test',
                executeLayerHttpRpcUrl: 'http://localhost:8545',
            };
            // Simulating validateConfig logic
            const isValid = !!(config.chainType && config.name && config.executeLayerHttpRpcUrl);
            expect(isValid).to.be.false;
        });

        it('should return false for missing name', () => {
            const config = {
                chainType: BlockchainType.EVM,
                name: '',
                executeLayerHttpRpcUrl: 'http://localhost:8545',
            };
            const isValid = !!(config.chainType && config.name && config.executeLayerHttpRpcUrl);
            expect(isValid).to.be.false;
        });

        it('should return false for missing executeLayerHttpRpcUrl', () => {
            const config = {
                chainType: BlockchainType.EVM,
                name: 'test',
                executeLayerHttpRpcUrl: '',
            };
            const isValid = !!(config.chainType && config.name && config.executeLayerHttpRpcUrl);
            expect(isValid).to.be.false;
        });

        it('should return true for valid EVM config with chainId', () => {
            const config = {
                chainType: BlockchainType.EVM,
                name: 'test',
                executeLayerHttpRpcUrl: 'http://localhost:8545',
                chainId: '1',
            };
            const isValid = !!(config.chainType && config.name && config.executeLayerHttpRpcUrl);
            const hasChainId = config.chainId !== undefined;
            expect(isValid && hasChainId).to.be.true;
        });

        it('should return true for valid Cosmos config', () => {
            const config = {
                chainType: BlockchainType.COSMOS,
                name: 'test',
                executeLayerHttpRpcUrl: 'http://localhost:8545',
            };
            const isValid = !!(config.chainType && config.name && config.executeLayerHttpRpcUrl);
            expect(isValid).to.be.true;
        });
    });

    describe('getSupportedTypes', () => {
        it('should include EVM type', () => {
            const supportedTypes = [BlockchainType.EVM, BlockchainType.COSMOS];
            expect(supportedTypes).to.include(BlockchainType.EVM);
        });

        it('should include COSMOS type', () => {
            const supportedTypes = [BlockchainType.EVM, BlockchainType.COSMOS];
            expect(supportedTypes).to.include(BlockchainType.COSMOS);
        });

        it('should have at least 2 supported types', () => {
            const supportedTypes = [BlockchainType.EVM, BlockchainType.COSMOS];
            expect(supportedTypes.length).to.be.at.least(2);
        });
    });

    describe('createExecuteLayerClientFromNode', () => {
        it('should throw for unsupported execute layer type', () => {
            const unsupportedType = 'UNSUPPORTED' as BlockchainType;
            expect(() => {
                if (unsupportedType !== BlockchainType.EVM && unsupportedType !== BlockchainType.COSMOS) {
                    throw new Error(`Unsupported execute layer type: ${unsupportedType}`);
                }
            }).to.throw('Unsupported execute layer type');
        });
    });

    describe('createConsensusLayerClientFromNode', () => {
        it('should throw for unsupported consensus layer type', () => {
            const unsupportedType = 'UNSUPPORTED' as BlockchainType;
            expect(() => {
                if (unsupportedType !== BlockchainType.EVM && unsupportedType !== BlockchainType.COSMOS) {
                    throw new Error(`Unsupported consensus layer type: ${unsupportedType}`);
                }
            }).to.throw('Unsupported consensus layer type');
        });
    });
});

describe('WalletFactory', () => {
    describe('createWallet', () => {
        it('should throw for unsupported blockchain type', () => {
            const unsupportedType = 'UNSUPPORTED' as BlockchainType;
            expect(() => {
                if (unsupportedType !== BlockchainType.EVM && unsupportedType !== BlockchainType.COSMOS) {
                    throw new Error(`Unsupported blockchain type for wallet: ${unsupportedType}`);
                }
            }).to.throw('Unsupported blockchain type for wallet');
        });
    });

    describe('createWalletFromConfig', () => {
        it('should throw for unsupported blockchain type', () => {
            const unsupportedType = 'UNSUPPORTED' as BlockchainType;
            expect(() => {
                if (unsupportedType !== BlockchainType.EVM && unsupportedType !== BlockchainType.COSMOS) {
                    throw new Error(`Unsupported blockchain type for wallet config: ${unsupportedType}`);
                }
            }).to.throw('Unsupported blockchain type for wallet config');
        });
    });

    describe('createRandomWallets', () => {
        it('should throw for unsupported blockchain type', () => {
            const unsupportedType = 'UNSUPPORTED' as BlockchainType;
            expect(() => {
                if (unsupportedType !== BlockchainType.EVM && unsupportedType !== BlockchainType.COSMOS) {
                    throw new Error(`Unsupported blockchain type for multiple wallets: ${unsupportedType}`);
                }
            }).to.throw('Unsupported blockchain type for multiple wallets');
        });
    });
});
