# Guides des modules

Un guide par interface de MedCare. Chaque guide suit la même structure :

1. **À quoi sert le module** et qui l'utilise.
2. **Accès** : menu, permissions nécessaires.
3. **Écrans** : ce que l'on voit et où.
4. **👤 Procédures** : les tâches courantes, pas à pas.
5. **Règles et statuts** : ce que le système impose, et pourquoi.
6. **Limites connues**.
7. **🛠️ Repères techniques** : routes API et fichiers, pour les développeurs.

## Modules cliniques

| Guide | Menu | Permission |
|---|---|---|
| [Tableau de bord](tableau-de-bord/README.md) | Tableau de Bord | — (contenu filtré selon les permissions) |
| [Patients](patients/README.md) | Gestion des Patients | `MODULE_CORE_PATIENT` |
| [Rendez-vous](rendez-vous/README.md) | Rendez-vous | `MODULE_APPOINTMENTS` |
| [Admissions, consultations et sorties](admissions/README.md) | Admissions → Séjours / Consultations / Sorties | `MODULE_ADMISSION` |
| [Laboratoire](laboratoire/README.md) | Laboratoire → Examens | `MODULE_LAB` |
| [Banque de sang](banque-de-sang/README.md) | Laboratoire → Banque de sang | `MODULE_LAB` |
| [Radiologie](radiologie/README.md) | Radiologie | `MODULE_RADIOLOGY` |
| [Chirurgie](chirurgie/README.md) | Chirurgie | `MODULE_SURGERY` |
| [Pharmacie et stock](pharmacie/README.md) | Pharmacie | `MODULE_PHARMACY` |
| [Maternité et planification familiale](maternite/README.md) | Maternité | `MODULE_MATERNITY` |
| [Programmes de santé](programmes-de-sante/README.md) | Programmes de Santé | `MODULE_DISEASE_PROGRAMS` (+ `MODULE_HIV`) |

## Modules administratifs

| Guide | Menu | Permission |
|---|---|---|
| [Facturation](facturation/README.md) | Facturation → Factures / Grille tarifaire | `MODULE_BILLING` |
| [Tiers payant](tiers-payant/README.md) | Facturation → Créances et bordereaux ; fiche patient → Tiers payant | `MODULE_BILLING` |
| [Planning du personnel](planning/README.md) | Planning | `MODULE_PLANNING` |
| [RMA3 et rapports](rma3/README.md) | RMA3 ; Paramètres → Rapports | `MODULE_RMA3` ; administrateur |
| [Messagerie et notifications](messagerie/README.md) | Messages, cloche de notifications | — |

Le paramétrage (référentiels, tarifs, utilisateurs, intégrations) est décrit dans
[Paramétrage](../parametrage/README.md). Les parcours qui traversent plusieurs modules sont dans
[Workflows](../workflows/README.md).
