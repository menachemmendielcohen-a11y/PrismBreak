using System;
using UnityEngine;

namespace PrismBreak
{
    public static class PrismMath
    {
        public static float Clamp(float value, float min, float max) { return Mathf.Max(min, Mathf.Min(max, value)); }
        public static int Clamp(int value, int min, int max) { return Math.Max(min, Math.Min(max, value)); }
        public static float Lerp(float a, float b, float t) { return a + (b - a) * Mathf.Clamp01(t); }
        public static float SmoothStep(float edge0, float edge1, float value)
        {
            float t = Mathf.Clamp01((value - edge0) / Mathf.Max(.0001f, edge1 - edge0));
            return t * t * (3f - 2f * t);
        }

        public static float DistanceToSegmentSquared(Vector2 point, Vector2 start, Vector2 end)
        {
            Vector2 segment = end - start;
            float lengthSquared = segment.sqrMagnitude;
            if (lengthSquared <= .00001f) return (point - start).sqrMagnitude;
            float t = Mathf.Clamp01(Vector2.Dot(point - start, segment) / lengthSquared);
            Vector2 closest = start + segment * t;
            return (point - closest).sqrMagnitude;
        }

        public static Vector2 FromAngle(float radians) { return new Vector2(Mathf.Cos(radians), Mathf.Sin(radians)); }
        public static float Angle(Vector2 direction) { return Mathf.Atan2(direction.y, direction.x); }
    }

    [Serializable]
    public sealed class DeterministicRng
    {
        [SerializeField] private uint state;

        public DeterministicRng(int seed)
        {
            state = seed == 0 ? 0x9e3779b9u : unchecked((uint)seed);
        }

        public uint NextUInt()
        {
            uint value = state;
            value ^= value << 13;
            value ^= value >> 17;
            value ^= value << 5;
            state = value;
            return value;
        }

        public float NextFloat() { return (NextUInt() & 0x00ffffffu) / 16777216f; }
        public int Range(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextFloat() * (maxExclusive - minInclusive));
        }
        public float Range(float minInclusive, float maxInclusive) { return Mathf.Lerp(minInclusive, maxInclusive, NextFloat()); }
        public bool Chance(float probability) { return NextFloat() < Mathf.Clamp01(probability); }
    }
}
