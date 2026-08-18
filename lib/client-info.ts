// Pas de compte client (cf. lib/supabase/admin.ts) : on retient juste les
// coordonnées saisies au dernier achat, en local, pour préremplir le
// formulaire et identifier le client sur /mes-commandes (recherche par
// numéro de téléphone, la seule donnée stable qu'on ait de lui).
const CLE_STORAGE = "sari_food_client";

export type ClientInfo = { nom: string; telephone: string; adresse: string };

export function lireClientInfo(): ClientInfo | null {
  try {
    const brut = localStorage.getItem(CLE_STORAGE);
    return brut ? (JSON.parse(brut) as ClientInfo) : null;
  } catch {
    return null;
  }
}

export function ecrireClientInfo(info: ClientInfo) {
  try {
    localStorage.setItem(CLE_STORAGE, JSON.stringify(info));
  } catch {
    // stockage indisponible (navigation privée...) : silencieux
  }
}
