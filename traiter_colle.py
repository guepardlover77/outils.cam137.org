#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Programme pour traiter les fichiers de notes d'examen et les organiser par licence.
"""

import pandas as pd
import sys
from pathlib import Path


def selectionner_fichier(titre, types_fichiers):
    """
    Ouvre un dialogue de sélection de fichier.

    Args:
        titre: Titre de la fenêtre de dialogue
        types_fichiers: Liste de tuples (description, extensions)

    Returns:
        str: Chemin du fichier sélectionné ou None si annulé
    """
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()  # Masquer la fenêtre principale
    root.attributes('-topmost', True)  # Mettre la fenêtre au premier plan

    fichier = filedialog.askopenfilename(
        title=titre,
        filetypes=types_fichiers
    )

    root.destroy()
    return fichier if fichier else None


def selectionner_licences_pour_groupes(licences_disponibles):
    """
    Permet à l'utilisateur de sélectionner quelles licences vont dans quels groupes.

    Args:
        licences_disponibles: Liste des licences disponibles

    Returns:
        dict: {'Groupe A': [licences], 'Groupe B': [licences], 'Groupe C': [licences]}
    """
    groupes = {'Groupe A': [], 'Groupe B': [], 'Groupe C': []}

    print("\n" + "=" * 70)
    print("CONFIGURATION DES GROUPES")
    print("=" * 70)
    print()
    print("Licences disponibles :")
    for i, licence in enumerate(licences_disponibles, 1):
        print(f"  {i}. {licence}")
    print()

    for groupe in ['Groupe A', 'Groupe B', 'Groupe C']:
        print(f"\n{groupe} :")
        print("Entrez les numéros des licences à inclure (séparés par des virgules)")
        print("ou 'tous' pour toutes les licences, ou 'aucun' pour passer :")

        choix = input("➜ ").strip().lower()

        if choix == 'aucun' or choix == '':
            print(f"  → Aucune licence sélectionnée pour {groupe}")
            continue

        if choix == 'tous' or choix == 'toutes':
            groupes[groupe] = licences_disponibles.copy()
            print(f"  ✓ Toutes les licences sélectionnées pour {groupe}")
            continue

        # Interpréter les numéros
        try:
            indices = [int(x.strip()) - 1 for x in choix.split(',')]
            licences_selectionnees = []

            for idx in indices:
                if 0 <= idx < len(licences_disponibles):
                    licences_selectionnees.append(licences_disponibles[idx])
                else:
                    print(f"  ⚠ Numéro {idx + 1} invalide, ignoré")

            groupes[groupe] = licences_selectionnees
            print(f"  ✓ {len(licences_selectionnees)} licence(s) sélectionnée(s) pour {groupe}")

        except ValueError:
            print(f"  ⚠ Entrée invalide. Aucune licence sélectionnée pour {groupe}")

    return groupes


def lire_fichier_csv_notes(fichier_path):
    """
    Lit un fichier CSV de notes avec le format spécifique (séparateur ;).

    Args:
        fichier_path: Chemin vers le fichier CSV de notes

    Returns:
        tuple: (dict_notes, taux_reussite, erreurs) où dict_notes = {numero: note},
               taux_reussite = {question: taux}, et erreurs = liste des problèmes trouvés
    """
    try:
        print(f"📄 Lecture du fichier CSV : {fichier_path}")

        # Lire le fichier CSV avec séparateur ;
        df = pd.read_csv(fichier_path, sep=';', header=0)

        print(f"   ✓ Fichier chargé : {df.shape[0]} lignes x {df.shape[1]} colonnes")

        # Extraire les notes des étudiants
        dict_notes = {}
        erreurs = []
        etudiants_sans_numero = 0

        # Colonnes attendues : "Mark" pour la note, "etu" pour le numéro d'anonymat
        if 'Mark' not in df.columns or 'etu' not in df.columns:
            print(f"✗ Erreur : Le fichier doit contenir les colonnes 'Mark' et 'etu'")
            print(f"   Colonnes trouvées : {df.columns.tolist()}")
            sys.exit(1)

        # Calculer les taux de réussite à partir des colonnes Q01 à Q40
        taux_reussite = {}
        questions_colonnes = [col for col in df.columns if col.startswith('Q') and len(col) == 3]

        for question_col in sorted(questions_colonnes):
            # Compter le nombre de 1 (bonnes réponses) pour cette question
            bonnes_reponses = df[question_col].sum()
            total_reponses = df[question_col].notna().sum()

            if total_reponses > 0:
                taux = bonnes_reponses / total_reponses
                taux_reussite[question_col] = taux

        print(f"   ✓ {len(taux_reussite)} taux de réussite calculés")

        # Extraire les notes et numéros d'étudiants
        for idx, row in df.iterrows():
            numero_raw = row.get('etu')
            note_raw = row.get('Mark')

            # Vérifier que les données sont valides
            if pd.notna(numero_raw) and pd.notna(note_raw) and str(numero_raw).strip() != '' and str(note_raw).strip() != '':
                try:
                    # Conversion plus robuste
                    numero_str = str(numero_raw).strip()
                    note_str = str(note_raw).strip().replace(',', '.')

                    # Gérer les numéros qui peuvent être des entiers ou des chaînes
                    try:
                        numero = str(int(float(numero_str)))
                    except ValueError:
                        numero = numero_str

                    note = float(note_str)

                    # Vérifier que le numéro a exactement 4 chiffres
                    if len(numero) != 4 or not numero.isdigit():
                        erreurs.append({
                            'type': 'numero_invalide',
                            'numero': numero,
                            'note': note,
                            'ligne': idx + 2,  # +2 car ligne 0 = header, et on commence à 0
                            'raison': f"Le numéro doit comporter exactement 4 chiffres (trouvé: {numero})"
                        })
                        continue

                    dict_notes[numero] = note
                except (ValueError, TypeError, AttributeError) as e:
                    etudiants_sans_numero += 1
            else:
                etudiants_sans_numero += 1

        print(f"   ✓ {len(dict_notes)} notes extraites")
        if etudiants_sans_numero > 0:
            print(f"   ⚠ {etudiants_sans_numero} ligne(s) ignorée(s) (données manquantes)")
        if erreurs:
            print(f"   ⚠ {len(erreurs)} erreur(s) de validation détectée(s)")

        return dict_notes, taux_reussite, erreurs

    except FileNotFoundError:
        print(f"✗ Erreur : Le fichier {fichier_path} n'existe pas.")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Erreur lors de la lecture du fichier CSV de notes : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def lire_fichier_notes(fichier_path):
    """
    Lit le fichier de notes et extrait les données nécessaires.
    Détecte automatiquement le format (XLSX ou CSV).

    Args:
        fichier_path: Chemin vers le fichier de notes

    Returns:
        tuple: (dict_notes, taux_reussite, erreurs) où dict_notes = {numero: note},
               taux_reussite = {question: taux}, et erreurs = liste des problèmes trouvés
    """
    # Détecter l'extension du fichier
    extension = Path(fichier_path).suffix.lower()

    if extension == '.csv':
        return lire_fichier_csv_notes(fichier_path)
    elif extension in ['.xlsx', '.xls']:
        return lire_fichier_xlsx_notes(fichier_path)
    else:
        print(f"✗ Erreur : Format de fichier non supporté : {extension}")
        print(f"   Formats supportés : .xlsx, .csv")
        sys.exit(1)


def lire_fichier_xlsx_notes(fichier_path):
    """
    Lit un fichier XLSX de notes (ancienne méthode).

    Args:
        fichier_path: Chemin vers le fichier XLSX de notes

    Returns:
        tuple: (dict_notes, taux_reussite, erreurs) où dict_notes = {numero: note},
               taux_reussite = {question: taux}, et erreurs = liste des problèmes trouvés
    """
    try:
        print(f"📄 Lecture du fichier XLSX : {fichier_path}")

        # Lire le fichier XLSX
        df = pd.read_excel(fichier_path, sheet_name=0, header=None)

        print(f"   ✓ Fichier chargé : {df.shape[0]} lignes x {df.shape[1]} colonnes")

        # Vérifier que nous avons au moins 47 colonnes (index 0 à 46)
        if df.shape[1] < 47:
            print(f"   ⚠ Attention : Le fichier ne contient que {df.shape[1]} colonnes, 47 attendues")
            print(f"   ℹ Extension de la DataFrame pour ajouter les colonnes manquantes...")
            # Ajouter des colonnes vides si nécessaire
            for i in range(df.shape[1], 47):
                df[i] = pd.NA


        # Extraire les taux de réussite (ligne 4, index 4)
        taux_reussite = {}
        ligne_taux = df.iloc[4]

        # Les questions sont dans les colonnes 6 à 45 (Q01 à Q40)
        for i in range(6, 46):
            question_num = i - 5  # Q01 = 1, Q02 = 2, etc.
            taux = ligne_taux.get(i) if i in ligne_taux.index else None
            if pd.notna(taux) and taux != '':
                try:
                    # Gérer les différents formats possibles
                    taux_float = float(str(taux).replace(',', '.').replace('%', ''))
                    taux_reussite[f"Q{question_num:02d}"] = taux_float
                except (ValueError, TypeError, AttributeError):
                    pass  # Ignorer les valeurs non convertibles

        print(f"   ✓ {len(taux_reussite)} taux de réussite extraits")

        # Extraire les notes des étudiants (à partir de la ligne 5, index 5)
        dict_notes = {}
        erreurs = []
        etudiants_sans_numero = 0

        for idx in range(5, len(df)):
            ligne = df.iloc[idx]

            # Colonne 46 : numéro d'anonymat
            # Colonne 3 : note
            numero_raw = ligne.get(46) if 46 in ligne.index else None
            note_raw = ligne.get(3) if 3 in ligne.index else None

            # Vérifier que les données sont valides
            if pd.notna(numero_raw) and pd.notna(note_raw) and numero_raw != '' and note_raw != '':
                try:
                    # Conversion plus robuste
                    numero_str = str(numero_raw).strip()
                    note_str = str(note_raw).strip().replace(',', '.')

                    numero = str(int(float(numero_str)))
                    note = float(note_str)

                    # Vérifier que le numéro a exactement 4 chiffres
                    if len(numero) != 4 or not numero.isdigit():
                        erreurs.append({
                            'type': 'numero_invalide',
                            'numero': numero,
                            'note': note,
                            'ligne': idx + 1,
                            'raison': f"Le numéro doit comporter exactement 4 chiffres (trouvé: {numero})"
                        })
                        continue

                    dict_notes[numero] = note
                except (ValueError, TypeError, AttributeError) as e:
                    etudiants_sans_numero += 1
            else:
                etudiants_sans_numero += 1

        print(f"   ✓ {len(dict_notes)} notes extraites")
        if etudiants_sans_numero > 0:
            print(f"   ⚠ {etudiants_sans_numero} ligne(s) ignorée(s) (données manquantes)")
        if erreurs:
            print(f"   ⚠ {len(erreurs)} erreur(s) de validation détectée(s)")

        return dict_notes, taux_reussite, erreurs
        
    except FileNotFoundError:
        print(f"✗ Erreur : Le fichier {fichier_path} n'existe pas.")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Erreur lors de la lecture du fichier de notes : {e}")
        sys.exit(1)


def lire_fichier_licences(fichier_path):
    """
    Lit le fichier des licences.
    Détecte automatiquement le format (XLSX ou CSV).

    Args:
        fichier_path: Chemin vers le fichier des licences (XLSX ou CSV)

    Returns:
        dict: {numero_anonymat: licence}
    """
    try:
        print(f"📄 Lecture du fichier : {fichier_path}")

        # Détecter l'extension du fichier
        extension = Path(fichier_path).suffix.lower()

        # Lire le fichier selon l'extension
        if extension == '.csv':
            df = pd.read_csv(fichier_path, sep=';')
        elif extension in ['.xlsx', '.xls']:
            df = pd.read_excel(fichier_path)
        else:
            print(f"✗ Erreur : Format de fichier non supporté : {extension}")
            print(f"   Formats supportés : .xlsx, .csv")
            sys.exit(1)

        print(f"   ✓ Fichier chargé : {len(df)} étudiants")

        # Colonnes attendues : "Numéro Anonymat" et "Licence"
        if 'Numéro Anonymat' not in df.columns or 'Licence' not in df.columns:
            print(f"✗ Erreur : Le fichier doit contenir les colonnes 'Numéro Anonymat' et 'Licence'")
            print(f"   Colonnes trouvées : {df.columns.tolist()}")
            sys.exit(1)

        dict_licences = {}
        for _, row in df.iterrows():
            numero = str(int(row['Numéro Anonymat']))
            licence = str(row['Licence']).strip()
            dict_licences[numero] = licence

        return dict_licences

    except FileNotFoundError:
        print(f"✗ Erreur : Le fichier {fichier_path} n'existe pas.")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Erreur lors de la lecture du fichier des licences : {e}")
        sys.exit(1)


def separer_notes_par_premier_chiffre(dict_notes, taux_reussite, fichier_notes_original):
    """
    Sépare les notes en deux groupes selon le premier chiffre du numéro CREM :
    - Groupe 1 : numéros commençant par 1, 7 ou 8
    - Groupe 2 : numéros commençant par 9

    Crée deux fichiers de notes séparés.

    Args:
        dict_notes: {numero: note}
        taux_reussite: {question: taux}
        fichier_notes_original: Chemin du fichier de notes original

    Returns:
        tuple: (fichier_178, fichier_9) chemins des deux fichiers créés
    """
    print("\n" + "=" * 70)
    print("SÉPARATION DES NUMÉROS CREM")
    print("=" * 70)
    print()

    # Séparer les notes en deux groupes
    notes_178 = {}  # Numéros commençant par 1, 7 ou 8
    notes_9 = {}    # Numéros commençant par 9

    for numero, note in dict_notes.items():
        premier_chiffre = numero[0]
        if premier_chiffre in ['1', '7', '8']:
            notes_178[numero] = note
        elif premier_chiffre == '9':
            notes_9[numero] = note
        else:
            print(f"⚠ Attention : numéro {numero} commence par '{premier_chiffre}', ignoré")

    print(f"✓ {len(notes_178)} numéros commençant par 1, 7 ou 8")
    print(f"✓ {len(notes_9)} numéros commençant par 9")
    print()

    # Déterminer le format et le nom de base du fichier original
    fichier_path = Path(fichier_notes_original)
    extension = fichier_path.suffix.lower()
    nom_base = fichier_path.stem
    repertoire = fichier_path.parent

    # Créer les noms de fichiers pour les deux groupes
    fichier_178 = repertoire / f"{nom_base}_1-7-8{extension}"
    fichier_9 = repertoire / f"{nom_base}_9{extension}"

    # Créer les deux fichiers selon le format
    if extension == '.csv':
        _creer_fichier_csv_separe(notes_178, taux_reussite, str(fichier_178), "1, 7 ou 8")
        _creer_fichier_csv_separe(notes_9, taux_reussite, str(fichier_9), "9")
    elif extension in ['.xlsx', '.xls']:
        _creer_fichier_xlsx_separe(notes_178, taux_reussite, str(fichier_178), "1, 7 ou 8")
        _creer_fichier_xlsx_separe(notes_9, taux_reussite, str(fichier_9), "9")
    else:
        print(f"✗ Erreur : format de fichier non supporté : {extension}")
        sys.exit(1)

    print()
    print(f"✓ Fichiers créés :")
    print(f"  📁 Groupe 1/7/8 : {fichier_178}")
    print(f"  📁 Groupe 9 : {fichier_9}")
    print()

    return str(fichier_178), str(fichier_9)


def _creer_fichier_csv_separe(dict_notes, taux_reussite, fichier_path, description):
    """
    Crée un fichier CSV avec les notes filtrées.

    Args:
        dict_notes: {numero: note}
        taux_reussite: {question: taux}
        fichier_path: Chemin du fichier à créer
        description: Description du groupe (pour les logs)
    """
    # Créer un DataFrame avec les colonnes 'etu' et 'Mark'
    data = {
        'etu': list(dict_notes.keys()),
        'Mark': list(dict_notes.values())
    }

    # Ajouter les colonnes de taux de réussite
    for question in sorted(taux_reussite.keys()):
        data[question] = [taux_reussite[question]] * len(dict_notes)

    df = pd.DataFrame(data)
    df.to_csv(fichier_path, sep=';', index=False)
    print(f"✓ Fichier CSV créé pour le groupe {description} : {len(dict_notes)} étudiants")


def _creer_fichier_xlsx_separe(dict_notes, taux_reussite, fichier_path, description):
    """
    Crée un fichier XLSX avec les notes filtrées.

    Args:
        dict_notes: {numero: note}
        taux_reussite: {question: taux}
        fichier_path: Chemin du fichier à créer
        description: Description du groupe (pour les logs)
    """
    # Créer un DataFrame avec la structure attendue
    # Lignes 0-3 : entêtes et infos
    # Ligne 4 : taux de réussite
    # Lignes 5+ : données étudiants

    # Préparer les données
    data_rows = []

    # Ligne 0-3 : entêtes (vides pour simplifier)
    for _ in range(4):
        data_rows.append([None] * 47)

    # Ligne 4 : taux de réussite
    ligne_taux = [None] * 47
    for i, question in enumerate(sorted(taux_reussite.keys()), start=6):
        if i < 46:
            ligne_taux[i] = taux_reussite[question]
    data_rows.append(ligne_taux)

    # Lignes 5+ : données étudiants
    for numero, note in dict_notes.items():
        ligne = [None] * 47
        ligne[3] = note      # Colonne 3 : note
        ligne[46] = numero   # Colonne 46 : numéro d'anonymat
        data_rows.append(ligne)

    # Créer le DataFrame et sauvegarder
    df = pd.DataFrame(data_rows)
    df.to_excel(fichier_path, index=False, header=False)
    print(f"✓ Fichier XLSX créé pour le groupe {description} : {len(dict_notes)} étudiants")


def afficher_erreurs(erreurs):
    """
    Affiche les erreurs de validation trouvées dans le fichier de notes.

    Args:
        erreurs: Liste des erreurs de validation
    """
    if not erreurs:
        return

    print("\n" + "=" * 70)
    print("ERREURS DE VALIDATION DÉTECTÉES")
    print("=" * 70)
    print()
    print("Les numéros d'anonymat suivants ne sont pas valides (doivent être à 4 chiffres) :")
    print()

    for i, erreur in enumerate(erreurs, 1):
        print(f"{i}. Ligne {erreur['ligne']} : Numéro '{erreur['numero']}' (Note: {erreur['note']:.2f})")
        print(f"   → {erreur['raison']}")

    print()
    print("Ces étudiants ont été ignorés et ne seront pas inclus dans le fichier de sortie.")
    print("Veuillez corriger ces numéros dans le fichier source et relancer le programme.")
    print("=" * 70)
    print()


def assigner_licences_interactif(etudiants_ignores, etudiants_par_licence, dict_licences):
    """
    Permet à l'utilisateur d'assigner interactivement une licence aux étudiants non trouvés.

    Args:
        etudiants_ignores: Liste des (numero, note) non trouvés
        etudiants_par_licence: Dict {licence: [(numero, note), ...]}
        dict_licences: Dict {numero: licence} (sera modifié)

    Returns:
        tuple: (etudiants_par_licence mis à jour, nouvelle liste etudiants_ignores)
    """
    if not etudiants_ignores:
        return etudiants_par_licence, []

    print("\n" + "=" * 70)
    print("ÉTUDIANTS NON TROUVÉS DANS LE FICHIER DES LICENCES")
    print("=" * 70)
    print()
    print(f"{len(etudiants_ignores)} étudiant(s) avec un numéro à 4 chiffres n'ont pas été trouvés :")
    print()

    for i, (numero, note) in enumerate(etudiants_ignores, 1):
        print(f"{i}. Numéro {numero} (Note: {note:.2f})")

    print()
    print("Licences disponibles dans le fichier :")
    licences_disponibles = sorted(set(dict_licences.values()))
    for i, licence in enumerate(licences_disponibles, 1):
        print(f"  {i}. {licence}")

    print()
    print("Voulez-vous assigner ces étudiants à des licences ? (o/n)")
    reponse = input("➜ ").strip().lower()

    if reponse != 'o':
        print("Les étudiants non trouvés seront ignorés.")
        return etudiants_par_licence, etudiants_ignores

    nouveaux_ignores = []

    for numero, note in etudiants_ignores:
        print()
        print(f"Étudiant : Numéro {numero} (Note: {note:.2f})")
        print("Entrez le numéro ou le nom de la licence (ou 'i' pour ignorer) :")

        choix = input("➜ ").strip()

        if choix.lower() == 'i':
            nouveaux_ignores.append((numero, note))
            print(f"  → Étudiant {numero} ignoré")
            continue

        # Essayer d'interpréter comme un numéro
        try:
            idx = int(choix) - 1
            if 0 <= idx < len(licences_disponibles):
                licence = licences_disponibles[idx]
            else:
                print(f"  ⚠ Numéro invalide. Étudiant {numero} ignoré")
                nouveaux_ignores.append((numero, note))
                continue
        except ValueError:
            # Interpréter comme un nom de licence
            licence = choix

        # Ajouter l'étudiant à la licence
        if licence not in etudiants_par_licence:
            etudiants_par_licence[licence] = []

        etudiants_par_licence[licence].append((numero, note))
        dict_licences[numero] = licence
        print(f"  ✓ Étudiant {numero} assigné à la licence '{licence}'")

    # Retrier chaque liste
    for licence in etudiants_par_licence:
        etudiants_par_licence[licence].sort(key=lambda x: x[1], reverse=True)

    if nouveaux_ignores:
        print()
        print(f"⚠ {len(nouveaux_ignores)} étudiant(s) ignoré(s) ne seront pas inclus dans le fichier de sortie.")

    return etudiants_par_licence, nouveaux_ignores


def organiser_donnees(dict_notes, dict_licences):
    """
    Organise les données par licence.

    Args:
        dict_notes: {numero: note}
        dict_licences: {numero: licence}

    Returns:
        tuple: (etudiants_par_licence, etudiants_ignores) où
               etudiants_par_licence = {licence: [(numero, note), ...]} et
               etudiants_ignores = [(numero, note), ...]
    """
    etudiants_par_licence = {}
    etudiants_ignores = []

    for numero, note in dict_notes.items():
        if numero in dict_licences:
            licence = dict_licences[numero]

            if licence not in etudiants_par_licence:
                etudiants_par_licence[licence] = []

            etudiants_par_licence[licence].append((numero, note))
        else:
            etudiants_ignores.append((numero, note))

    # Afficher les étudiants ignorés
    if etudiants_ignores:
        print(f"\n⚠ {len(etudiants_ignores)} étudiant(s) non trouvé(s) dans le fichier des licences :")
        print()
        # Trier par numéro pour un affichage ordonné
        etudiants_ignores_tries = sorted(etudiants_ignores, key=lambda x: x[0])
        for numero, note in etudiants_ignores_tries:
            print(f"   • Numéro CREM : {numero} (Note : {note:.2f})")
        print()
        print(f"   Total d'étudiants traités : {sum(len(v) for v in etudiants_par_licence.values())}/{len(dict_notes)}")

    # Trier chaque liste par note décroissante
    for licence in etudiants_par_licence:
        etudiants_par_licence[licence].sort(key=lambda x: x[1], reverse=True)

    return etudiants_par_licence, etudiants_ignores


def creer_fichier_sortie(etudiants_par_licence, taux_reussite, fichier_sortie="resultats.xlsx", groupes=None, etudiants_ignores=None):
    """
    Crée le fichier XLSX de sortie avec toutes les feuilles.

    Args:
        etudiants_par_licence: {licence: [(numero, note), ...]}
        taux_reussite: {question: taux}
        fichier_sortie: Nom du fichier de sortie
        groupes: dict {'Groupe A': [licences], 'Groupe B': [licences], 'Groupe C': [licences]}
        etudiants_ignores: [(numero, note), ...] étudiants sans licence

    Returns:
        str: Chemin absolu du fichier créé
    """
    if groupes is None:
        groupes = {'Groupe A': [], 'Groupe B': [], 'Groupe C': []}
    if etudiants_ignores is None:
        etudiants_ignores = []

    # Forcer l'extension .xlsx si une autre extension est fournie
    extension = Path(fichier_sortie).suffix.lower()
    if extension != '.xlsx':
        print(f"⚠ Extension '{extension}' non supportée, utilisation de .xlsx à la place")
        fichier_sortie = str(Path(fichier_sortie).with_suffix('.xlsx'))

    # Convertir en chemin absolu
    chemin_absolu = str(Path(fichier_sortie).resolve())

    try:
        with pd.ExcelWriter(chemin_absolu, engine='openpyxl') as writer:
            # ===== FEUILLE "Général" =====
            tous_etudiants = []
            for licence, etudiants in etudiants_par_licence.items():
                for numero, note in etudiants:
                    tous_etudiants.append({
                        'Numéro CREM': numero,
                        'Note': note,
                        'Licence': licence
                    })
            
            df_general = pd.DataFrame(tous_etudiants)
            df_general = df_general.sort_values('Note', ascending=False)
            df_general.to_excel(writer, sheet_name='Général', index=False)
            print(f"✓ Feuille 'Général' créée avec {len(df_general)} étudiants")
            
            # ===== FEUILLE "Stats" =====
            stats_data = []
            
            # Statistiques générales
            toutes_notes = [note for _, etudiants in etudiants_par_licence.items() 
                           for _, note in etudiants]
            
            if toutes_notes:
                stats_data.append({
                    'Licence': 'GÉNÉRAL',
                    'Nombre d\'étudiants': len(toutes_notes),
                    'Moyenne': round(sum(toutes_notes) / len(toutes_notes), 2),
                    'Médiane': round(pd.Series(toutes_notes).median(), 2),
                    'Écart-type': round(pd.Series(toutes_notes).std(), 2),
                    'Note min': round(min(toutes_notes), 2),
                    'Note max': round(max(toutes_notes), 2)
                })
                
                # Ligne vide
                stats_data.append({
                    'Licence': '', 'Nombre d\'étudiants': '', 'Moyenne': '',
                    'Médiane': '', 'Écart-type': '', 'Note min': '', 'Note max': ''
                })
                
                # Statistiques par licence
                for licence in sorted(etudiants_par_licence.keys()):
                    notes = [note for _, note in etudiants_par_licence[licence]]
                    stats_data.append({
                        'Licence': licence,
                        'Nombre d\'étudiants': len(notes),
                        'Moyenne': round(sum(notes) / len(notes), 2),
                        'Médiane': round(pd.Series(notes).median(), 2),
                        'Écart-type': round(pd.Series(notes).std(), 2),
                        'Note min': round(min(notes), 2),
                        'Note max': round(max(notes), 2)
                    })
            
            df_stats = pd.DataFrame(stats_data)
            
            # Ajouter une section vide puis les taux de réussite
            if taux_reussite:
                # Ajouter 2 lignes vides
                for _ in range(2):
                    df_stats = pd.concat([df_stats, pd.DataFrame([{
                        'Licence': '', 'Nombre d\'étudiants': '', 'Moyenne': '',
                        'Médiane': '', 'Écart-type': '', 'Note min': '', 'Note max': ''
                    }])], ignore_index=True)
                
                # Ajouter un titre pour la section taux de réussite
                df_stats = pd.concat([df_stats, pd.DataFrame([{
                    'Licence': 'TAUX DE RÉUSSITE PAR QUESTION',
                    'Nombre d\'étudiants': '', 'Moyenne': '',
                    'Médiane': '', 'Écart-type': '', 'Note min': '', 'Note max': ''
                }])], ignore_index=True)
                
                # Ajouter les taux de réussite
                for question in sorted(taux_reussite.keys()):
                    taux = round(taux_reussite[question] * 100, 2)
                    df_stats = pd.concat([df_stats, pd.DataFrame([{
                        'Licence': question,
                        'Nombre d\'étudiants': f'{taux}%',
                        'Moyenne': '', 'Médiane': '', 'Écart-type': '', 
                        'Note min': '', 'Note max': ''
                    }])], ignore_index=True)
            
            df_stats.to_excel(writer, sheet_name='Stats', index=False)
            print(f"✓ Feuille 'Stats' créée")
            
            # ===== FEUILLES PAR LICENCE =====
            for licence in sorted(etudiants_par_licence.keys()):
                data = {
                    'Numéro CREM': [etudiant[0] for etudiant in etudiants_par_licence[licence]],
                    'Note': [etudiant[1] for etudiant in etudiants_par_licence[licence]]
                }
                df = pd.DataFrame(data)
                df.to_excel(writer, sheet_name=licence, index=False)
                print(f"✓ Feuille '{licence}' créée avec {len(df)} étudiants")

            # ===== FEUILLES DE GROUPES =====
            for nom_groupe in ['Groupe A', 'Groupe B', 'Groupe C']:
                licences_groupe = groupes.get(nom_groupe, [])

                if not licences_groupe:
                    print(f"⚠ Groupe '{nom_groupe}' : aucune licence sélectionnée, feuille non créée")
                    continue

                # Regrouper tous les étudiants des licences sélectionnées
                etudiants_groupe = []
                for licence in licences_groupe:
                    if licence in etudiants_par_licence:
                        for numero, note in etudiants_par_licence[licence]:
                            etudiants_groupe.append({
                                'Numéro CREM': numero,
                                'Note': note,
                                'Licence': licence
                            })

                if etudiants_groupe:
                    df_groupe = pd.DataFrame(etudiants_groupe)
                    df_groupe = df_groupe.sort_values('Note', ascending=False)
                    df_groupe.to_excel(writer, sheet_name=nom_groupe, index=False)
                    print(f"✓ Feuille '{nom_groupe}' créée avec {len(df_groupe)} étudiants de {len(licences_groupe)} licence(s)")
                else:
                    print(f"⚠ Groupe '{nom_groupe}' : aucun étudiant trouvé, feuille non créée")

            # ===== FEUILLE "Sans Licence" =====
            if etudiants_ignores:
                data_sans_licence = {
                    'Numéro CREM': [etudiant[0] for etudiant in etudiants_ignores],
                    'Note': [etudiant[1] for etudiant in etudiants_ignores]
                }
                df_sans_licence = pd.DataFrame(data_sans_licence)
                df_sans_licence = df_sans_licence.sort_values('Note', ascending=False)
                df_sans_licence.to_excel(writer, sheet_name='Sans Licence', index=False)
                print(f"⚠ Feuille 'Sans Licence' créée avec {len(df_sans_licence)} étudiants")

        print(f"\n✓ Fichier créé avec succès !")
        print(f"  📁 Emplacement : {chemin_absolu}")
        print(f"  Total de {len(etudiants_par_licence)} licences traitées")
        if etudiants_ignores:
            print(f"  ⚠ {len(etudiants_ignores)} étudiant(s) sans licence")

        return chemin_absolu

    except Exception as e:
        print(f"✗ Erreur lors de la création du fichier de sortie : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Fonction principale."""
    print("=" * 70)
    print("Programme de traitement des notes d'examen par licence")
    print("=" * 70)
    print()

    # Sélectionner le fichier de notes
    print("📂 Sélectionnez le fichier de notes (XLSX ou CSV)...")
    fichier_notes = selectionner_fichier(
        "Sélectionner le fichier de notes",
        [("Fichiers CSV", "*.csv"), ("Fichiers XLSX", "*.xlsx"), ("Tous les fichiers", "*.*")]
    )

    if not fichier_notes:
        print("✗ Aucun fichier sélectionné. Abandon.")
        sys.exit(0)

    print(f"✓ Fichier sélectionné : {fichier_notes}")
    print()

    # Sélectionner le fichier des licences
    print("📂 Sélectionnez le fichier des licences (XLSX ou CSV)...")
    fichier_licences = selectionner_fichier(
        "Sélectionner le fichier des licences",
        [("Fichiers CSV", "*.csv"), ("Fichiers XLSX", "*.xlsx"), ("Tous les fichiers", "*.*")]
    )

    if not fichier_licences:
        print("✗ Aucun fichier sélectionné. Abandon.")
        sys.exit(0)

    print(f"✓ Fichier sélectionné : {fichier_licences}")
    print()

    # Demander le nom du fichier de sortie
    print("Nom du fichier de sortie [resultats.xlsx] :")
    fichier_sortie = input("➜ ").strip()

    if not fichier_sortie:
        fichier_sortie = "resultats.xlsx"

    print()
    print("-" * 70)
    print("Traitement en cours...")
    print("-" * 70)
    print()

    # Lire les fichiers
    dict_notes, taux_reussite, erreurs = lire_fichier_notes(fichier_notes)
    print()

    # Afficher les erreurs de validation
    afficher_erreurs(erreurs)

    # Séparer les notes par premier chiffre et créer deux fichiers
    fichier_178, fichier_9 = separer_notes_par_premier_chiffre(dict_notes, taux_reussite, fichier_notes)

    dict_licences = lire_fichier_licences(fichier_licences)
    print()

    # Organiser les données
    print("-" * 70)
    print("Organisation des données par licence...")
    print("-" * 70)
    print()
    print(f"📊 Total de notes à traiter : {len(dict_notes)}")
    print(f"📋 Total d'étudiants dans le fichier licences : {len(dict_licences)}")
    etudiants_par_licence, etudiants_ignores = organiser_donnees(dict_notes, dict_licences)

    # Afficher la répartition détaillée par licence
    if etudiants_par_licence:
        print()
        print("📌 Répartition par licence :")
        for licence in sorted(etudiants_par_licence.keys()):
            nb_etudiants = len(etudiants_par_licence[licence])
            print(f"   • {licence} : {nb_etudiants} étudiant(s)")
    print()

    # Permettre l'assignation interactive des licences
    if etudiants_ignores:
        etudiants_par_licence, etudiants_ignores = assigner_licences_interactif(
            etudiants_ignores, etudiants_par_licence, dict_licences
        )
        print()

    # Configurer les groupes
    licences_disponibles = sorted(etudiants_par_licence.keys())
    groupes = selectionner_licences_pour_groupes(licences_disponibles)
    print()

    # Créer le fichier de sortie
    print("-" * 70)
    print("Création du fichier de sortie...")
    print("-" * 70)
    print()
    chemin_final = creer_fichier_sortie(etudiants_par_licence, taux_reussite, fichier_sortie, groupes, etudiants_ignores)

    print()
    print("=" * 70)
    print("Traitement terminé avec succès !")
    print("=" * 70)
    print()
    print(f"📄 Fichier disponible ici : {chemin_final}")
    print()
    print("Vous pouvez maintenant ouvrir ce fichier avec Excel.")


if __name__ == "__main__":
    main()
