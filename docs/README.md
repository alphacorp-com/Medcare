# Documentation MedCare

Ce dossier rassemble toute la documentation de MedCare. Les guides des modules s'adressent au
personnel de l'établissement ; les sections marquées **🛠️** s'adressent aux développeurs et aux
administrateurs techniques.

## Par où commencer

| Vous êtes… | Lisez d'abord |
|---|---|
| Nouveau dans l'établissement | [Présentation](presentation/README.md), puis le guide de votre module |
| Administrateur de l'établissement | [Paramétrage](parametrage/README.md), [Sécurité et rôles](securite/README.md), [Licence](licence/README.md) |
| Responsable technique / informatique | [Installation](installation/README.md), [Licence](licence/README.md), [Guide développeur](developpement/README.md) |
| Développeur | [Guide développeur](developpement/README.md), [État des modules](etat-des-modules/README.md) |

## Sommaire

### Comprendre MedCare
- [Présentation](presentation/README.md) : pourquoi MedCare, modèle de déploiement, lien avec AlphaCorp, lexique.
- [État des modules](etat-des-modules/README.md) : ce qui est complet, partiel ou manquant.

### Installer et exploiter
- [Installation et déploiement](installation/README.md) : variables d'environnement, premier démarrage (`/setup`), Vercel, Docker, sauvegardes.
- [Données de démonstration (seed)](installation/SEEDING.md).
- [Licence AlphaCorp](licence/README.md) : activation en ligne et hors ligne, renouvellement, dépannage.

### Utiliser les modules
- [Index des modules](modules/README.md) — un guide par interface :
  [Tableau de bord](modules/tableau-de-bord/README.md) ·
  [Patients](modules/patients/README.md) ·
  [Rendez-vous](modules/rendez-vous/README.md) ·
  [Admissions, consultations et sorties](modules/admissions/README.md) ·
  [Laboratoire](modules/laboratoire/README.md) ·
  [Banque de sang](modules/banque-de-sang/README.md) ·
  [Radiologie](modules/radiologie/README.md) ·
  [Chirurgie](modules/chirurgie/README.md) ·
  [Pharmacie et stock](modules/pharmacie/README.md) ·
  [Maternité et planification familiale](modules/maternite/README.md) ·
  [Programmes de santé](modules/programmes-de-sante/README.md) ·
  [Facturation](modules/facturation/README.md) ·
  [Tiers payant](modules/tiers-payant/README.md) ·
  [Planning du personnel](modules/planning/README.md) ·
  [Messagerie et notifications](modules/messagerie/README.md) ·
  [RMA3 et rapports](modules/rma3/README.md)

### Parcours transverses
- [Workflows inter-modules](workflows/README.md) : « payer d'abord, soigner ensuite », du triage à la sortie, de la prescription au résultat, de l'ordonnance à la délivrance, de la facture au règlement de l'organisme.

### Configurer l'établissement
- [Paramétrage](parametrage/README.md) : organisation, utilisateurs, rôles, référentiels, actes et tarifs, examens, lits et salles, payeurs, modèles de documents (éditeur), sauvegarde, intégrations.
- [Intégration DHIS2](parametrage/integration-dhis2.md) · [Mobile Money](parametrage/mobile-money.md)

### Sécurité
- [Sécurité, rôles et permissions](securite/README.md)
- [Audit de sécurité de septembre 2026](securite/AUDIT_2026-09.md) (avec le statut de chaque constat)

### Développer
- [Guide développeur](developpement/README.md) : architecture, conventions, tests, dette technique.

## Conventions de cette documentation

- **👤 Procédure** : étapes à suivre dans l'interface.
- **🛠️ Technique** : fonctionnement interne (routes API, fichiers), pour les développeurs.
- Les noms de boutons et d'écrans sont ceux de l'interface en français.
- Une fonctionnalité non vérifiée dans le code n'est pas documentée. Les limites connues sont
  signalées dans chaque guide et récapitulées dans l'[état des modules](etat-des-modules/README.md).
