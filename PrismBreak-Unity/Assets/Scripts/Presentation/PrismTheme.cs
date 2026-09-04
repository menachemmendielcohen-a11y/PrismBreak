using System;
using System.Linq;
using UnityEngine;

namespace PrismBreak
{
    public static class PrismPalette
    {
        public static readonly Color Void = Hex("030711");
        public static readonly Color Panel = Hex("071226");
        public static readonly Color PanelBright = Hex("0b1c35");
        public static readonly Color Cyan = Hex("65efff");
        public static readonly Color CyanDim = Hex("2a8ca0");
        public static readonly Color Violet = Hex("a873ff");
        public static readonly Color Magenta = Hex("ff5cac");
        public static readonly Color Gold = Hex("ffe076");
        public static readonly Color Crimson = Hex("ff547c");
        public static readonly Color Mint = Hex("8affc4");
        public static readonly Color Text = Hex("eaf7ff");
        public static readonly Color Muted = Hex("718198");
        public static readonly Color Danger = Hex("ff456e");

        public static Color Spectrum(SpectrumId id)
        {
            switch (id)
            {
                case SpectrumId.Violet: return Violet;
                case SpectrumId.Gold: return Gold;
                case SpectrumId.Crimson: return Crimson;
                default: return Cyan;
            }
        }

        public static Color Hex(string hex)
        {
            Color value;
            return ColorUtility.TryParseHtmlString("#" + hex, out value) ? value : Color.white;
        }
    }

    public sealed class PrismAssetLibrary
    {
        public Texture2D[] Ships { get; private set; }
        public Texture2D DropAtlas { get; private set; }
        public Texture2D White { get; private set; }
        public Texture2D Disc { get; private set; }
        public Texture2D SoftDisc { get; private set; }

        public PrismAssetLibrary()
        {
            Ships = Resources.LoadAll<Texture2D>("Art/Ships")
                .OrderBy(texture => texture.name, StringComparer.OrdinalIgnoreCase)
                .ToArray();
            DropAtlas = Resources.Load<Texture2D>("Art/Drops/prism-drop-icons");
            White = MakeWhite();
            Disc = MakeDisc(64, false);
            SoftDisc = MakeDisc(64, true);
        }

        private static Texture2D MakeWhite()
        {
            var texture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            texture.name = "PrismWhite";
            texture.SetPixel(0, 0, Color.white);
            texture.Apply(false, true);
            return texture;
        }

        private static Texture2D MakeDisc(int size, bool soft)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.name = soft ? "PrismSoftDisc" : "PrismDisc";
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.filterMode = FilterMode.Bilinear;
            var pixels = new Color32[size * size];
            float half = size * .5f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float dx = (x + .5f - half) / half;
                float dy = (y + .5f - half) / half;
                float distance = Mathf.Sqrt(dx * dx + dy * dy);
                float alpha = soft ? Mathf.Clamp01(1f - distance) : Mathf.Clamp01((1f - distance) * 12f);
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(alpha * 255f));
            }
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            return texture;
        }
    }

    public static class PrismDraw
    {
        public static void Fill(Texture2D white, Rect rect, Color color)
        {
            Color previous = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, white, ScaleMode.StretchToFill, true);
            GUI.color = previous;
        }

        public static void Border(Texture2D white, Rect rect, Color color, float width = 1f)
        {
            Fill(white, new Rect(rect.x, rect.y, rect.width, width), color);
            Fill(white, new Rect(rect.x, rect.yMax - width, rect.width, width), color);
            Fill(white, new Rect(rect.x, rect.y, width, rect.height), color);
            Fill(white, new Rect(rect.xMax - width, rect.y, width, rect.height), color);
        }

        public static void Line(Texture2D white, Vector2 from, Vector2 to, Color color, float width = 1f)
        {
            Vector2 delta = to - from;
            float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
            Matrix4x4 previous = GUI.matrix;
            GUIUtility.RotateAroundPivot(angle, from);
            Fill(white, new Rect(from.x, from.y - width * .5f, delta.magnitude, width), color);
            GUI.matrix = previous;
        }

        public static void Disc(Texture2D disc, Vector2 center, float radius, Color color)
        {
            Color previous = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(new Rect(center.x - radius, center.y - radius, radius * 2f, radius * 2f), disc, ScaleMode.StretchToFill, true);
            GUI.color = previous;
        }

        public static void RotatedTexture(Texture texture, Rect rect, float degrees, Color tint)
        {
            if (texture == null) return;
            Matrix4x4 previousMatrix = GUI.matrix;
            Color previousColor = GUI.color;
            GUIUtility.RotateAroundPivot(degrees, rect.center);
            GUI.color = tint;
            GUI.DrawTexture(rect, texture, ScaleMode.ScaleToFit, true);
            GUI.color = previousColor;
            GUI.matrix = previousMatrix;
        }

        public static void AtlasCell(Texture atlas, Rect rect, int index, int columns = 4, int rows = 3)
        {
            if (atlas == null) return;
            int safe = Mathf.Clamp(index, 0, columns * rows - 1);
            int column = safe % columns;
            int row = safe / columns;
            var uv = new Rect(column / (float)columns, 1f - (row + 1f) / rows, 1f / columns, 1f / rows);
            GUI.DrawTextureWithTexCoords(rect, atlas, uv, true);
        }
    }
}
