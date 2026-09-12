# Medcare - Description Complète

Bienvenue dans **Medcare** (Hospital Management System), la plateforme intégrée de gestion hospitalière conçue pour centraliser, sécuriser et fluidifier les parcours de soins.

Ce guide s'adresse **à l'ensemble du personnel** de l'établissement (médical, paramédical, administratif et direction technique). Il explique de manière claire les objectifs du système, le fonctionnement de chaque module et la manière dont l'information circule entre les différents services.

---

## Pourquoi MedCare existe

Beaucoup d'établissements de santé en zone à ressources limitées gèrent encore leurs patients sur
papier ou via des tableurs dispersés entre services : dossiers perdus, doubles saisies, aucune vue
d'ensemble pour la direction, aucune traçabilité en cas de litige. MedCare centralise l'ensemble du
parcours de soins — de l'accueil du patient jusqu'à sa facturation — dans une seule application,
tout en restant utilisable **même quand la connectivité internet est instable ou absente**, une
contrainte réelle et non secondaire dans ce contexte.

## Modèle de déploiement : une installation par établissement

MedCare n'est **pas** une plateforme partagée où plusieurs hôpitaux se connecteraient au même
serveur. Chaque établissement client reçoit **sa propre installation** — sa propre base de données,
son propre serveur (hébergé sur site ou chez un hébergeur au choix du client) — totalement isolée
des autres. Deux hôpitaux clients de MedCare ne partagent ni serveur, ni base de données, ni le
moindre octet de données patient. Ce choix élimine le risque de fuite de données entre
établissements et permet à un site sans accès internet fiable de continuer à fonctionner
normalement — seule l'activation/le renouvellement de la licence a besoin d'un contact, ponctuel et
bref, avec l'extérieur (voir ci-dessous).

## Le lien avec AlphaCorp

**AlphaCorp est l'éditeur qui conçoit, distribue et licencie MedCare** — mais AlphaCorp n'héberge
jamais les données d'un hôpital et ne peut pas s'y connecter en continu : les deux systèmes ne se
parlent que le temps d'une activation ou d'un renouvellement de licence, jamais en continu.

Concrètement, AlphaCorp gère depuis sa propre console d'administration :

- la fiche de chaque client (établissement) et son identifiant/secret d'activation ;
- les modules cliniques inclus dans son contrat, le nombre d'utilisateurs et de lits autorisés ;
- l'émission des licences signées numériquement qui activent (ou renouvellent) une installation
  MedCare, **en ligne si le site a un accès internet, ou hors ligne via un simple échange de deux
  petits fichiers sinon** — dans les deux cas, sans qu'un technicien ait besoin de se déplacer sur
  site ;
- la facturation associée à chaque licence émise.

Une fois une licence appliquée, l'installation MedCare l'applique et la fait respecter
**localement** (modules activés, plafond d'utilisateurs/lits, période de validité avec une période
de grâce avant tout blocage en cas de retard de renouvellement) sans avoir besoin de recontacter
AlphaCorp pour fonctionner au quotidien.

📄 Le détail complet du fonctionnement (étapes, schémas, dépannage) est dans
[`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md).

## Rôles et permissions

Chaque établissement définit lui-même ses rôles (Médecin, Infirmier, Pharmacien, ou tout autre nom
utile à son organisation) depuis Paramètres → Rôles — il n'y a pas de liste figée imposée par
MedCare. Un rôle est soit **administrateur** (accès complet, y compris la gestion des autres
comptes et de la licence), soit défini par un ensemble précis de permissions par module (lecture,
création, modification, suppression) — assignées par défaut à la création d'un utilisateur avec ce
rôle, et toujours ajustables individuellement ensuite.

## Que peut-on faire avec MedCare aujourd'hui

- Dossier patient unifié, identifiant permanent (IPP), historique médical complet.
- Admissions, gestion des lits par service, sorties/transferts.
- Consultations, prescriptions, rendez-vous avec agenda médecin.
- Laboratoire et radiologie : de la demande au résultat, avec alerte sur résultat critique.
- Bloc opératoire avec check-list de sécurité OMS obligatoire avant intervention.
- Pharmacie : stock, dispensation, alertes de rupture.
- Maternité : suivi de grossesse (CPN), accouchement avec partogramme, nouveau-né.
- Programmes de santé publique : vaccination, paludisme, tuberculose (avec remontée DHIS2/SNIS).
- Facturation : génération automatique d'une ligne de facture à chaque acte facturable, paiement
  espèces/carte/assurance/virement/Mobile Money (Orange Money, MTN MoMo).
- Planning du personnel avec détection de conflits.
- Messagerie interne entre membres du personnel.
- Journal d'audit complet (qui a fait quoi, quand) consultable par les administrateurs de
  l'établissement.

Certains points sont encore partiels (ex. pas d'export PDF pour les ordonnances/résultats de labo,
vérification d'interaction médicamenteuse non implémentée) — le détail honnête, module par module,
est tenu à jour dans [`MODULES_STATUS.md`](MODULES_STATUS.md).

---

## Lexique et Acronymes

Pour que tout le système soit compréhensible par le personnel médical et non médical, voici la signification des termes techniques utilisés quotidiennement dans l'application :

* **IPP (Identifiant Permanent du Patient)** : Numéro unique attribué à un patient dès sa première venue à l'hôpital. Il permet de regrouper tout son dossier médical.
* **PMSI (Programme de Médicalisation des Systèmes d'Information)** : Système français de description de l'activité médicale. Il sert à coder les maladies et les actes pour financer l'hôpital (Tarification à l'Activité - T2A).
* **DIM (Département de l'Information Médicale)** : Service chargé du traitement et de l'analyse des données médicales (notamment la validation du codage PMSI avant facturation).
* **PACS (Picture Archiving and Communication System)** : Système informatique de gestion, d'archivage et de visualisation des images médicales (radiographies, scanners, IRM).
* **OMS (Organisation Mondiale de la Santé)** : Dans le contexte chirurgical, on parle de la *"Check-list OMS"*, une procédure de sécurité obligatoire avant le début de toute opération.
* **STAT** : Du latin *statim*. Signifie "Immédiatement" ou "Urgence absolue" (ex: pour une imagerie ou un examen de laboratoire).

---

## Les Modules Disponibles

L'application est divisée en plusieurs modules spécialisés. **L'accès à ces modules est strictement limité par le rôle de l'utilisateur** (un administratif n'aura pas accès à la prescription pharmaceutique, et un chirurgien n'aura pas accès aux fiches de paie).

| Module                         | Description                                                                                      | Utilisateurs Typiques                   |
|:------------------------------ |:------------------------------------------------------------------------------------------------ |:--------------------------------------- |
| **Patients (Dossier Patient)** | Annuaire centralisé des patients, identités, historique.                                         | Accueil, Infirmiers, Médecins, Admin    |
| **Admissions & Lits**          | Gestion des flux, affectation des lits, urgences.                                                | Cadres de santé, Accueil, Médecins      |
| **Rendez-vous**                | Agenda des consultations programmées, accueil à l'arrivée.                                       | Accueil, Médecins                       |
| **Pharmacie**                  | Gestion des stocks, dispensation des traitements.                                                | Pharmaciens, Infirmiers                 |
| **Laboratoire**                | Suivi des analyses biologiques et des résultats.                                                 | Biologistes, Techniciens de labo        |
| **Bloc Opératoire**            | Planification chirurgicale et traçabilité (Check-list).                                          | Chirurgiens, IBODE, MAR                 |
| **Radiologie**                 | Demandes d'imagerie et consultation des comptes-rendus.                                          | Radiologues, Manipulateurs radio        |
| **Maternité**                  | Suivi de grossesse (CPN), accouchement, nouveau-né.                                              | Sages-femmes, Gynécologues              |
| **Programmes de Santé**        | Vaccination, paludisme, tuberculose — suivi et reporting DHIS2/SNIS.                             | Infirmiers, Responsables santé publique |
| **Facturation**                | Facturation générée automatiquement à chaque acte, suivi des paiements (y compris Mobile Money). | Secrétaires médicales, Comptabilité     |
| **Plannings**                  | Gestion des plannings du personnel et détection de conflits.                                     | Cadres de santé, Direction RH           |
| **Messagerie**                 | Messagerie interne entre membres du personnel.                                                   | Tout le personnel                       |
| **Paramètres**                 | Configuration de l'établissement, comptes, rôles, licence — propre à chaque installation.        | Administrateurs de l'établissement      |

---

## Le Flux des Modules (Workflows Détaillés)

### 1. Annuaire Patients & Admissions

**Le point d'entrée de l'hôpital.**

* **Création** : Un nouvel arrivant est enregistré (création d'un IPP).
* **Urgence vs Programmé** : Le patient est soit admis en urgence, soit prévu pour une intervention programmée.
* **Affectation** : Il est dirigé vers un lit ou un service spécifique. 
* *Action rapide* : Impression ou export en CSV des listes de présence pour les transmissions.

### 2. Imagerie (Radiologie) & Biologie (Labo)

**Les services d'investigation diagnostique.**

* **Demande (Prescription)** : Le médecin crée une requête via un formulaire simplifié "Nouvelle Demande" en précisant le degré d'urgence (Routine, Urgent, STAT).
* **Réalisation** : Le manipulateur radio ou technicien labo voit la demande en "Attente d'examen".
* **Validation & Disponibilité** : Une fois l'examen validé, son statut passe en "Résultats disponibles" (connexion PACS pour la radiologie).

### 3. Bloc Opératoire (Chirurgie)

**L'endroit le plus sensible nécessitant une traçabilité parfaite.**

* **Planification** : La secrétaire ou le chirurgien ajoute une intervention au planning de la semaine (état *Programmé*).
* **Sécurité (Check-list OMS)** : Avant d'entrer en salle, l'équipe valide obligatoirement la check-list. Le système **bloque** électroniquement le démarrage (bouton Démarrer) tant que l'OMS n'est pas validée.
* **Déroulement** : L'intervention passe *"En cours"*.
* **Clôture** : Le chirurgien "Termine et Signe" (état *Terminé*). L'information part vers la facturation.

### 4. Pharmacie

**Le centre de distribution des produits de santé.**

* L'infirmier ou le médecin consulte le stock ou demande une dotation.
* Le logiciel trace les quantités disponibles pour éviter les ruptures critiques.

### 5. Facturation

La facture d'un patient se construit **automatiquement**, acte par acte, sans ressaisie manuelle.

1. **Génération automatique** : chaque acte facturable terminé (consultation signée, examen labo/radio validé, chirurgie clôturée, visite CPN, accouchement, délivrance pharmacie) ajoute sa propre ligne à la facture du patient, au tarif défini dans la grille tarifaire de l'établissement.
2. **Suivi du statut** : la facture évolue entre *Brouillon*, *En attente de paiement*, *Partiellement payée*, *Payée* ou *Annulée*.
3. **Paiement** : enregistrement immédiat en espèces, carte, assurance, virement, ou Mobile Money (Orange Money, MTN MoMo).

*(Le codage PMSI/validation DIM décrit dans le lexique est une pratique hospitalière courante, mais MedCare ne l'implémente pas comme circuit de validation séparé — la facturation se limite à la génération et à l'encaissement.)*

---

## Les Workflows Inter-Modules (Le Parcours Central)

Aucun module ne fonctionne seul. Voici comment l'information vit dans l'établissement à travers un cas classique :

> **Patient Jean arrive aux urgences**
> 
> 1. Accueil : Création dans **PATIENTS** → Le patient reçoit un IPP.
> 2. Lits : Admission assigne un lit dans **ADMISSIONS**.
> 3. Examens : Le médecin demande une IRM en statut "STAT" vers **RADIOLOGIE**.
> 4. Chirurgie : Suite à l'IRM, le bloc ouvre une entrée dans **BLOC OPÉRATOIRE**. La check-list OMS est validée, l'opération a lieu.
> 5. Facturation : la clôture de l'intervention chirurgicale génère automatiquement la ligne de facture correspondante dans **FACTURATION** — aucune ressaisie.
> 6. Trésorerie : la comptabilité enregistre le paiement du patient (ou de son assurance) sur cette facture.

---

## Fonctionnalités Transversales

Sur la majeure partie des modules, vous retrouverez des outils universels (en haut à droite des tableaux) :

* **Bouton Imprimer** : Génère une version propre de la table à l'écran, prête pour le dossier papier.
* **Bouton Exporter (CSV)** : Télécharge instantanément un tableur Excel / CSV pour faire des rapports.
* **Bouton Email** : Ouvre votre messagerie locale avec un texte pré-rempli et au design professionnel de l'établissement prêt pour accompagner une pièce jointe.
* **Filtres Avancés / Boutons Statistiques rapides** : En cliquant sur les gros marqueurs colorés (ex: "Terminé", "À valider"), le tableau en dessous se filtre automatiquement.

## Sécurité & Administration

Medcare est hautement sécurisé :

- **Audit Logging** : L'administrateur peut visualiser **l'historique complet d'activité** de chaque collaborateur (qui a validé quel dossier, qui a téléchargé quel fichier).
- **Accès RBA** : La gestion des droits "Role-Based Access" garantit que si une personne non habilitée tente de modifier un dossier ou d'ouvrir un module qui ne lui appartient pas (par modification manuelle d'une URL de page par exemple), le système la bloquera via un panneau *"Accès au Module Restreint"*.
- **Licence** : l'installation reste soumise à la licence délivrée par AlphaCorp (modules, nombre d'utilisateurs/lits, période de validité) — voir [`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md).

---

*Medcare - Développé pour la sécurité et l'efficience des soins.*
