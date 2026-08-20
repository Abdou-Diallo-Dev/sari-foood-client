"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { effacerPaiementEnAttente } from "@/lib/paiement-en-attente";

export function StatutPolling({ enAttente }: { enAttente: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (enAttente) return;
    // Le paiement a une issue définitive (payée/échouée) : plus rien à
    // reprendre, cf. lib/paiement-en-attente.ts.
    effacerPaiementEnAttente();
  }, [enAttente]);

  useEffect(() => {
    if (!enAttente) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [enAttente, router]);

  return null;
}
