using System;
using System.Linq;
using UnityEngine;

namespace PrismBreak
{
    public sealed partial class PrismBreakApp
    {
        private string T(string english, string hebrew)
        {
            return PrismLocalization.T(language, english, hebrew);
        }

        private string D(string value)
        {
            return PrismLocalization.Display(language, value);
        }

        private TextAnchor ReadingAnchor
        {
            get { return language == LanguageId.Hebrew ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft; }
        }

        private void LoadProfileAndSettings()
        {
            profile = SaveService.Load();
            if (profile == null) profile = PlayerProfile.CreateDefault();
            ProfileSanitizer.Sanitize(profile);
            language = profile.settings.language;
            selectedShip = Mathf.Clamp(profile.selectedShip, 0, 29);
            selectedCampaignStage = Mathf.Clamp(profile.unlockedStage, 0, 100);
            campaignPage = CampaignCatalog.WorldForStage(selectedCampaignStage).id - 1;
            selectedThreat = Mathf.Clamp(Mathf.Max(1, profile.highestThreat + 1), 1, ThreatSystem.MaxAttempt(profile.highestThreat));
            ApplyAudioSettings();
        }

        private void ApplyAudioSettings()
        {
            if (audioEngine == null || profile == null || profile.settings == null) return;
            audioEngine.MusicEnabled = profile.settings.musicEnabled;
            audioEngine.EffectsEnabled = profile.settings.soundEnabled;
            audioEngine.MusicVolume = profile.settings.musicVolume;
            audioEngine.EffectsVolume = profile.settings.soundVolume;
        }

        private void SaveProfile()
        {
            if (profile == null) return;
            profile.selectedShip = Mathf.Clamp(selectedShip, 0, 29);
            profile.settings.language = language;
            ProfileSanitizer.Sanitize(profile);
            SaveService.Save(profile);
        }

        private void StartRun(RunConfig config)
        {
            if (config == null) return;
            activeConfig = config;
            SessionLoadout loadout = new SessionLoadout
            {
                StartingHealthBonus = Mathf.Max(0, profile.healthBonus),
                SelectedShip = selectedShip,
                ReducedMotion = ReducedMotion,
                StartingUpgrades = Array.Empty<UpgradeId>(),
                UnlockedPowers = profile.unlockedPowerIds == null ? Array.Empty<PersistentPowerId>() : profile.unlockedPowerIds.ToArray(),
                WorldUpgrades = profile.worldCoreUpgrades == null ? Array.Empty<WorldUpgradeId>() : profile.worldCoreUpgrades.ToArray(),
            };
            session = new GameSession(config, loadout);
            screen = AppScreen.Playing;
            runCommitted = false;
            minimalHud = false;
            audioEngine.Play("level");
        }

        private void CommitRunOnce()
        {
            if (runCommitted || session == null || session.Result == null || activeConfig == null) return;
            runCommitted = true;
            RunResult result = session.Result;
            ProgressionService.ApplyRun(profile, activeConfig, result);
            SaveProfile();
        }

        private void DrawMenuChrome()
        {
            ui.Kicker(new Rect(58, 28, 360, 28), "PRISM PROTOCOL // UNITY", PrismPalette.Cyan);
            if (screen != AppScreen.Home && ui.Button(new Rect(58, 69, 126, 42), T("← HOME", "בית →"), PrismPalette.CyanDim, false, true, 13))
                screen = AppScreen.Home;

            ui.Panel(new Rect(1240, 24, 300, 74), .78f, PrismPalette.Gold);
            ui.Kicker(new Rect(1260, 31, 126, 22), T("PRISM SHARDS", "שברי פריזמה"), PrismPalette.Gold);
            ui.Label(new Rect(1260, 51, 116, 34), "◆ " + profile.prismShards.ToString("N0"), 23, PrismPalette.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            ui.Kicker(new Rect(1390, 31, 126, 22), T("RANK", "דרגה"), PrismPalette.Cyan);
            ui.Label(new Rect(1390, 51, 126, 34), profile.rank.ToString("00"), 23, PrismPalette.Text, TextAnchor.MiddleLeft, FontStyle.Bold);

            ui.Label(new Rect(54, 856, 920, 24), T("ABSORB • REFRACT • ASCEND", "ספוג • שבור • התעלה"), 12, PrismPalette.Muted);
            ui.Label(new Rect(1120, 856, 420, 24), T("P PAUSE  •  B MINIMAL HUD", "P השהיה  •  B ממשק מינימלי"), 11, PrismPalette.Muted, TextAnchor.MiddleRight);
        }

        private void DrawCurrentMenu()
        {
            switch (screen)
            {
                case AppScreen.Campaign: DrawCampaignMenu(); break;
                case AppScreen.Prime: DrawPrimeMenu(); break;
                case AppScreen.Threat: DrawThreatMenu(); break;
                case AppScreen.Daily: DrawDailyMenu(); break;
                case AppScreen.Arcade: DrawArcadeMenu(); break;
                case AppScreen.Guide: DrawGuideMenu(); break;
                case AppScreen.Shop: DrawShopMenu(); break;
                case AppScreen.Achievements: DrawAchievementsMenu(); break;
                case AppScreen.Settings: DrawSettingsMenu(); break;
                default: DrawHomeMenu(); break;
            }
        }

        private void DrawHomeMenu()
        {
            ui.Kicker(new Rect(112, 114, 710, 28), T("ENEMY FIRE BECOMES YOUR WEAPON", "האש של האויב הופכת לנשק שלך"), PrismPalette.Cyan);
            ui.Label(new Rect(104, 140, 750, 122), "PRISM\nBREAK", 70, PrismPalette.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            ui.Label(new Rect(112, 262, 680, 60), D(T("Absorb hostile bullets, combine their spectrum,\nand refract the storm back at its source.", "ספוג קליעי אויב, שלב את הספקטרום שלהם,\nוהחזר את הסערה אל המקור.")), 17, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);

            DrawShipPreview(new Rect(960, 112, 470, 250));

            float x = 108f;
            float y = 374f;
            float width = 288f;
            float height = 104f;
            float gap = 18f;
            if (ui.Button(new Rect(x, y, width, height), T("CAMPAIGN", "מערכה"), PrismPalette.Cyan, false, true, 20, T("100 STAGES // 4 WORLDS", "100 שלבים // 4 עולמות"))) screen = AppScreen.Campaign;
            if (ui.Button(new Rect(x + width + gap, y, width, height), T("PRIME MISSIONS", "משימות PRIME"), PrismPalette.Violet, false, true, 19, T("POWER BONUS STAGES", "שלבי בונוס עוצמתיים"))) screen = AppScreen.Prime;
            if (ui.Button(new Rect(x + (width + gap) * 2f, y, width, height), T("THREAT LEVEL", "רמת איום"), PrismPalette.Magenta, false, true, 20, T("ENDLESS RIFT", "קרע אינסופי"))) screen = AppScreen.Threat;
            if (ui.Button(new Rect(x + (width + gap) * 3f, y, width, height), T("DAILY RIFT", "קרע יומי"), PrismPalette.Gold, false, true, 20, T("ONE SHARED SIGNAL", "אות יומי משותף"))) screen = AppScreen.Daily;

            y += height + gap;
            if (ui.Button(new Rect(x, y, width, height), T("ARCADE RIFT", "קרע ארקייד"), PrismPalette.CyanDim, false, true, 20, T("PURE SCORE ATTACK", "מרדף נקודות טהור"))) screen = AppScreen.Arcade;
            if (ui.Button(new Rect(x + width + gap, y, width, height), T("PRISM ARMORY", "מדריך כוחות"), PrismPalette.Violet, false, true, 20, T("POWERS • DROPS • SPECTRUM", "כוחות • דרופים • ספקטרום"))) screen = AppScreen.Guide;
            if (ui.Button(new Rect(x + (width + gap) * 2f, y, width, height), T("PRISM SHOP", "חנות פריזמה"), PrismPalette.Gold, false, true, 20, T("PERMANENT UPGRADES", "שדרוגים קבועים"))) screen = AppScreen.Shop;
            if (ui.Button(new Rect(x + (width + gap) * 3f, y, width, height), T("ACHIEVEMENTS", "הישגים"), PrismPalette.Mint, false, true, 20, T("MASTERY RECORDS", "שיאי שליטה"))) screen = AppScreen.Achievements;

            y += height + gap;
            ui.Panel(new Rect(108, y, 900, 106), .72f, PrismPalette.Cyan);
            ui.Kicker(new Rect(130, y + 12, 300, 22), T("NEXT SIGNAL", "האות הבא"), PrismPalette.Cyan);
            StageDefinition next = CampaignCatalog.GetStage(Mathf.Clamp(profile.unlockedStage, 0, 100));
            ui.Label(new Rect(130, y + 34, 470, 34), D(language == LanguageId.Hebrew ? next.hebrewName : next.name), 22, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
            ui.Label(new Rect(130, y + 67, 470, 24), D(PrismLocalization.ObjectiveName(language, next.objective) + "  " + next.target), 12, PrismPalette.Muted, ReadingAnchor);
            if (ui.Button(new Rect(680, y + 24, 292, 60), T("ENTER CAMPAIGN →", "כניסה למערכה ←"), PrismPalette.Cyan, false, true, 15))
            {
                selectedCampaignStage = next.id;
                campaignPage = CampaignCatalog.WorldForStage(next.id).id - 1;
                screen = AppScreen.Campaign;
            }
            if (ui.Button(new Rect(1030, y, 276, 106), T("SETTINGS", "הגדרות"), PrismPalette.Muted, false, true, 18, T("LANGUAGE • AUDIO", "שפה • שמע"))) screen = AppScreen.Settings;
            DrawShipSelector(new Rect(1324, y, 168, 106));
        }

        private void DrawShipPreview(Rect rect)
        {
            ui.Panel(rect, .62f, PrismPalette.Cyan);
            float pulse = ReducedMotion ? 1f : 1f + Mathf.Sin(presentationTime * 2.2f) * .04f;
            Vector2 center = new Vector2(rect.center.x, rect.center.y - 9f);
            PrismDraw.Disc(assets.SoftDisc, center, 105f * pulse, PrismPalette.Cyan.WithAlpha(.13f));
            for (int ring = 0; ring < 3; ring++)
            {
                float radius = 72f + ring * 28f + (ReducedMotion ? 0f : Mathf.Repeat(presentationTime * (8f + ring * 2f), 24f));
                DrawRing(center, radius, (ring & 1) == 0 ? PrismPalette.Cyan.WithAlpha(.18f) : PrismPalette.Violet.WithAlpha(.15f), 1.2f);
            }
            Texture2D ship = ShipTexture(selectedShip);
            PrismDraw.RotatedTexture(ship, new Rect(center.x - 68f, center.y - 68f, 136f, 136f), ReducedMotion ? 0f : Mathf.Sin(presentationTime * .8f) * 4f, Color.white);
            ui.Kicker(new Rect(rect.x + 16, rect.yMax - 37, rect.width - 32, 20), T("ACTIVE PRISM FRAME", "שלדת פריזמה פעילה"), PrismPalette.Cyan, TextAnchor.MiddleCenter);
            ui.Label(new Rect(rect.x + 16, rect.yMax - 20, rect.width - 32, 17), (selectedShip + 1).ToString("00") + " / " + Mathf.Max(1, assets.Ships.Length).ToString("00"), 11, PrismPalette.Muted, TextAnchor.MiddleCenter);
        }

        private void DrawShipSelector(Rect rect)
        {
            ui.Panel(rect, .7f, PrismPalette.Violet);
            ui.Kicker(new Rect(rect.x + 8, rect.y + 5, rect.width - 16, 18), T("SHIP", "חללית"), PrismPalette.Violet, TextAnchor.MiddleCenter);
            Rect image = new Rect(rect.center.x - 27, rect.y + 27, 54, 54);
            PrismDraw.RotatedTexture(ShipTexture(selectedShip), image, 0f, Color.white);
            if (ui.IconButton(new Rect(rect.x + 8, rect.y + 35, 28, 36), "‹", PrismPalette.Violet)) SelectShip(selectedShip - 1);
            if (ui.IconButton(new Rect(rect.xMax - 36, rect.y + 35, 28, 36), "›", PrismPalette.Violet)) SelectShip(selectedShip + 1);
            ui.Label(new Rect(rect.x, rect.yMax - 22, rect.width, 18), (selectedShip + 1).ToString("00"), 10, PrismPalette.Muted, TextAnchor.MiddleCenter);
        }

        private void SelectShip(int index)
        {
            int count = Mathf.Max(1, assets.Ships.Length);
            selectedShip = (index % count + count) % count;
            profile.selectedShip = selectedShip;
            SaveProfile();
            audioEngine.Play("pickup", .6f);
        }

        private void DrawCampaignMenu()
        {
            MenuTitle(T("CAMPAIGN", "מערכה"), T("FOUR WORLDS // ONE HUNDRED SIGNALS", "ארבעה עולמות // מאה אותות"), PrismPalette.Cyan);
            for (int i = 0; i < CampaignCatalog.Worlds.Length; i++)
            {
                CampaignWorldDefinition world = CampaignCatalog.Worlds[i];
                string name = language == LanguageId.Hebrew ? world.hebrewName : world.name;
                if (ui.Button(new Rect(105 + i * 344, 184, 326, 58), D("0" + world.id + " // " + name), WorldColor(world.id), campaignPage == i, true, 14))
                {
                    campaignPage = i;
                    selectedCampaignStage = Mathf.Clamp(selectedCampaignStage, world.startStage, world.endStage);
                }
            }

            CampaignWorldDefinition selectedWorld = CampaignCatalog.Worlds[Mathf.Clamp(campaignPage, 0, CampaignCatalog.Worlds.Length - 1)];
            int pageStart = selectedWorld.startStage + Mathf.FloorToInt((selectedCampaignStage - selectedWorld.startStage) / 10f) * 10;
            int pageEnd = Mathf.Min(selectedWorld.endStage, pageStart + 9);
            for (int index = pageStart; index <= pageEnd; index++)
            {
                int local = index - pageStart;
                float x = 105 + (local % 5) * 164;
                float y = 270 + (local / 5) * 94;
                bool unlocked = index <= profile.unlockedStage;
                StageDefinition stage = CampaignCatalog.GetStage(index);
                int stars = profile.GetStars(index, selectedDifficulty);
                string sub = unlocked ? new string('◆', stars) + new string('◇', 3 - stars) : T("LOCKED", "נעול");
                if (ui.Button(new Rect(x, y, 148, 76), stage.code + "  " + (unlocked ? "" : "⌁"), WorldColor(stage.world), selectedCampaignStage == index, unlocked, 18, sub))
                    selectedCampaignStage = index;
            }
            if (pageStart > selectedWorld.startStage && ui.IconButton(new Rect(105, 466, 54, 42), "‹", PrismPalette.Cyan))
                selectedCampaignStage = Mathf.Max(selectedWorld.startStage, pageStart - 10);
            if (pageEnd < selectedWorld.endStage && ui.IconButton(new Rect(170, 466, 54, 42), "›", PrismPalette.Cyan))
                selectedCampaignStage = Mathf.Min(selectedWorld.endStage, pageStart + 10);

            StageDefinition current = CampaignCatalog.GetStage(selectedCampaignStage);
            Rect detail = new Rect(970, 270, 525, 500);
            ui.Panel(detail, .86f, WorldColor(current.world), true);
            ui.Kicker(new Rect(detail.x + 34, detail.y + 24, detail.width - 68, 26), "STAGE " + current.code + " // WORLD 0" + current.world, WorldColor(current.world));
            ui.Label(new Rect(detail.x + 34, detail.y + 60, detail.width - 68, 62), D(language == LanguageId.Hebrew ? current.hebrewName : current.name), 34, PrismPalette.Text, ReadingAnchor, FontStyle.Bold, true);
            ui.Label(new Rect(detail.x + 34, detail.y + 126, detail.width - 68, 38), D(language == LanguageId.Hebrew ? current.hebrewSubtitle : current.subtitle), 14, WorldColor(current.world), ReadingAnchor, FontStyle.Normal, true);
            ui.Label(new Rect(detail.x + 34, detail.y + 174, detail.width - 68, 78), D(language == LanguageId.Hebrew ? current.hebrewBriefing : current.briefing), 14, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);
            ui.Kicker(new Rect(detail.x + 34, detail.y + 266, 210, 22), T("PRIMARY OBJECTIVE", "מטרה ראשית"), PrismPalette.Cyan);
            ui.Label(new Rect(detail.x + 34, detail.y + 292, detail.width - 68, 34), D(PrismLocalization.ObjectiveName(language, current.objective) + "  " + current.target), 17, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);

            DrawDifficultyRow(new Rect(detail.x + 34, detail.y + 347, detail.width - 68, 48));
            bool canLaunch = selectedCampaignStage <= profile.unlockedStage;
            if (ui.Button(new Rect(detail.x + 34, detail.yMax - 83, detail.width - 68, 56), T("START STAGE", "התחל שלב"), WorldColor(current.world), false, canLaunch, 18,
                PrismLocalization.DifficultyName(language, selectedDifficulty)))
                StartRun(RunConfigFactory.Campaign(selectedCampaignStage, selectedDifficulty));
        }

        private void DrawDifficultyRow(Rect rect)
        {
            float width = (rect.width - 16f) / 3f;
            Difficulty[] values = { Difficulty.Cadet, Difficulty.Standard, Difficulty.Overdrive };
            for (int i = 0; i < values.Length; i++)
            {
                bool enabled = values[i] != Difficulty.Overdrive || profile.overdriveUnlocked;
                if (ui.Button(new Rect(rect.x + i * (width + 8), rect.y, width, rect.height), PrismLocalization.DifficultyName(language, values[i]),
                    i == 0 ? PrismPalette.Cyan : i == 1 ? PrismPalette.Violet : PrismPalette.Magenta, selectedDifficulty == values[i], enabled, 11))
                    selectedDifficulty = values[i];
            }
        }

        private void DrawPrimeMenu()
        {
            MenuTitle(T("PRIME BONUS MISSIONS", "משימות בונוס PRIME"), T("PAY ONCE • KEEP FOREVER • ENTER POWERED UP", "שלם פעם אחת • שמור לתמיד • היכנס מחוזק"), PrismPalette.Violet);
            for (int i = 0; i < PrimeMissionCatalog.All.Length; i++)
            {
                PrimeMissionDefinition mission = PrimeMissionCatalog.All[i];
                bool owned = profile.HasPrime(mission.id);
                bool rankReady = profile.rank >= mission.requiredRank;
                Rect card = new Rect(105 + i * 348, 208, 328, 392);
                ui.Panel(card, selectedPrime == i ? .95f : .74f, i == 0 ? PrismPalette.Cyan : i == 1 ? PrismPalette.Violet : PrismPalette.Gold, selectedPrime == i);
                Color accent = i == 0 ? PrismPalette.Cyan : i == 1 ? PrismPalette.Violet : PrismPalette.Gold;
                ui.Kicker(new Rect(card.x + 22, card.y + 18, card.width - 44, 26), mission.code, accent, TextAnchor.MiddleCenter);
                ui.Diamond(new Vector2(card.center.x, card.y + 78), 24, accent.WithAlpha(.9f), owned);
                ui.Label(new Rect(card.x + 22, card.y + 112, card.width - 44, 50), D(language == LanguageId.Hebrew ? mission.hebrewName : mission.name), 22, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold, true);
                ui.Label(new Rect(card.x + 24, card.y + 171, card.width - 48, 86), D(language == LanguageId.Hebrew ? mission.hebrewDescription : mission.description), 13, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
                ui.Kicker(new Rect(card.x + 24, card.y + 268, card.width - 48, 20), PrismLocalization.ObjectiveName(language, mission.objective) + "  " + mission.target, accent, TextAnchor.MiddleCenter);
                string state = owned ? T("PERMANENTLY UNLOCKED", "פתוח לצמיתות") : T("RANK", "דרגה") + " " + mission.requiredRank + "  •  ◆ " + mission.unlockCost;
                ui.Label(new Rect(card.x + 20, card.y + 301, card.width - 40, 26), D(state), 13, owned ? PrismPalette.Mint : rankReady ? PrismPalette.Gold : PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Bold);
                if (ui.Button(new Rect(card.x + 24, card.yMax - 57, card.width - 48, 40), selectedPrime == i ? T("SELECTED", "נבחר") : T("SELECT", "בחר"), accent, selectedPrime == i, true, 12)) selectedPrime = i;
            }

            PrimeMissionDefinition selected = PrimeMissionCatalog.Get(selectedPrime);
            bool unlocked = profile.HasPrime(selected.id);
            if (unlocked)
            {
                if (ui.Button(new Rect(1167, 626, 328, 68), T("START BONUS STAGE", "התחל שלב בונוס"), PrismPalette.Violet, false, true, 17, T("NO REPEAT FEE", "ללא תשלום נוסף")))
                    StartRun(RunConfigFactory.Prime(selectedPrime));
            }
            else
            {
                bool canBuy = PrimeMissionCatalog.CanUnlock(profile, selected);
                if (ui.Button(new Rect(1167, 626, 328, 68), T("UNLOCK PERMANENTLY", "פתח לצמיתות"), PrismPalette.Gold, false, canBuy, 16, "◆ " + selected.unlockCost))
                {
                    if (PrimeMissionCatalog.Purchase(profile, selected)) { SaveProfile(); audioEngine.Play("level"); }
                }
            }
            ui.Label(new Rect(106, 650, 1000, 54), D(T("Prime stages are short power fantasies. The truly difficult challenge lives in Threat Level.", "שלבי PRIME הם שלבי בונוס קצרים ומהנים. האתגר הקשה באמת נמצא ברמת האיום.")), 14, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);
        }

        private void DrawThreatMenu()
        {
            MenuTitle(T("THREAT LEVEL", "רמת איום"), T("AN ENDLESS RIFT THAT GROWS WITH YOUR MASTERY", "קרע אינסופי שגדל יחד עם השליטה שלך"), PrismPalette.Magenta);
            int maximum = Mathf.Max(1, ThreatSystem.MaxAttempt(profile.highestThreat));
            selectedThreat = Mathf.Clamp(selectedThreat, 1, maximum);
            Rect core = new Rect(164, 220, 760, 502);
            ui.Panel(core, .82f, PrismPalette.Magenta, true);
            ui.Kicker(new Rect(core.x + 40, core.y + 28, core.width - 80, 24), T("SELECTED THREAT", "האיום שנבחר"), PrismPalette.Magenta, TextAnchor.MiddleCenter);
            ui.Label(new Rect(core.x + 40, core.y + 57, core.width - 80, 102), selectedThreat.ToString(), 76, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            ui.Label(new Rect(core.x + 40, core.y + 159, core.width - 80, 34), D(T("EXPECTED DANGER", "סכנה צפויה") + "  //  " + ThreatDanger(selectedThreat)), 16, PrismPalette.Magenta, TextAnchor.MiddleCenter, FontStyle.Bold);

            float y = core.y + 218;
            int[] steps = { -10, -5, -1, 1, 5, 10 };
            for (int i = 0; i < steps.Length; i++)
            {
                int target = Mathf.Clamp(selectedThreat + steps[i], 1, maximum);
                if (ui.Button(new Rect(core.x + 38 + i * 113, y, 101, 46), (steps[i] > 0 ? "+" : "") + steps[i], PrismPalette.Magenta, false, target != selectedThreat, 14)) selectedThreat = target;
            }
            float trackY = y + 74;
            ui.Progress(new Rect(core.x + 46, trackY, core.width - 92, 7), (selectedThreat - 1f) / Mathf.Max(1f, maximum - 1f), PrismPalette.Magenta);
            ui.Label(new Rect(core.x + 46, trackY + 15, 180, 20), "1", 11, PrismPalette.Muted);
            ui.Label(new Rect(core.xMax - 226, trackY + 15, 180, 20), T("MAX ", "מרבי ") + maximum, 11, PrismPalette.Muted, TextAnchor.MiddleRight);
            if (ui.Button(new Rect(core.x + 135, core.yMax - 82, core.width - 270, 56), T("ENTER THE RIFT", "היכנס לקרע"), PrismPalette.Magenta, false, ThreatSystem.CanAttempt(profile, selectedThreat), 18))
                StartRun(RunConfigFactory.Threat(selectedThreat));

            ThreatScaling scaling = ThreatSystem.Scaling(selectedThreat);
            IntRange reward = ThreatSystem.RewardRange(selectedThreat);
            Rect data = new Rect(962, 220, 474, 502);
            ui.Panel(data, .82f, PrismPalette.Cyan);
            DataRow(data, 28, T("HIGHEST CLEARED", "הגבוה ביותר שהושלם"), profile.highestThreat.ToString(), PrismPalette.Cyan);
            DataRow(data, 86, T("POTENTIAL YIELD", "תגמול אפשרי"), "◆ " + reward.minimum + "–" + reward.maximum, PrismPalette.Gold);
            DataRow(data, 144, T("HOSTILE INTEGRITY", "חיי אויבים"), scaling.enemyHealth.ToString("0.00") + "×", PrismPalette.Crimson);
            DataRow(data, 202, T("PROJECTILE SPEED", "מהירות קליעים"), scaling.projectileSpeed.ToString("0.00") + "×", PrismPalette.Violet);
            DataRow(data, 260, T("SIGNAL DENSITY", "צפיפות אותות"), scaling.maxEnemies.ToString(), PrismPalette.Magenta);
            ui.Kicker(new Rect(data.x + 30, data.y + 328, data.width - 60, 23), T("ACTIVE MODIFIERS", "משנים פעילים"), PrismPalette.Cyan);
            ThreatModifierId[] modifiers = ThreatSystem.SelectModifiers(selectedThreat);
            if (modifiers.Length == 0)
                ui.Label(new Rect(data.x + 30, data.y + 360, data.width - 60, 34), T("NONE // CLEAN SIGNAL", "ללא // אות נקי"), 14, PrismPalette.Muted);
            else
                for (int i = 0; i < modifiers.Length; i++)
                    ui.Label(new Rect(data.x + 30, data.y + 357 + i * 28, data.width - 60, 25), "◇ " + ModifierName(modifiers[i]), 13, i % 2 == 0 ? PrismPalette.Magenta : PrismPalette.Violet);
        }

        private string ThreatDanger(int level)
        {
            if (language == LanguageId.English) return ThreatSystem.DangerLabel(level);
            if (level <= 10) return "נמוכה מאוד";
            if (level <= 25) return "בינונית";
            if (level <= 50) return "עולה";
            if (level <= 100) return "גבוהה";
            if (level <= 250) return "קיצונית";
            return "ללא גבול";
        }

        private string ModifierName(ThreatModifierId id)
        {
            string en = id.ToString().ToUpperInvariant();
            string he;
            switch (id)
            {
                case ThreatModifierId.DoubleFire: he = "ירי כפול"; break;
                case ThreatModifierId.EliteSwarm: he = "נחיל אליטות"; break;
                case ThreatModifierId.FastProjectiles: he = "קליעים מהירים"; break;
                case ThreatModifierId.NovaDrain: he = "דליפת נובה"; break;
                case ThreatModifierId.DashCooldown: he = "קירור דאש"; break;
                case ThreatModifierId.HighDensity: he = "צפיפות גבוהה"; break;
                case ThreatModifierId.AggressiveEnemies: he = "אויבים תוקפניים"; break;
                case ThreatModifierId.LowIntegrity: he = "שלמות נמוכה"; break;
                default: he = "הופעה מהירה"; break;
            }
            return D(T(en, he));
        }

        private void DrawDailyMenu()
        {
            MenuTitle(T("DAILY RIFT", "קרע יומי"), DateTime.UtcNow.ToString("yyyy-MM-dd") + " // " + T("ONE SIGNAL FOR EVERY PILOT", "אות אחד לכל הטייסים"), PrismPalette.Gold);
            Rect panel = new Rect(340, 238, 920, 460);
            ui.Panel(panel, .84f, PrismPalette.Gold, true);
            ui.Diamond(new Vector2(panel.center.x, panel.y + 100), 43, PrismPalette.Gold.WithAlpha(.9f), true);
            ui.Label(new Rect(panel.x + 80, panel.y + 168, panel.width - 160, 50), T("A NEW DETERMINISTIC RIFT EVERY UTC DAY", "קרע קבוע חדש בכל יום לפי UTC"), 22, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold, true);
            ui.Label(new Rect(panel.x + 130, panel.y + 226, panel.width - 260, 60), D(T("Every pilot receives the same waves, spectra and upgrade choices. Your best local score is preserved.", "כל הטייסים מקבלים אותם גלים, ספקטרומים ואפשרויות שדרוג. השיא המקומי שלך נשמר.")), 14, PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Normal, true);
            int dailySeed = DateTime.UtcNow.Year * 10000 + DateTime.UtcNow.Month * 100 + DateTime.UtcNow.Day;
            if (ui.Button(new Rect(panel.center.x - 210, panel.yMax - 90, 420, 58), T("ENTER DAILY SIGNAL", "היכנס לאות היומי"), PrismPalette.Gold, false, true, 17))
                StartRun(RunConfigFactory.Daily(dailySeed));
        }

        private void DrawArcadeMenu()
        {
            MenuTitle(T("ARCADE RIFT", "קרע ארקייד"), T("TWO MINUTES // PURE SCORE ATTACK", "שתי דקות // מרדף נקודות טהור"), PrismPalette.Cyan);
            Rect panel = new Rect(330, 224, 940, 492);
            ui.Panel(panel, .82f, PrismPalette.Cyan, true);
            ui.Label(new Rect(panel.x + 80, panel.y + 48, panel.width - 160, 54), T("HOW HIGH CAN THE MULTIPLIER GO?", "כמה גבוה תוכל להעלות את המכפיל?"), 26, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold, true);
            ui.Label(new Rect(panel.x + 130, panel.y + 118, panel.width - 260, 70), D(T("No campaign objective. Build spectrum combinations, Perfect Absorb at the last instant, and turn every hostile pattern into score.", "אין מטרת מערכה. בנה שילובי ספקטרום, בצע ספיגה מושלמת ברגע האחרון והפוך כל תבנית אויב לנקודות.")), 15, PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Normal, true);
            DrawDifficultyRow(new Rect(panel.x + 155, panel.y + 232, panel.width - 310, 52));
            if (ui.Button(new Rect(panel.center.x - 220, panel.yMax - 92, 440, 60), T("START SCORE ATTACK", "התחל מרדף נקודות"), PrismPalette.Cyan, false, true, 18))
                StartRun(RunConfigFactory.Arcade(selectedDifficulty));
        }

        private void MenuTitle(string title, string subtitle, Color accent)
        {
            ui.Kicker(new Rect(105, 108, 1020, 28), subtitle, accent);
            ui.Label(new Rect(100, 130, 1120, 58), D(title), 40, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
        }

        private void DataRow(Rect panel, float y, string label, string value, Color accent)
        {
            ui.Kicker(new Rect(panel.x + 30, panel.y + y, panel.width * .58f, 24), label, PrismPalette.Muted);
            ui.Label(new Rect(panel.x + panel.width * .58f, panel.y + y - 2, panel.width * .34f, 28), D(value), 17, accent, TextAnchor.MiddleRight, FontStyle.Bold);
            PrismDraw.Fill(assets.White, new Rect(panel.x + 30, panel.y + y + 31, panel.width - 60, 1), PrismPalette.Cyan.WithAlpha(.12f));
        }

        private Color WorldColor(int world)
        {
            switch (world)
            {
                case 2: return PrismPalette.Violet;
                case 3: return PrismPalette.Magenta;
                case 4: return PrismPalette.Gold;
                default: return PrismPalette.Cyan;
            }
        }

        private Texture2D ShipTexture(int index)
        {
            if (assets.Ships == null || assets.Ships.Length == 0) return assets.Disc;
            return assets.Ships[Mathf.Clamp(index, 0, assets.Ships.Length - 1)];
        }
    }
}
