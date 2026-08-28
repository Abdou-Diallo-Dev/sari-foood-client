export type ProduitMenu = {
  id: string;
  nom: string;
  prix: number;
  categorie: string;
  pole: "patisserie" | "boulangerie" | "fastfood";
  imageUrl: string | null;
  coutPoints: number | null;
};

export type PanierItem = {
  produit_id: string;
  quantite: number;
  avecPoints?: boolean;
};

export type ZoneLivraison = {
  id: string;
  nom: string;
  frais: number;
};

export const MODES_PAIEMENT = [
  { value: "wave", label: "Wave" },
] as const;

export type ModePaiement = (typeof MODES_PAIEMENT)[number]["value"];

// Lien de paiement Wave fixe (Sari Food)
export const WAVE_PAYMENT_URL = "https://pay.wave.com/m/M_sn_wKEaRIzrHnhr/c/sn/";
