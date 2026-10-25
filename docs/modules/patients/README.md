# Patients

Le module Patients est le point d'entrée de MedCare : chaque patient y reçoit un **IPP**
(identifiant permanent), et sa fiche réunit tout son historique, quel que soit le service.

- **Utilisateurs** : accueil, infirmiers, médecins, facturation.
- **Menu** : Gestion des Patients (`/patients`).
- **Permission** : `MODULE_CORE_PATIENT` (module toujours actif). Lecture pour consulter, création
  pour enregistrer un patient ou une note, modification pour corriger l'identité.

---

## Écrans

### Liste des patients (`/patients`)
- Recherche par nom, prénom, IPP ou numéro de sécurité sociale (NSS).
- Filtre **Actifs / Décédés**, tri par date d'enregistrement (les plus récents en tête) ou par
  nom.
- Pagination.
- Bouton **Nouveau patient**, export PDF de la liste.

### Fiche patient (`/patients/<id>`)
- **En-tête** : identité, âge, IPP, actions (modifier, nouvelle admission, nouvelle note, imprimer
  le dossier).
- **Profil rapide** : groupe sanguin, allergies, antécédents, dernières constantes, derniers
  diagnostics CIM-10.
- **Onglets** :

| Onglet | Contenu |
|---|---|
| Admissions | Séjours du patient : n° de séjour, type, service et lit, médecin, dates, statut |
| Dossiers médicaux | Notes de consultation, notes complémentaires, comptes rendus (signées ou non) |
| Prescriptions | Ordonnances et leur statut à la pharmacie |
| Laboratoire | Examens de biologie ; **Voir** ouvre le résultat validé |
| Imagerie | Examens de radiologie ; **Ouvrir Visionneuse** ouvre le compte rendu validé |
| Constantes | Historique des constantes vitales |
| Chirurgie | Interventions |
| Maternité | Grossesses |
| Programmes | Vaccinations (et MAPI), paludisme, tuberculose, dossier VIH (si `MODULE_HIV`), planification familiale (si `MODULE_MATERNITY`) |
| Facturation | Factures du patient |
| Tiers payant | Adhésions, bénéficiaires, bons de prise en charge, gratuités (si `MODULE_BILLING`) |

---

## 👤 Procédures

### Enregistrer un nouveau patient
1. **Gestion des Patients → Nouveau patient**.
2. Renseignez au minimum **nom, prénom, date de naissance et sexe**. Complétez si possible :
   téléphone, adresse, NSS, groupe sanguin, nom de jeune fille, lieu de naissance, personne à
   prévenir, allergies, antécédents chroniques, consentement au traitement des données.
3. Avant la création, MedCare cherche un **doublon probable** : même nom, prénom et date de
   naissance, ou même NSS. S'il en trouve un, ouvrez la fiche existante plutôt que d'en créer une
   seconde.
4. Validez : l'IPP est attribué automatiquement.

### Corriger l'identité d'un patient
Fiche patient → **Modifier** → corrigez → enregistrez. Toute modification est tracée.

### Admettre le patient
Fiche patient → **Nouvelle admission**. Voir [Admissions](../admissions/README.md#admettre-un-patient).

### Ajouter une note au dossier
Fiche patient → **Nouvelle note** → type de note, titre, contenu → enregistrez, signée ou non.
- L'auteur et le signataire sont **toujours** l'utilisateur connecté, et l'heure de signature est
  celle du serveur : personne ne peut signer au nom d'un autre.
- Une **note de consultation** ne peut être signée qu'avec un **diagnostic principal CIM-10**.
  La signer termine la consultation (voir [Admissions](../admissions/README.md)).

### Consulter un résultat d'examen
Onglet **Laboratoire** → **Voir**, ou onglet **Imagerie** → **Ouvrir Visionneuse**. La feuille
affiche :
- l'alerte en cas de résultat critique ;
- qui a réalisé et qui a validé l'examen, et la date de validation ;
- les paramètres mesurés, ou le compte rendu (technique, constatations, conclusion) ;
- le lien vers les images, s'il y en a un.

Tant que le résultat n'est pas **validé**, la ligne affiche « En attente » ou « Compte rendu en
attente » : un brouillon n'est pas cliniquement utilisable.

### Imprimer le dossier patient
Fiche patient → **Imprimer** : aperçu PDF du dossier, imprimable ou téléchargeable.

### Enregistrer un acte de programme depuis la fiche
Onglet **Programmes** : nouvelle vaccination, déclaration de MAPI, cas de paludisme, cas de
tuberculose et suivi. Voir [Programmes de santé](../programmes-de-sante/README.md).

---

## Règles

- **IPP** unique dans l'établissement, attribué par le serveur.
- Un patient **décédé** sort de la liste par défaut (filtre *Décédés*). Le décès est enregistré
  par la sortie d'un séjour avec le statut décédé, par le programme VIH ou par la maternité.
- Un **nouveau-né** enregistré en maternité devient automatiquement un patient avec son propre IPP.
- Les résultats VIH ne sont visibles que par le personnel autorisé (voir
  [Sécurité](../../securite/README.md#6-données-confidentielles-vih)).

## Limites connues

- Pas de fusion de deux dossiers créés en doublon : la détection n'intervient qu'à la création.
- Pas de visionneuse d'images DICOM : la radiologie stocke un compte rendu et, au plus, un lien
  externe (PACS).

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste, création | `GET/POST /api/v1/patients` |
| Doublon probable | `GET /api/v1/patients/check-duplicate` |
| Fiche, modification | `GET/PATCH /api/v1/patients/[id]` |
| Séjours (noms du service, du lit et du médecin résolus) | `GET/POST /api/v1/patients/[id]/stays` |
| Notes, constantes, diagnostics | `/api/v1/patients/[id]/records`, `/vitals`, `/diagnoses` |
| Examens (et noms des intervenants) | `GET /api/v1/patients/[id]/exams` |
| Prescriptions, chirurgie, grossesses, facturation | `/api/v1/patients/[id]/prescriptions`, `/surgeries`, `/pregnancies`, `/billing` |

Interface : `app/[locale]/(dashboard)/(guarded)/patients/`. Feuille de résultat partagée :
`components/shared/exam-result-sheet.tsx`.
