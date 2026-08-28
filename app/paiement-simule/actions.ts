"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Mode simulation uniquement : n'autorise la validation/l'échec simulé que
// tant que la commande est encore en attente de paiement.
async function simulationAutorisee(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("commandes_en_ligne")
    .select("statut")
    .eq("id", id)
    .maybeSingle();

  return !!data && data.statut === "en_attente";
}

export async function simulerPaiementReussi(id: string): Promise<{ error?: string }> {
  if (!(await simulationAutorisee(id))) {
    return { error: "Simulation indisponible pour cette commande." };
  }

  // materialiser_commande_en_ligne revérifie et re-résout elle-même la
  // session de caisse à cet instant (migration 0034) — jamais la valeur
  // figée à la commande, qui a pu fermer entre-temps. Un renvoi vide ici
  // ne signifie donc pas "pas de caisse", seulement "commande introuvable
  // ou déjà traitée".
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
