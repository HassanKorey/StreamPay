"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStreamPayClient,
  signTransactionWithFreighter,
  parseUnits,
  addStoredStreamId,
} from "../lib/stellar";
import { useWallet } from "../lib/hooks";

export function CreateStreamForm() {
  const router = useRouter();
  const { address, connect } = useWallet();

  const [payee, setPayee] = useState<string>("");
  const [rate, setRate] = useState<string>("0.1"); // Default 0.1 USDC/sec (1,000,000 base units)
  const [note, setNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdStreamId, setCreatedStreamId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError("Please connect your Freighter wallet first.");
      return;
    }

    if (!payee || payee.trim().length < 56) {
      setError("Please enter a valid Stellar recipient address (e.g. G...).");
      return;
    }

    if (!rate || Number(rate) <= 0) {
      setError("Please specify a valid payment rate greater than 0.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = getStreamPayClient();
      const ratePerSecond = parseUnits(rate);

      // 1. Build and simulate transaction
      const preparedXdr = await client.createStream({
        payer: address,
        payee: payee.trim(),
        ratePerSecond,
        source: address,
      });

      // 2. Request Freighter signature
      const signedXdr = await signTransactionWithFreighter(preparedXdr);

      // 3. Submit transaction to Soroban RPC
      const res = await client.submitTransaction(signedXdr);

      // 4. Determine created stream ID from contract or query NextStreamId - 1
      // For reliable UX, query NextStreamId from on-chain storage or start from 1
      // We know NextStreamId increments; let's inspect streams or get next
      // If we don't have event parser, we can read stream count or check storage
      let newId = "1";
      try {
        // Probe streams starting from 1 to find the newest stream
        for (let testId = 1n; testId <= 100n; testId++) {
          try {
            const s = await client.getStream(testId);
            if (s.payer.toLowerCase() === address.toLowerCase()) {
              newId = s.id.toString();
            }
          } catch {
            break;
          }
        }
      } catch {
        newId = "1";
      }

      // Add to localStorage
      addStoredStreamId(newId);
      setCreatedStreamId(newId);

      // Save note if provided
      if (note.trim()) {
        localStorage.setItem(`streampay_note_${newId}`, note.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stream.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetRate = (preset: string) => {
    setRate(preset);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-xl dark:shadow-2xl transition-colors">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Create Payment Stream</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Open a continuous, non-custodial streaming transfer of USDC to any Stellar recipient.
        </p>
      </div>

      {createdStreamId ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Stream Created!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Stream ID <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">#{createdStreamId}</span> is now actively accruing on Stellar.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/stream/${createdStreamId}`)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
            >
              View Stream Details
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedStreamId(null);
                setPayee("");
                setNote("");
              }}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition border border-slate-200 dark:border-slate-700"
            >
              Create Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="payee" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Recipient Address (Payee)
            </label>
            <input
              id="payee"
              type="text"
              required
              placeholder="G... or C..."
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="rate" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Payment Rate (USDC per second)
              </label>
              <div className="flex gap-1.5">
                {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetRate(preset)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition ${
                      rate === preset
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                id="rate"
                type="number"
                step="any"
                min="0.0000001"
                required
                placeholder="e.g. 0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition pr-16"
              />
              <span className="absolute right-4 top-3 text-xs font-bold text-slate-400 dark:text-slate-500">
                USDC/s
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              1 USDC = 10,000,000 base units. Rate of 0.1 USDC/s transfers 1,000,000 stroops per ledger.
            </p>
          </div>

          <div>
            <label htmlFor="note" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Optional Note / Label
            </label>
            <input
              id="note"
              type="text"
              placeholder="e.g. Engineering Retainer, Creator Grant, Salary"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition"
            />
          </div>

          {!address ? (
            <button
              type="button"
              onClick={() => connect()}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl text-sm transition"
            >
              Connect Freighter to Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Signing & Submitting to Stellar...</span>
                </>
              ) : (
                <span>Launch Stream</span>
              )}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
