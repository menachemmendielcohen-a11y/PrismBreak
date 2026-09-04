using UnityEngine;

namespace PrismBreak
{
    /// <summary>Procedural PRISM PROTOCOL backdrop shared by every screen.</summary>
    public sealed class PrismBackgroundRenderer
    {
        private struct Star
        {
            public float x;
            public float y;
            public float size;
            public float phase;
            public float speed;
        }

        private readonly PrismAssetLibrary assets;
        private readonly Star[] stars = new Star[92];

        public PrismBackgroundRenderer(PrismAssetLibrary assets)
        {
            this.assets = assets;
            var rng = new System.Random(0x50A17);
            for (int i = 0; i < stars.Length; i++)
            {
                stars[i].x = (float)rng.NextDouble() * 1600f;
                stars[i].y = (float)rng.NextDouble() * 900f;
                stars[i].size = 1f + (float)rng.NextDouble() * 2.2f;
                stars[i].phase = (float)rng.NextDouble() * 10f;
                stars[i].speed = .8f + (float)rng.NextDouble() * 2.5f;
            }
        }

        public void DrawMenu(float time, bool reducedMotion, int variant = 0)
        {
            DrawVoidBands(variant);
            DrawStars(time, reducedMotion, 1f);
            DrawPerspectiveGrid(time, reducedMotion, variant);
            DrawSpectralGeometry(time, reducedMotion, variant);
            DrawScanLines(time, reducedMotion);
        }

        public void DrawArena(float time, bool reducedMotion, int world)
        {
            DrawVoidBands(Mathf.Clamp(world - 1, 0, 3));
            DrawStars(time, reducedMotion, 1.35f);
            DrawPerspectiveGrid(time * 1.3f, reducedMotion, world);
            DrawSpectralGeometry(time * 1.15f, reducedMotion, world);
            DrawScanLines(time, reducedMotion);
        }

        private void DrawVoidBands(int variant)
        {
            PrismDraw.Fill(assets.White, new Rect(0, 0, 1600, 900), PrismPalette.Void);
            Color core = variant % 4 == 1 ? PrismPalette.Violet : variant % 4 == 2 ? PrismPalette.Magenta : variant % 4 == 3 ? PrismPalette.Gold : PrismPalette.Cyan;
            for (int i = 0; i < 18; i++)
            {
                float t = i / 17f;
                Color color = Color.Lerp(core.WithAlpha(.025f), PrismPalette.Void.WithAlpha(.01f), t);
                PrismDraw.Fill(assets.White, new Rect(0, 900f * t, 1600, 54f), color);
            }
            PrismDraw.Disc(assets.SoftDisc, new Vector2(1260, 180), 380, core.WithAlpha(.035f));
            PrismDraw.Disc(assets.SoftDisc, new Vector2(260, 700), 310, PrismPalette.Violet.WithAlpha(.025f));
        }

        private void DrawStars(float time, bool reducedMotion, float speedScale)
        {
            for (int i = 0; i < stars.Length; i++)
            {
                Star star = stars[i];
                float y = star.y;
                if (!reducedMotion) y = Mathf.Repeat(y + time * star.speed * speedScale, 900f);
                float shimmer = .28f + .32f * (Mathf.Sin(time * 1.7f + star.phase) * .5f + .5f);
                Color color = (i % 7 == 0 ? PrismPalette.Violet : PrismPalette.Cyan).WithAlpha(shimmer);
                PrismDraw.Fill(assets.White, new Rect(star.x, y, star.size, star.size), color);
            }
        }

        private void DrawPerspectiveGrid(float time, bool reducedMotion, int variant)
        {
            float horizon = 310f;
            Color cyan = PrismPalette.Cyan.WithAlpha(.075f);
            Color purple = PrismPalette.Violet.WithAlpha(.052f);
            for (int i = -12; i <= 12; i++)
            {
                float bottomX = 800f + i * 92f;
                float topX = 800f + i * 15f;
                PrismDraw.Line(assets.White, new Vector2(topX, horizon), new Vector2(bottomX, 900f), (i & 1) == 0 ? cyan : purple);
            }

            float drift = reducedMotion ? 0f : Mathf.Repeat(time * 18f, 52f);
            for (int i = 0; i < 14; i++)
            {
                float normalized = (i * 52f + drift) / 728f;
                float curve = normalized * normalized;
                float y = horizon + curve * 590f;
                PrismDraw.Line(assets.White, new Vector2(0, y), new Vector2(1600, y), ((i + variant) & 1) == 0 ? cyan : purple);
            }
            PrismDraw.Line(assets.White, new Vector2(0, horizon), new Vector2(1600, horizon), PrismPalette.Cyan.WithAlpha(.12f), 2f);
        }

        private void DrawSpectralGeometry(float time, bool reducedMotion, int variant)
        {
            float rotation = reducedMotion ? 0f : time * (4f + variant);
            DrawPolygon(new Vector2(1280, 420), 280, 6, rotation, PrismPalette.Violet.WithAlpha(.1f));
            DrawPolygon(new Vector2(1280, 420), 210, 6, -rotation * .72f, PrismPalette.Cyan.WithAlpha(.105f));
            DrawPolygon(new Vector2(295, 235), 190, 3, rotation * .45f, PrismPalette.Cyan.WithAlpha(.065f));
            DrawPolygon(new Vector2(295, 235), 135, 3, -rotation * .85f, PrismPalette.Magenta.WithAlpha(.05f));
        }

        private void DrawPolygon(Vector2 center, float radius, int sides, float degrees, Color color)
        {
            float radians = degrees * Mathf.Deg2Rad;
            Vector2 previous = center + new Vector2(Mathf.Cos(radians), Mathf.Sin(radians)) * radius;
            for (int i = 1; i <= sides; i++)
            {
                float angle = radians + i * Mathf.PI * 2f / sides;
                Vector2 next = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
                PrismDraw.Line(assets.White, previous, next, color, 1.5f);
                previous = next;
            }
        }

        private void DrawScanLines(float time, bool reducedMotion)
        {
            for (int y = 2; y < 900; y += 5)
                PrismDraw.Fill(assets.White, new Rect(0, y, 1600, 1), Color.black.WithAlpha(.075f));
            float scanY = reducedMotion ? 446f : Mathf.Repeat(time * 96f, 960f) - 30f;
            PrismDraw.Fill(assets.White, new Rect(0, scanY, 1600, 2f), PrismPalette.Cyan.WithAlpha(.06f));
        }
    }
}
