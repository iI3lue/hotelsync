// src/components/LoyaltyCard.tsx
"use client";

import { useEffect, useState } from "react";
import { getMyLoyalty } from "../lib/api-loyalty";
import Spinner  from "@/components/Spinner";

const TIER_COLORS: Record<string, string> = {
  silver: "bg-slate-200 text-slate-800 border-slate-300",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  platinum: "bg-indigo-100 text-indigo-800 border-indigo-300",
};

const NEXT_TIER: Record<string, { name: string; min: number }> = {
  silver: { name: "Gold", min: 1000 },
  gold: { name: "Platinum", min: 5000 },
  platinum: { name: "Máximo", min: 5000 },
};

export function LoyaltyCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyLoyalty()
      .then((res) => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 flex justify-center"><Spinner /></div>;
  if (!data) return null;

  const { account, recent_transactions } = data;
  const tierInfo = NEXT_TIER[account.tier];
  const progress = account.tier === "platinum" 
    ? 100 
    : Math.min(100, (account.points_balance / tierInfo.min) * 100);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Mi Fidelización</h2>
          <p className="text-sm text-zinc-500">Acumula puntos con cada estadía</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${TIER_COLORS[account.tier]}`}>
          {account.tier}
        </span>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            {account.points_balance.toLocaleString()} <span className="text-lg text-zinc-500 font-medium">pts</span>
          </p>
          
          {account.tier !== "platinum" && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Progreso hacia {tierInfo.name}</span>
                <span>{tierInfo.min.toLocaleString()} pts</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Actividad Reciente</h3>
          {recent_transactions.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No hay transacciones aún.</p>
          ) : (
            <ul className="space-y-3">
              {recent_transactions.slice(0, 5).map((tx: any) => (
                <li key={tx.transaction_id} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{tx.reason}</span>
                  <span className={`font-medium ${tx.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}