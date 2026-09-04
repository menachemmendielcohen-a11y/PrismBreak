using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Direct localStorage bridge for WebGL. It also lets the Unity version import
    /// the existing React save once when both builds use the same host/origin.
    /// </summary>
    public static class LegacyWebSaveBridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern IntPtr PrismBreak_LoadStorage(string key);
        [DllImport("__Internal")] private static extern void PrismBreak_FreeStorageString(IntPtr pointer);
        [DllImport("__Internal")] private static extern void PrismBreak_SaveStorage(string key, string value);
        [DllImport("__Internal")] private static extern void PrismBreak_DeleteStorage(string key);
#endif

        public static string LoadValue(string key)
        {
            if (string.IsNullOrEmpty(key)) return string.Empty;
#if UNITY_WEBGL && !UNITY_EDITOR
            try
            {
                IntPtr pointer = PrismBreak_LoadStorage(key);
                if (pointer == IntPtr.Zero) return string.Empty;
                string value = Marshal.PtrToStringUTF8(pointer) ?? string.Empty;
                PrismBreak_FreeStorageString(pointer);
                return value;
            }
            catch { return string.Empty; }
#else
            return PlayerPrefs.GetString(key, string.Empty);
#endif
        }

        public static bool SaveValue(string key, string value)
        {
            if (string.IsNullOrEmpty(key)) return false;
            try
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                PrismBreak_SaveStorage(key, value ?? string.Empty);
#else
                PlayerPrefs.SetString(key, value ?? string.Empty);
                PlayerPrefs.Save();
#endif
                return true;
            }
            catch { return false; }
        }

        public static void DeleteValue(string key)
        {
            if (string.IsNullOrEmpty(key)) return;
            try
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                PrismBreak_DeleteStorage(key);
#else
                PlayerPrefs.DeleteKey(key);
                PlayerPrefs.Save();
#endif
            }
            catch { }
        }
    }
}
