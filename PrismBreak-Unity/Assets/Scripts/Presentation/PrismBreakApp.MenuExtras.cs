using System;
using UnityEngine;

namespace PrismBreak
{
    public sealed partial class PrismBreakApp
    {
        private int achievementPage;
        private int upgradeGuidePage;
        private string rebindingAction = string.Empty;

        private void DrawGuideMenu()
        {
            MenuTitle(T("PRISM ARMORY", "מדריך הפריזמה"), T("EVERY SYMBOL // ONE CLEAR EFFECT", "כל סמל // השפעה ברורה אחת"), PrismPalette.Violet);
            string[] tabs = { T("CONTROL", "שליטה"), T("SPECTRUM", "ספקטרום"), T("POWERS", "כוחות"), T("DROPS", "דרופים") };
            for (int i = 0; i < tabs.Length; i++)
                if (ui.Button(new Rect(106 + i * 278, 191, 260, 47), tabs[i], i == 0 ? PrismPalette.Cyan : i == 1 ? PrismPalette.Violet : i == 2 ? PrismPalette.Magenta : PrismPalette.Gold, guidePage == i, true, 13)) guidePage = i;

            if (guidePage == 0) DrawControlGuide();
            else if (guidePage == 1) DrawSpectrumGuide();
            else if (guidePage == 2) DrawPowerGuide();
            else DrawDropGuide();
        }

        private void DrawControlGuide()
        {
            Rect hero = new Rect(106, 265, 720, 488);
            ui.Panel(hero, .8f, PrismPalette.Cyan, true);
            ui.Kicker(new Rect(hero.x + 30, hero.y + 25, hero.width - 60, 22), T("THE FIRST 30 SECONDS", "שלושים השניות הראשונות"), PrismPalette.Cyan);
            ui.Label(new Rect(hero.x + 30, hero.y + 58, hero.width - 60, 62), D(T("MOVE. ABSORB. TURN THEIR FIRE BACK.", "זוז. ספוג. החזר אליהם את האש.")), 26, PrismPalette.Text, ReadingAnchor, FontStyle.Bold, true);
            string[] glyphs = { "◌", "◇", "△", "✦" };
            string[] titles = { T("FOLLOW THE POINTER", "עקוב אחרי המצביע"), T("DASH THROUGH COLOR", "דאש דרך צבע"), T("REFRACT THE STORE", "שבור את המאגר"), T("BREAK THE PRISM", "שבור את הפריזמה") };
            string[] descriptions =
            {
                T("The ship is the pointer. Keyboard movement remains available as a fallback.", "החללית היא המצביע. תנועת מקלדת זמינה כגיבוי."),
                T("Space dashes. Touch a colored hostile shot during the dash to store its spectrum. Last-instant timing creates PERFECT ABSORB.", "רווח מבצע דאש. גע בקליע אויב צבעוני בזמן הדאש כדי לאגור את הספקטרום שלו. תזמון ברגע האחרון יוצר ספיגה מושלמת."),
                T("Left click or Q converts stored enemy energy into a spectrum weapon. Color combinations create stronger recipes.", "לחיצה שמאלית או Q הופכת אנרגיית אויב אגורה לנשק ספקטרום. שילובי צבעים יוצרים מתכונים חזקים יותר."),
                T("Fill all twelve cells, then refract. PRISM BREAK raises score and power, but mistakes become dangerous.", "מלא את כל שנים־עשר התאים ואז שבור. מצב שבירת פריזמה מעלה ניקוד ועוצמה, אבל טעויות נעשות מסוכנות."),
            };
            for (int i = 0; i < 4; i++)
            {
                float y = hero.y + 146 + i * 78;
                ui.Diamond(new Vector2(hero.x + 51, y + 24), 17, i == 3 ? PrismPalette.Magenta : PrismPalette.Cyan.WithAlpha(.9f), i == 3);
                ui.Label(new Rect(hero.x + 40, y + 8, 22, 30), glyphs[i], 14, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
                ui.Label(new Rect(hero.x + 86, y, 254, 27), D(titles[i]), 14, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(hero.x + 86, y + 28, hero.width - 120, 46), D(descriptions[i]), 12, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
            }

            Rect keys = new Rect(856, 265, 638, 488);
            ui.Panel(keys, .8f, PrismPalette.Violet);
            ui.Kicker(new Rect(keys.x + 30, keys.y + 25, keys.width - 60, 22), T("DEFAULT CONTROL MATRIX", "מפת מקשים ברירת מחדל"), PrismPalette.Violet);
            string[,] values =
            {
                { "MOUSE", T("MOVE SHIP", "הזז חללית") },
                { "LMB / Q", T("REFRACT", "שבירה") },
                { "SPACE", T("DASH / ABSORB", "דאש / ספיגה") },
                { "E", T("NOVA // CONFIRM 1 COIN", "נובה // אישור מטבע אחד") },
                { "F", T("PRISM SMASH", "מכת פריזמה") },
                { "R", T("PRISM LANCE", "רומח פריזמה") },
                { "P", T("PAUSE", "השהיה") },
                { "B", T("MINIMAL HUD", "ממשק מינימלי") },
            };
            for (int i = 0; i < values.GetLength(0); i++)
            {
                float y = keys.y + 67 + i * 47;
                PrismDraw.Fill(assets.White, new Rect(keys.x + 30, y, 120, 34), PrismPalette.Cyan.WithAlpha(.08f));
                PrismDraw.Border(assets.White, new Rect(keys.x + 30, y, 120, 34), PrismPalette.Cyan.WithAlpha(.4f));
                ui.Label(new Rect(keys.x + 30, y, 120, 34), values[i, 0], 12, PrismPalette.Cyan, TextAnchor.MiddleCenter, FontStyle.Bold);
                ui.Label(new Rect(keys.x + 170, y, keys.width - 205, 34), D(values[i, 1]), 13, PrismPalette.Text, ReadingAnchor);
            }
        }

        private void DrawSpectrumGuide()
        {
            SpectrumId[] spectra = { SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Gold, SpectrumId.Crimson };
            string[] effectEn = { "Pierces enemies and hostile projectile formations.", "Splits into a wide fan of refracted shots.", "Chains between nearby targets.", "Detonates in a high-damage burst." };
            string[] effectHe = { "חודר דרך אויבים ותצורות של קליעים עוינים.", "מתפצל למניפה רחבה של יריות שבורות.", "קופץ בין מטרות קרובות.", "מתפוצץ בפרץ נזק חזק." };
            for (int i = 0; i < 4; i++)
            {
                Rect card = new Rect(106 + i * 350, 266, 330, 184);
                Color color = PrismPalette.Spectrum(spectra[i]);
                ui.Panel(card, .82f, color, true);
                ui.Diamond(new Vector2(card.x + 42, card.y + 48), 20, color, true);
                ui.Label(new Rect(card.x + 78, card.y + 25, card.width - 100, 45), PrismLocalization.SpectrumName(language, spectra[i]), 20, color, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(card.x + 25, card.y + 90, card.width - 50, 70), D(T(effectEn[i], effectHe[i])), 13, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
            }

            ui.Kicker(new Rect(106, 480, 1000, 25), T("REFRACTION RECIPES", "מתכוני שבירה"), PrismPalette.Cyan);
            string[,] recipes =
            {
                { T("CYAN + VIOLET", "תכלת + סגול"), T("PRISM LANCE", "רומח פריזמה"), T("Three piercing refractions.", "שלוש שבירות חודרות.") },
                { T("GOLD + CRIMSON", "זהב + ארגמן"), T("SOLAR CASCADE", "מפל שמש"), T("Explosive chain reaction.", "תגובת שרשרת מתפוצצת.") },
                { T("CYAN + GOLD", "תכלת + זהב"), T("ARC BEAM", "קרן קשת"), T("Pierce plus target chaining.", "חדירה וקפיצה בין מטרות.") },
                { T("VIOLET + CRIMSON", "סגול + ארגמן"), T("VOID BLOOM", "פריחת ריק"), T("Wide splitting explosion.", "פיצול רחב ומתפוצץ.") },
                { T("ALL FOUR", "כל הארבעה"), T("FULL SPECTRUM", "ספקטרום מלא"), T("The strongest combined refraction.", "השבירה המשולבת החזקה ביותר.") },
            };
            for (int i = 0; i < 5; i++)
            {
                Rect card = new Rect(106 + (i % 3) * 462, 516 + (i / 3) * 106, 440, 88);
                ui.Panel(card, .7f, i == 4 ? PrismPalette.Gold : PrismPalette.Violet);
                ui.Kicker(new Rect(card.x + 18, card.y + 10, card.width - 36, 17), recipes[i, 0], i == 4 ? PrismPalette.Gold : PrismPalette.Cyan);
                ui.Label(new Rect(card.x + 18, card.y + 31, card.width - 36, 24), D(recipes[i, 1]), 14, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(card.x + 18, card.y + 56, card.width - 36, 18), D(recipes[i, 2]), 11, PrismPalette.Muted, ReadingAnchor);
            }
        }

        private void DrawPowerGuide()
        {
            int pageSize = 9;
            int pageCount = Mathf.Max(1, Mathf.CeilToInt(UpgradeCatalog.All.Length / (float)pageSize));
            upgradeGuidePage = Mathf.Clamp(upgradeGuidePage, 0, pageCount - 1);
            for (int local = 0; local < pageSize; local++)
            {
                int index = upgradeGuidePage * pageSize + local;
                if (index >= UpgradeCatalog.All.Length) break;
                UpgradeDefinition power = UpgradeCatalog.All[index];
                Color accent = RarityColor(power.rarity);
                Rect card = new Rect(106 + (local % 3) * 464, 267 + (local / 3) * 148, 442, 130);
                ui.Panel(card, .77f, accent);
                ui.Diamond(new Vector2(card.x + 41, card.y + 45), 17, accent, power.rarity >= UpgradeRarity.Prismatic);
                ui.Label(new Rect(card.x + 30, card.y + 31, 23, 28), SafeGlyph(power.glyph), 12, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
                string name = language == LanguageId.Hebrew && !LooksCorrupt(power.hebrewName) ? power.hebrewName : power.name;
                string tag = language == LanguageId.Hebrew && !LooksCorrupt(power.hebrewTag) ? power.hebrewTag : power.tag;
                string description = language == LanguageId.Hebrew && !LooksCorrupt(power.hebrewDescription) ? power.hebrewDescription : power.description;
                ui.Kicker(new Rect(card.x + 74, card.y + 15, card.width - 98, 20), D(tag), accent);
                ui.Label(new Rect(card.x + 74, card.y + 38, card.width - 98, 27), D(name), 15, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(card.x + 24, card.y + 76, card.width - 48, 42), D(description), 11, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
            }
            if (ui.IconButton(new Rect(622, 730, 50, 38), "‹", PrismPalette.Violet, upgradeGuidePage > 0)) upgradeGuidePage--;
            ui.Label(new Rect(680, 730, 240, 38), (upgradeGuidePage + 1) + " / " + pageCount, 12, PrismPalette.Muted, TextAnchor.MiddleCenter);
            if (ui.IconButton(new Rect(928, 730, 50, 38), "›", PrismPalette.Violet, upgradeGuidePage + 1 < pageCount)) upgradeGuidePage++;
        }

        private void DrawDropGuide()
        {
            DropKind[] kinds = (DropKind[])Enum.GetValues(typeof(DropKind));
            for (int i = 0; i < kinds.Length; i++)
            {
                Rect card = new Rect(106 + (i % 3) * 464, 264 + (i / 3) * 122, 442, 106);
                Color accent = DropColor(kinds[i]);
                ui.Panel(card, .78f, accent);
                Rect iconRect = new Rect(card.x + 22, card.y + 20, 64, 64);
                PrismDraw.Disc(assets.SoftDisc, iconRect.center, 42, accent.WithAlpha(.16f));
                Color old = GUI.color;
                GUI.color = Color.white;
                PrismDraw.AtlasCell(assets.DropAtlas, iconRect, (int)kinds[i], 4, 3);
                GUI.color = old;
                ui.Label(new Rect(card.x + 104, card.y + 15, card.width - 124, 30), D(PrismLocalization.DropName(language, kinds[i])), 15, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(card.x + 104, card.y + 47, card.width - 124, 45), D(PrismLocalization.DropDescription(language, kinds[i])), 11, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
            }
        }

        private void DrawShopMenu()
        {
            MenuTitle(T("PRISM SHOP", "חנות הפריזמה"), T("PERMANENT UPGRADES // NO REAL-MONEY PURCHASES", "שדרוגים קבועים // ללא רכישות בכסף אמיתי"), PrismPalette.Gold);
            Rect health = new Rect(106, 238, 642, 230);
            ui.Panel(health, .84f, PrismPalette.Mint, true);
            ui.Kicker(new Rect(health.x + 30, health.y + 24, health.width - 60, 22), T("PRISM INTEGRITY", "שלמות הפריזמה"), PrismPalette.Mint);
            ui.Label(new Rect(health.x + 30, health.y + 53, health.width - 60, 43), T("ADDITIONAL STARTING LIFE", "חיים נוספים בתחילת המשחק"), 22, PrismPalette.Text, ReadingAnchor, FontStyle.Bold);
            ui.Label(new Rect(health.x + 30, health.y + 102, health.width - 60, 40), D(T("Every purchased level permanently adds one starting life to every mode.", "כל דרגה שנרכשת מוסיפה לצמיתות חיים אחד בתחילת כל מצב.")), 13, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);
            int healthCost = ProgressionBalance.HealthCost(profile.healthBonus);
            string healthSub = healthCost < 0 ? T("MAXIMUM LEVEL", "דרגה מרבית") : "◆ " + healthCost + "  //  " + T("CURRENT +", "נוכחי +") + profile.healthBonus;
            if (ui.Button(new Rect(health.x + 30, health.yMax - 68, health.width - 60, 44), healthCost < 0 ? T("FULLY UPGRADED", "שודרג במלואו") : T("PURCHASE INTEGRITY", "רכוש שלמות"), PrismPalette.Mint, false, healthCost >= 0 && profile.prismShards >= healthCost, 14, healthSub))
            {
                if (ProgressionService.PurchaseHealth(profile)) { SaveProfile(); audioEngine.Play("level"); }
            }

            Rect powers = new Rect(776, 238, 718, 230);
            ui.Panel(powers, .84f, PrismPalette.Violet);
            ui.Kicker(new Rect(powers.x + 30, powers.y + 24, powers.width - 60, 22), T("RARE PRISM CORES", "ליבות פריזמה נדירות"), PrismPalette.Violet);
            ui.Label(new Rect(powers.x + 30, powers.y + 53, powers.width - 60, 43), T("SPECIAL POWERS COME FROM DROPS", "כוחות מיוחדים מגיעים מדרופים"), 20, PrismPalette.Text, ReadingAnchor, FontStyle.Bold, true);
            ui.Label(new Rect(powers.x + 30, powers.y + 105, powers.width - 60, 48), D(T("Power Cores can unlock Focus, Overclock or Prism Lance. They are never sold here, so mastery—not grinding—earns combat powers.", "ליבות כוח יכולות לפתוח מיקוד, הילוך־על או רומח פריזמה. הן אינן נמכרות כאן — שליטה במשחק מעניקה כוחות.")), 12, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);
            PersistentPowerId[] persistent = { PersistentPowerId.Focus, PersistentPowerId.Overclock, PersistentPowerId.Lance };
            for (int i = 0; i < persistent.Length; i++)
            {
                bool owned = profile.HasPower(persistent[i]);
                Rect chip = new Rect(powers.x + 30 + i * 219, powers.yMax - 65, 202, 42);
                ui.Button(chip, PersistentPowerName(persistent[i]), owned ? PrismPalette.Mint : PrismPalette.Muted, owned, false, 11, owned ? T("ONLINE", "פעיל") : T("CORE REQUIRED", "דרושה ליבה"));
            }

            ui.Kicker(new Rect(106, 500, 700, 22), T("ACTIVE FRAME", "שלדה פעילה"), PrismPalette.Cyan);
            for (int i = 0; i < Mathf.Min(30, assets.Ships.Length); i++)
            {
                float x = 106 + (i % 10) * 139;
                float y = 532 + (i / 10) * 83;
                Rect cell = new Rect(x, y, 122, 68);
                Color accent = i < 25 ? PrismPalette.Cyan : PrismPalette.Violet;
                PrismDraw.Fill(assets.White, cell, (selectedShip == i ? accent : PrismPalette.Panel).WithAlpha(selectedShip == i ? .18f : .72f));
                PrismDraw.Border(assets.White, cell, accent.WithAlpha(selectedShip == i ? 1f : .32f), selectedShip == i ? 2f : 1f);
                PrismDraw.RotatedTexture(ShipTexture(i), new Rect(cell.center.x - 24, cell.y + 5, 48, 48), 0f, Color.white);
                ui.Label(new Rect(cell.x, cell.yMax - 16, cell.width, 14), (i + 1).ToString("00"), 9, PrismPalette.Muted, TextAnchor.MiddleCenter);
                if (GUI.Button(cell, GUIContent.none, ui.GetLabel(1, Color.clear, TextAnchor.MiddleCenter, FontStyle.Normal, false))) SelectShip(i);
            }
        }

        private void DrawAchievementsMenu()
        {
            MenuTitle(T("ACHIEVEMENTS", "הישגים"), T("MASTERY LEAVES A SIGNAL", "שליטה משאירה אות"), PrismPalette.Mint);
            int pageSize = 12;
            int pageCount = Mathf.Max(1, Mathf.CeilToInt(AchievementCatalog.All.Length / (float)pageSize));
            achievementPage = Mathf.Clamp(achievementPage, 0, pageCount - 1);
            for (int local = 0; local < pageSize; local++)
            {
                int index = achievementPage * pageSize + local;
                if (index >= AchievementCatalog.All.Length) break;
                AchievementDefinition achievement = AchievementCatalog.All[index];
                bool unlocked = profile.achievements.unlockedIds.Contains(achievement.id);
                float progress = AchievementSystem.Progress(achievement, profile);
                Color accent = unlocked ? RarityColor(achievement.tier) : PrismPalette.Muted;
                Rect card = new Rect(106 + (local % 3) * 464, 246 + (local / 3) * 122, 442, 106);
                ui.Panel(card, unlocked ? .88f : .62f, accent);
                ui.Diamond(new Vector2(card.x + 41, card.y + 40), 17, accent.WithAlpha(unlocked ? 1f : .45f), unlocked);
                ui.Label(new Rect(card.x + 28, card.y + 27, 26, 26), achievement.glyph, 11, unlocked ? PrismPalette.Text : PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Bold);
                string title = language == LanguageId.Hebrew ? achievement.hebrewTitle : achievement.title;
                string description = language == LanguageId.Hebrew ? achievement.hebrewDescription : achievement.description;
                ui.Label(new Rect(card.x + 78, card.y + 12, card.width - 100, 25), D(title), 14, unlocked ? PrismPalette.Text : PrismPalette.Muted, ReadingAnchor, FontStyle.Bold);
                ui.Label(new Rect(card.x + 78, card.y + 39, card.width - 100, 31), D(description), 10, PrismPalette.Muted, language == LanguageId.Hebrew ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal, true);
                ui.Progress(new Rect(card.x + 78, card.y + 78, card.width - 166, 5), progress, accent);
                ui.Label(new Rect(card.xMax - 78, card.y + 68, 58, 24), unlocked ? "✓" : Mathf.RoundToInt(progress * 100) + "%", 11, accent, TextAnchor.MiddleRight, FontStyle.Bold);
            }
            if (ui.IconButton(new Rect(622, 748, 50, 38), "‹", PrismPalette.Mint, achievementPage > 0)) achievementPage--;
            ui.Label(new Rect(680, 748, 240, 38), (achievementPage + 1) + " / " + pageCount, 12, PrismPalette.Muted, TextAnchor.MiddleCenter);
            if (ui.IconButton(new Rect(928, 748, 50, 38), "›", PrismPalette.Mint, achievementPage + 1 < pageCount)) achievementPage++;
        }

        private void DrawSettingsMenu()
        {
            CaptureRebindingKey();
            MenuTitle(T("SETTINGS", "הגדרות"), T("LANGUAGE • AUDIO • ACCESSIBILITY • CONTROLS", "שפה • שמע • נגישות • שליטה"), PrismPalette.Cyan);
            Rect left = new Rect(106, 229, 650, 522);
            Rect right = new Rect(786, 229, 708, 522);
            ui.Panel(left, .82f, PrismPalette.Cyan);
            ui.Panel(right, .82f, PrismPalette.Violet);
            ui.Kicker(new Rect(left.x + 30, left.y + 24, left.width - 60, 22), T("LANGUAGE", "שפה"), PrismPalette.Cyan);
            if (ui.Button(new Rect(left.x + 30, left.y + 58, 274, 48), "ENGLISH", PrismPalette.Cyan, language == LanguageId.English, true, 13)) SetLanguage(LanguageId.English);
            if (ui.Button(new Rect(left.x + 316, left.y + 58, 274, 48), "עברית", PrismPalette.Cyan, language == LanguageId.Hebrew, true, 14)) SetLanguage(LanguageId.Hebrew);

            ui.Kicker(new Rect(left.x + 30, left.y + 135, left.width - 60, 22), T("AUDIO", "שמע"), PrismPalette.Gold);
            ToggleSetting(new Rect(left.x + 30, left.y + 168, 274, 46), T("MUSIC", "מוזיקה"), profile.settings.musicEnabled, PrismPalette.Gold, delegate { profile.settings.musicEnabled = !profile.settings.musicEnabled; ApplyAudioSettings(); SaveProfile(); });
            ToggleSetting(new Rect(left.x + 316, left.y + 168, 274, 46), T("EFFECTS", "אפקטים"), profile.settings.soundEnabled, PrismPalette.Gold, delegate { profile.settings.soundEnabled = !profile.settings.soundEnabled; ApplyAudioSettings(); SaveProfile(); });
            DrawVolumeControl(new Rect(left.x + 30, left.y + 229, 560, 50), T("MUSIC VOLUME", "עוצמת מוזיקה"), profile.settings.musicVolume, delegate(float value) { profile.settings.musicVolume = value; ApplyAudioSettings(); });
            DrawVolumeControl(new Rect(left.x + 30, left.y + 289, 560, 50), T("EFFECT VOLUME", "עוצמת אפקטים"), profile.settings.soundVolume, delegate(float value) { profile.settings.soundVolume = value; ApplyAudioSettings(); });

            ui.Kicker(new Rect(left.x + 30, left.y + 363, left.width - 60, 22), T("ACCESSIBILITY", "נגישות"), PrismPalette.Mint);
            ToggleSetting(new Rect(left.x + 30, left.y + 397, 274, 46), T("REDUCED MOTION", "הפחתת תנועה"), profile.settings.reducedMotion, PrismPalette.Mint, delegate { profile.settings.reducedMotion = !profile.settings.reducedMotion; SaveProfile(); });
            ToggleSetting(new Rect(left.x + 316, left.y + 397, 274, 46), T("HIGH CONTRAST", "ניגודיות גבוהה"), profile.settings.highContrast, PrismPalette.Mint, delegate { profile.settings.highContrast = !profile.settings.highContrast; SaveProfile(); });
            if (ui.Button(new Rect(left.x + 30, left.y + 458, 560, 40), Screen.fullScreen ? T("EXIT FULLSCREEN", "צא ממסך מלא") : T("ENTER FULLSCREEN", "עבור למסך מלא"), PrismPalette.CyanDim, false, true, 12)) Screen.fullScreen = !Screen.fullScreen;

            ui.Kicker(new Rect(right.x + 30, right.y + 24, right.width - 60, 22), T("KEY BINDINGS", "מיפוי מקשים"), PrismPalette.Violet);
            string[,] bindings =
            {
                { "dash", T("DASH / ABSORB", "דאש / ספיגה"), "Space" },
                { "nova", T("NOVA CONFIRM", "אישור נובה"), "KeyE" },
                { "smash", T("PRISM SMASH", "מכת פריזמה"), "KeyF" },
                { "blast", T("REFRACT", "שבירה"), "KeyQ" },
                { "pause", T("PAUSE", "השהיה"), "KeyP" },
                { "hud", T("MINIMAL HUD", "ממשק מינימלי"), "KeyB" },
            };
            for (int i = 0; i < bindings.GetLength(0); i++)
            {
                float y = right.y + 62 + i * 64;
                ui.Label(new Rect(right.x + 30, y, 330, 44), D(bindings[i, 1]), 13, PrismPalette.Text, ReadingAnchor);
                string action = bindings[i, 0];
                string shown = rebindingAction == action ? T("PRESS A KEY…", "לחץ על מקש…") : DisplayBinding(profile.settings.Binding(action, bindings[i, 2]));
                if (ui.Button(new Rect(right.x + 390, y + 2, 248, 40), shown, rebindingAction == action ? PrismPalette.Gold : PrismPalette.Violet, rebindingAction == action, true, 12)) rebindingAction = action;
            }
            ui.Label(new Rect(right.x + 30, right.yMax - 66, right.width - 60, 42), D(T("Arrow keys always remain available. Escape is reserved by the browser and cannot be assigned.", "מקשי החצים תמיד זמינים. Escape שמור לדפדפן ואי אפשר להקצות אותו.")), 11, PrismPalette.Muted, ReadingAnchor, FontStyle.Normal, true);
        }

        private void CaptureRebindingKey()
        {
            if (string.IsNullOrEmpty(rebindingAction) || Event.current.type != EventType.KeyDown) return;
            KeyCode key = Event.current.keyCode;
            if (key == KeyCode.None) return;
            if (key == KeyCode.Escape)
            {
                rebindingAction = string.Empty;
                Event.current.Use();
                return;
            }
            if (key == KeyCode.UpArrow || key == KeyCode.DownArrow || key == KeyCode.LeftArrow || key == KeyCode.RightArrow) return;
            profile.settings.SetBinding(rebindingAction, key.ToString());
            rebindingAction = string.Empty;
            SaveProfile();
            audioEngine.Play("pickup", .5f);
            Event.current.Use();
        }

        private void SetLanguage(LanguageId value)
        {
            language = value;
            profile.settings.language = value;
            SaveProfile();
            audioEngine.Play("pickup", .4f);
        }

        private void ToggleSetting(Rect rect, string label, bool value, Color accent, Action toggle)
        {
            if (ui.Button(rect, label + "  //  " + (value ? T("ON", "פעיל") : T("OFF", "כבוי")), accent, value, true, 12)) toggle();
        }

        private void DrawVolumeControl(Rect rect, string label, float value, Action<float> update)
        {
            ui.Label(new Rect(rect.x, rect.y, 260, rect.height), D(label), 12, PrismPalette.Text, ReadingAnchor);
            if (ui.IconButton(new Rect(rect.x + 278, rect.y + 7, 36, 36), "−", PrismPalette.Gold, value > 0f)) { update(Mathf.Clamp01(value - .1f)); SaveProfile(); }
            ui.Progress(new Rect(rect.x + 328, rect.y + 21, 164, 7), value, PrismPalette.Gold);
            if (ui.IconButton(new Rect(rect.x + 506, rect.y + 7, 36, 36), "+", PrismPalette.Gold, value < 1f)) { update(Mathf.Clamp01(value + .1f)); SaveProfile(); }
        }

        private static string DisplayBinding(string value)
        {
            if (string.IsNullOrEmpty(value)) return "—";
            return value.StartsWith("Key", StringComparison.OrdinalIgnoreCase) && value.Length == 4 ? value.Substring(3) : value.ToUpperInvariant();
        }

        private string PersistentPowerName(PersistentPowerId id)
        {
            switch (id)
            {
                case PersistentPowerId.Overclock: return T("OVERCLOCK", "הילוך־על");
                case PersistentPowerId.Lance: return T("PRISM LANCE", "רומח פריזמה");
                default: return T("FOCUS", "מיקוד");
            }
        }

        private static Color RarityColor(UpgradeRarity rarity)
        {
            switch (rarity)
            {
                case UpgradeRarity.Anomalous: return PrismPalette.Magenta;
                case UpgradeRarity.Prismatic: return PrismPalette.Violet;
                case UpgradeRarity.Rare: return PrismPalette.Cyan;
                default: return PrismPalette.Mint;
            }
        }

        private static Color DropColor(DropKind kind)
        {
            switch (kind)
            {
                case DropKind.Repair:
                case DropKind.Alliance:
                case DropKind.Resonance: return PrismPalette.Mint;
                case DropKind.Overcharge:
                case DropKind.PowerCore: return PrismPalette.Gold;
                case DropKind.SmashCell:
                case DropKind.Cooldown:
                case DropKind.Aegis: return PrismPalette.Violet;
                case DropKind.Double:
                case DropKind.Pierce: return PrismPalette.Magenta;
                default: return PrismPalette.Cyan;
            }
        }

        private static bool LooksCorrupt(string value)
        {
            return string.IsNullOrEmpty(value) || value.IndexOf('׳') >= 0 || value.IndexOf('ג') >= 0;
        }

        private static string SafeGlyph(string value)
        {
            return LooksCorrupt(value) ? "◇" : value;
        }
    }
}
