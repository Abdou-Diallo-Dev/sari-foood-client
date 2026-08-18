import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TicketClient } from "./ticket-client";

export default async function TicketCommandePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: commandeEnLigne } = await supabase
    .from("commandes_en_ligne")
    .select("client_nom, client_telephone, adresse_livraison, frais_livraison, statut, commande_id")
    .eq("id", id)
    .maybeSingle();

  if (!commandeEnLigne?.commande_id || commandeEnLigne.statut !== "payee") notFound();

  const [{ data: commande }, { data: lignes }] = await Promise.all([
    supabase
      .from("commandes")
      .select("numero, total, created_at, restaurants(nom, adresse)")
      .eq("id", commandeEnLigne.commande_id)
      .single(),
    supabase
      .from("lignes_commande")
      .select("quantite, prix_unitaire, produits(nom)")
      .eq("commande_id", commandeEnLigne.commande_id),
  ]);

  if (!commande) notFound();

  const restaurant = commande.restaurants as unknown as { nom: string; adresse: string | null } | null;

  return (
    <TicketClient
      commande={{
        numero: commande.numero,
        total: Number(commande.total),
        created_at: commande.created_at,
        restaurantNom: restaurant?.nom ?? "Sari Food",
        restaurantAdresse: restaurant?.adresse ?? null,
        clientNom: commandeEnLigne.client_nom,
        adresseLivraison: commandeEnLigne.adresse_livraison,
        fraisLivraison: Number(commandeEnLigne.frais_livraison),
      }}
      lignes={(lignes ?? []).map((l) => ({
        nom: (l.produits as unknown as { nom: string } | null)?.nom ?? "",
        quantite: l.quantite,
        prix_unitaire: Number(l.prix_unitaire),
      }))}
    />
  );
}
