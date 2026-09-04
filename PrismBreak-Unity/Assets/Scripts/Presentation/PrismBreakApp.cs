using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Scene entry point for the Unity port. Rendering is intentionally immediate-mode:
    /// it keeps the arena resolution-independent, produces a small WebGL build and lets
    /// the simulation remain a deterministic, scene-free C# model.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed partial class PrismBreakApp : MonoBehaviour
    {
        private const float DesignWidth = 1600f;
        private const float DesignHeight = 900f;
        private const float ArenaScale = DesignWidth / ArenaConstants.Width;

        private PrismAssetLibrary assets;
        private PrismUiKit ui;
        private PrismBackgroundRenderer background;
        private SynthAudioEngine audioEngine;
        private PlayerProfile profile;
        private GameSession session;
        private RunConfig activeConfig;
        private AppScreen screen = AppScreen.Home;
        private LanguageId language = LanguageId.English;
        private Difficulty selectedDifficulty = Difficulty.Cadet;
        private int selectedCampaignStage = 1;
        private int selectedPrime;
        private int selectedThreat = 1;
        private int selectedShip;
        private int guidePage;
        private int campaignPage;
        private bool minimalHud;
        private bool runCommitted;
        private bool leftMouseWasDown;
        private float presentationTime;
        private float screenFlash;
        private float screenShake;
        private float eventBannerTime;
        private string eventBanner = string.Empty;
        private Color eventBannerColor = Color.white;
        private Matrix4x4 previousGuiMatrix;
        private float guiScale = 1f;
        private Vector2 guiOffset;

        private bool IsGameplayScreen
        {
            get
            {
                return screen == AppScreen.Playing || screen == AppScreen.Paused || screen == AppScreen.Upgrade
                    || screen == AppScreen.NovaConfirm || screen == AppScreen.Result;
            }
        }

        private bool ReducedMotion
        {
            get { return profile != null && profile.settings != null && profile.settings.reducedMotion; }
        }

        private void Awake()
        {
            Application.targetFrameRate = 120;
            QualitySettings.vSyncCount = 0;
            assets = new PrismAssetLibrary();
            ui = new PrismUiKit(assets);
            background = new PrismBackgroundRenderer(assets);
            audioEngine = gameObject.GetComponent<SynthAudioEngine>();
            if (audioEngine == null) audioEngine = gameObject.AddComponent<SynthAudioEngine>();
            LoadProfileAndSettings();
            Cursor.visible = true;
            Cursor.lockState = CursorLockMode.None;
        }

        private void Update()
        {
            presentationTime += Mathf.Min(Time.unscaledDeltaTime, .05f);
            screenFlash = Mathf.Max(0f, screenFlash - Time.unscaledDeltaTime * 2.8f);
            screenShake = Mathf.Max(0f, screenShake - Time.unscaledDeltaTime * 4.5f);
            eventBannerTime = Mathf.Max(0f, eventBannerTime - Time.unscaledDeltaTime);

            bool gameplayCursor = IsGameplayScreen && screen != AppScreen.Result;
            Cursor.visible = !gameplayCursor;

            if (session == null || screen == AppScreen.Result) return;
            InputFrame frame = ReadInputFrame();
            session.Advance(Mathf.Min(Time.unscaledDeltaTime, .05f), frame);
            HandleSessionEvents();
            SynchronizeScreenWithSession();
        }

        private InputFrame ReadInputFrame()
        {
            InputFrame frame = new InputFrame();
            Vector2 designMouse;
            if (TryScreenToDesign(Input.mousePosition, out designMouse))
            {
                frame.HasPointer = designMouse.x >= 0f && designMouse.x <= DesignWidth && designMouse.y >= 0f && designMouse.y <= DesignHeight;
                frame.PointerWorld = new Vector2(designMouse.x / ArenaScale, designMouse.y / ArenaScale);
            }

            float x = 0f;
            float y = 0f;
            if (ActionHeld("left", KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) x -= 1f;
            if (ActionHeld("right", KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) x += 1f;
            if (ActionHeld("up", KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) y -= 1f;
            if (ActionHeld("down", KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) y += 1f;
            frame.Move = Vector2.ClampMagnitude(new Vector2(x, y), 1f);

            bool left = Input.GetMouseButton(0);
            frame.RefractPressed = (left && !leftMouseWasDown) || ActionDown("blast", KeyCode.Q);
            leftMouseWasDown = left;
            frame.DashPressed = ActionDown("dash", KeyCode.Space);
            // E never fires Nova immediately: GameSession transitions to NovaConfirm,
            // then the player explicitly accepts or cancels the one-coin purchase.
            frame.NovaPressed = ActionDown("nova", KeyCode.E);
            frame.SmashPressed = ActionDown("smash", KeyCode.F);
            frame.LancePressed = Input.GetKeyDown(KeyCode.R);
            frame.PausePressed = ActionDown("pause", KeyCode.P);
            if (ActionDown("hud", KeyCode.B)) minimalHud = !minimalHud;
            return frame;
        }

        private bool ActionDown(string action, KeyCode fallback)
        {
            return Input.GetKeyDown(BoundKey(action, fallback));
        }

        private bool ActionHeld(string action, KeyCode fallback)
        {
            return Input.GetKey(BoundKey(action, fallback));
        }

        private KeyCode BoundKey(string action, KeyCode fallback)
        {
            if (profile == null || profile.settings == null) return fallback;
            string value = profile.settings.Binding(action, fallback.ToString());
            if (value.StartsWith("Key", StringComparison.OrdinalIgnoreCase) && value.Length == 4)
                value = value.Substring(3);
            KeyCode result;
            return Enum.TryParse(value, true, out result) ? result : fallback;
        }

        private void SynchronizeScreenWithSession()
        {
            if (session == null) return;
            switch (session.Phase)
            {
                case SessionPhase.Paused: screen = AppScreen.Paused; break;
                case SessionPhase.UpgradeChoice: screen = AppScreen.Upgrade; break;
                case SessionPhase.NovaConfirm: screen = AppScreen.NovaConfirm; break;
                case SessionPhase.Victory:
                case SessionPhase.Defeat:
                    screen = AppScreen.Result;
                    CommitRunOnce();
                    break;
                default: screen = AppScreen.Playing; break;
            }
        }

        private void HandleSessionEvents()
        {
            if (session == null || session.Events == null) return;
            for (int i = 0; i < session.Events.Count; i++)
            {
                GameEvent gameEvent = session.Events[i];
                if (gameEvent == null) continue;
                string id = gameEvent.id ?? string.Empty;
                audioEngine.Play(id, id == "shoot" ? .35f : 1f);
                if (id == "hurt") { screenShake = 1f; screenFlash = .8f; }
                else if (id == "nova") { screenShake = .8f; screenFlash = 1f; ShowBanner("PRISM NOVA", PrismPalette.Cyan); }
                else if (id == "smash") { screenShake = .65f; ShowBanner("PRISM SMASH", PrismPalette.Gold); }
                else if (id == "perfect") ShowBanner(PrismLocalization.T(language, "PERFECT ABSORB", "ספיגה מושלמת"), PrismPalette.Gold);
                else if (id == "full-spectrum") ShowBanner(PrismLocalization.T(language, "FULL SPECTRUM", "ספקטרום מלא"), Color.white);
                else if (id == "prism-break") { screenShake = .55f; ShowBanner("PRISM BREAK", PrismPalette.Magenta); }
            }
            if (session != null)
                audioEngine.SetMusicIntensity(Mathf.Clamp01(session.Intensity));
        }

        private void ShowBanner(string value, Color color)
        {
            eventBanner = value ?? string.Empty;
            eventBannerColor = color;
            eventBannerTime = 1.25f;
        }

        private void OnGUI()
        {
            if (assets == null || ui == null) return;
            BeginScaledGui();
            if (IsGameplayScreen && session != null)
                DrawGameplay();
            else
            {
                background.DrawMenu(presentationTime, ReducedMotion, MenuVariant());
                DrawMenuChrome();
                DrawCurrentMenu();
            }
            EndScaledGui();
        }

        private void BeginScaledGui()
        {
            guiScale = Mathf.Min(Screen.width / DesignWidth, Screen.height / DesignHeight);
            guiScale = Mathf.Max(.01f, guiScale);
            guiOffset = new Vector2((Screen.width - DesignWidth * guiScale) * .5f, (Screen.height - DesignHeight * guiScale) * .5f);
            previousGuiMatrix = GUI.matrix;
            GUI.matrix = Matrix4x4.TRS(guiOffset, Quaternion.identity, new Vector3(guiScale, guiScale, 1f));
        }

        private void EndScaledGui()
        {
            GUI.matrix = previousGuiMatrix;
        }

        private bool TryScreenToDesign(Vector3 screenPoint, out Vector2 design)
        {
            float scale = Mathf.Min(Screen.width / DesignWidth, Screen.height / DesignHeight);
            if (scale <= 0f) { design = Vector2.zero; return false; }
            float offsetX = (Screen.width - DesignWidth * scale) * .5f;
            float offsetY = (Screen.height - DesignHeight * scale) * .5f;
            design = new Vector2((screenPoint.x - offsetX) / scale, (Screen.height - screenPoint.y - offsetY) / scale);
            return true;
        }

        private int MenuVariant()
        {
            switch (screen)
            {
                case AppScreen.Prime: return 1;
                case AppScreen.Threat: return 2;
                case AppScreen.Achievements: return 3;
                default: return 0;
            }
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) SaveProfile();
        }

        private void OnApplicationQuit()
        {
            SaveProfile();
        }
    }
}
