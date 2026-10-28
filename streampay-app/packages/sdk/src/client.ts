import {
  Contract,
  rpc,
  scValToNative,
  nativeToScVal,
  xdr,
  TransactionBuilder,
  Account,
  TimeoutInfinite,
  Address,
} from "@stellar/stellar-sdk";
import {
  Stream,
  ContractError,
  CONTRACT_ERROR_MESSAGES,
  StreamPayClientOptions,
  CreateStreamParams,
} from "./types.js";

/**
 * High-level typed client to interact with StreamPay Soroban smart contract.
 */
export class StreamPayClient {
  public readonly contractId: string;
  public readonly rpcUrl: string;
  public readonly networkPassphrase: string;
  public readonly server: rpc.Server;
  public readonly contract: Contract;

  constructor(opts: StreamPayClientOptions) {
    this.contractId = opts.contractId;
    this.rpcUrl = opts.rpcUrl;
    this.networkPassphrase = opts.networkPassphrase;
    this.server = new rpc.Server(this.rpcUrl);
    this.contract = new Contract(this.contractId);
  }

  /**
   * Helper to fetch on-chain account for transaction building.
   */
  private async getAccount(publicKey: string): Promise<Account> {
    try {
      return await this.server.getAccount(publicKey);
    } catch {
      // Fallback dummy account if not yet activated on Testnet
      return new Account(publicKey, "0");
    }
  }

  /**
   * Simulates a read-only view call and unpacks the returned ScVal.
   */
  private async simulateView(functionName: string, args: xdr.ScVal[] = []): Promise<unknown> {
    const dummyAccount = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0"
    );

    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(functionName, ...args))
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation error: ${sim.error}`);
    }

    if (rpc.Api.isSimulationSuccess(sim)) {
      if (!sim.result) {
        throw new Error("Simulation returned empty result.");
      }
      return scValToNative(sim.result.retval);
    }

    throw new Error("Simulation failed without explicit error result.");
  }

  /**
   * Builds, simulates, and prepares an invokable Soroban transaction XDR.
   */
  public async buildTransaction(
    sourceAddress: string,
    functionName: string,
    args: xdr.ScVal[]
  ): Promise<string> {
    const account = await this.getAccount(sourceAddress);

    let tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(functionName, ...args))
      .setTimeout(TimeoutInfinite)
      .build();

    tx = await this.server.prepareTransaction(tx);
    return tx.toXDR();
  }

  /**
   * Builds prepared transaction XDR for create_stream.
   */
  public async createStream(params: CreateStreamParams): Promise<string> {
    const source = params.source || params.payer;
    const args: xdr.ScVal[] = [
      new Address(params.payer).toScVal(),
      new Address(params.payee).toScVal(),
      nativeToScVal(params.ratePerSecond, { type: "i128" }),
    ];
    return this.buildTransaction(source, "create_stream", args);
  }

  /**
   * Builds prepared transaction XDR for pause.
   */
  public async pause(streamId: bigint, source: string): Promise<string> {
    const args: xdr.ScVal[] = [nativeToScVal(streamId, { type: "u64" })];
    return this.buildTransaction(source, "pause", args);
  }

  /**
   * Builds prepared transaction XDR for resume.
   */
  public async resume(streamId: bigint, source: string): Promise<string> {
    const args: xdr.ScVal[] = [nativeToScVal(streamId, { type: "u64" })];
    return this.buildTransaction(source, "resume", args);
  }

  /**
   * Builds prepared transaction XDR for update_rate.
   */
  public async updateRate(streamId: bigint, newRate: bigint, source: string): Promise<string> {
    const args: xdr.ScVal[] = [
      nativeToScVal(streamId, { type: "u64" }),
      nativeToScVal(newRate, { type: "i128" }),
    ];
    return this.buildTransaction(source, "update_rate", args);
  }

  /**
   * Builds prepared transaction XDR for cancel.
   * If canceller is provided and differs from payer, uses cancel_by.
   */
  public async cancel(streamId: bigint, canceller: string, source?: string): Promise<string> {
    const signingSource = source || canceller;
    const args: xdr.ScVal[] = [
      nativeToScVal(streamId, { type: "u64" }),
      new Address(canceller).toScVal(),
    ];
    return this.buildTransaction(signingSource, "cancel_by", args);
  }

  /**
   * Builds prepared transaction XDR for execute_payment (permissionless).
   */
  public async executePayment(streamId: bigint, source: string): Promise<string> {
    const args: xdr.ScVal[] = [nativeToScVal(streamId, { type: "u64" })];
    return this.buildTransaction(source, "execute_payment", args);
  }

  /**
   * Reads stream metadata for the given stream ID.
   */
  public async getStream(streamId: bigint): Promise<Stream> {
    const args = [nativeToScVal(streamId, { type: "u64" })];
    const raw = (await this.simulateView("get_stream", args)) as {
      cancelled: boolean;
      id: bigint;
      last_paid_ledger: number;
      paused: boolean;
      payer: string;
      payee: string;
      rate_per_second: bigint;
      start_ledger: number;
      total_paid: bigint;
    };

    return {
      id: BigInt(raw.id),
      payer: raw.payer,
      payee: raw.payee,
      ratePerSecond: BigInt(raw.rate_per_second),
      startLedger: Number(raw.start_ledger),
      lastPaidLedger: Number(raw.last_paid_ledger),
      paused: Boolean(raw.paused),
      cancelled: Boolean(raw.cancelled),
      totalPaid: BigInt(raw.total_paid),
    };
  }

  /**
   * Reads amount currently owed to payee.
   */
  public async amountOwed(streamId: bigint): Promise<bigint> {
    const args = [nativeToScVal(streamId, { type: "u64" })];
    const raw = await this.simulateView("amount_owed", args);
    return BigInt(raw as number | bigint | string);
  }

  /**
   * Returns configured SEP-41 token address.
   */
  public async getToken(): Promise<string> {
    const raw = await this.simulateView("get_token");
    return String(raw);
  }

  /**
   * Returns contract admin address.
   */
  public async getAdmin(): Promise<string> {
    const raw = await this.simulateView("get_admin");
    return String(raw);
  }

  /**
   * Submits a signed transaction XDR to the RPC server and polls until confirmation.
   */
  public async submitTransaction(signedXdr: string): Promise<{ hash: string; ledger: number }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const sendResponse = await this.server.sendTransaction(tx);

    if (sendResponse.status === "ERROR") {
      throw new Error(`Submission failed: ${JSON.stringify(sendResponse.errorResult)}`);
    }

    const txHash = sendResponse.hash;

    // Poll until finality
    const maxRetries = 20;
    const intervalMs = 1500;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const statusRes = await this.server.getTransaction(txHash);

      if (statusRes.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          hash: txHash,
          ledger: statusRes.ledger,
        };
      }

      if (statusRes.status === rpc.Api.GetTransactionStatus.FAILED) {
        const errorMsg = this.parseError(statusRes.resultXdr?.toXDR("base64"));
        throw new Error(`Transaction failed on-chain: ${errorMsg}`);
      }
    }

    throw new Error(`Transaction pending timeout for hash: ${txHash}`);
  }

  /**
   * Attempts to parse human-readable ContractError from failed transaction result.
   */
  public parseError(resultXdrBase64?: string): string {
    if (!resultXdrBase64) return "Unknown transaction error.";

    try {
      const result = xdr.TransactionResult.fromXDR(resultXdrBase64, "base64");
      // Check for custom ContractError codes
      const resultStr = resultXdrBase64;
      for (const [codeStr, msg] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
        const codeNum = Number(codeStr);
        if (resultStr.includes(`Error(Contract, #${codeNum})`) || resultStr.includes(`code:${codeNum}`)) {
          return msg;
        }
      }
      return `Transaction reverted: ${result.result().switch().name}`;
    } catch {
      return "Transaction reverted on-chain.";
    }
  }

  /**
   * Maps error code to message.
   */
  public static getErrorMessage(errorCode: ContractError): string {
    return CONTRACT_ERROR_MESSAGES[errorCode] || `Unknown contract error (#${errorCode}).`;
  }
}
