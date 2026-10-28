"use client";

import React from "react";
import { useWallet } from "../lib/hooks";

export function WalletConnect() {
  const { address, network, isConnecting, error, connect, disconnect } = useWallet();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full py-1.5 px-3">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-slate-300 font-mono">
            {truncateAddress(address)}
          </span>
          {network && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {network}
            </span>
          )}
          <button
            type="button"
            onClick={disconnect}
            aria-label="Disconnect wallet"
            className="text-xs text-slate-400 hover:text-rose-400 transition ml-1 px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => connect()}
          disabled={isConnecting}
          aria-label="Connect Freighter wallet"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Connecting...</span>
            </>
          ) : (
            <span>Connect Freighter</span>
          )}
        </button>
      )}

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
          {error}
        </div>
      )}
    </div>
  );
}
