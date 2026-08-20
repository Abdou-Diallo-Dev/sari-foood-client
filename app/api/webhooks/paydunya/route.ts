import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmerPaiementPayDunya } from "@/lib/paiement/paydunya";

// PayDunya envoie son IPN en application/x-www-form-urlencoded avec un champ
// "data" contenant le JSON de la facture (forme historique documentée —
// à revérifier contre le dashboard PayDunya au premier test réel ; on
// accepte aussi du JSON direct par sécurité). On n'utilise ce corps que pour
// retrouver le token de facture — jamais pour décider du statut du paiement,
// toujours reconfirmé via confirmerPaiementPayDunya (cf.
// lib/paiement/paydunya.ts) qui rappelle PayDunya avec nos identifiants.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let token: string | undefined;

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { token?: string; invoice?: { token?: string } };
      token = body.token ?? body.invoice?.token;
    } else {
      const form = await request.formData();
      const brut = form.get("data");
      if (typeof brut === "string") {
        const data = JSON.parse(brut) as { invoice?: { token?: string } };
        token = data.invoice?.token;
      }
    }
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token de facture manquant." }, { status: 400 });
  }

  const { complete, commandeEnLigneId } = await confirmerPaiementPayDunya(token);
  if (!commandeEnLigneId) {
    return NextResponse.json({ error: "Commande introuvable pour cette facture." }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (complete) {
    // La session de caisse mémorisée à la commande a pu fermer entre le
    // checkout et ce webhook (confirmation asynchrone) : la fonction
    // revérifie et re-résout elle-même la session à rattacher, jamais la
    // valeur figée (migration 0034).
    await supabase.rpc("materialiser_commande_en_ligne", {
      p_id: commandeEnLigneId,
      p_reference: token,
    });
  } else {
    await supabase
      .from("commandes_en_ligne")
      .update({ statut: "echouee" })
      .eq("id", commandeEnLigneId)
      .eq("statut", "en_attente");
  }

  return NextResponse.json({ ok: true });
}
