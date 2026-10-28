import React from "react";
import Link from "next/link";
import { CreateStreamForm } from "../../components/CreateStreamForm";

export default function CreateStreamPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition mb-2"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <CreateStreamForm />
    </div>
  );
}
