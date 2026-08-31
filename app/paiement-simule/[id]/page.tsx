import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatutPolling } from "@/app/commande/[id]/statut-polling";
import { WAVE_PAYMENT_URL } from "@/lib/types";

export default async function ConfirmationCommandePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: commande } = await supabase
    .from("commandes_en_ligne")
    .select("total, mode_paiement, statut, client_nom, panier, commande_id")
    .eq("id", id)
    .maybeSingle();

  if (!commande) notFound();

  const estEnAttente = commande.statut === "en_attente";
  const estPayee = commande.statut === "payee";

  let numeroCommande: number | null = null;
  if (commande.commande_id) {
    const { data: c } = await supabase
      .from("commandes")
      .select("numero")
      .eq("id", commande.commande_id)
      .maybeSingle();
    numeroCommande = c?.numero ?? null;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12 text-center">
      {/* Polling automatique du statut : s'actualise dès que la caisse valide la commande */}
      <StatutPolling enAttente={estEnAttente} />

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
            {numeroCommande
              ? `Votre commande n°${numeroCommande} a été validée et transmise en cuisine.`
              : "Votre commande a été validée. Merci pour votre achat chez Sari Food."}
          </p>

          <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
            <a
              href={`/commande/${id}/ticket`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-[12px] bg-orange py-3 font-bold text-white transition hover:bg-orange/90"
            >
              Télécharger le ticket
            </a>
            <Link
              href="/"
              className="flex-1 rounded-[12px] border border-line py-3 font-bold text-ink-soft transition hover:border-orange hover:text-orange"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </>
      ) : estEnAttente ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-orange">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">
              Commande enregistrée
            </h1>
            <p className="mt-1 text-xs text-ink-soft">
              Finalisez votre paiement via Wave pour lancer la préparation.
            </p>
          </div>

          <div className="w-full rounded-[16px] border border-orange/30 bg-orange/5 p-5 text-left shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-orange">
              Montant à régler
            </p>
            <p className="font-display text-2xl font-black text-ink">
              {Number(commande.total).toLocaleString("fr-FR")} F CFA
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              Bénéficiaire : <strong className="text-ink">Sari Food</strong>
            </p>
          </div>

          {/* Bouton de paiement direct : le clic utilisateur permet à iOS/Android d'ouvrir l'app Wave */}
          <a
            href={WAVE_PAYMENT_URL}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#1DC8FF] py-3.5 text-base font-bold text-white shadow transition hover:opacity-95 active:scale-[0.98]"
          >
            <span>Ouvrir l&apos;application Wave</span>
            <span aria-hidden="true">→</span>
          </a>

          <div className="w-full rounded-[12px] bg-bg-soft/70 p-3.5 text-left text-xs text-ink-soft space-y-2">
            <p className="font-semibold text-ink">💡 Comment ça se passe ?</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Cliquez sur le bouton ci-dessus pour ouvrir Wave et payer le montant exact.</li>
              <li>Revenez sur cette page : elle s&apos;actualisera automatiquement dès confirmation par le restaurant.</li>
            </ol>
            <p className="text-[11px] text-ink-soft/80 border-t border-line/60 pt-2">
              <strong className="text-ink-soft">Sur iPhone :</strong> Si l&apos;App Store s&apos;ouvre au lieu de l&apos;application, faites un <strong>appui long</strong> sur le bouton ci-dessus et choisissez <em>« Ouvrir dans Wave »</em>.
            </p>
          </div>
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
            Commande non finalisée
          </h1>
          <p className="text-sm text-ink-soft">
            Cette commande n&apos;a pas pu être validée. Vous pouvez passer une nouvelle commande.
          </p>
          <Link
            href="/"
            className="w-full rounded-[12px] bg-orange py-3 font-bold text-white transition hover:bg-orange/90"
          >
            Retour au menu
          </Link>
        </>
      )}

      {estEnAttente && (
        <Link
          href="/"
          className="text-xs font-semibold text-ink-soft hover:text-orange transition"
        >
          ← Revenir à l&apos;accueil
        </Link>
      )}
    </div>
  );
}
