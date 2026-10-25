# Pharmacie et stock

Circuit du médicament et gestion du stock : file des ordonnances (validation, facturation,
délivrance), stock **par lots et par dépôts** avec sortie **FEFO**, réceptions, pertes,
transferts, inventaires, flacons multidoses de vaccins, rapport mensuel et pharmacovigilance.

- **Utilisateurs** : pharmaciens, gestionnaires de stock.
- **Menu** : Pharmacie → File des prescriptions, Stock & inventaire, Rapport mensuel,
  Pharmacovigilance (`/pharmacy`).
- **Permission** : `MODULE_PHARMACY` — lecture, création (article), modification (mouvements de
  stock, validation et délivrance des ordonnances).

---

## Notions

| Notion | Explication |
|---|---|
| **Article** | Médicament ou consommable : nom, catégorie, unité, prix unitaire, seuil d'alerte, dépôt de dispensation, fournisseur |
| **Lot** | Quantité d'un article avec un n° de lot et une date de péremption, dans un dépôt |
| **Dépôt (magasin)** | Lieu de stockage. Chaque article sort d'un **dépôt de dispensation** ; à défaut, le dépôt principal, créé automatiquement |
| **FEFO** | « Premier périmé, premier sorti » : les sorties prennent d'abord le lot qui expire le plus tôt |
| **Stock délivrable** | Lots **non périmés** du dépôt de dispensation : ce que l'on peut réellement remettre au patient |
| **Journal de stock** | Chaque entrée et chaque sortie est un mouvement tracé, avec le stock restant après le mouvement |

Un lot est utilisable **jusqu'au jour de sa péremption inclus**, et périmé dès le lendemain.

---

## Écrans

| Onglet | Contenu |
|---|---|
| File des prescriptions | Ordonnances **À valider**, **À dispenser**, **Délivrées**, avec recherche et compteurs. Détail : lignes, disponibilité en stock, prix, état de la facture, impression de l'**ordonnance** et de la **fiche patient** (posologie) |
| Stock & inventaire | Articles actifs : stock total, stock délivrable, quantité périmée encore en rayon, quantité qui expire dans les 90 jours, péremption la plus proche, alertes de stock faible. Actions par article : Réception, Perte, Transfert, Lots & historique |
| Rapport mensuel | Par article : stock de début, reçu, consommé, pertes, ajustements, stock de fin, **CMM**, **jours de rupture**. Pour les vaccins : doses administrées, doses perdues, taux de perte. **Imprimer le rapport** (PDF) |
| Pharmacovigilance | Effets indésirables déclarés dans le mois et leur investigation |

---

## 👤 Procédures

### Traiter une ordonnance
1. **File des prescriptions → À valider** → ouvrez l'ordonnance.
2. Vérifiez les lignes et leur disponibilité.
3. **Valider** : les lignes tirées du stock sont **facturées** au prix unitaire de l'article. Une
   ligne « médicament hors stock » (texte libre) n'est ni facturée ni délivrée par la pharmacie.
4. Le patient règle la facture à la caisse.
5. **À dispenser → Délivrer** : quand la facturation est active, la délivrance est **refusée tant
   que la facture n'est pas payée**. La délivrance sort le stock **lot par lot (FEFO)**.

**Fiche patient** : depuis l'ordonnance, imprime pour le patient comment prendre chaque
médicament (dose, fréquence, durée, instructions du prescripteur). Elle ne contient que ce que le
prescripteur a écrit : MedCare n'a pas de monographie de médicaments et n'imprime jamais de mise
en garde qu'un clinicien n'a pas rédigée.

Si le stock délivrable est insuffisant pour une ligne, **toute la délivrance est refusée**
(« stock insuffisant ») : enregistrez d'abord la réception ou l'inventaire, pour que le stock reste
juste. Deux clics simultanés ne peuvent ni facturer deux fois, ni sortir le stock deux fois.

### Créer un article
**Stock & inventaire → Ajouter un Médicament** :
- nom, catégorie, fabricant, unité, prix unitaire, seuil d'alerte ;
- dépôt de dispensation, fournisseur ;
- pour un vaccin : **antigène**, doses par flacon et, pour un multidose, durée d'utilisation après
  ouverture en heures ;
- catégorie RMA3 et traitement RMA3 éventuels (SRO, zinc, antibiotique, fer / acide folique).

L'article est créé **avec un stock vide** : les quantités n'entrent que par une **réception**.

### Réceptionner une livraison
Article → **Réception** :
- dépôt de réception (par défaut, le dépôt de dispensation) ;
- **n° de lot**, date de péremption, quantité reçue ;
- coût unitaire, fournisseur, référence, date de réception.

### Déclarer une perte
Article → **Perte** :
- type : **périmé**, **endommagé** ou **perdu** ;
- lot : automatique (premier lot à expirer) ou choisi ;
- quantité, date, **motif obligatoire**.

### Transférer entre dépôts
Article → **Transfert** → lot, dépôt de destination, quantité.

### Faire un inventaire
Article → **Lots & historique** → **Compter** sur un lot → quantité comptée, motif. L'écart est
enregistré comme ajustement.

### Jeter un flacon multidose ouvert
Article (vaccin) → **Lots & historique** → *Flacons ouverts* → **Jeter le flacon** (fin de séance,
contamination). Les doses restantes comptent comme perte. Un flacon dont la durée d'utilisation est
dépassée se ferme tout seul.

### Déclarer un effet indésirable
**Pharmacovigilance → Nouvelle déclaration** :
- patient ;
- article du stock (ou nom du médicament), lot, péremption ;
- date de la réaction, description, gravité.

Suivi : date d'investigation et conclusion.

### Consulter et imprimer le rapport mensuel
**Rapport mensuel** → choisissez le mois et, si besoin, une catégorie → **Imprimer le rapport**
pour le PDF (articles, entrées, sorties, pertes, CMM, jours de rupture, pertes de vaccins).

---

## Règles

- Le **stock ne se modifie jamais directement** : uniquement par réception, perte, transfert,
  inventaire, délivrance et vaccination. Chaque mouvement est verrouillé et tracé.
- Un mouvement **antidaté** recalcule les soldes suivants. Il est refusé s'il rendait le stock
  négatif à une date passée.
- Un lot **périmé** n'est jamais remis à un patient ; il ne peut sortir que comme perte.
- **Vaccins** : un article relié à un antigène fournit les doses de cet antigène.
  - Un flacon unidose sort une unité par vaccination.
  - Un flacon multidose est ouvert à la première dose (une unité sort du stock), puis ses doses
    restantes servent jusqu'à épuisement ou jusqu'à expiration du délai d'utilisation.

## Limites connues

- **Pas de vérification des interactions médicamenteuses.** L'ancienne alerte « Interaction à
  Haut Risque » a été retirée (2026-10-25) : elle n'était calculée par rien. Une vraie
  vérification demanderait un référentiel d'interactions validé cliniquement.
- Dans la fiche d'ordonnance, les boutons « Annuler » et « Voir » le patient n'ont pas encore
  d'action.

## 🛠️ Repères techniques

| Besoin | Route / fichier |
|---|---|
| File des ordonnances | `GET /api/v1/pharmacy/prescriptions` |
| Valider / délivrer | `PATCH /api/v1/pharmacy/prescriptions/[id]/status` |
| Articles | `GET/POST /api/v1/pharmacy/inventory`, `PATCH /api/v1/pharmacy/inventory/[id]` |
| Lots, journal, mouvements | `GET/POST /api/v1/pharmacy/inventory/[id]/movements` |
| Rapport mensuel | `GET /api/v1/pharmacy/stock-report?period=AAAAMM` |
| Pharmacovigilance | `/api/v1/pharmacy/adverse-reactions` |
| Articles prescriptibles, lots de vaccin, flacons | `/api/v1/stock/prescribable`, `/vaccine-lots`, `/open-vials/[id]/discard` |
| Seul code qui modifie le stock | `lib/stock/movements.ts` |
| FEFO, rapport, vaccins | `lib/stock/fefo.ts`, `lib/stock/report.ts`, `lib/stock/vaccines.ts` |
