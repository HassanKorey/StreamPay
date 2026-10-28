/**
 * Represents a payment stream matching the on-chain Soroban Stream struct.
 */
export interface Stream {
  id: bigint;
  payer: string;
  payee: string;
  ratePerSecond: bigint;
  startLedger: number;
  lastPaidLedger: number;
  paused: boolean;
  cancelled: boolean;
  totalPaid: bigint;
}

/**
 * Custom contract errors mapping 1-to-1 with ContractError enum.
 */
export enum ContractError {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  Unauthorized = 3,
  StreamNotFound = 4,
  StreamAlreadyPaused = 5,
  StreamNotPaused = 6,
  StreamCancelled = 7,
  InvalidRate = 8,
  Overflow = 9,
  InsufficientBalance = 10,
  InvalidToken = 11,
}

/**
 * Human-friendly error messages for each ContractError.
 */
export const CONTRACT_ERROR_MESSAGES: Record<ContractError, string> = {
  [ContractError.AlreadyInitialized]: "Contract is already initialized.",
  [ContractError.NotInitialized]: "Contract has not been initialized yet.",
  [ContractError.Unauthorized]: "Unauthorized: you do not have permission to execute this operation.",
  [ContractError.StreamNotFound]: "Stream not found. Please verify the Stream ID.",
  [ContractError.StreamAlreadyPaused]: "Stream is already paused.",
  [ContractError.StreamNotPaused]: "Stream is active and cannot be resumed.",
  [ContractError.StreamCancelled]: "Stream has been cancelled and cannot be modified.",
  [ContractError.InvalidRate]: "Invalid rate: payment rate must be strictly positive.",
  [ContractError.Overflow]: "Arithmetic overflow occurred in computation.",
  [ContractError.InsufficientBalance]: "Insufficient token balance or allowance to process transfer.",
  [ContractError.InvalidToken]: "Invalid token contract address.",
};

/**
 * Options to instantiate StreamPayClient.
 */
export interface StreamPayClientOptions {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

/**
 * Parameters to create a new stream.
 */
export interface CreateStreamParams {
  payer: string;
  payee: string;
  ratePerSecond: bigint;
  source?: string;
}
