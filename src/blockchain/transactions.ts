/**
 * Blockchain transaction utilities
 *
 * Note: TransactionManager now requires explicit rpcUrl and chainId parameters.
 * These should be obtained from the Blockchain instance.
 */

import { ethers } from 'ethers';
import { expect } from 'chai';
import { Config } from '../utils/common';

/**
 * Transaction manager class
 */
export class TransactionManager {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet | ethers.HDNodeWallet;
    private chainId: number;

    constructor(rpcUrl: string, privateKey?: string, chainId?: number) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey ?? Config.founderWalletPrivateKey, this.provider);
        this.chainId = chainId ?? 0; // Will be fetched from provider if not specified
    }

    /**
     * Get the current provider
     */
    getProvider(): ethers.JsonRpcProvider {
        return this.provider;
    }

    /**
     * Get the current wallet
     */
    getWallet(): ethers.Wallet | ethers.HDNodeWallet {
        return this.wallet;
    }

    /**
     * Get the current chain ID
     */
    getChainId(): number {
        return this.chainId;
    }

    /**
     * Send a transaction
     */
    async sendTransaction(to: string = Config.account, value: string = '0.01', maxPriorityFeePerGas?: bigint) {
        const tx: ethers.TransactionRequest = {
            to,
            value: ethers.parseEther(value),
            maxPriorityFeePerGas,
            chainId: this.chainId,
        };

        const result = await this.wallet.sendTransaction(tx);
        return result;
    }

    /**
     * Send multiple transactions rapidly without waiting for confirmation
     */
    async sendMultipleTransactions(transactions: Array<{ to: string; value: string }>, maxPriorityFeePerGas?: bigint) {
        // Pre-calculate gas price and nonce for all transactions
        const feeData = await this.provider.getFeeData();
        const currentNonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');

        const results = [];

        for (let i = 0; i < transactions.length; i++) {
            const { to, value } = transactions[i];

            const tx: ethers.TransactionRequest = {
                to,
                value: ethers.parseEther(value),
                maxPriorityFeePerGas,
                chainId: this.chainId,
                gasLimit: 21000,
                nonce: currentNonce + i, // Use sequential nonces
            };

            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                tx.maxFeePerGas = feeData.maxFeePerGas;
                tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
            } else {
                tx.gasPrice = feeData.gasPrice;
            }

            const result = await this.wallet.sendTransaction(tx);
            results.push(result);
        }

        return results;
    }

    /**
     * Send a transaction with a specific nonce
     */
    async sendTransactionWithNonce(to: string = Config.account, value: string = '0.01', nonce: number) {
        const tx: ethers.TransactionRequest = {
            to,
            value: ethers.parseEther(value),
            nonce,
            chainId: this.chainId,
        };

        const result = await this.wallet.sendTransaction(tx);
        return result;
    }

    /**
     * Send an unprotected transaction (no chainId)
     */
    async sendUnprotectedTransaction(to: string = Config.account, value: string = '0.01') {
        const tx: ethers.TransactionRequest = {
            to,
            value: ethers.parseEther(value),
        };

        const result = await this.wallet.sendTransaction(tx);
        return result;
    }

    /**
     * Sign a transaction
     */
    async signTransaction(tx: ethers.TransactionRequest) {
        // Ensure the transaction has the correct chainId
        tx.chainId ??= this.chainId;

        const signedTx = await this.wallet.signTransaction(tx);
        return signedTx;
    }

    /**
     * Wait for a specific block number
     */
    async waitForBlockNumber(blockNumber: number) {
        return new Promise<void>(resolve => {
            const checkBlock = async () => {
                const currentBlock = await this.provider.getBlockNumber();
                if (currentBlock >= blockNumber) {
                    resolve();
                } else {
                    setTimeout(checkBlock, 1000);
                }
            };
            void checkBlock();
        });
    }

    /**
     * Get the balance of a wallet
     */
    async getWalletBalance(walletAddress?: string, blockNumber?: number): Promise<any> {
        const address = walletAddress ?? this.wallet.address;
        const block = blockNumber ?? 'latest';

        // Get the wallet balance
        const balance = await this.getProvider().getBalance(address, block);
        const formattedBalance = ethers.formatEther(balance);

        // console.log(`Current balance of ${address} - ${block}: ${formattedBalance}`);
        return formattedBalance;
    }

    /**
     * Create a wallet
     */
    createWallet(privateKey: string = '') {
        if (privateKey) {
            const wallet = new ethers.Wallet(privateKey, this.getProvider());
            return wallet;
        } else {
            const wallet = ethers.Wallet.createRandom(this.getProvider());
            return wallet;
        }
    }
}

/**
 * Test helper for transaction expectations
 */
export async function expectTransaction(
    fromWallet: ethers.Wallet | ethers.HDNodeWallet,
    toAddress: string,
    amount: string,
    provider: ethers.JsonRpcProvider,
    shouldSucceed: boolean,
    errorMessage: string = 'Transaction failed'
): Promise<number> {
    console.log(`Sending ${amount} from ${fromWallet.address} to ${toAddress}`);

    const rpcUrl = (provider as any)._getConnection().url;
    const txManager = new TransactionManager(rpcUrl, fromWallet.privateKey);

    if (shouldSucceed) {
        const response = await expect(txManager.sendTransaction(toAddress, amount)).to.not.be.rejectedWith(Error);
        return response.blockNumber;
    } else {
        console.log('Transaction should fail');
        await expect(txManager.sendTransaction(toAddress, amount)).to.be.rejectedWith(errorMessage);
        return 0;
    }
}

// Legacy compatibility exports
export async function sendTransaction(
    sender?: ethers.HDNodeWallet | ethers.Wallet,
    to?: string,
    value?: string,
    priorityFeePerGas?: bigint,
    defaultProvider?: ethers.JsonRpcProvider
) {
    const rpcUrl = defaultProvider ? (defaultProvider as any)._getConnection().url : undefined;
    const txManager = new TransactionManager(rpcUrl, sender?.privateKey);
    return txManager.sendTransaction(to, value, priorityFeePerGas);
}

export async function sendMultipleTransactions(
    transactions: Array<{ to: string; value: string }>,
    sender?: ethers.HDNodeWallet | ethers.Wallet,
    priorityFeePerGas?: bigint,
    defaultProvider?: ethers.JsonRpcProvider
) {
    const rpcUrl = defaultProvider ? (defaultProvider as any)._getConnection().url : undefined;
    const txManager = new TransactionManager(rpcUrl, sender?.privateKey);
    return txManager.sendMultipleTransactions(transactions, priorityFeePerGas);
}

/**
 * Sign a transaction with a private key
 * @param tx - Transaction to sign
 * @param privateKey - Private key to sign with
 * @param chainId - Optional chain ID (if not set in tx)
 */
export async function signTransaction(tx: any, privateKey: string, chainId?: number): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);

    // Ensure the transaction has the correct chainId
    if (chainId !== undefined) {
        tx.chainId ??= chainId;
    }

    return wallet.signTransaction(tx);
}

/**
 * Wait for blockchain to reach a specific block number
 * Useful for testing scenarios where you need to wait for block progression
 */
export async function waitForBlockNumber(targetBlock: number, provider: ethers.JsonRpcProvider): Promise<void> {
    let currentBlock = await provider.getBlockNumber();
    while (currentBlock < targetBlock) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        currentBlock = await provider.getBlockNumber();
    }
}

export async function getWalletBalance(
    walletAddress?: string,
    blockNumber?: number,
    defaultProvider?: ethers.JsonRpcProvider
) {
    const rpcUrl = defaultProvider ? (defaultProvider as any)._getConnection().url : undefined;
    const txManager = new TransactionManager(rpcUrl);
    return txManager.getWalletBalance(walletAddress, blockNumber);
}

export function createWallet(privateKey: string = '', defaultProvider?: ethers.JsonRpcProvider) {
    const rpcUrl = defaultProvider ? (defaultProvider as any)._getConnection().url : undefined;
    const txManager = new TransactionManager(rpcUrl);
    return txManager.createWallet(privateKey);
}
