"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Stream } from "@streampay/sdk";
import {
  getStreamPayClient,
  formatUnits,
  removeStoredStreamId,
} from "../lib/stellar";

interface StreamCardProps {
  streamId: string;
  onRemove?: () => void;
}

export function StreamCard({ streamId, onRemove }: StreamCardProps) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [amountOwed, setAmountOwed] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined") {
      const savedNote = localStorage.getItem(`streampay_note_${streamId}`);
      if (savedNote) setNote(savedNote);
    }

    const loadData = async () => {
      try {
        const client = getStreamPayClient();
        const idBigInt = BigInt(streamId);
        const [s, owed] = await Promise.all([
          client.getStream(idBigInt),
          client.amountOwed(idBigInt),
        ]);

        if (isMounted) {
          setStream(s);
          setAmountOwed(owed);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Stream not found");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamId]);

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeStoredStreamId(streamId);
    if (onRemove) onRemove();
  };

  const truncate = (addr: string) => `${addr.slice(0, 5)}...${addr.slice(-4)}`;

  if (isLoading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse flex flex-col justify-between h-44">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-800 rounded w-20" />
          <div className="h-4 bg-slate-800 rounded w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-6 bg-slate-800 rounded w-32" />
          <div className="h-3 bg-slate-800 rounded w-48" />
        </div>
        <div className="h-8 bg-slate-800 rounded" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-slate-500">Stream #{streamId}</span>
            <button
              onClick={handleRemove}
              className="text-xs text-slate-500 hover:text-rose-400"
              title="Remove from dashboard"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-rose-400">Unavailable on-chain ({error || "Not found"}).</p>
        </div>
      </div>
    );
  }

  const isStreaming = !stream.paused && !stream.cancelled;

  return (
    <Link
      href={`/stream/${stream.id}`}
      className="group block bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 transition shadow-sm hover:shadow-xl relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
            #{stream.id.toString()}
          </span>
          {note && (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
              {note}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Active
            </span>
          ) : stream.paused ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Paused
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Cancelled
            </span>
          )}

          <button
            onClick={handleRemove}
            className="text-slate-400 hover:text-rose-500 text-xs px-1"
            title="Remove from list"
            aria-label="Remove stream from saved list"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Unclaimed</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition">
            {formatUnits(amountOwed)}
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">USDC</span>
        </div>
      </div>

      <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex justify-between">
          <span>Payer:</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">{truncate(stream.payer)}</span>
        </div>
        <div className="flex justify-between">
          <span>Payee:</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">{truncate(stream.payee)}</span>
        </div>
        <div className="flex justify-between">
          <span>Rate:</span>
          <span className="font-mono text-slate-800 dark:text-slate-200">
            {formatUnits(stream.ratePerSecond)} USDC/sec
          </span>
        </div>
      </div>
    </Link>
  );
}
