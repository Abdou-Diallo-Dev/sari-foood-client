import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaiementSimuleActions } from "./actions-client";

const LABELS_MODE: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
};

export default async function PaiementSimulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: commandeEnLigne } = await supabase
    .from("commandes_en_ligne")
    .select("total, mode_paiement, statut")
    .eq("id", id)
    .maybeSingle();

  if (!commandeEnLigne) notFound();

  const cleManquante =
    commandeEnLigne.mode_paiement === "wave"
      ? !process.env.WAVE_API_KEY
      : !process.env.ORANGE_MONEY_MERCHANT_KEY;

  if (!cleManquante || commandeEnLigne.statut !== "en_attente") notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
      <span className="rounded-full border border-orange px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange">
        Mode test — paiement simulé
      </span>
      <h1 className="font-display text-xl font-extrabold text-ink">
        Paiement {LABELS_MODE[commandeEnLigne.mode_paiement] ?? commandeEnLigne.mode_paiement}
      </h1>
      <p className="text-sm text-ink-soft">
        Les identifiants {LABELS_MODE[commandeEnLigne.mode_paiement]} ne sont pas encore configurés.
        Cet écran simule l&apos;issue du paiement pour tester la commande de bout en bout.
      </p>
      <p className="font-display text-2xl font-extrabold text-ink">
        {Number(commandeEnLigne.total).toLocaleString("fr-FR")} F
      </p>

      <PaiementSimuleActions id={id} />
    </div>
  );
}
