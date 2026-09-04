using System;
using System.IO;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Cross-platform v4 profile persistence with legacy browser import and a
    /// PlayerPrefs backup. All failures fall back to a valid default profile.
    /// </summary>
    public static class SaveService
    {
        public const string StorageKey = "prism-break-unity-profile-v4";
        public const string LegacyBrowserKey = "prism-break-profile-v2";
        private const string SaveFileName = "prism-break-profile-v4.json";

        public static PlayerProfile Load()
        {
            PlayerProfile profile = null;
            string current = LegacyWebSaveBridge.LoadValue(StorageKey);
            if (!string.IsNullOrWhiteSpace(current)) profile = Deserialize(current);

#if !UNITY_WEBGL || UNITY_EDITOR
            if (profile == null)
            {
                try
                {
                    string path = SavePath;
                    if (File.Exists(path)) profile = Deserialize(File.ReadAllText(path));
                }
                catch { }
            }
#endif

            bool importedLegacy = false;
            if (profile == null)
            {
                string legacy = LegacyWebSaveBridge.LoadValue(LegacyBrowserKey);
                if (!string.IsNullOrWhiteSpace(legacy))
                {
                    profile = LegacyProfileMigrator.FromBrowserJson(legacy);
                    importedLegacy = profile != null;
                }
            }

            if (profile == null) profile = PlayerProfile.CreateDefault();
            if (importedLegacy) LegacyProfileMigrator.ApplyLegacySettings(profile);
            profile = ProfileSanitizer.Sanitize(profile);
            if (importedLegacy) Save(profile);
            return profile;
        }

        public static bool Save(PlayerProfile profile)
        {
            if (profile == null) return false;
            string json;
            try { json = Serialize(profile); }
            catch { return false; }
            bool stored = LegacyWebSaveBridge.SaveValue(StorageKey, json);

#if !UNITY_WEBGL || UNITY_EDITOR
            try
            {
                string directory = Path.GetDirectoryName(SavePath);
                if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
                File.WriteAllText(SavePath, json);
                stored = true;
            }
            catch { }
#endif
            return stored;
        }

        public static string Serialize(PlayerProfile profile)
        {
            return JsonUtility.ToJson(ProfileSanitizer.Sanitize(profile));
        }

        public static PlayerProfile Deserialize(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                // Browser profiles use object maps; Unity v4 profiles use arrays.
                PlayerProfile profile = json.IndexOf("\"stars\":[", StringComparison.Ordinal) >= 0
                    ? JsonUtility.FromJson<PlayerProfile>(json)
                    : LegacyProfileMigrator.FromBrowserJson(json);
                return profile == null ? null : ProfileSanitizer.Sanitize(profile);
            }
            catch { return null; }
        }

        public static void Reset()
        {
            LegacyWebSaveBridge.DeleteValue(StorageKey);
#if !UNITY_WEBGL || UNITY_EDITOR
            try { if (File.Exists(SavePath)) File.Delete(SavePath); } catch { }
#endif
        }

        public static string SavePath { get { return Path.Combine(Application.persistentDataPath, SaveFileName); } }
    }
}
