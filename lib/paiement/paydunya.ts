// Intégration contre l'API "Checkout Invoice" de PayDunya
// (https://developers.paydunya.com) : un seul intégrateur qui gère lui-même
// Wave/Orange Money/Free Money/carte sur sa propre page de paiement
// hébergée, au lieu des deux intégrations directes Wave/Orange Money
// (lib/paiement/wave.ts, lib/paiement/orangeMoney.ts) jamais branchées faute
// de clés. On restreint le choix du client à UN seul canal (`channels`) pour
// que `mode_paiement` (wave/orange_money, cf. lib/types.ts) reste fiable et
// continue d'alimenter la réconciliation caisse existante (ecart_wave,
// ecart_orange_money...) exactement comme avant : seul le transport change,
// pas le reste de l'app.
//
// Piège vérifié en conditions réelles (SDK officiel paydunya-node) : le mode
// test n'est PAS déterminé par le préfixe des clés mais par l'URL de base —
// /api/v1 est réservé au live, le sandbox vit sous /sandbox-api/v1. Utiliser
// /api/v1 avec des clés test échoue avec "LIVE Private Key and Token
// combination is invalid", un message trompeur qui ne parle pas d'URL. La
// clé publique n'est par ailleurs jamais envoyée en en-tête par le SDK
// officiel (seuls master/private/token le sont) — gardée en variable
// d'environnement uniquement comme indicateur de configuration.
const PAYDUNYA_BASE_URL =
  process.env.PAYDUNYA_MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

const CANAUX: Record<"wave" | "orange_money", string> = {
  wave: "wave-senegal",
  orange_money: "orange-money-senegal",
};

function enTeteAuth(): Record<string, string> {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  if (!masterKey || !privateKey || !token) {
    throw new Error("Identifiants PayDunya manquants.");
  }
  return {
    "PAYDUNYA-MASTER-KEY": masterKey,
    "PAYDUNYA-PRIVATE-KEY": privateKey,
    "PAYDUNYA-TOKEN": token,
    "Content-Type": "application/json",
  };
}

export async function creerCheckoutPayDunya(params: {
  montant: number;
  reference: string;
  canal: "wave" | "orange_money";
  description: string;
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;
}): Promise<{ url: string; token: string }> {
  const res = await fetch(`${PAYDUNYA_BASE_URL}/checkout-invoice/create`, {
    method: "POST",
    headers: enTeteAuth(),
    body: JSON.stringify({
      invoice: {
        total_amount: Math.round(params.montant),
        description: params.description,
      },
      store: { name: "Sari Food" },
      actions: {
        cancel_url: params.cancelUrl,
        return_url: params.successUrl,
        callback_url: params.callbackUrl,
      },
      // Retrouvé côté webhook via confirmerPaiementPayDunya ci-dessous — ne
      // jamais faire confiance au statut envoyé dans le corps de l'IPN
      // lui-même, seulement à cet id pour savoir QUELLE commande reconfirmer.
      custom_data: { commande_en_ligne_id: params.reference },
      channels: [CANAUX[params.canal]],
    }),
  });

  const data = (await res.json()) as {
    response_code?: string;
    response_text?: string;
    token?: string;
  };

  if (!res.ok || data.response_code !== "00" || !data.token) {
    throw new Error(
      `PayDunya a refusé la création du paiement${data.response_text ? ` (${data.response_text})` : ""}.`,
    );
  }

  // response_text EST l'URL de paiement sur un succès (vérifié en sandbox :
  // "https://paydunya.com/sandbox-checkout/invoice/<token>", vraisemblablement
  // "https://paydunya.com/checkout/invoice/<token>" en live) — jamais la
  // reconstruire soi-même, le chemin diffère déjà entre les deux modes.
  return { url: data.response_text!, token: data.token };
}

// Le webhook IPN de PayDunya n'a pas de mécanisme de signature simple et
// documenté de façon fiable : plutôt que de faire confiance au corps reçu, on
// rappelle systématiquement l'API "confirm" avec nos propres identifiants dès
// qu'une notif arrive, pour obtenir le statut réel directement depuis
// PayDunya (source de vérité) — évite d'avoir à valider un HMAC dont le
// format exact reste à vérifier.
export async function confirmerPaiementPayDunya(
  token: string,
): Promise<{ complete: boolean; commandeEnLigneId: string | null }> {
  const res = await fetch(`${PAYDUNYA_BASE_URL}/checkout-invoice/confirm/${token}`, {
    headers: enTeteAuth(),
  });

  const data = (await res.json()) as {
    status?: string;
    custom_data?: { commande_en_ligne_id?: string };
  };

  return {
    complete: res.ok && data.status === "completed",
    commandeEnLigneId: data.custom_data?.commande_en_ligne_id ?? null,
  };
}
