using System;
using UnityEngine;

namespace PrismBreak
{
    public sealed partial class PrismBreakApp
    {
        private void DrawGameplay()
        {
            int world = ActiveWorld();
            background.DrawArena(presentationTime, ReducedMotion, world);
            DrawArenaObjects();
            if (!minimalHud) DrawFullHud();
            else DrawMinimalHud();
            DrawEventBanner();
            if (screenFlash > 0f) PrismDraw.Fill(assets.White, new Rect(0, 0, DesignWidth, DesignHeight), Color.white.WithAlpha(screenFlash * .16f));

            if (screen == AppScreen.Paused) DrawPauseOverlay();
            else if (screen == AppScreen.Upgrade) DrawUpgradeOverlay();
            else if (screen == AppScreen.NovaConfirm) DrawNovaConfirmOverlay();
            else if (screen == AppScreen.Result) DrawResultOverlay();
        }

        private void DrawArenaObjects()
        {
            if (session == null) return;
            Vector2 shake = ReducedMotion ? Vector2.zero : new Vector2(Mathf.Sin(presentationTime * 71f), Mathf.Cos(presentationTime * 57f)) * screenShake * 3.2f;
            Matrix4x4 previous = GUI.matrix;
            GUI.matrix = previous * Matrix4x4.TRS(shake, Quaternion.identity, Vector3.one);

            for (int i = 0; i < session.Pickups.Count; i++)
            {
                PickupState pickup = session.Pickups[i];
                if (pickup.dead) continue;
                Vector2 p = ToDesign(pickup.position);
                Color color = pickup.prismShard ? PrismPalette.Mint : PrismPalette.Gold;
                PrismDraw.Disc(assets.SoftDisc, p, 23f, color.WithAlpha(.18f));
                ui.Diamond(p, 11f, color, true);
            }

            for (int i = 0; i < session.PowerDrops.Count; i++)
            {
                PowerDropState drop = session.PowerDrops[i];
                if (drop.dead) continue;
                Vector2 p = ToDesign(drop.position);
                Color color = DropColor(drop.kind);
                float pulse = ReducedMotion ? 1f : 1f + Mathf.Sin(presentationTime * 7f + i) * .08f;
                PrismDraw.Disc(assets.SoftDisc, p, 31f * pulse, color.WithAlpha(.18f));
                Rect rect = new Rect(p.x - 22f, p.y - 22f, 44f, 44f);
                PrismDraw.AtlasCell(assets.DropAtlas, rect, (int)drop.kind, 4, 3);
                PrismDraw.Border(assets.White, rect, color.WithAlpha(.85f), 1.5f);
            }

            for (int i = 0; i < session.Projectiles.Count; i++)
            {
                ProjectileState projectile = session.Projectiles[i];
                if (projectile.dead) continue;
                Vector2 p = ToDesign(projectile.position);
                Color color = projectile.color;
                float radius = Mathf.Max(4f, projectile.radius * ArenaScale);
                PrismDraw.Disc(assets.SoftDisc, p, radius * 2.5f, color.WithAlpha(projectile.hostile ? .2f : .28f));
                PrismDraw.Disc(assets.Disc, p, radius, color.WithAlpha(projectile.hostile ? .9f : 1f));
            }

            for (int i = 0; i < session.Enemies.Count; i++)
            {
                EnemyState enemy = session.Enemies[i];
                if (enemy.dead) continue;
                Vector2 p = ToDesign(enemy.position);
                Color color = enemy.ally ? PrismPalette.Mint : CombatMath.EnemyColor(enemy.kind);
                float radius = enemy.radius * ArenaScale;
                PrismDraw.Disc(assets.SoftDisc, p, radius * 2f, color.WithAlpha(.18f));
                if (enemy.kind == EnemyKind.Boss) DrawRing(p, radius * 1.2f, color.WithAlpha(.9f), 4f);
                else if (enemy.eliteTier != EliteTier.None) DrawRing(p, radius * 1.25f, color.WithAlpha(.85f), 2.5f);
                ui.Diamond(p, radius * .7f, color, enemy.ally);
                if (enemy.maxHealth > 0f && enemy.health < enemy.maxHealth)
                    ui.Progress(new Rect(p.x - radius, p.y + radius + 8f, radius * 2f, 4f), enemy.health / enemy.maxHealth, color, Color.black.WithAlpha(.35f));
            }

            for (int i = 0; i < session.Particles.Count; i++)
            {
                ParticleState particle = session.Particles[i];
                Vector2 p = ToDesign(particle.position);
                float alpha = Mathf.Clamp01(particle.life / Mathf.Max(.01f, particle.maxLife));
                if (particle.ring) DrawRing(p, particle.size * ArenaScale * (1.2f - alpha * .2f), particle.color.WithAlpha(alpha * .42f), 2f);
                else PrismDraw.Disc(assets.Disc, p, Mathf.Max(1f, particle.size * ArenaScale), particle.color.WithAlpha(alpha));
            }

            PlayerState player = session.Player;
            Vector2 center = ToDesign(player.position);
            float angle = player.aim * Mathf.Rad2Deg + 90f;
            PrismDraw.Disc(assets.SoftDisc, center, 54f, PrismPalette.Cyan.WithAlpha(.16f));
            if (player.shield > 0f) DrawRing(center, 36f + player.shield * 5f, PrismPalette.Mint.WithAlpha(.8f), 2.4f);
            PrismDraw.RotatedTexture(ShipTexture(selectedShip), new Rect(center.x - 31f, center.y - 31f, 62f, 62f), angle, Color.white);

            for (int i = 0; i < session.FloatTexts.Count; i++)
            {
                FloatTextState text = session.FloatTexts[i];
                Vector2 p = ToDesign(text.position);
                ui.Label(new Rect(p.x - 130f, p.y - 18f, 260f, 26f), text.text, 13, text.color.WithAlpha(Mathf.Clamp01(text.life)), TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            GUI.matrix = previous;
        }

        private void DrawFullHud()
        {
            if (session == null) return;
            Rect left = new Rect(34, 34, 374, 242);
            ui.Panel(left, .84f, PrismPalette.Cyan);
            ui.Kicker(new Rect(left.x + 20, left.y + 16, left.width - 40, 20), session.Config.label, PrismPalette.Cyan);
            ui.Label(new Rect(left.x + 20, left.y + 44, left.width - 40, 30), session.CurrentObjectiveProgress + " / " + session.ObjectiveTarget, 22, PrismPalette.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            ui.Progress(new Rect(left.x + 20, left.y + 82, left.width - 40, 7), session.CurrentObjectiveProgress / (float)Mathf.Max(1, session.ObjectiveTarget), PrismPalette.Cyan);
            ui.Kicker(new Rect(left.x + 20, left.y + 110, left.width - 40, 20), "PRISM REFRACTION ENGINE", PrismPalette.Muted);
            SpectrumId[] spectra = { SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Gold, SpectrumId.Crimson };
            for (int i = 0; i < spectra.Length; i++)
                ui.SpectrumChip(new Rect(left.x + 20 + i * 82, left.y + 144, 72, 42), spectra[i], session.Spectrum.Get(spectra[i]), PrismLocalization.SpectrumName(language, spectra[i]).Substring(0, 3).ToUpperInvariant());
            ui.Label(new Rect(left.x + 20, left.y + 197, left.width - 40, 24), "Q / LMB REFRACT   E NOVA COIN   B HUD", 12, PrismPalette.Muted);

            Rect right = new Rect(1192, 34, 352, 208);
            ui.Panel(right, .82f, PrismPalette.Gold);
            DataRow(right, 20, "SCORE", session.Score.ToString("N0"), PrismPalette.Text);
            DataRow(right, 70, "COMBO", session.Multiplier.ToString("0.00") + "x", PrismPalette.Gold);
            DataRow(right, 120, "COINS", "x " + session.CoinsCollected, PrismPalette.Gold);
            DataRow(right, 170, "TIME", Mathf.CeilToInt(session.TimeRemaining).ToString(), PrismPalette.Cyan);

            Rect bottom = new Rect(34, 798, 520, 56);
            ui.Panel(bottom, .74f, PrismPalette.Crimson);
            ui.Label(new Rect(bottom.x + 20, bottom.y + 7, 170, 18), "INTEGRITY", 11, PrismPalette.Muted);
            ui.Progress(new Rect(bottom.x + 20, bottom.y + 30, 200, 8), session.Player.health / (float)Mathf.Max(1, session.Player.maxHealth), PrismPalette.Crimson);
            ui.Label(new Rect(bottom.x + 238, bottom.y + 16, 72, 24), session.Player.health + "/" + session.Player.maxHealth, 16, PrismPalette.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            ui.Label(new Rect(bottom.x + 328, bottom.y + 7, 170, 18), "NOVA CHARGE", 11, PrismPalette.Muted);
            ui.Progress(new Rect(bottom.x + 328, bottom.y + 30, 160, 8), session.NovaCharge / 100f, PrismPalette.Cyan);
        }

        private void DrawMinimalHud()
        {
            if (session == null) return;
            ui.Label(new Rect(28, 24, 480, 30), "HP " + session.Player.health + "/" + session.Player.maxHealth + "   COIN " + session.CoinsCollected + "   SCORE " + session.Score.ToString("N0"), 15, PrismPalette.Text);
        }

        private void DrawPauseOverlay()
        {
            Rect panel = new Rect(522, 250, 556, 316);
            ui.Panel(panel, .94f, PrismPalette.Cyan, true);
            ui.Kicker(new Rect(panel.x + 35, panel.y + 34, panel.width - 70, 24), T("SIMULATION SUSPENDED", "PAUSED"), PrismPalette.Cyan, TextAnchor.MiddleCenter);
            ui.Label(new Rect(panel.x + 35, panel.y + 72, panel.width - 70, 62), T("PAUSED", "PAUSED"), 38, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            if (ui.Button(new Rect(panel.x + 86, panel.y + 166, panel.width - 172, 52), T("RESUME", "RESUME"), PrismPalette.Cyan, false, true, 16))
            {
                session.SetPaused(false);
                screen = AppScreen.Playing;
            }
            if (ui.Button(new Rect(panel.x + 86, panel.y + 236, panel.width - 172, 44), T("RETURN TO HOME", "RETURN HOME"), PrismPalette.Muted, false, true, 13))
            {
                session = null;
                screen = AppScreen.Home;
                Cursor.visible = true;
            }
        }

        private void DrawUpgradeOverlay()
        {
            UpgradeId[] choices = session != null ? session.UpgradeChoices : Array.Empty<UpgradeId>();
            Rect panel = new Rect(142, 142, 1316, 578);
            ui.Panel(panel, .93f, PrismPalette.Violet, true);
            ui.Kicker(new Rect(panel.x + 40, panel.y + 44, panel.width - 80, 24), "PRISM EVOLUTION // LEVEL " + (session != null ? session.Level.ToString("00") : "00"), PrismPalette.Cyan, TextAnchor.MiddleCenter);
            ui.Label(new Rect(panel.x + 40, panel.y + 86, panel.width - 80, 58), T("CHOOSE POWER", "CHOOSE POWER"), 36, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            for (int i = 0; i < choices.Length; i++)
            {
                UpgradeDefinition upgrade = UpgradeCatalog.Get(choices[i]);
                Color accent = RarityColor(upgrade.rarity);
                Rect card = new Rect(panel.x + 70 + i * 400, panel.y + 190, 360, 292);
                ui.Panel(card, .86f, accent, true);
                ui.Diamond(new Vector2(card.center.x, card.y + 62), 24, accent, true);
                ui.Label(new Rect(card.center.x - 20, card.y + 43, 40, 38), SafeGlyph(upgrade.glyph), 14, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
                ui.Kicker(new Rect(card.x + 28, card.y + 105, card.width - 56, 22), language == LanguageId.Hebrew ? upgrade.hebrewTag : upgrade.tag, accent, TextAnchor.MiddleCenter);
                ui.Label(new Rect(card.x + 28, card.y + 132, card.width - 56, 36), D(language == LanguageId.Hebrew ? upgrade.hebrewName : upgrade.name), 18, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
                ui.Label(new Rect(card.x + 28, card.y + 184, card.width - 56, 54), D(language == LanguageId.Hebrew ? upgrade.hebrewDescription : upgrade.description), 12, PrismPalette.Muted, TextAnchor.UpperCenter, FontStyle.Normal, true);
                if (ui.Button(new Rect(card.x + 42, card.yMax - 48, card.width - 84, 34), T("INSTALL", "INSTALL"), accent, false, true, 12))
                    session.ApplyUpgrade(choices[i]);
            }
        }

        private void DrawNovaConfirmOverlay()
        {
            Rect panel = new Rect(510, 230, 580, 360);
            ui.Panel(panel, .95f, PrismPalette.Cyan, true);
            ui.Kicker(new Rect(panel.x + 35, panel.y + 28, panel.width - 70, 24), T("NOVA AUTHORIZATION // PRISM COIN", "NOVA AUTHORIZATION // PRISM COIN"), PrismPalette.Cyan, TextAnchor.MiddleCenter);
            ui.Label(new Rect(panel.x + 35, panel.y + 72, panel.width - 70, 56), T("DEPLOY NOVA?", "DEPLOY NOVA?"), 32, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            int coins = session != null ? session.CoinsCollected : 0;
            ui.Label(new Rect(panel.x + 60, panel.y + 142, panel.width - 120, 34), "COST 1 COIN  //  BALANCE " + coins, 16, coins > 0 ? PrismPalette.Gold : PrismPalette.Danger, TextAnchor.MiddleCenter, FontStyle.Bold);
            ui.Label(new Rect(panel.x + 74, panel.y + 188, panel.width - 148, 46), coins > 0 ? "Yes spends one collected run coin and releases Prism Nova." : "Collect one coin from enemies before authorizing Nova.", 13, PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Normal, true);
            if (ui.Button(new Rect(panel.x + 86, panel.yMax - 96, 190, 48), "YES // PAY 1", PrismPalette.Cyan, false, coins > 0, 13))
            {
                session.ConfirmNova(true);
                screen = AppScreen.Playing;
            }
            if (ui.Button(new Rect(panel.xMax - 276, panel.yMax - 96, 190, 48), "NO", PrismPalette.Muted, false, true, 13))
            {
                session.ConfirmNova(false);
                screen = AppScreen.Playing;
            }
        }

        private void DrawResultOverlay()
        {
            RunResult result = session != null ? session.Result : null;
            Rect panel = new Rect(458, 122, 684, 640);
            ui.Panel(panel, .95f, result != null && result.victory ? PrismPalette.Cyan : PrismPalette.Crimson, true);
            ui.Kicker(new Rect(panel.x + 42, panel.y + 38, panel.width - 84, 24), result != null && result.victory ? "SIGNAL CONTAINED" : "SIGNAL TERMINATED", result != null && result.victory ? PrismPalette.Cyan : PrismPalette.Crimson, TextAnchor.MiddleCenter);
            ui.Label(new Rect(panel.x + 42, panel.y + 84, panel.width - 84, 92), result != null && result.victory ? "PRISM\nASCENDED" : "PRISM\nFALLEN", 50, PrismPalette.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            DataRow(panel, 218, "FINAL SCORE", result != null ? result.score.ToString("N0") : "0", PrismPalette.Text);
            DataRow(panel, 278, "PRISM SHARDS", result != null ? "+" + result.shardsEarned : "+0", PrismPalette.Gold);
            DataRow(panel, 338, "HOSTILES", result != null ? result.kills.ToString() : "0", PrismPalette.Cyan);
            DataRow(panel, 398, "BEST COMBO", result != null ? result.bestCombo.ToString("0.00") + "x" : "1.00x", PrismPalette.Violet);
            if (ui.Button(new Rect(panel.x + 112, panel.yMax - 110, panel.width - 224, 54), T("RUN IT AGAIN", "RUN IT AGAIN"), PrismPalette.Cyan, false, true, 16))
            {
                if (activeConfig != null) StartRun(activeConfig);
            }
            if (ui.Button(new Rect(panel.x + 164, panel.yMax - 46, panel.width - 328, 34), T("RETURN TO HOME", "RETURN TO HOME"), PrismPalette.Muted, false, true, 12))
            {
                session = null;
                activeConfig = null;
                screen = AppScreen.Home;
                Cursor.visible = true;
            }
        }

        private void DrawEventBanner()
        {
            if (eventBannerTime <= 0f || string.IsNullOrEmpty(eventBanner)) return;
            float alpha = Mathf.Clamp01(eventBannerTime);
            ui.Label(new Rect(430, 94, 740, 42), eventBanner, 25, eventBannerColor.WithAlpha(alpha), TextAnchor.MiddleCenter, FontStyle.Bold);
        }

        private void DrawRing(Vector2 center, float radius, Color color, float width)
        {
            const int segments = 44;
            Vector2 previous = center + new Vector2(radius, 0f);
            for (int i = 1; i <= segments; i++)
            {
                float angle = i * Mathf.PI * 2f / segments;
                Vector2 next = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
                PrismDraw.Line(assets.White, previous, next, color, width);
                previous = next;
            }
        }

        private Vector2 ToDesign(Vector2 arena)
        {
            return new Vector2(arena.x * ArenaScale, arena.y * ArenaScale);
        }

        private int ActiveWorld()
        {
            if (session == null || session.Config == null) return 1;
            if (session.Config.mode == RunMode.Campaign && session.Config.stageId > 0)
                return CampaignCatalog.WorldForStage(session.Config.stageId).id;
            if (session.Config.mode == RunMode.Prime) return 4;
            if (session.Config.mode == RunMode.Threat) return 3;
            return 1;
        }
    }
}
