using System;
using System.Collections.Generic;
using System.Text;

namespace PrismBreak
{
    /// <summary>
    /// Tiny, allocation-conscious localization helpers for the presentation layer.
    /// Game/catalog data keeps its own translated fields; this class owns only UI chrome.
    /// </summary>
    public static class PrismLocalization
    {
        public static string T(LanguageId language, string english, string hebrew)
        {
            return language == LanguageId.Hebrew ? hebrew : english;
        }

        public static string DifficultyName(LanguageId language, Difficulty difficulty)
        {
            switch (difficulty)
            {
                case Difficulty.Cadet: return T(language, "CADET", "צוער");
                case Difficulty.Overdrive: return T(language, "OVERDRIVE", "הילוך־על");
                default: return T(language, "STANDARD", "רגיל");
            }
        }

        public static string ObjectiveName(LanguageId language, ObjectiveKind objective)
        {
            switch (objective)
            {
                case ObjectiveKind.Kills: return T(language, "ELIMINATE HOSTILES", "חסל אויבים");
                case ObjectiveKind.Absorb: return T(language, "ABSORB PROJECTILES", "ספוג קליעים");
                case ObjectiveKind.Elites: return T(language, "ELIMINATE ELITES", "חסל אליטות");
                case ObjectiveKind.Boss: return T(language, "BREAK THE APERTURE", "שבור את המִפתח");
                default: return T(language, "SURVIVE THE SEQUENCE", "שרוד את הרצף");
            }
        }

        public static string SpectrumName(LanguageId language, SpectrumId spectrum)
        {
            switch (spectrum)
            {
                case SpectrumId.Violet: return T(language, "VIOLET", "סגול");
                case SpectrumId.Gold: return T(language, "GOLD", "זהב");
                case SpectrumId.Crimson: return T(language, "CRIMSON", "ארגמן");
                default: return T(language, "CYAN", "תכלת");
            }
        }

        public static string DropName(LanguageId language, DropKind kind)
        {
            switch (kind)
            {
                case DropKind.Repair: return T(language, "REPAIR SHARD", "שבר תיקון");
                case DropKind.Overcharge: return T(language, "NOVA CELL", "תא נובה");
                case DropKind.Rapid: return T(language, "RAPID MODULE", "מודול מהיר");
                case DropKind.SmashCell: return T(language, "SMASH CELL", "תא מחץ");
                case DropKind.Double: return T(language, "TWIN BEAM", "קרן כפולה");
                case DropKind.Alliance: return T(language, "CHROMA PACT", "ברית כרומה");
                case DropKind.PowerCore: return T(language, "PRISM CORE", "ליבת פריזמה");
                case DropKind.Cooldown: return T(language, "TIME FRACTURE", "שבר זמן");
                case DropKind.Aegis: return T(language, "AEGIS PLATE", "לוח מגן");
                case DropKind.Pierce: return T(language, "PHASE NEEDLE", "מחט פאזה");
                case DropKind.Stasis: return T(language, "STASIS BLOOM", "פריחת קיפאון");
                default: return T(language, "ABSORPTION COIL", "סליל ספיגה");
            }
        }

        public static string DropDescription(LanguageId language, DropKind kind)
        {
            switch (kind)
            {
                case DropKind.Repair: return T(language, "Restores one point of Prism Integrity.", "משחזר נקודת שלמות אחת.");
                case DropKind.Overcharge: return T(language, "Immediately adds energy to the Nova core.", "מוסיף מיד אנרגיה לליבת הנובה.");
                case DropKind.Rapid: return T(language, "Temporarily accelerates the primary array.", "מאיץ זמנית את מערך הירי הראשי.");
                case DropKind.SmashCell: return T(language, "Cuts nine seconds from Prism Smash recharge.", "מוריד תשע שניות מזמן הקירור של המחץ.");
                case DropKind.Double: return T(language, "Temporarily adds a second primary beam.", "מוסיף זמנית קרן ירי ראשית שנייה.");
                case DropKind.Alliance: return T(language, "Converts matching hostiles into temporary allies.", "הופך אויבים תואמי צבע לבעלי ברית זמניים.");
                case DropKind.PowerCore: return T(language, "Unlocks one persistent special power.", "פותח כוח מיוחד קבוע אחד.");
                case DropKind.Cooldown: return T(language, "Reduces all active ability cooldowns by ten seconds.", "מוריד עשר שניות מכל זמני הקירור הפעילים.");
                case DropKind.Aegis: return T(language, "Blocks the next incoming hit.", "חוסם את הפגיעה הבאה.");
                case DropKind.Pierce: return T(language, "Primary shots pierce hostile formations.", "הירי הראשי חודר דרך מערכי אויבים.");
                case DropKind.Stasis: return T(language, "Slows nearby enemies and hostile projectiles.", "מאט אויבים וקליעים עוינים בקרבתך.");
                default: return T(language, "Expands absorption range and stored energy gain.", "מרחיב את טווח הספיגה ואת כמות האנרגיה שנאגרת.");
            }
        }

        public static string EnemyName(LanguageId language, EnemyKind kind)
        {
            switch (kind)
            {
                case EnemyKind.Halo: return T(language, "HALO", "הילה");
                case EnemyKind.Splitter: return T(language, "SPLITTER", "מפצל");
                case EnemyKind.Lancer: return T(language, "LANCER", "נושא רומח");
                case EnemyKind.Bulwark: return T(language, "BULWARK", "מבצר");
                case EnemyKind.Skimmer: return T(language, "SKIMMER", "מרפרף");
                case EnemyKind.Weaver: return T(language, "WEAVER", "אורג");
                case EnemyKind.Warden: return T(language, "WARDEN", "סוהר");
                case EnemyKind.Siphon: return T(language, "SIPHON", "שואב");
                case EnemyKind.Phantom: return T(language, "PHANTOM", "רוח");
                case EnemyKind.Oracle: return T(language, "ORACLE", "אורקל");
                case EnemyKind.Boss: return T(language, "THE APERTURE", "המִפתח");
                default: return T(language, "NEEDLE", "מחט");
            }
        }

        /// <summary>
        /// Unity's legacy GUI handles right alignment but its bidi support varies by
        /// runtime. Directional embedding keeps Hebrew and mixed numbers stable in
        /// current desktop/WebGL players without mutating catalog strings.
        /// </summary>
        public static string Display(LanguageId language, string value)
        {
            if (language != LanguageId.Hebrew || string.IsNullOrEmpty(value)) return value ?? string.Empty;
            return "\u202B" + value + "\u202C";
        }
    }
}
