"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStream, useWallet } from "../../../lib/hooks";
import { AmountOwed } from "../../../components/AmountOwed";
import { StreamControls } from "../../../components/StreamControls";
import { formatUnits, USDC_DECIMALS } from "../../../lib/stellar";

export default function StreamDetailPage() {
  const params = useParams();
  const streamId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : null;

  const { stream, amountOwed, isLoading, error, refresh } = useStream(streamId);
  const { address } = useWallet();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-8">
        <div className="h-6 bg-slate-900 rounded w-32 animate-pulse" />
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse" />
        <div className="h-44 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-white">Stream Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {error || "Could not load stream details from Stellar Soroban Testnet."}
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition"
        >
          ← Back to Dashboard
        </Link>
        <span className="font-mono text-xs text-slate-500">
          Stream ID #{stream.id.toString()}
        </span>
      </div>

      {/* Live Amount Owed Ticker */}
      <AmountOwed
        amountOwed={amountOwed}
        ratePerSecond={stream.ratePerSecond}
        paused={stream.paused}
        cancelled={stream.cancelled}
      />

      {/* Stream Controls */}
      <StreamControls
        stream={stream}
        amountOwed={amountOwed}
        connectedAddress={address}
        onSuccess={refresh}
      />

      {/* Stream Details Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Stream Ledger Records
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <span className="block text-slate-500 mb-1">Payer (Sender)</span>
            <span className="font-mono text-slate-200 break-all select-all font-semibold">
              {stream.payer}
            </span>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <span className="block text-slate-500 mb-1">Payee (Recipient)</span>
            <span className="font-mono text-slate-200 break-all select-all font-semibold">
              {stream.payee}
            </span>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <span className="block text-slate-500 mb-1">Total Paid To Date</span>
            <span className="font-mono text-emerald-400 text-base font-extrabold">
              {formatUnits(stream.totalPaid, USDC_DECIMALS)} USDC
            </span>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <span className="block text-slate-500 mb-1">Accrual Timeline</span>
            <div className="font-mono text-slate-300 space-y-0.5">
              <div>Started: Ledger #{stream.startLedger}</div>
              <div>Last Settled: Ledger #{stream.lastPaidLedger}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
