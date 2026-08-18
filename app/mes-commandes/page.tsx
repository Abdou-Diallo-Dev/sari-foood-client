"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lireClientInfo } from "@/lib/client-info";
import { ecrirePanierPrefill } from "@/lib/panier-prefill";
import { obtenirSoldePoints } from "../actions";
import { rechercherCommandes, type CommandeHistorique } from "./actions";

const LABELS_STATUT: Record<CommandeHistorique["statut"], { label: string; couleur: string }> = {
  payee: { label: "Confirmée", couleur: "bg-green" },
  en_attente: { label: "En attente", couleur: "bg-orange" },
  echouee: { label: "Échouée", couleur: "bg-red-600" },
  expiree: { label: "Expirée", couleur: "bg-ink-soft" },
};

export default function MesCommandesPage() {
  const router = useRouter();
  const [telephone, setTelephone] = useState("");
  const [commandes, setCommandes] = useState<CommandeHistorique[] | null>(null);
  const [soldePoints, setSoldePoints] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function commanderANouveau(commande: CommandeHistorique) {
    ecrirePanierPrefill(commande.panier);
    router.push("/");
  }

  useEffect(() => {
    const info = lireClientInfo();
    if (info?.telephone) {
      setTelephone(info.telephone);
      startTransition(async () => {
        setCommandes(await rechercherCommandes(info.telephone));
        setSoldePoints(await obtenirSoldePoints(info.telephone));
      });
    }
  }, []);

  function rechercher() {
    startTransition(async () => {
      setCommandes(await rechercherCommandes(telephone));
      setSoldePoints(await obtenirSoldePoints(telephone));
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-ink">Mes commandes</h1>
        <Link href="/" className="text-sm font-bold text-orange hover:underline">
          Retour au menu
        </Link>
      </header>

      <div className="flex gap-2">
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Votre numéro de téléphone"
          type="tel"
          className="min-w-0 flex-1 rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-orange"
        />
        <button
          onClick={rechercher}
          disabled={!telephone.trim() || isPending}
          className="rounded-[9px] bg-orange px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Recherche..." : "Voir"}
        </button>
      </div>

      {soldePoints !== null && soldePoints > 0 && (
        <p className="rounded-[10px] border border-green/40 bg-green/5 px-3.5 py-2.5 text-sm font-bold text-green">
          🎁 Solde de points fidélité : {soldePoints}
        </p>
      )}

      {commandes === null ? (
        <p className="text-sm text-ink-soft opacity-70">
          Entrez le numéro utilisé lors de vos commandes pour retrouver leur historique.
        </p>
      ) : commandes.length === 0 ? (
        <p className="text-sm text-ink-soft opacity-70">Aucune commande trouvée pour ce numéro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {commandes.map((c) => {
            const statut = LABELS_STATUT[c.statut];
            const date = new Date(c.created_at);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2.5 rounded-[12px] border border-line bg-paper px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${statut.couleur}`}
                      title={statut.label}
                    />
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {c.numero ? `Commande n°${c.numero}` : "Commande"}
                      </p>
                      <p className="text-xs text-ink-soft opacity-70">
                        {date.toLocaleDateString("fr-FR")} à{" "}
                        {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {statut.label}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-ink">{c.total.toLocaleString("fr-FR")} F</span>
                </div>

                {c.adresseLivraison && (
                  <p className="text-xs text-ink-soft">Livraison : {c.adresseLivraison}</p>
                )}

                <div className="flex items-center gap-3 border-t border-line pt-2">
                  <button
                    onClick={() => commanderANouveau(c)}
                    className="text-xs font-bold text-orange hover:underline"
                  >
                    Commander à nouveau
                  </button>
                  {c.statut === "payee" && (
                    <Link
                      href={`/commande/${c.id}/ticket`}
                      target="_blank"
                      className="text-xs font-bold text-ink-soft hover:underline"
                    >
                      Ticket
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
