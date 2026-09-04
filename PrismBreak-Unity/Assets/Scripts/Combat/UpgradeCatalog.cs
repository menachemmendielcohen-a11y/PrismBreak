using System;
using System.Collections.Generic;

namespace PrismBreak
{
    public static class UpgradeCatalog
    {
        public static readonly UpgradeDefinition[] All =
        {
            Make(UpgradeId.Split, "SPLIT BEAM", "קרן מפוצלת", "OFFENSE", "התקפה", "Adds two refracted side shots.", "מוסיף שתי יריות צד.", "◆", 2, UpgradeRarity.Common),
            Make(UpgradeId.Rapid, "RAPID REFRACTION", "ירי מהיר", "FIRE RATE", "קצב ירי", "Fires 18% faster.", "יורה מהר יותר ב־18%.", "»", 4, UpgradeRarity.Common),
            Make(UpgradeId.Heavy, "HEAVY LIGHT", "אור כבד", "DAMAGE", "נזק", "Shots hit 28% harder.", "היריות חזקות יותר ב־28%.", "✦", 4, UpgradeRarity.Common),
            Make(UpgradeId.Chain, "ARC CHAIN", "שרשרת ברק", "VOLTAIC", "חשמל", "Kills arc damage into a nearby target.", "חיסול פוגע גם במטרה קרובה.", "ϟ", 3, UpgradeRarity.Rare),
            Make(UpgradeId.Magnet, "MAGNETIC CORE", "ליבה מגנטית", "UTILITY", "איסוף", "Greatly expands shard attraction.", "מגדיל מאוד את טווח משיכת הרסיסים.", "◎", 3, UpgradeRarity.Common),
            Make(UpgradeId.Wake, "DASH WAKE", "שובל דאש", "MOBILITY", "תנועה", "Your dash trail cuts through enemies.", "שובל הדאש חותך אויבים.", "⌁", 3, UpgradeRarity.Rare),
            Make(UpgradeId.Phase, "PHASE BATTERY", "סוללת פאזה", "COOLDOWN", "טעינה", "Dash recharges 18% faster.", "הדאש נטען מהר יותר ב־18%.", "◌", 3, UpgradeRarity.Common),
            Make(UpgradeId.Guard, "PRISM GUARD", "מגן פריזמה", "DEFENSE", "הגנה", "Nova grants a temporary shield.", "נובה נותנת מגן זמני.", "⬡", 2, UpgradeRarity.Rare),
            Make(UpgradeId.Glass, "GLASS SPECTRUM", "ספקטרום זכוכית", "RISK / REWARD", "סיכון / תגמול", "+55% damage, but maximum integrity drops.", "+55% נזק, אבל החיים המרביים יורדים.", "◇", 1, UpgradeRarity.Anomalous),
            Make(UpgradeId.Second, "SECOND LIGHT", "אור שני", "FAILSAFE", "הצלה", "Survive one lethal strike each run.", "שורד פגיעה קטלנית אחת בכל ריצה.", "✦", 1, UpgradeRarity.Prismatic),
            Make(UpgradeId.Focus, "FOCUS LENS", "עדשת מיקוד", "PRECISION", "דיוק", "Every shot deals 14% more damage.", "כל ירייה גורמת 14% יותר נזק.", "⊙", 4, UpgradeRarity.Rare),
            Make(UpgradeId.Overclock, "OVERDRIVE COIL", "סליל טורבו", "FIRE RATE", "קצב ירי", "Fires 12% faster per tier.", "יורה מהר יותר ב־12% לכל דרגה.", "≈", 3, UpgradeRarity.Rare),
            Make(UpgradeId.Lance, "PRISM LANCE", "רומח פריזמה", "SPECIAL", "כוח מיוחד", "Unlocks a devastating piercing shot with a 5 second cooldown.", "פותח ירייה חודרת ועוצמתית עם קירור של 5 שניות.", "⚡", 1, UpgradeRarity.Prismatic),
            Make(UpgradeId.Echo, "ECHO REFRACTION", "הד שבירה", "PRISMATIC", "פריזמטי", "Every refraction repeats after a delay at 58% power.", "כל שבירה חוזרת לאחר השהיה בעוצמה מופחתת.", "↯", 1, UpgradeRarity.Prismatic),
            Make(UpgradeId.SpectrumLock, "SPECTRUM LOCK", "נעילת ספקטרום", "RESONANCE", "תהודה", "Three matching absorbs store one bonus unit.", "שלוש ספיגות באותו צבע מוסיפות יחידה.", "◉", 1, UpgradeRarity.Rare),
            Make(UpgradeId.Horizon, "EVENT HORIZON", "אופק אירועים", "PERFECT ABSORB", "ספיגה מושלמת", "Perfect Absorb captures two nearby projectiles.", "ספיגה מושלמת לוכדת עוד שני קליעים סמוכים.", "◍", 1, UpgradeRarity.Anomalous),
            Make(UpgradeId.Shatterpoint, "SHATTERPOINT", "נקודת שבר", "PRISM BREAK", "שבירת פריזמה", "Break-state kills release spectrum fragments.", "חיסולים בזמן שבירה משחררים רסיסי ספקטרום.", "✦", 1, UpgradeRarity.Prismatic),
        };

        private static readonly Dictionary<UpgradeId, UpgradeDefinition> ById = BuildIndex();

        public static UpgradeDefinition Get(UpgradeId id)
        {
            return ById[id];
        }

        public static UpgradeId[] ChooseThree(DeterministicRng rng, IDictionary<UpgradeId, int> ranks,
            ISet<PersistentPowerId> unlockedPowers, int stageId)
        {
            List<UpgradeId> pool = new List<UpgradeId>
            {
                UpgradeId.Split, UpgradeId.Rapid, UpgradeId.Heavy, UpgradeId.Magnet,
                UpgradeId.Phase, UpgradeId.Second, UpgradeId.SpectrumLock
            };
            if (unlockedPowers.Contains(PersistentPowerId.Focus)) pool.Add(UpgradeId.Focus);
            if (unlockedPowers.Contains(PersistentPowerId.Overclock)) pool.Add(UpgradeId.Overclock);
            if (unlockedPowers.Contains(PersistentPowerId.Lance)) pool.Add(UpgradeId.Lance);
            if (stageId >= 2) { pool.Add(UpgradeId.Chain); pool.Add(UpgradeId.Echo); }
            if (stageId >= 3) { pool.Add(UpgradeId.Wake); pool.Add(UpgradeId.Horizon); }
            if (stageId >= 4) { pool.Add(UpgradeId.Guard); pool.Add(UpgradeId.Shatterpoint); }
            if (stageId >= 5) pool.Add(UpgradeId.Glass);

            for (int i = pool.Count - 1; i >= 0; i--)
            {
                int rank;
                ranks.TryGetValue(pool[i], out rank);
                if (rank >= Get(pool[i]).maxRank) pool.RemoveAt(i);
            }

            List<UpgradeId> result = new List<UpgradeId>(3);
            while (pool.Count > 0 && result.Count < 3)
            {
                int index = rng.Range(0, pool.Count);
                result.Add(pool[index]);
                pool.RemoveAt(index);
            }
            return result.ToArray();
        }

        private static Dictionary<UpgradeId, UpgradeDefinition> BuildIndex()
        {
            Dictionary<UpgradeId, UpgradeDefinition> result = new Dictionary<UpgradeId, UpgradeDefinition>();
            for (int i = 0; i < All.Length; i++) result[All[i].id] = All[i];
            return result;
        }

        private static UpgradeDefinition Make(UpgradeId id, string name, string hebrewName, string tag,
            string hebrewTag, string description, string hebrewDescription, string glyph, int maxRank, UpgradeRarity rarity)
        {
            return new UpgradeDefinition
            {
                id = id,
                name = name,
                hebrewName = hebrewName,
                tag = tag,
                hebrewTag = hebrewTag,
                description = description,
                hebrewDescription = hebrewDescription,
                glyph = glyph,
                maxRank = maxRank,
                rarity = rarity,
            };
        }
    }
}
