"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StreamCard } from "../components/StreamCard";
import { getStoredStreamIds, addStoredStreamId } from "../lib/stellar";
import { useWallet } from "../lib/hooks";

export default function DashboardPage() {
  const { address } = useWallet();
  const [streamIds, setStreamIds] = useState<string[]>([]);
  const [manualIdInput, setManualIdInput] = useState<string>("");

  const loadStreams = () => {
    const stored = getStoredStreamIds();
    // Default to at least stream #1 for easy demo review if list is empty
    if (stored.length === 0) {
      setStreamIds(["1"]);
    } else {
      setStreamIds(stored);
    }
  };

  useEffect(() => {
    loadStreams();
  }, []);

  const handleAddManualId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualIdInput.trim().replace(/^#/, "");
    if (!cleanId || isNaN(Number(cleanId))) return;

    addStoredStreamId(cleanId);
    setManualIdInput("");
    loadStreams();
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span>Stellar Soroban Wave 11</span>
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span>Non-Custodial Streaming</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Continuous value transfer on Stellar.
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Stream USDC per second trustlessly. Settle accrued balances permissionlessly. Either party can pause, resume, or cancel anytime.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/create"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <span>+ Open New Stream</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Streams Header & Manual Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-xl font-bold text-white">Tracked Streams</h2>
          <p className="text-xs text-slate-400">
            Streams saved in your local index or created with your account.
          </p>
        </div>

        {/* Search / Track by ID */}
        <form onSubmit={handleAddManualId} className="flex gap-2">
          <input
            type="text"
            placeholder="Track stream ID (e.g. 1)"
            value={manualIdInput}
            onChange={(e) => setManualIdInput(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500 w-44"
          />
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition border border-slate-700"
          >
            Track
          </button>
        </form>
      </div>

      {/* Grid of Streams */}
      {streamIds.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto text-xl text-slate-500">
            ≋
          </div>
          <h3 className="text-base font-bold text-slate-300">No streams tracked yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first per-second payment stream or track an existing stream by ID.
          </p>
          <div className="pt-2">
            <Link
              href="/create"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              Create Stream
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {streamIds.map((id) => (
            <StreamCard key={id} streamId={id} onRemove={loadStreams} />
          ))}
        </div>
      )}
    </div>
  );
}
