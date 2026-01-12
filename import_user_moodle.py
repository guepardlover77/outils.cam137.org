import pandas as pd
import sys
import os
from pathlib import Path

def lire_fichier_emails(fichier_path):
    """
    Lit le fichier contenant les numéros d'anonymat (col A) et emails (col B)
    Supporte les formats .xlsx et .ods
    Retourne un DataFrame avec les données
    """
    try:
        # Détecter l'extension du fichier
        extension = Path(fichier_path).suffix.lower()
        
        # Lire le fichier selon son format
        if extension == '.ods':
            df = pd.read_excel(fichier_path, engine='odf', header=None, usecols=[0, 1])
        elif extension in ['.xlsx', '.xls']:
            df = pd.read_excel(fichier_path, header=None, usecols=[0, 1])
        else:
            print(f"❌ Format de fichier non supporté : {extension}")
            print(f"   Formats acceptés : .xlsx, .xls, .ods")
            return None
        
        df.columns = ['anonymat', 'email']
        
        # Supprimer les lignes avec des valeurs manquantes
        df = df.dropna()
        
        # Nettoyer les données (supprimer les espaces)
        df['anonymat'] = df['anonymat'].astype(str).str.strip()
        df['email'] = df['email'].astype(str).str.strip()
        
        print(f"✓ Fichier lu : {len(df)} entrées trouvées")
        return df
    except Exception as e:
        print(f"❌ Erreur lors de la lecture du fichier : {e}")
        if 'odf' in str(e).lower():
            print("💡 Conseil : Installez le module odfpy avec : pip install odfpy")
        return None

def creer_csv_moodle(df_emails, fichier_sortie, cohort_id=None):
    """
    Crée le fichier CSV au format Moodle avec tous les utilisateurs
    """
    if df_emails.empty:
        print("⚠️  Aucune donnée trouvée dans le fichier !")
        return False
    
    # Créer le DataFrame au format Moodle avec tous les utilisateurs
    moodle_data = {
        'username': df_emails['anonymat'],
        'email': df_emails['email'],
        'auth': 'email',
        'firstname': 'Etudiant',
        'lastname': df_emails['anonymat']
    }
    
    # Ajouter la colonne cohorte si spécifiée
    if cohort_id:
        moodle_data['cohort1'] = cohort_id
        print(f"✓ Cohorte configurée : {cohort_id}")
    
    df_moodle = pd.DataFrame(moodle_data)
    
    # Sauvegarder en CSV
    try:
        df_moodle.to_csv(fichier_sortie, index=False, encoding='utf-8')
        print(f"✓ Fichier CSV créé : {fichier_sortie}")
        print(f"✓ {len(df_moodle)} utilisateurs exportés")
        
        if cohort_id:
            print(f"✓ Tous les utilisateurs seront assignés à la cohorte : {cohort_id}")
            
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la création du fichier CSV : {e}")
        return False

def main():
    """
    Fonction principale
    """
    print("🔄 Conversion fichier vers CSV Moodle")
    print("=" * 50)
    
    # Vérifier les arguments
    if len(sys.argv) < 3 or len(sys.argv) > 4:
        print("Usage: python script.py <fichier_entrée> <sortie.csv> [cohorte_id]")
        print("\nExemple:")
        print("python script.py emails.xlsx moodle_import.csv")
        print("python script.py emails.ods moodle_import.csv")
        print("python script.py emails.xlsx moodle_import.csv year2024")
        print("\nOù :")
        print("- fichier_entrée : fichier .xlsx, .xls ou .ods avec anonymats (col A) et emails (col B)")
        print("- sortie.csv : fichier CSV de sortie pour Moodle")
        print("- cohorte_id (optionnel) : ID de la cohorte où assigner les utilisateurs")
        print("\n📌 Note importante :")
        print("- TOUS les utilisateurs du fichier seront importés")
        print("- La cohorte doit déjà exister dans Moodle")
        print("- Utilisez l'ID de la cohorte, pas son nom complet")
        print("- L'ID de cohorte correspond au 'shortname' dans Moodle")
        print("\n📦 Pour les fichiers .ods, installez : pip install odfpy")
        return
    
    fichier_input, fichier_sortie = sys.argv[1], sys.argv[2]
    cohort_id = sys.argv[3] if len(sys.argv) == 4 else None
    
    # Vérifier l'existence du fichier d'entrée
    if not os.path.exists(fichier_input):
        print(f"❌ Fichier non trouvé : {fichier_input}")
        return
    
    # Afficher les paramètres
    print(f"\n📋 Paramètres :")
    print(f"   Fichier d'entrée     : {fichier_input}")
    print(f"   Fichier de sortie    : {fichier_sortie}")
    if cohort_id:
        print(f"   Cohorte ID           : {cohort_id}")
    else:
        print(f"   Cohorte ID           : Aucune (pas d'assignation)")
    
    # Traitement
    print(f"\n📖 Lecture du fichier : {fichier_input}")
    df_emails = lire_fichier_emails(fichier_input)
    if df_emails is None:
        return
    
    print(f"\n💾 Création du fichier CSV : {fichier_sortie}")
    success = creer_csv_moodle(df_emails, fichier_sortie, cohort_id)
    
    if success:
        print(f"\n✅ Traitement terminé avec succès !")
        print(f"📄 Fichier de sortie : {os.path.abspath(fichier_sortie)}")
        print(f"\n📋 Format CSV généré :")
        if cohort_id:
            print(f"   username,email,auth,firstname,lastname,cohort1")
        else:
            print(f"   username,email,auth,firstname,lastname")
        print(f"\n🎯 Prêt pour l'import dans Moodle via :")
        print(f"   Administration > Utilisateurs > Comptes > Importer des utilisateurs")
    else:
        print(f"\n❌ Échec du traitement")

if __name__ == "__main__":
    main()
