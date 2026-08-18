"use client";

export type TicketCommande = {
  numero: number;
  total: number;
  created_at: string;
  restaurantNom: string;
  restaurantAdresse: string | null;
  clientNom: string;
  adresseLivraison: string | null;
  fraisLivraison: number;
  pointsUtilises: number;
};

export type TicketLigne = {
  nom: string;
  quantite: number;
  prix_unitaire: number;
};

export function TicketClient({
  commande,
  lignes,
}: {
  commande: TicketCommande;
  lignes: TicketLigne[];
}) {
  const date = new Date(commande.created_at);
  const dateFormatee = date.toLocaleDateString("fr-FR");
  const heureFormatee = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-paper py-8">
      <style>{`
        @page { size: 80mm auto; margin: 2mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-md justify-center gap-2 px-4">
        <button
          onClick={() => window.print()}
          className="rounded-[9px] bg-orange px-4 py-2 text-sm font-bold text-white"
        >
          Télécharger / Imprimer
        </button>
        <a
          href="/"
          className="rounded-[9px] border border-line px-4 py-2 text-sm font-bold text-ink-soft"
        >
          Retour à l&apos;accueil
        </a>
      </div>

      <div className="mx-auto flex w-[80mm] flex-col gap-3 border border-line bg-white p-4 text-xs text-ink">
        <div className="flex flex-col items-center gap-1 border-b border-dashed border-line pb-3 text-center">
          <span className="font-display text-lg font-extrabold">{commande.restaurantNom}</span>
          {commande.restaurantAdresse && (
            <span className="text-ink-soft">{commande.restaurantAdresse}</span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 border-b border-dashed border-line pb-3">
          <div className="flex justify-between">
            <span className="text-ink-soft">Commande</span>
            <span className="font-bold">n°{commande.numero}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Date</span>
            <span>
              {dateFormatee} à {heureFormatee}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Client</span>
            <span>{commande.clientNom}</span>
          </div>
          {commande.adresseLivraison && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-ink-soft">Livraison</span>
              <span className="text-right">{commande.adresseLivraison}</span>
            </div>
          )}
        </div>

        <table className="w-full border-collapse">
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <td className="py-1 align-top">
                  {l.quantite}× {l.nom}
                  {l.prix_unitaire === 0 && <span className="text-green"> (offert)</span>}
                </td>
                <td className="py-1 text-right align-top font-bold">
                  {(l.quantite * l.prix_unitaire).toLocaleString("fr-FR")} F
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {commande.fraisLivraison > 0 && (
          <div className="flex justify-between border-t border-dashed border-line pt-2">
            <span className="text-ink-soft">Frais de livraison</span>
            <span>{commande.fraisLivraison.toLocaleString("fr-FR")} F</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-dashed border-line pt-3">
          <span className="font-display font-extrabold">Total</span>
          <span className="font-display text-lg font-extrabold">
            {commande.total.toLocaleString("fr-FR")} F
          </span>
        </div>

        <p className="pt-2 text-center text-green">
          {commande.pointsUtilises > 0 && `-${commande.pointsUtilises} pts échangés · `}
          +1 pt fidélité gagné
        </p>
        <p className="text-center text-ink-soft">Merci de votre commande !</p>
      </div>
    </div>
  );
}
