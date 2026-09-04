using System;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace PrismBreak.EditorTools
{
    public static class PrismProjectBuilder
    {
        private const string ScenePath = "Assets/Scenes/PrismBreak.unity";

        [MenuItem("PRISM BREAK/Configure Project")]
        public static void ConfigureProject()
        {
            PlayerSettings.companyName = "Prism Protocol";
            PlayerSettings.productName = "PRISM BREAK";
            PlayerSettings.bundleVersion = "1.0.0-unity";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Gamma;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "com.prismprotocol.prismbreak");
            QualitySettings.vSyncCount = 0;

            Type appType = Type.GetType("PrismBreak.PrismBreakApp, PrismBreak.Runtime");
            if (appType == null)
                throw new InvalidOperationException("PrismBreakApp has not compiled yet.");

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "PrismBreak";

            var cameraObject = new GameObject("Arena Camera");
            var camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(.004f, .012f, .035f, 1f);
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            cameraObject.tag = "MainCamera";

            var root = new GameObject("PRISM BREAK");
            root.AddComponent(appType);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            Debug.Log("PRISM BREAK project configured: " + ScenePath);
        }

        public static void ConfigureBatch()
        {
            ConfigureProject();
        }
    }
}
