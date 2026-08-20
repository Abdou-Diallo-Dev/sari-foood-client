"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { creerCommandeEnLigne, obtenirSoldePoints } from "./actions";
import { MODES_PAIEMENT, type ModePaiement, type ProduitMenu, type ZoneLivraison } from "@/lib/types";
import { lireClientInfo, ecrireClientInfo } from "@/lib/client-info";
import { lirePanierPrefill } from "@/lib/panier-prefill";

const POLES = [
  { value: "patisserie", label: "Pâtisserie" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "fastfood", label: "Fast-Food" },
] as const;

type LignePanier = { produit_id: string; quantite: number; avecPoints?: boolean };

function cleLigne(produitId: string, avecPoints?: boolean) {
  return avecPoints ? `${produitId}__points` : produitId;
}

export function MenuClient({
  produits,
  zonesLivraison,
}: {
  produits: ProduitMenu[];
  zonesLivraison: ZoneLivraison[];
}) {
  const [panier, setPanier] = useState<Record<string, LignePanier>>({});
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [zoneLivraisonId, setZoneLivraisonId] = useState("");
  const [modePaiement, setModePaiement] = useState<ModePaiement>("wave");
  const [soldePoints, setSoldePoints] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const info = lireClientInfo();
    if (!info) return;
    setClientNom(info.nom);
    setClientTelephone(info.telephone);
    setAdresseLivraison(info.adresse);
  }, []);

  // Recommande la même commande depuis /mes-commandes : reconstitue le
  // panier à partir des produits toujours au menu (un article retiré depuis
  // est simplement ignoré).
  useEffect(() => {
    const prefill = lirePanierPrefill();
    if (!prefill) return;
    setPanier((prev) => {
      const suivant = { ...prev };
      for (const item of prefill) {
        if (!produits.some((p) => p.id === item.produit_id)) continue;
        suivant[item.produit_id] = { produit_id: item.produit_id, quantite: item.quantite };
      }
      return suivant;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule lecture au montage
  }, []);

  // Solde de points recalculé au fil de la saisie du téléphone (identifiant
  // du client, pas de compte) — un léger débounce évite une requête par frappe.
  useEffect(() => {
    const numero = clientTelephone.trim();
    if (!numero) {
      setSoldePoints(0);
      return;
    }
    const id = setTimeout(() => {
      obtenirSoldePoints(numero).then(setSoldePoints);
    }, 500);
    return () => clearTimeout(id);
  }, [clientTelephone]);

  const produitsParPole = useMemo(() => {
    const groupes: Record<string, Record<string, ProduitMenu[]>> = {
      patisserie: {},
      boulangerie: {},
      fastfood: {},
    };
    for (const p of produits) {
      groupes[p.pole][p.categorie] ??= [];
      groupes[p.pole][p.categorie].push(p);
    }
    return groupes;
  }, [produits]);

  const polesVisibles = POLES.filter((pole) => Object.keys(produitsParPole[pole.value]).length > 0);

  const categoriesVisibles = polesVisibles.flatMap((pole) =>
    Object.keys(produitsParPole[pole.value]).map((nom) => ({ pole: pole.value, nom, cle: `${pole.value}::${nom}` })),
  );

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categorieRefs = useRef<Record<string, HTMLElement | null>>({});
  const [poleActif, setPoleActif] = useState<string>(polesVisibles[0]?.value ?? POLES[0].value);
  const [categorieActive, setCategorieActive] = useState<string>(categoriesVisibles[0]?.cle ?? "");

  // Barre d'onglets figée : surligne le pôle actuellement visible pendant
  // le scroll, plutôt que de dépendre d'un seul clic pour se repérer.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entrees) => {
        const visible = entrees.find((e) => e.isIntersecting);
        if (visible) setPoleActif(visible.target.getAttribute("data-pole") ?? "");
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );

    for (const pole of polesVisibles) {
      const el = sectionRefs.current[pole.value];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sections stables tant que produits ne change pas
  }, [produits]);

  // Même principe pour les catégories : sans ça, seuls les 3 pôles se
  // surlignaient pendant le scroll, les catégories restaient toutes dans le
  // même état visuel quelle que soit la position réelle dans la page.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entrees) => {
        const visible = entrees.find((e) => e.isIntersecting);
        if (visible) setCategorieActive(visible.target.getAttribute("data-categorie") ?? "");
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );

    for (const cat of categoriesVisibles) {
      const el = categorieRefs.current[cat.cle];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sections stables tant que produits ne change pas
  }, [produits]);

  function allerAuPole(pole: string) {
    sectionRefs.current[pole]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function allerALaCategorie(cle: string) {
    categorieRefs.current[cle]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const lignes = Object.entries(panier).map(([cle, ligne]) => ({ cle, ...ligne }));
  const sousTotal = lignes.reduce((s, l) => {
    if (l.avecPoints) return s;
    const p = produits.find((prod) => prod.id === l.produit_id);
    return s + (p?.prix ?? 0) * l.quantite;
  }, 0);
  const pointsEngages = lignes.reduce((s, l) => {
    if (!l.avecPoints) return s;
    const p = produits.find((prod) => prod.id === l.produit_id);
    return s + (p?.coutPoints ?? 0) * l.quantite;
  }, 0);
  const pointsRestants = soldePoints - pointsEngages;
  const zoneChoisie = zonesLivraison.find((z) => z.id === zoneLivraisonId);
  const fraisLivraison = zoneChoisie?.frais ?? 0;
  const total = sousTotal + fraisLivraison;

  function ajouter(p: ProduitMenu) {
    setMessage(null);
    const cle = cleLigne(p.id);
    setPanier((prev) => {
      const existant = prev[cle];
      return { ...prev, [cle]: { produit_id: p.id, quantite: (existant?.quantite ?? 0) + 1 } };
    });
  }

  function echangerAvecPoints(p: ProduitMenu) {
    if (!p.coutPoints || p.coutPoints > pointsRestants) return;
    setMessage(null);
    const cle = cleLigne(p.id, true);
    setPanier((prev) => {
      const existant = prev[cle];
      return {
        ...prev,
        [cle]: { produit_id: p.id, quantite: (existant?.quantite ?? 0) + 1, avecPoints: true },
      };
    });
  }

  function changerQuantite(cle: string, delta: number) {
    setPanier((prev) => {
      const existant = prev[cle];
      if (!existant) return prev;
      const quantite = existant.quantite + delta;
      if (quantite <= 0) {
        const { [cle]: _retire, ...reste } = prev;
        return reste;
      }
      return { ...prev, [cle]: { ...existant, quantite } };
    });
  }

  function payer() {
    setMessage(null);
    if (!clientNom.trim()) return setMessage("Indiquez votre nom.");
    if (!clientTelephone.trim()) return setMessage("Indiquez votre numéro de téléphone.");
    if (!adresseLivraison.trim()) return setMessage("Indiquez votre adresse de livraison.");
    if (zonesLivraison.length > 0 && !zoneLivraisonId) {
      return setMessage("Choisissez votre zone de livraison.");
    }
    if (lignes.length === 0) return setMessage("Votre panier est vide.");
    if (pointsEngages > soldePoints) return setMessage("Solde de points insuffisant.");

    startTransition(async () => {
      const res = await creerCommandeEnLigne({
        clientNom,
        clientTelephone,
        adresseLivraison,
        zoneLivraisonId: zoneLivraisonId || null,
        modePaiement,
        panier: lignes.map(({ produit_id, quantite, avecPoints }) => ({
          produit_id,
          quantite,
          avecPoints,
        })),
      });
      if (res.error) {
        setMessage(res.error);
      } else if (res.url) {
        ecrireClientInfo({
          nom: clientNom.trim(),
          telephone: clientTelephone.trim(),
          adresse: adresseLivraison.trim(),
        });
        window.location.href = res.url;
      }
    });
  }

  const produitsEchangeables = produits.filter((p) => p.coutPoints);
  const nombreArticles = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 pb-24 lg:grid-cols-[1fr_340px] lg:pb-0">
      <div className="flex min-w-0 flex-col gap-6">
        {(polesVisibles.length > 1 || categoriesVisibles.length > 1) && (
          <nav className="sticky top-0 z-10 -mx-4 flex max-w-[100vw] items-center gap-2 overflow-x-auto border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:max-w-full sm:rounded-card sm:border sm:px-3">
            {polesVisibles.length > 1 &&
              polesVisibles.map((pole) => (
                <button
                  key={pole.value}
                  onClick={() => allerAuPole(pole.value)}
                  className={`shrink-0 rounded-[9px] px-3 py-1.5 text-sm font-bold transition ${
                    poleActif === pole.value
                      ? "bg-orange text-white"
                      : "text-ink-soft hover:bg-surface hover:text-ink"
                  }`}
                >
                  {pole.label}
                </button>
              ))}

            {polesVisibles.length > 1 && categoriesVisibles.length > 0 && (
              <span className="h-5 w-px shrink-0 bg-line" />
            )}

            {categoriesVisibles.map((cat) => (
              <button
                key={cat.cle}
                onClick={() => allerALaCategorie(cat.cle)}
                className={`shrink-0 rounded-[9px] border px-2.5 py-1 text-xs font-bold transition ${
                  categorieActive === cat.cle
                    ? "border-orange bg-orange/10 text-orange"
                    : "border-line text-ink-soft hover:border-orange hover:text-orange"
                }`}
              >
                {cat.nom}
              </button>
            ))}
          </nav>
        )}

        {clientTelephone.trim() && soldePoints > 0 && produitsEchangeables.length > 0 && (
          <section className="rounded-card border border-green/40 bg-green/5 p-5">
            <h2 className="mb-1 font-display text-lg font-extrabold text-green">
              🎁 Vos points de fidélité : {soldePoints}
            </h2>
            <p className="mb-4 text-xs text-ink-soft opacity-80">
              1 point gagné par commande. Échangez-les contre un produit offert.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {produitsEchangeables.map((p) => {
                const accessible = (p.coutPoints ?? 0) <= pointsRestants;
                const quantiteAjoutee = panier[cleLigne(p.id, true)]?.quantite ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => echangerAvecPoints(p)}
                    disabled={!accessible}
                    className={`relative rounded-[11px] border px-3 py-2.5 text-left transition active:scale-[0.97] ${
                      accessible
                        ? "border-green/40 bg-surface hover:border-green"
                        : "cursor-not-allowed border-line bg-line/10 opacity-50"
                    }`}
                  >
                    {quantiteAjoutee > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-[11px] font-extrabold text-white shadow">
                        {quantiteAjoutee}
                      </span>
                    )}
                    <div className="text-sm font-bold text-ink">{p.nom}</div>
                    <div className="text-xs font-bold text-green">{p.coutPoints} pts</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {POLES.map((pole) => {
          const categories = produitsParPole[pole.value];
          const nomsCategories = Object.keys(categories);
          if (nomsCategories.length === 0) return null;

          return (
            <section
              key={pole.value}
              ref={(el) => {
                sectionRefs.current[pole.value] = el;
              }}
              data-pole={pole.value}
              className="scroll-mt-16 rounded-card border border-line bg-surface p-5"
            >
              <h2 className="mb-4 font-display text-lg font-extrabold text-orange">{pole.label}</h2>
              <div className="flex flex-col gap-4">
                {nomsCategories.map((nomCategorie) => (
                  <div
                    key={nomCategorie}
                    ref={(el) => {
                      categorieRefs.current[`${pole.value}::${nomCategorie}`] = el;
                    }}
                    data-categorie={`${pole.value}::${nomCategorie}`}
                    className="scroll-mt-16"
                  >
                    <h3 className="mb-2 text-sm font-bold text-ink-soft">{nomCategorie}</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {categories[nomCategorie].map((p) => {
                        const quantiteAjoutee = panier[cleLigne(p.id)]?.quantite ?? 0;
                        return (
                          <button
                            key={p.id}
                            onClick={() => ajouter(p)}
                            className={`relative overflow-hidden rounded-[11px] border bg-paper text-left transition active:scale-[0.97] ${
                              quantiteAjoutee > 0 ? "border-orange" : "border-line hover:border-orange"
                            }`}
                          >
                            {quantiteAjoutee > 0 && (
                              <span className="absolute right-1.5 top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange px-1.5 text-xs font-extrabold text-white shadow">
                                {quantiteAjoutee}
                              </span>
                            )}
                            <div className="aspect-square w-full bg-line/20">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt={p.nom}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-ink-soft opacity-30">
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                    className="h-8 w-8"
                                  >
                                    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                                    <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
                                    <path d="m5 17 5-5 3 3 3-3.5 3.5 4" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-2.5">
                              <div className="text-sm font-bold text-ink">{p.nom}</div>
                              <div className="text-xs font-bold text-orange">
                                {p.prix.toLocaleString("fr-FR")} F
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {nombreArticles > 0 && (
        <button
          onClick={() =>
            document.getElementById("panier-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-[14px] bg-orange px-4 py-3 text-white shadow-lg transition active:scale-[0.98] lg:hidden"
        >
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-sm font-extrabold">
            {nombreArticles}
          </span>
          <span className="font-display text-sm font-extrabold">Voir mon panier</span>
          <span className="text-sm font-extrabold">{total.toLocaleString("fr-FR")} F</span>
        </button>
      )}

      <aside
        id="panier-panel"
        className="flex h-fit scroll-mt-6 flex-col gap-4 rounded-card border border-line bg-surface p-5 lg:sticky lg:top-6"
      >
        <h2 className="font-display text-lg font-extrabold text-ink">Votre commande</h2>

        {lignes.length === 0 ? (
          <p className="text-sm text-ink-soft opacity-70">Aucun article sélectionné.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lignes.map((l) => {
              const p = produits.find((prod) => prod.id === l.produit_id);
              return (
                <li key={l.cle} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {p?.nom}
                    {l.avecPoints && (
                      <span className="ml-1 text-xs font-bold text-green">(points)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changerQuantite(l.cle, -1)}
                      className="rounded-[6px] border border-line px-1.5 text-ink-soft hover:text-orange"
                    >
                      −
                    </button>
                    <span className="w-4 text-center font-bold text-ink">{l.quantite}</span>
                    <button
                      onClick={() => changerQuantite(l.cle, 1)}
                      disabled={l.avecPoints && (p?.coutPoints ?? 0) > pointsRestants}
                      className="rounded-[6px] border border-line px-1.5 text-ink-soft hover:text-orange disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 text-right font-bold text-ink">
                    {l.avecPoints
                      ? `${(p?.coutPoints ?? 0) * l.quantite} pts`
                      : `${((p?.prix ?? 0) * l.quantite).toLocaleString("fr-FR")} F`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Sous-total</span>
            <span className="text-ink">{sousTotal.toLocaleString("fr-FR")} F</span>
          </div>
          {zonesLivraison.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Livraison</span>
              <span className="text-ink">
                {zoneChoisie ? `${fraisLivraison.toLocaleString("fr-FR")} F` : "—"}
              </span>
            </div>
          )}
          {pointsEngages > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Points utilisés</span>
              <span className="font-bold text-green">-{pointsEngages} pts</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-bold text-ink-soft">Total</span>
            <span className="font-display text-lg font-extrabold text-ink">
              {total.toLocaleString("fr-FR")} F
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={clientNom}
            onChange={(e) => setClientNom(e.target.value)}
            placeholder="Votre nom"
            className="rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-orange"
          />
          <input
            value={clientTelephone}
            onChange={(e) => setClientTelephone(e.target.value)}
            placeholder="Votre numéro de téléphone"
            type="tel"
            className="rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-orange"
          />
          {zonesLivraison.length > 0 && (
            <select
              value={zoneLivraisonId}
              onChange={(e) => setZoneLivraisonId(e.target.value)}
              className="rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-orange"
            >
              <option value="">Choisir votre zone de livraison</option>
              {zonesLivraison.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nom} — {z.frais.toLocaleString("fr-FR")} F
                </option>
              ))}
            </select>
          )}
          <input
            value={adresseLivraison}
            onChange={(e) => setAdresseLivraison(e.target.value)}
            placeholder="Adresse précise (rue, repère...)"
            className="rounded-[9px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-orange"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-soft">Moyen de paiement</p>
          <div className="flex gap-2">
            {MODES_PAIEMENT.map((m) => (
              <button
                key={m.value}
                onClick={() => setModePaiement(m.value)}
                className={`flex-1 rounded-[9px] border px-2 py-1.5 text-xs font-bold transition ${
                  modePaiement === m.value
                    ? "border-orange bg-orange text-white"
                    : "border-line bg-paper text-ink-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={payer}
          disabled={lignes.length === 0 || isPending}
          className="rounded-[11px] bg-orange px-4 py-2.5 text-center font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Redirection..." : `Payer ${total.toLocaleString("fr-FR")} F`}
        </button>

        {message && <p className="text-sm font-bold text-red-600">{message}</p>}
      </aside>
    </div>
  );
}
