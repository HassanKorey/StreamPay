"use client";

import { useState, useEffect, useCallback } from "react";
import {
  connectFreighterWallet,
  isFreighterInstalled,
  getStreamPayClient,
} from "./stellar";
import { Stream } from "@streampay/sdk";

const WALLET_STORAGE_KEY = "streampay_wallet_address";

export interface WalletState {
  address: string | null;
  network: string | null;
  isInstalled: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook to manage Freighter wallet state with local storage persistence.
 */
export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isFreighterInstalled().then(setIsInstalled);

    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      setAddress(saved);
      setNetwork("TESTNET");
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const details = await connectFreighterWallet();
      setAddress(details.address);
      setNetwork(details.network || "TESTNET");
      localStorage.setItem(WALLET_STORAGE_KEY, details.address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect Freighter wallet.";
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setError(null);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  return {
    address,
    network,
    isInstalled,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}

/**
 * Hook to poll live stream details and amount owed every 5-10 seconds.
 */
export function useStream(streamId: string | null) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [amountOwed, setAmountOwed] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreamData = useCallback(async () => {
    if (!streamId) return;

    try {
      const client = getStreamPayClient();
      const idBigInt = BigInt(streamId);
      const [streamData, owed] = await Promise.all([
        client.getStream(idBigInt),
        client.amountOwed(idBigInt),
      ]);

      setStream(streamData);
      setAmountOwed(owed);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load stream details.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    fetchStreamData();

    // Poll every 5 seconds to keep amountOwed in sync with Stellar ledgers
    const interval = setInterval(fetchStreamData, 5000);
    return () => clearInterval(interval);
  }, [fetchStreamData]);

  return {
    stream,
    amountOwed,
    isLoading,
    error,
    refresh: fetchStreamData,
  };
}
