import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConfirmationCommandePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: commande } = await supabase
    .from("commandes_en_ligne")
    .select("total, mode_paiement, statut, client_nom, panier")
    .eq("id", id)
    .maybeSingle();

  if (!commande) notFound();

  const estEnAttente = commande.statut === "en_attente";
  const estPayee = commande.statut === "payee";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center">
      {estPayee ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-8 w-8 text-green-600">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Paiement confirmé !
          </h1>
          <p className="text-sm text-ink-soft">
            Votre commande a été validée. Merci pour votre achat chez Sari Food.
          </p>
        </>
      ) : estEnAttente ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-orange">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Commande enregistrée
          </h1>
          <div className="w-full rounded-[14px] border border-orange/30 bg-orange/5 p-4 text-left">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange">
              À faire maintenant
            </p>
            <p className="text-sm font-bold text-ink">
              Payez {Number(commande.total).toLocaleString("fr-FR")} F via Wave
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Votre commande sera confirmée après réception du paiement.
            </p>
          </div>
          <a
            href="https://pay.wave.com/m/M_sn_wKEaRIzrHnhr/c/sn/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-[12px] bg-orange py-3 font-bold text-white transition active:scale-[0.98]"
          >
            Payer via Wave →
          </a>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-8 w-8 text-red-500">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Commande annulée
          </h1>
          <p className="text-sm text-ink-soft">
            Cette commande a été annulée. Vous pouvez passer une nouvelle commande.
          </p>
        </>
      )}

      <Link
        href="/"
        className="text-sm font-bold text-orange hover:underline"
      >
        ← Retour au menu
      </Link>
    </div>
  );
}
