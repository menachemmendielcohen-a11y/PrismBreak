using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace PrismBreak
{
    /// <summary>
    /// Small read-only JSON parser used only to migrate the browser game's legacy
    /// dictionary-shaped profile. New Unity saves use JsonUtility.
    /// </summary>
    internal sealed class MiniJsonReader
    {
        private readonly string source;
        private int index;

        private MiniJsonReader(string source) { this.source = source ?? string.Empty; }

        public static object Parse(string json)
        {
            try { return new MiniJsonReader(json).ReadValue(); }
            catch { return null; }
        }

        private object ReadValue()
        {
            SkipWhite();
            if (index >= source.Length) return null;
            char token = source[index];
            if (token == '{') return ReadObject();
            if (token == '[') return ReadArray();
            if (token == '"') return ReadString();
            if (token == 't' && Match("true")) return true;
            if (token == 'f' && Match("false")) return false;
            if (token == 'n' && Match("null")) return null;
            return ReadNumber();
        }

        private Dictionary<string, object> ReadObject()
        {
            Dictionary<string, object> result = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            index++;
            while (index < source.Length)
            {
                SkipWhite();
                if (Consume('}')) return result;
                string key = ReadString();
                SkipWhite();
                if (!Consume(':')) throw new FormatException("Missing colon");
                result[key] = ReadValue();
                SkipWhite();
                if (Consume('}')) return result;
                if (!Consume(',')) throw new FormatException("Missing comma");
            }
            throw new FormatException("Unclosed object");
        }

        private List<object> ReadArray()
        {
            List<object> result = new List<object>();
            index++;
            while (index < source.Length)
            {
                SkipWhite();
                if (Consume(']')) return result;
                result.Add(ReadValue());
                SkipWhite();
                if (Consume(']')) return result;
                if (!Consume(',')) throw new FormatException("Missing comma");
            }
            throw new FormatException("Unclosed array");
        }

        private string ReadString()
        {
            SkipWhite();
            if (!Consume('"')) throw new FormatException("Expected string");
            StringBuilder builder = new StringBuilder();
            while (index < source.Length)
            {
                char value = source[index++];
                if (value == '"') return builder.ToString();
                if (value != '\\') { builder.Append(value); continue; }
                if (index >= source.Length) break;
                char escaped = source[index++];
                switch (escaped)
                {
                    case '"': builder.Append('"'); break;
                    case '\\': builder.Append('\\'); break;
                    case '/': builder.Append('/'); break;
                    case 'b': builder.Append('\b'); break;
                    case 'f': builder.Append('\f'); break;
                    case 'n': builder.Append('\n'); break;
                    case 'r': builder.Append('\r'); break;
                    case 't': builder.Append('\t'); break;
                    case 'u':
                        if (index + 4 > source.Length) throw new FormatException("Bad unicode escape");
                        builder.Append((char)int.Parse(source.Substring(index, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        index += 4;
                        break;
                    default: builder.Append(escaped); break;
                }
            }
            throw new FormatException("Unclosed string");
        }

        private object ReadNumber()
        {
            int start = index;
            while (index < source.Length)
            {
                char value = source[index];
                if ((value >= '0' && value <= '9') || value == '-' || value == '+' || value == '.' || value == 'e' || value == 'E') index++;
                else break;
            }
            double number;
            if (start == index || !double.TryParse(source.Substring(start, index - start), NumberStyles.Float,
                CultureInfo.InvariantCulture, out number)) throw new FormatException("Bad number");
            return number;
        }

        private bool Match(string value)
        {
            if (index + value.Length > source.Length || string.CompareOrdinal(source, index, value, 0, value.Length) != 0) return false;
            index += value.Length;
            return true;
        }

        private bool Consume(char value)
        {
            if (index >= source.Length || source[index] != value) return false;
            index++;
            return true;
        }

        private void SkipWhite()
        {
            while (index < source.Length && char.IsWhiteSpace(source[index])) index++;
        }
    }
}
