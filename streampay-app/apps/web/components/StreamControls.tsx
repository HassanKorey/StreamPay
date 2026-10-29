"use client";

import React, { useState } from "react";
import { Stream } from "@streampay/sdk";
import {
  getStreamPayClient,
  signTransactionWithFreighter,
  parseUnits,
  formatUnits,
} from "../lib/stellar";

interface StreamControlsProps {
  stream: Stream;
  amountOwed: bigint;
  connectedAddress: string | null;
  onSuccess: () => Promise<void>;
}

export function StreamControls({
  stream,
  amountOwed,
  connectedAddress,
  onSuccess,
}: StreamControlsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update Rate input state
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [newRateInput, setNewRateInput] = useState<string>("");

  const isPayer = Boolean(
    connectedAddress &&
      connectedAddress.toLowerCase() === stream.payer.toLowerCase()
  );
  const isPayee = Boolean(
    connectedAddress &&
      connectedAddress.toLowerCase() === stream.payee.toLowerCase()
  );

  const client = getStreamPayClient();

  const handleExecutePayment = async () => {
    if (!connectedAddress) {
      setError("Please connect your Freighter wallet to execute payment.");
      return;
    }

    setLoadingAction("execute");
    setError(null);
    setSuccessMessage(null);

    try {
      const preparedXdr = await client.executePayment(stream.id, connectedAddress);
      const signedXdr = await signTransactionWithFreighter(preparedXdr);
      const res = await client.submitTransaction(signedXdr);
      setSuccessMessage(`Payment executed successfully in ledger ${res.ledger}!`);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute payment.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePause = async () => {
    if (!connectedAddress) return;
    setLoadingAction("pause");
    setError(null);
    setSuccessMessage(null);

    try {
      const preparedXdr = await client.pause(stream.id, connectedAddress);
      const signedXdr = await signTransactionWithFreighter(preparedXdr);
      const res = await client.submitTransaction(signedXdr);
      setSuccessMessage(`Stream paused successfully in ledger ${res.ledger}!`);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause stream.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResume = async () => {
    if (!connectedAddress) return;
    setLoadingAction("resume");
    setError(null);
    setSuccessMessage(null);

    try {
      const preparedXdr = await client.resume(stream.id, connectedAddress);
      const signedXdr = await signTransactionWithFreighter(preparedXdr);
      const res = await client.submitTransaction(signedXdr);
      setSuccessMessage(`Stream resumed successfully in ledger ${res.ledger}!`);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume stream.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!connectedAddress) return;
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this stream? Any remaining accrued balance will be settled immediately."
    );
    if (!confirmCancel) return;

    setLoadingAction("cancel");
    setError(null);
    setSuccessMessage(null);

    try {
      const preparedXdr = await client.cancel(
        stream.id,
        connectedAddress,
        connectedAddress
      );
      const signedXdr = await signTransactionWithFreighter(preparedXdr);
      const res = await client.submitTransaction(signedXdr);
      setSuccessMessage(`Stream cancelled successfully in ledger ${res.ledger}!`);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel stream.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectedAddress) return;
    if (!newRateInput || Number(newRateInput) <= 0) {
      setError("Rate must be greater than zero.");
      return;
    }

    setLoadingAction("update_rate");
    setError(null);
    setSuccessMessage(null);

    try {
      const newRateBigInt = parseUnits(newRateInput);
      const preparedXdr = await client.updateRate(
        stream.id,
        newRateBigInt,
        connectedAddress
      );
      const signedXdr = await signTransactionWithFreighter(preparedXdr);
      const res = await client.submitTransaction(signedXdr);
      setSuccessMessage(`Rate updated to ${newRateInput} USDC/sec in ledger ${res.ledger}!`);
      setShowRateModal(false);
      setNewRateInput("");
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rate.");
    } finally {
      setLoadingAction(null);
    }
  };

  if (stream.cancelled) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center transition-colors">
        <span className="text-sm font-semibold text-rose-500 dark:text-rose-400">
          This payment stream is cancelled and closed.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Actions
        </h3>
        {connectedAddress && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Role:{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {isPayer ? "Payer (Sender)" : isPayee ? "Payee (Recipient)" : "Viewer"}
            </span>
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Permissionless Settlement: anyone can execute if balance > 0 */}
        <button
          type="button"
          onClick={handleExecutePayment}
          disabled={loadingAction !== null || amountOwed <= 0n}
          aria-label="Execute stream settlement payment"
          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/10 flex items-center gap-2"
        >
          {loadingAction === "execute" ? (
            <span>Settling...</span>
          ) : (
            <span>Execute Payment ({formatUnits(amountOwed)} USDC)</span>
          )}
        </button>

        {/* Payer Only: Pause */}
        {isPayer && !stream.paused && (
          <button
            type="button"
            onClick={handlePause}
            disabled={loadingAction !== null}
            aria-label="Pause stream"
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold px-4 py-2.5 rounded-xl text-sm transition"
          >
            {loadingAction === "pause" ? "Pausing..." : "Pause Stream"}
          </button>
        )}

        {/* Payer Only: Resume */}
        {isPayer && stream.paused && (
          <button
            type="button"
            onClick={handleResume}
            disabled={loadingAction !== null}
            aria-label="Resume stream"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold px-4 py-2.5 rounded-xl text-sm transition"
          >
            {loadingAction === "resume" ? "Resuming..." : "Resume Stream"}
          </button>
        )}

        {/* Payer Only: Update Rate */}
        {isPayer && (
          <button
            type="button"
            onClick={() => setShowRateModal(true)}
            disabled={loadingAction !== null}
            aria-label="Update stream rate"
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-sm transition border border-slate-300 dark:border-slate-700"
          >
            Update Rate
          </button>
        )}

        {/* Payer OR Payee: Cancel */}
        {(isPayer || isPayee) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loadingAction !== null}
            aria-label="Cancel stream"
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold px-4 py-2.5 rounded-xl text-sm transition ml-auto"
          >
            {loadingAction === "cancel" ? "Cancelling..." : "Cancel Stream"}
          </button>
        )}
      </div>

      {/* Update Rate Modal / Dropdown */}
      {showRateModal && (
        <form
          onSubmit={handleUpdateRate}
          className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 mt-3 transition-colors"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Update Per-Second Rate
            </span>
            <button
              type="button"
              onClick={() => setShowRateModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0.0000001"
              required
              placeholder="e.g. 0.2"
              value={newRateInput}
              onChange={(e) => setNewRateInput(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white font-mono flex-1 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loadingAction === "update_rate"}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loadingAction === "update_rate" ? "Updating..." : "Save Rate"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
