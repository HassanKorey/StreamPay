"use client";

import React from "react";
import { formatUnits, USDC_DECIMALS } from "../lib/stellar";

interface AmountOwedProps {
  amountOwed: bigint;
  ratePerSecond: bigint;
  paused: boolean;
  cancelled: boolean;
}

export function AmountOwed({
  amountOwed,
  ratePerSecond,
  paused,
  cancelled,
}: AmountOwedProps) {
  const isStreaming = !paused && !cancelled;
  const formattedOwed = formatUnits(amountOwed, USDC_DECIMALS);
  const formattedRate = formatUnits(ratePerSecond, USDC_DECIMALS);

  // Approximate per-minute and per-hour rates for user context (assuming ~5s ledger or 1/s rate)
  const rateNum = Number(formattedRate);
  const perMinute = (rateNum * 60).toFixed(4);
  const perHour = (rateNum * 3600).toFixed(2);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-sm transition-colors">
      {isStreaming && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
          Unclaimed Balance
        </span>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Live Accruing
            </span>
          ) : paused ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
              Paused
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 dark:bg-rose-400" />
              Cancelled
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
          {formattedOwed}
        </span>
        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">USDC</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-xs">
        <div>
          <span className="block text-slate-500 dark:text-slate-400">Flow Rate</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
            {formattedRate} USDC / sec
          </span>
        </div>
        <div>
          <span className="block text-slate-500 dark:text-slate-400">Est. / minute</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
            ~{perMinute} USDC
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="block text-slate-500 dark:text-slate-400">Est. / hour</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
            ~{perHour} USDC
          </span>
        </div>
      </div>
    </div>
  );
}
