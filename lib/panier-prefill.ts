// Relais entre /mes-commandes ("Commander à nouveau") et l'accueil : on ne
// peut pas naviguer avec un state React, donc on passe par le stockage
// local le temps d'un aller-retour, consommé une seule fois.
const CLE_STORAGE = "sari_food_panier_prefill";

export type PanierPrefillItem = { produit_id: string; quantite: number };

export function ecrirePanierPrefill(items: PanierPrefillItem[]) {
  try {
    sessionStorage.setItem(CLE_STORAGE, JSON.stringify(items));
  } catch {
    // stockage indisponible : la recommande retombera sur un panier vide
  }
}

export function lirePanierPrefill(): PanierPrefillItem[] | null {
  try {
    const brut = sessionStorage.getItem(CLE_STORAGE);
    if (!brut) return null;
    sessionStorage.removeItem(CLE_STORAGE);
    return JSON.parse(brut) as PanierPrefillItem[];
  } catch {
    return null;
  }
}
