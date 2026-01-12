#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour construire un fichier Excel avec les numéros d'anonymat et licences
à partir de plusieurs fichiers xlsx dont le nom correspond à la licence.
"""

import pandas as pd
import os
import sys
from pathlib import Path


def extraire_numeros_anonymat(fichier_path):
    """
    Extrait les numéros d'anonymat d'un fichier Excel.
    
    Args:
        fichier_path: Chemin vers le fichier Excel
        
    Returns:
        list: Liste des numéros d'anonymat uniques (convertis en entiers)
    """
    try:
        # Lire le fichier avec header
        df = pd.read_excel(fichier_path, header=0)
        
        # Chercher la colonne qui contient les numéros d'anonymat
        # On cherche une colonne nommée "Client" ou contenant "client" (insensible à la casse)
        colonne_client = None
        for col in df.columns:
            if 'client' in str(col).lower() and 'nom' not in str(col).lower():
                colonne_client = col
                break
        
        if colonne_client is None:
            print(f"  ⚠ Attention : Colonne 'Client' non trouvée dans {fichier_path.name}")
            print(f"     Colonnes disponibles : {df.columns.tolist()}")
            return []
        
        # Extraire les numéros d'anonymat (supprimer NaN et doublons)
        numeros = df[colonne_client].dropna().unique()
        
        # Convertir en entiers (pour gérer les floats comme 9245.0)
        numeros = [int(num) for num in numeros if pd.notna(num)]
        
        return numeros
        
    except Exception as e:
        print(f"  ✗ Erreur lors de la lecture de {fichier_path.name} : {e}")
        return []


def construire_fichier_licences(dossier_source, fichier_sortie_17="licences_1_7.xlsx", fichier_sortie_9="licences_9.xlsx"):
    """
    Construit deux fichiers Excel avec les numéros d'anonymat et licences.
    Un fichier pour les numéros commençant par 1 ou 7, un autre pour ceux commençant par 9.
    
    Args:
        dossier_source: Chemin du dossier contenant les fichiers xlsx
        fichier_sortie_17: Nom du fichier de sortie pour les numéros commençant par 1 ou 7
        fichier_sortie_9: Nom du fichier de sortie pour les numéros commençant par 9
    """
    print("=" * 70)
    print("Construction des fichiers des licences")
    print("=" * 70)
    print()
    
    # Convertir en Path
    dossier = Path(dossier_source)
    
    # Vérifier que le dossier existe
    if not dossier.exists():
        print(f"✗ Erreur : Le dossier '{dossier}' n'existe pas.")
        sys.exit(1)
    
    if not dossier.is_dir():
        print(f"✗ Erreur : '{dossier}' n'est pas un dossier.")
        sys.exit(1)
    
    # Trouver tous les fichiers .xlsx dans le dossier
    fichiers_xlsx = list(dossier.glob("*.xlsx"))
    
    if not fichiers_xlsx:
        print(f"✗ Aucun fichier .xlsx trouvé dans le dossier '{dossier}'")
        sys.exit(1)
    
    print(f"📁 Dossier source : {dossier.absolute()}")
    print(f"📊 {len(fichiers_xlsx)} fichier(s) .xlsx trouvé(s)")
    print()
    print("-" * 70)
    print("Traitement des fichiers...")
    print("-" * 70)
    print()
    
    # Listes pour stocker les étudiants par catégorie
    etudiants_1_7 = []  # Numéros commençant par 1 ou 7
    etudiants_9 = []     # Numéros commençant par 9
    stats_licences = {}
    stats_par_categorie = {'1_7': {}, '9': {}}
    
    # Parcourir chaque fichier
    for fichier in sorted(fichiers_xlsx):
        # Le nom du fichier (sans extension) est le nom de la licence
        nom_licence = fichier.stem.upper()
        
        print(f"📄 Traitement de : {fichier.name}")
        print(f"   Licence : {nom_licence}")
        
        # Extraire les numéros d'anonymat
        numeros = extraire_numeros_anonymat(fichier)
        
        if numeros:
            print(f"   ✓ {len(numeros)} numéro(s) d'anonymat trouvé(s)")
            
            # Compter par catégorie
            count_1_7 = 0
            count_9 = 0
            
            # Répartir par catégorie selon le premier chiffre
            for numero in numeros:
                premier_chiffre = str(numero)[0]
                
                if premier_chiffre in ['1', '7']:
                    etudiants_1_7.append({
                        'Numéro Anonymat': numero,
                        'Licence': nom_licence
                    })
                    count_1_7 += 1
                elif premier_chiffre == '9':
                    etudiants_9.append({
                        'Numéro Anonymat': numero,
                        'Licence': nom_licence
                    })
                    count_9 += 1
            
            stats_licences[nom_licence] = len(numeros)
            stats_par_categorie['1_7'][nom_licence] = count_1_7
            stats_par_categorie['9'][nom_licence] = count_9
            
            print(f"      → {count_1_7} numéro(s) commençant par 1 ou 7")
            print(f"      → {count_9} numéro(s) commençant par 9")
        else:
            print(f"   ⚠ Aucun numéro d'anonymat trouvé")
        
        print()
    
    # Vérifier qu'on a des données
    if not etudiants_1_7 and not etudiants_9:
        print("✗ Aucun étudiant trouvé dans les fichiers.")
        sys.exit(1)
    
    print("=" * 70)
    print("Vérification des doublons...")
    print("=" * 70)
    print()
    
    # Fonction pour vérifier les doublons
    def verifier_doublons(etudiants, categorie):
        if not etudiants:
            return True
        
        df = pd.DataFrame(etudiants)
        doublons = df[df.duplicated(subset=['Numéro Anonymat'], keep=False)]
        
        if not doublons.empty:
            print(f"⚠ ATTENTION : Doublons dans la catégorie {categorie} :")
            for numero in doublons['Numéro Anonymat'].unique():
                licences = df[df['Numéro Anonymat'] == numero]['Licence'].tolist()
                print(f"  Numéro {numero} : {', '.join(licences)}")
            print()
            return False
        return True
    
    doublons_ok = True
    doublons_ok = verifier_doublons(etudiants_1_7, "numéros 1 et 7") and doublons_ok
    doublons_ok = verifier_doublons(etudiants_9, "numéros 9") and doublons_ok
    
    if not doublons_ok:
        reponse = input("Voulez-vous continuer et garder tous les doublons ? (o/n) : ").lower()
        if reponse != 'o':
            print("Traitement annulé.")
            sys.exit(0)
        print()
    
    # Créer et sauvegarder le fichier pour les numéros 1 et 7
    if etudiants_1_7:
        df_1_7 = pd.DataFrame(etudiants_1_7)
        df_1_7 = df_1_7.sort_values(['Licence', 'Numéro Anonymat'])
        df_1_7.to_excel(fichier_sortie_17, index=False, engine='openpyxl')
        print(f"✓ Fichier '{fichier_sortie_17}' créé avec {len(df_1_7)} étudiants (numéros 1 et 7)")
    else:
        print(f"⚠ Aucun étudiant avec numéro commençant par 1 ou 7")
    
    # Créer et sauvegarder le fichier pour les numéros 9
    if etudiants_9:
        df_9 = pd.DataFrame(etudiants_9)
        df_9 = df_9.sort_values(['Licence', 'Numéro Anonymat'])
        df_9.to_excel(fichier_sortie_9, index=False, engine='openpyxl')
        print(f"✓ Fichier '{fichier_sortie_9}' créé avec {len(df_9)} étudiants (numéros 9)")
    else:
        print(f"⚠ Aucun étudiant avec numéro commençant par 9")
    
    # Afficher les statistiques détaillées
    print()
    print("=" * 70)
    print("STATISTIQUES DÉTAILLÉES")
    print("=" * 70)
    print()
    print(f"📊 Total d'étudiants : {len(etudiants_1_7) + len(etudiants_9)}")
    print()
    print("Répartition globale par licence :")
    for licence in sorted(stats_licences.keys()):
        total = stats_licences[licence]
        count_1_7 = stats_par_categorie['1_7'].get(licence, 0)
        count_9 = stats_par_categorie['9'].get(licence, 0)
        print(f"  • {licence:<15} : {total:>3} total  ({count_1_7:>3} dans 1/7, {count_9:>3} dans 9)")
    
    print()
    print(f"📄 Fichier 1/7 : {len(etudiants_1_7)} étudiants")
    print(f"📄 Fichier 9   : {len(etudiants_9)} étudiants")
    print()
    print("=" * 70)


def main():
    """Fonction principale."""
    print()
    
    # Demander le dossier source
    print("Veuillez entrer le chemin du dossier contenant les fichiers xlsx :")
    print("(appuyez sur Entrée pour utiliser le dossier courant)")
    dossier = input("➜ ").strip()
    
    if not dossier:
        dossier = "."
    
    print()
    
    # Demander le nom du fichier de sortie pour les numéros 1 et 7
    print("Nom du fichier de sortie pour les numéros 1 et 7 [licences_1_7.xlsx] :")
    fichier_sortie_17 = input("➜ ").strip()
    
    if not fichier_sortie_17:
        fichier_sortie_17 = "licences_1_7.xlsx"
    
    print()
    
    # Demander le nom du fichier de sortie pour les numéros 9
    print("Nom du fichier de sortie pour les numéros 9 [licences_9.xlsx] :")
    fichier_sortie_9 = input("➜ ").strip()
    
    if not fichier_sortie_9:
        fichier_sortie_9 = "licences_9.xlsx"
    
    print()
    
    # Construire les fichiers
    construire_fichier_licences(dossier, fichier_sortie_17, fichier_sortie_9)


if __name__ == "__main__":
    main()
