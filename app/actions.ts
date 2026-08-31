"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { type PanierItem, type ModePaiement, WAVE_PAYMENT_URL } from "@/lib/types";


// Pas de solde stocké : on additionne le ledger points_fidelite_mouvements
// (+1/commande payée, -coût lors d'un échange — cf. migration 0031).
export async function obtenirSoldePoints(telephone: string): Promise<number> {
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;
  const numero = telephone.trim();
  if (!restaurantId || !numero) return 0;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("points_fidelite_mouvements")
    .select("delta")
    .eq("restaurant_id", restaurantId)
    .eq("client_telephone", numero);

  return (data ?? []).reduce((s, m) => s + m.delta, 0);
}

// Pour le bandeau "Reprendre mon paiement en attente" (lib/paiement-en-attente.ts) :
// ne propose une reprise que si la commande est toujours en attente.
export async function verifierPaiementEnAttente(
  commandeId: string,
): Promise<{ enAttente: boolean; urlReprise?: string }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("commandes_en_ligne")
    .select("statut")
    .eq("id", commandeId)
    .maybeSingle();

  if (!data || data.statut !== "en_attente") return { enAttente: false };

  return { enAttente: true, urlReprise: `/paiement-simule/${commandeId}` };
}

export async function creerCommandeEnLigne(params: {
  clientNom: string;
  clientTelephone: string;
  adresseLivraison: string;
  zoneLivraisonId: string | null;
  modePaiement: ModePaiement;
  panier: PanierItem[];
}): Promise<{ error?: string; url?: string; commandeId?: string }> {
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;
  if (!restaurantId) return { error: "Configuration du site incomplète." };

  const clientNom = params.clientNom.trim();
  const clientTelephone = params.clientTelephone.trim();
  const adresseLivraison = params.adresseLivraison.trim();
  if (!clientNom) return { error: "Le nom est obligatoire." };
  if (!clientTelephone) return { error: "Le numéro de téléphone est obligatoire." };
  if (!adresseLivraison) return { error: "L'adresse de livraison est obligatoire." };
  if (params.panier.length === 0) return { error: "Le panier est vide." };
  if (params.modePaiement !== "wave") {
    return { error: "Moyen de paiement invalide." };
  }

  const supabase = createAdminClient();

  // Filtre UX best-effort : évite d'engager un client dans un paiement s'il
  // n'y a déjà aucune caisse ouverte. Ce n'est PAS la garantie finale — le
  // paiement Wave/Orange Money se confirme de façon asynchrone (webhook),
  // parfois bien après ce point, et la session ci-dessous peut avoir
  // fermé entre-temps. La vérification qui compte réellement est celle,
  // atomique, faite dans materialiser_commande_en_ligne au moment de la
  // confirmation (migration 0034) — elle seule décide de la session à
  // rattacher, jamais la valeur figée ici.
  const { data: sessionOuverte } = await supabase
    .from("sessions_caisse")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("statut", "ouverte")
    .order("ouverte_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!sessionOuverte) {
    return { error: "Les commandes en ligne sont momentanément indisponibles. Réessayez un peu plus tard." };
  }

  // On ne fait jamais confiance au panier envoyé par le navigateur pour le
  // prix : chaque article est revérifié (existe, actif, bon restaurant) et
  // son prix/pôle recalculés depuis produits/categories_produits. Idem pour
  // un article échangé contre des points : le coût vient de produits.cout_points,
  // jamais du navigateur.
  const produitIds = [...new Set(params.panier.map((i) => i.produit_id))];
  const { data: produits, error: produitsError } = await supabase
    .from("produits")
    .select("id, nom, prix, actif, restaurant_id, cout_points, categories_produits(pole)")
    .in("id", produitIds);

  if (produitsError || !produits) return { error: "Impossible de vérifier le panier." };

  const panierValide: {
    produit_id: string;
    nom: string;
    pole: string;
    quantite: number;
    prix_unitaire: number;
  }[] = [];
  let total = 0;
  let pointsUtilises = 0;

  for (const item of params.panier) {
    const produit = produits.find((p) => p.id === item.produit_id);
    const pole = (produit?.categories_produits as unknown as { pole: string } | null)?.pole;

    if (
      !produit ||
      !produit.actif ||
      produit.restaurant_id !== restaurantId ||
      !pole ||
      !Number.isFinite(item.quantite) ||
      item.quantite <= 0
    ) {
      return { error: `Un article du panier n'est plus disponible (${produit?.nom ?? "inconnu"}).` };
    }

    if (item.avecPoints) {
      if (!produit.cout_points) {
        return { error: `${produit.nom} ne peut pas être échangé contre des points.` };
      }
      pointsUtilises += produit.cout_points * item.quantite;
      panierValide.push({
        produit_id: produit.id,
        nom: produit.nom,
        pole,
        quantite: item.quantite,
        prix_unitaire: 0,
      });
      continue;
    }

    const prixUnitaire = Number(produit.prix);
    panierValide.push({
      produit_id: produit.id,
      nom: produit.nom,
      pole,
      quantite: item.quantite,
      prix_unitaire: prixUnitaire,
    });
    total += prixUnitaire * item.quantite;
  }

  if (pointsUtilises > 0) {
    const solde = await obtenirSoldePoints(clientTelephone);
    if (pointsUtilises > solde) {
      return { error: "Solde de points insuffisant pour l'échange demandé." };
    }
  }

  // Comme pour les articles : le frais de livraison vient de la base, jamais
  // du navigateur (le manager le fixe par zone, cf. admin/livraison).
  let fraisLivraison = 0;
  if (params.zoneLivraisonId) {
    const { data: zone } = await supabase
      .from("zones_livraison")
      .select("frais, actif, restaurant_id")
      .eq("id", params.zoneLivraisonId)
      .maybeSingle();

    if (!zone || !zone.actif || zone.restaurant_id !== restaurantId) {
      return { error: "Zone de livraison invalide." };
    }
    fraisLivraison = Number(zone.frais);
    total += fraisLivraison;
  }

  const { data: commandeEnLigne, error: insertError } = await supabase
    .from("commandes_en_ligne")
    .insert({
      restaurant_id: restaurantId,
      client_nom: clientNom,
      client_telephone: clientTelephone,
      adresse_livraison: adresseLivraison,
      zone_livraison_id: params.zoneLivraisonId,
      frais_livraison: fraisLivraison,
      points_utilises: pointsUtilises,
      // Simple indice pour la matérialisation (session ouverte au moment du
      // checkout) — pas une garantie : re-résolue atomiquement à la
      // confirmation, cf. commentaire ci-dessus.
      session_caisse_id: sessionOuverte.id,
      panier: panierValide,
      total,
      mode_paiement: params.modePaiement,
    })
    .select("id")
    .single();

  if (insertError || !commandeEnLigne) return { error: "Impossible d'enregistrer la commande." };

  return { url: `/paiement-simule/${commandeEnLigne.id}`, commandeId: commandeEnLigne.id };

}
