// Garde une trace locale de la dernière commande en ligne en attente de
// paiement, pour proposer "Reprendre mon paiement en attente" sur l'accueil
// si le client quitte l'écran de paiement simulé sans finaliser (cf.
// app/paiement-simule/[id]). Fenêtre de 5h : au-delà, on considère la
// commande abandonnée plutôt que de proposer une reprise qui n'a plus de sens.
const CLE_STORAGE = "sari_food_paiement_en_attente";
const DUREE_MAX_MS = 5 * 60 * 60 * 1000;

type PaiementEnAttente = { commandeId: string; creeLe: number };

export function ecrirePaiementEnAttente(commandeId: string) {
  try {
    localStorage.setItem(CLE_STORAGE, JSON.stringify({ commandeId, creeLe: Date.now() }));
  } catch {
    // stockage indisponible (navigation privée...) : silencieux
  }
}

export function lirePaiementEnAttente(): PaiementEnAttente | null {
  try {
    const brut = localStorage.getItem(CLE_STORAGE);
    if (!brut) return null;
    const data = JSON.parse(brut) as Partial<PaiementEnAttente>;
    if (!data.commandeId || !data.creeLe) return null;
    if (Date.now() - data.creeLe > DUREE_MAX_MS) {
      localStorage.removeItem(CLE_STORAGE);
      return null;
    }
    return data as PaiementEnAttente;
  } catch {
    return null;
  }
}

export function effacerPaiementEnAttente() {
  try {
    localStorage.removeItem(CLE_STORAGE);
  } catch {
    // stockage indisponible : silencieux
  }
}
