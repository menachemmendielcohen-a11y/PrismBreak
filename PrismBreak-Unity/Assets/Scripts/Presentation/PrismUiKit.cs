using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Immediate-mode widgets used by the menu and in-game HUD. They deliberately
    /// use only generated textures so the Unity port remains a compact WebGL build.
    /// </summary>
    public sealed class PrismUiKit
    {
        private readonly PrismAssetLibrary assets;
        private readonly Dictionary<string, GUIStyle> labels = new Dictionary<string, GUIStyle>(96);

        public PrismUiKit(PrismAssetLibrary assets)
        {
            this.assets = assets;
        }

        public void Label(Rect rect, string text, int size, Color color, TextAnchor alignment = TextAnchor.MiddleLeft,
            FontStyle fontStyle = FontStyle.Normal, bool wrap = false)
        {
            GUI.Label(rect, text ?? string.Empty, GetLabel(size, color, alignment, fontStyle, wrap));
        }

        public void Kicker(Rect rect, string text, Color color, TextAnchor alignment = TextAnchor.MiddleLeft)
        {
            Label(rect, AddTracking(text), 14, color, alignment, FontStyle.Normal, false);
        }

        public void Panel(Rect rect, float alpha = .88f, Color? accent = null, bool bright = false)
        {
            PrismDraw.Fill(assets.White, rect, Color.Lerp(bright ? PrismPalette.PanelBright : PrismPalette.Panel, Color.black, .12f).WithAlpha(alpha));
            Color edge = (accent ?? PrismPalette.CyanDim).WithAlpha(.52f);
            PrismDraw.Border(assets.White, rect, edge, 1f);
            PrismDraw.Fill(assets.White, new Rect(rect.x, rect.y, Mathf.Min(96f, rect.width * .28f), 2f), (accent ?? PrismPalette.Cyan).WithAlpha(.86f));
            PrismDraw.Line(assets.White, new Vector2(rect.xMax - 25f, rect.y), new Vector2(rect.xMax, rect.y + 25f), PrismPalette.Void, 4f);
        }

        public bool Button(Rect rect, string text, Color accent, bool selected = false, bool enabled = true,
            int size = 16, string subline = null)
        {
            Vector2 mouse = Event.current.mousePosition;
            bool hover = enabled && rect.Contains(mouse);
            float pulse = .5f + .5f * Mathf.Sin(Time.unscaledTime * 5.2f);
            Color fill = selected
                ? Color.Lerp(accent.WithAlpha(.19f), accent.WithAlpha(.28f), pulse)
                : hover ? accent.WithAlpha(.135f) : PrismPalette.Panel.WithAlpha(.84f);
            if (!enabled) fill = PrismPalette.Panel.WithAlpha(.46f);
            PrismDraw.Fill(assets.White, rect, fill);
            PrismDraw.Border(assets.White, rect, (enabled ? accent : PrismPalette.Muted).WithAlpha(hover || selected ? .95f : .47f), hover || selected ? 2f : 1f);
            PrismDraw.Fill(assets.White, new Rect(rect.x, rect.y, 4f, rect.height), (enabled ? accent : PrismPalette.Muted).WithAlpha(hover ? .9f : .5f));
            Label(new Rect(rect.x + 18f, rect.y + (subline == null ? 0 : 3f), rect.width - 36f, subline == null ? rect.height : rect.height * .58f),
                text, size, enabled ? PrismPalette.Text : PrismPalette.Muted.WithAlpha(.6f), TextAnchor.MiddleCenter,
                selected ? FontStyle.Bold : FontStyle.Normal, true);
            if (!string.IsNullOrEmpty(subline))
                Label(new Rect(rect.x + 12f, rect.y + rect.height * .54f, rect.width - 24f, rect.height * .34f), subline, 11,
                    enabled ? accent.WithAlpha(.9f) : PrismPalette.Muted.WithAlpha(.45f), TextAnchor.UpperCenter, FontStyle.Normal, true);
            return enabled && ConsumeClick(rect);
        }

        public bool IconButton(Rect rect, string glyph, Color accent, bool enabled = true, string tooltip = null)
        {
            Vector2 mouse = Event.current.mousePosition;
            bool hover = enabled && rect.Contains(mouse);
            PrismDraw.Fill(assets.White, rect, (hover ? accent : PrismPalette.Panel).WithAlpha(hover ? .18f : .82f));
            PrismDraw.Border(assets.White, rect, (enabled ? accent : PrismPalette.Muted).WithAlpha(hover ? 1f : .5f));
            Label(rect, glyph, 20, enabled ? PrismPalette.Text : PrismPalette.Muted, TextAnchor.MiddleCenter, FontStyle.Bold);
            if (!string.IsNullOrEmpty(tooltip) && hover) GUI.tooltip = tooltip;
            return enabled && ConsumeClick(rect);
        }

        public void Progress(Rect rect, float value, Color accent, Color? background = null)
        {
            value = Mathf.Clamp01(value);
            PrismDraw.Fill(assets.White, rect, (background ?? PrismPalette.Void).WithAlpha(.9f));
            if (value > 0f)
            {
                PrismDraw.Fill(assets.White, new Rect(rect.x, rect.y, rect.width * value, rect.height), accent.WithAlpha(.82f));
                PrismDraw.Fill(assets.White, new Rect(rect.x + rect.width * value - 2f, rect.y - 2f, 3f, rect.height + 4f), Color.white.WithAlpha(.72f));
            }
            PrismDraw.Border(assets.White, rect, accent.WithAlpha(.35f));
        }

        public void Diamond(Vector2 center, float radius, Color color, bool filled = false)
        {
            Vector2 top = new Vector2(center.x, center.y - radius);
            Vector2 right = new Vector2(center.x + radius, center.y);
            Vector2 bottom = new Vector2(center.x, center.y + radius);
            Vector2 left = new Vector2(center.x - radius, center.y);
            if (filled)
            {
                for (int i = 0; i < Mathf.CeilToInt(radius); i++)
                {
                    float inset = i / Mathf.Max(1f, radius);
                    float half = radius * (1f - Mathf.Abs(inset * 2f - 1f));
                    PrismDraw.Fill(assets.White, new Rect(center.x - half, center.y - radius + i, half * 2f, 2f), color);
                }
            }
            PrismDraw.Line(assets.White, top, right, color, 1.5f);
            PrismDraw.Line(assets.White, right, bottom, color, 1.5f);
            PrismDraw.Line(assets.White, bottom, left, color, 1.5f);
            PrismDraw.Line(assets.White, left, top, color, 1.5f);
        }

        public void SpectrumChip(Rect rect, SpectrumId id, int amount, string name)
        {
            Color color = PrismPalette.Spectrum(id);
            PrismDraw.Fill(assets.White, rect, color.WithAlpha(amount > 0 ? .12f : .035f));
            PrismDraw.Border(assets.White, rect, color.WithAlpha(amount > 0 ? .7f : .28f));
            Diamond(new Vector2(rect.x + 17f, rect.center.y), 6f, color, amount > 0);
            Label(new Rect(rect.x + 31f, rect.y + 1f, rect.width - 66f, rect.height - 2f), name, 11,
                amount > 0 ? color : PrismPalette.Muted, TextAnchor.MiddleLeft, FontStyle.Bold);
            Label(new Rect(rect.xMax - 34f, rect.y, 27f, rect.height), amount.ToString(), 17,
                amount > 0 ? PrismPalette.Text : PrismPalette.Muted, TextAnchor.MiddleRight, FontStyle.Bold);
        }

        public GUIStyle GetLabel(int size, Color color, TextAnchor alignment, FontStyle fontStyle, bool wrap)
        {
            string key = size + ":" + ColorUtility.ToHtmlStringRGBA(color) + ":" + (int)alignment + ":" + (int)fontStyle + ":" + wrap;
            GUIStyle style;
            if (labels.TryGetValue(key, out style)) return style;
            style = new GUIStyle(GUI.skin.label)
            {
                fontSize = size,
                alignment = alignment,
                fontStyle = fontStyle,
                wordWrap = wrap,
                clipping = wrap ? TextClipping.Clip : TextClipping.Overflow,
                richText = false,
                padding = new RectOffset(0, 0, 0, 0),
            };
            style.normal.textColor = color;
            style.hover.textColor = color;
            labels[key] = style;
            return style;
        }

        public static string AddTracking(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            var builder = new System.Text.StringBuilder(value.Length * 2);
            for (int i = 0; i < value.Length; i++)
            {
                builder.Append(value[i]);
                if (i + 1 < value.Length && value[i] != ' ' && value[i + 1] != ' ') builder.Append(' ');
            }
            return builder.ToString();
        }

        private static bool ConsumeClick(Rect rect)
        {
            Event current = Event.current;
            if (current == null || current.type != EventType.MouseUp || current.button != 0 || !rect.Contains(current.mousePosition)) return false;
            current.Use();
            return true;
        }
    }

    public static class PrismColorExtensions
    {
        public static Color WithAlpha(this Color color, float alpha)
        {
            color.a = alpha;
            return color;
        }
    }
}
