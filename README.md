# Medcare - Guide d'Utilisation Complet

Bienvenue dans **Medcare** (Hospital Management System), la plateforme intégrée de gestion hospitalière conçue pour centraliser, sécuriser et fluidifier les parcours de soins.

Ce guide s'adresse **à l'ensemble du personnel** de l'établissement (médical, paramédical, administratif et direction technique). Il explique de manière claire les objectifs du système, le fonctionnement de chaque module et la manière dont l'information circule entre les différents services.

---

## Lexique et Acronymes
Pour que tout le système soit compréhensible par le personnel médical et non médical, voici la signification des termes techniques utilisés quotidiennement dans l'application :

*   **IPP (Identifiant Permanent du Patient)** : Numéro unique attribué à un patient dès sa première venue à l'hôpital. Il permet de regrouper tout son dossier médical.
*   **PMSI (Programme de Médicalisation des Systèmes d'Information)** : Système français de description de l'activité médicale. Il sert à coder les maladies et les actes pour financer l'hôpital (Tarification à l'Activité - T2A).
*   **DIM (Département de l'Information Médicale)** : Service chargé du traitement et de l'analyse des données médicales (notamment la validation du codage PMSI avant facturation).
*   **PACS (Picture Archiving and Communication System)** : Système informatique de gestion, d'archivage et de visualisation des images médicales (radiographies, scanners, IRM).
*   **OMS (Organisation Mondiale de la Santé)** : Dans le contexte chirurgical, on parle de la *"Check-list OMS"*, une procédure de sécurité obligatoire avant le début de toute opération.
*   **STAT** : Du latin *statim*. Signifie "Immédiatement" ou "Urgence absolue" (ex: pour une imagerie ou un examen de laboratoire).

---

## Les Modules Disponibles

L'application est divisée en plusieurs modules spécialisés. **L'accès à ces modules est strictement limité par le rôle de l'utilisateur** (un administratif n'aura pas accès à la prescription pharmaceutique, et un chirurgien n'aura pas accès aux fiches de paie).

| Module | Description | Utilisateurs Typiques |
| :--- | :--- | :--- |
| **Patients (Dossier Patient)** | Annuaire centralisé des patients, identités, historique. | Accueil, Infirmiers, Médecins, Admin |
| **Admissions & Lits** | Gestion des flux, affectation des lits, urgences. | Cadres de santé, Accueil, Médecins |
| **Pharmacie** | Gestion des stocks, dispensation des traitements. | Pharmaciens, Infirmiers |
| **Laboratoire** | Suivi des analyses biologiques et des résultats. | Biologistes, Techniciens de labo |
| **Bloc Opératoire** | Planification chirurgicale et traçabilité (Check-list). | Chirurgiens, IBODE, MAR |
| **Radiologie** | Demandes d'imagerie et consultation des comptes-rendus. | Radiologues, Manipulateurs radio |
| **Facturation & PMSI** | Parcours du codage médical jusqu'à la facturation. | Secrétaires médicales, DIM, Comptabilité |
| **Plannings & RH** | Gestion des plannings du personnel et affectations. | Cadres de santé, Direction RH |
| **Administration** | Configuration globale, gestion des accès et logs. | Administrateurs Système (DSI) |

---

## Le Flux des Modules (Workflows Détaillés)

### 1. Annuaire Patients & Admissions
**Le point d'entrée de l'hôpital.**
*   **Création** : Un nouvel arrivant est enregistré (création d'un IPP).
*   **Urgence vs Programmé** : Le patient est soit admis en urgence, soit prévu pour une intervention programmée.
*   **Affectation** : Il est dirigé vers un lit ou un service spécifique. 
*   *Action rapide* : Impression ou export en CSV des listes de présence pour les transmissions.

### 2. Imagerie (Radiologie) & Biologie (Labo)
**Les services d'investigation diagnostique.**
*   **Demande (Prescription)** : Le médecin crée une requête via un formulaire simplifié "Nouvelle Demande" en précisant le degré d'urgence (Routine, Urgent, STAT).
*   **Réalisation** : Le manipulateur radio ou technicien labo voit la demande en "Attente d'examen".
*   **Validation & Disponibilité** : Une fois l'examen validé, son statut passe en "Résultats disponibles" (connexion PACS pour la radiologie).

### 3. Bloc Opératoire (Chirurgie)
**L'endroit le plus sensible nécessitant une traçabilité parfaite.**
*   **Planification** : La secrétaire ou le chirurgien ajoute une intervention au planning de la semaine (état *Programmé*).
*   **Sécurité (Check-list OMS)** : Avant d'entrer en salle, l'équipe valide obligatoirement la check-list. Le système **bloque** électroniquement le démarrage (bouton Démarrer) tant que l'OMS n'est pas validée.
*   **Déroulement** : L'intervention passe *"En cours"*.
*   **Clôture** : Le chirurgien "Termine et Signe" (état *Terminé*). L'information part vers la facturation.

### 4. Pharmacie
**Le centre de distribution des produits de santé.**
*   L'infirmier ou le médecin consulte le stock ou demande une dotation.
*   Le logiciel trace les quantités disponibles pour éviter les ruptures critiques.

### 5. Facturation & DIM (Le Parcours PMSI)
La facturation hospitalière suit un workflow très rigoureux.
1.  **À coder (To Code)** : À la sortie d'un patient (urgence, séjour long, chirurgie), le dossier arrive ici. Le clinicien attribue des codes PMSI liés aux pathologies.
2.  **À valider DIM** : Les dossiers codés passent au département DIM qui vérifie la conformité (afin d'éviter les rejets de la caisse d'assurance maladie).
3.  **Prêt à Facturer** : Une fois l'acte médical certifié financièrement, le dossier descend à la comptabilité.
4.  **Facturé** : Les factures sont émises, expédiées ou mises à disposition sur le portail d'export.

---

## Les Workflows Inter-Modules (Le Parcours Central)

Aucun module ne fonctionne seul. Voici comment l'information vit dans l'établissement à travers un cas classique :

> **Patient Jean arrive aux urgences**
> 1. Accueil : Création dans **PATIENTS** → Le patient reçoit un IPP.
> 2. Lits : Admission assigne un lit dans **ADMISSIONS**.
> 3. Examens : Le médecin demande une IRM en statut "STAT" vers **RADIOLOGIE**.
> 4. Chirurgie : Suite à l'IRM, le bloc ouvre une entrée dans **BLOC OPÉRATOIRE**. La check-list OMS est validée, l'opération a lieu.
> 5. PMSI : Le patient sort. Le séjour complet atterrit automatiquement dans la file d'attente "To Code" de la **FACTURATION**.
> 6. Trésorerie : Le DIM valide, la comptabilité facture.

---

## Fonctionnalités Transversales

Sur la majeure partie des modules, vous retrouverez des outils universels (en haut à droite des tableaux) :

*   **Bouton Imprimer** : Génère une version propre de la table à l'écran, prête pour le dossier papier.
*   **Bouton Exporter (CSV)** : Télécharge instantanément un tableur Excel / CSV pour faire des rapports.
*   **Bouton Email** : Ouvre votre messagerie locale avec un texte pré-rempli et au design professionnel de l'établissement prêt pour accompagner une pièce jointe.
*   **Filtres Avancés / Boutons Statistiques rapides** : En cliquant sur les gros marqueurs colorés (ex: "Terminé", "À valider"), le tableau en dessous se filtre automatiquement.

## Sécurité & Administration
Medcare est hautement sécurisé :
- **Audit Logging** : L'administrateur peut visualiser **l'historique complet d'activité** de chaque collaborateur (qui a validé quel dossier, qui a téléchargé quel fichier).
- **Accès RBA** : La gestion des droits "Role-Based Access" garantit que si une personne non hilitée tente de modifier un dossier ou d'ouvrir un module qui ne lui appartient pas (par modification manuelle d'une URL de page par exemple), le système la bloquera via un panneau *"Accès au Module Restreint"*.

---
*Medcare - Développé pour la sécurité et l'efficience des soins.*
