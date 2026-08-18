"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type CommandeHistorique = {
  id: string;
  numero: number | null;
  total: number;
  statut: "en_attente" | "payee" | "echouee" | "expiree";
  created_at: string;
};

// Pas de compte client : on identifie l'historique par numéro de téléphone
// (seule donnée stable saisie à la commande) plutôt que par une session.
export async function rechercherCommandes(telephone: string): Promise<CommandeHistorique[]> {
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;
  const numero = telephone.trim();
  if (!restaurantId || !numero) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("commandes_en_ligne")
    .select("id, total, statut, created_at, commandes(numero)")
    .eq("restaurant_id", restaurantId)
    .eq("client_telephone", numero)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((c) => ({
    id: c.id,
    numero: (c.commandes as unknown as { numero: number } | null)?.numero ?? null,
    total: Number(c.total),
    statut: c.statut,
    created_at: c.created_at,
  }));
}
