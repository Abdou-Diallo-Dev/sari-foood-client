"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { simulerPaiementReussi, simulerPaiementEchec } from "../actions";

export function PaiementSimuleActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function valider(succes: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = succes ? await simulerPaiementReussi(id) : await simulerPaiementEchec(id);
      if (res.error) {
        setMessage(res.error);
        return;
      }
      router.push(succes ? `/commande/${id}` : `/commande/${id}?erreur=1`);
    });
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        onClick={() => valider(true)}
        disabled={isPending}
        className="rounded-[11px] bg-orange px-4 py-2.5 text-center font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Traitement..." : "Simuler un paiement réussi"}
      </button>
      <button
        onClick={() => valider(false)}
        disabled={isPending}
        className="rounded-[11px] border border-line px-4 py-2.5 text-center font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Simuler un échec
      </button>
      {message && <p className="text-sm font-bold text-red-600">{message}</p>}

      <Link
        href="/"
        className="mt-1 text-center text-sm font-bold text-ink-soft hover:text-orange hover:underline"
      >
        ← Retour
      </Link>
    </div>
  );
}
