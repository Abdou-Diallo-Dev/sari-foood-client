export type ProduitMenu = {
  id: string;
  nom: string;
  prix: number;
  categorie: string;
  pole: "patisserie" | "boulangerie" | "fastfood";
  imageUrl: string | null;
};

export type PanierItem = {
  produit_id: string;
  quantite: number;
};

export type ZoneLivraison = {
  id: string;
  nom: string;
  frais: number;
};

export const MODES_PAIEMENT = [
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
] as const;

export type ModePaiement = (typeof MODES_PAIEMENT)[number]["value"];
