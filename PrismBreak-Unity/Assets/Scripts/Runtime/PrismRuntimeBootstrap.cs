using UnityEngine;

namespace PrismBreak
{
    public static class PrismRuntimeBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureGameApp()
        {
            if (Object.FindFirstObjectByType<PrismBreakApp>() != null) return;

            Camera camera = Camera.main;
            if (camera == null)
            {
                var cameraObject = new GameObject("Arena Camera");
                camera = cameraObject.AddComponent<Camera>();
                cameraObject.tag = "MainCamera";
            }

            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(.004f, .012f, .035f, 1f);
            camera.orthographic = true;
            camera.orthographicSize = 5f;

            var appObject = new GameObject("PRISM BREAK Runtime");
            appObject.AddComponent<PrismBreakApp>();
        }
    }
}
