"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Réservé à la phase de test tant que Wave/Orange Money ne sont pas
// contractualisés (cf. app/actions.ts). Se referme d'elle-même dès qu'une
// clé réelle est configurée pour le moyen de paiement de la commande, pour
// qu'un lien de simulation ne puisse jamais valider un vrai paiement.
async function simulationAutorisee(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("commandes_en_ligne")
    .select("mode_paiement, statut")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.statut !== "en_attente") return false;

  return data.mode_paiement === "wave" ? !process.env.WAVE_API_KEY : !process.env.ORANGE_MONEY_MERCHANT_KEY;
}

export async function simulerPaiementReussi(id: string): Promise<{ error?: string }> {
  if (!(await simulationAutorisee(id))) {
    return { error: "Simulation indisponible pour cette commande." };
  }

  const supabase = createAdminClient();
  const { data: commandeId } = await supabase.rpc("materialiser_commande_en_ligne", {
    p_id: id,
    p_reference: `SIMULATION-${id}`,
  });

  if (!commandeId) return { error: "Impossible de valider le paiement simulé." };
  return {};
}

export async function simulerPaiementEchec(id: string): Promise<{ error?: string }> {
  if (!(await simulationAutorisee(id))) {
    return { error: "Simulation indisponible pour cette commande." };
  }

  const supabase = createAdminClient();
  await supabase
    .from("commandes_en_ligne")
    .update({ statut: "echouee" })
    .eq("id", id)
    .eq("statut", "en_attente");

  return {};
}
