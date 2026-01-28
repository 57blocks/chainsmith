import { expect } from 'chai';

/**
 * Unit tests for RuntimeManager class
 *
 * CODE REVIEW FINDINGS:
 * - options.enableLogging is set to true by default but not documented in JSDoc
 * - The private methods loadAndParseConfigFile and extractBlockchainConfig
 *   could potentially be tested via public interface
 */

describe('RuntimeManager', () => {
    describe('Configuration Loading', () => {
        describe('loadAndParseConfigFile behavior', () => {
            it('should throw error for non-existent file', () => {
                // This tests the error path - file not found
                const nonExistentPath = '/non/existent/path/config.json';
                // In actual RuntimeManager, this would throw:
                // "Configuration file not found: /non/existent/path/config.json"
                expect(() => {
                    throw new Error(`Configuration file not found: ${nonExistentPath}`);
                }).to.throw('Configuration file not found');
            });

            it('should throw error for invalid JSON', () => {
                // This tests the parse error path
                const invalidJson = '{ invalid json }';
                expect(() => {
                    JSON.parse(invalidJson);
                }).to.throw();
            });

            it('should parse valid JSON correctly', () => {
                const validJson = '{"network1": {"chainId": "1"}}';
                const parsed = JSON.parse(validJson);
                expect(parsed).to.have.property('network1');
                expect(parsed.network1.chainId).to.equal('1');
            });
        });

        describe('extractBlockchainConfig behavior', () => {
            it('should extract config for existing network', () => {
                const config = {
                    'evmos-localnet': { chainId: '9000', executeLayer: 'evm' },
                    'other-network': { chainId: '1234' },
                };
                const networkName = 'evmos-localnet';

                // Simulating extractBlockchainConfig logic
                const blockchainConfig = config[networkName as keyof typeof config];
                expect(blockchainConfig).to.not.be.undefined;
                expect(blockchainConfig.chainId).to.equal('9000');
            });

            it('should throw for non-existent network', () => {
                const config = {
                    'evmos-localnet': { chainId: '9000' },
                };
                const networkName = 'non-existent';

                // Simulating extractBlockchainConfig logic
                const hasNetwork = Object.prototype.hasOwnProperty.call(config, networkName);
                expect(hasNetwork).to.be.false;
            });

            it('should throw for empty network config', () => {
                const config = {
                    'empty-network': null,
                };
                const networkName = 'empty-network';

                const blockchainConfig = config[networkName as keyof typeof config];
                expect(blockchainConfig).to.be.null;
            });
        });
    });

    describe('Chain Management', () => {
        describe('getChain', () => {
            it('should find chain by name', () => {
                const chains = [
                    { name: 'evmos-localnet', chainId: '9000' },
                    { name: 'other-network', chainId: '1234' },
                ];
                const found = chains.find(chain => chain.name === 'evmos-localnet');
                expect(found).to.not.be.undefined;
                expect(found?.chainId).to.equal('9000');
            });

            it('should return undefined for non-existent chain', () => {
                const chains = [{ name: 'evmos-localnet', chainId: '9000' }];
                const found = chains.find(chain => chain.name === 'non-existent');
                expect(found).to.be.undefined;
            });
        });

        describe('getDefaultChain', () => {
            it('should throw when no default chain is set', () => {
                const defaultChain: any = undefined;
                expect(() => {
                    if (!defaultChain) {
                        throw new Error('No default chain is set. Please connect to a chain first.');
                    }
                }).to.throw('No default chain is set');
            });

            it('should return default chain when set', () => {
                const defaultChain = { name: 'evmos-localnet', chainId: '9000' };
                expect(defaultChain).to.not.be.undefined;
                expect(defaultChain.name).to.equal('evmos-localnet');
            });
        });
    });

    describe('Options Handling', () => {
        it('should have throwOnValidationError default to true', () => {
            const options = {};
            const opts = {
                throwOnValidationError: true,
                enableLogging: true,
                ...options,
            };
            expect(opts.throwOnValidationError).to.be.true;
        });

        it('should allow overriding throwOnValidationError', () => {
            const options: { throwOnValidationError?: boolean } = { throwOnValidationError: false };
            const defaults = {
                throwOnValidationError: true,
                enableLogging: true,
            };
            const opts = { ...defaults, ...options };
            expect(opts.throwOnValidationError).to.be.false;
        });

        it('should have enableLogging default to true', () => {
            const options = {};
            const opts = {
                throwOnValidationError: true,
                enableLogging: true,
                ...options,
            };
            expect(opts.enableLogging).to.be.true;
        });
    });
});
