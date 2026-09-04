using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    public sealed class SynthAudioEngine : MonoBehaviour
    {
        private readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>(StringComparer.OrdinalIgnoreCase);
        private AudioSource source;
        private AudioSource musicSource;
        private bool enabled = true;
        private bool musicEnabled = true;
        private bool effectsEnabled = true;
        private float musicVolume = .58f;
        private float effectsVolume = .75f;
        public bool Enabled
        {
            get { return enabled; }
            set
            {
                enabled = value;
                ApplyMix();
            }
        }

        public bool MusicEnabled
        {
            get { return musicEnabled; }
            set { musicEnabled = value; ApplyMix(); }
        }

        public bool EffectsEnabled
        {
            get { return effectsEnabled; }
            set { effectsEnabled = value; ApplyMix(); }
        }

        public float MusicVolume
        {
            get { return musicVolume; }
            set { musicVolume = Mathf.Clamp01(value); ApplyMix(); }
        }

        public float EffectsVolume
        {
            get { return effectsVolume; }
            set { effectsVolume = Mathf.Clamp01(value); ApplyMix(); }
        }

        private void Awake()
        {
            source = gameObject.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.spatialBlend = 0f;
            source.volume = .42f;
            musicSource = gameObject.AddComponent<AudioSource>();
            musicSource.playOnAwake = false;
            musicSource.loop = true;
            musicSource.spatialBlend = 0f;
            musicSource.volume = .13f;
            musicSource.clip = CreateMusicLoop();
            clips["shoot"] = CreateTone("Shoot", 720f, .045f, .13f, 1.5f);
            clips["hit"] = CreateTone("Hit", 210f, .055f, .18f, .65f);
            clips["kill"] = CreateTone("Kill", 150f, .12f, .24f, 2.2f);
            clips["dash"] = CreateTone("Dash", 390f, .09f, .20f, 2.8f);
            clips["absorb"] = CreateTone("Absorb", 520f, .11f, .2f, .55f);
            clips["perfect"] = CreateChord("Perfect", new[] { 720f, 1080f }, .16f, .20f);
            clips["refract"] = CreateChord("Refract", new[] { 330f, 660f, 990f }, .18f, .20f);
            clips["nova"] = CreateChord("Nova", new[] { 90f, 180f, 360f }, .5f, .24f);
            clips["hurt"] = CreateTone("Hurt", 95f, .18f, .27f, .4f);
            clips["pickup"] = CreateChord("Pickup", new[] { 620f, 930f }, .12f, .16f);
            clips["level"] = CreateChord("Level", new[] { 440f, 660f, 880f }, .32f, .18f);
            musicSource.Play();
            ApplyMix();
        }

        public void SetMusicIntensity(float intensity)
        {
            if (musicSource != null)
                musicSource.volume = enabled && musicEnabled
                    ? Mathf.Lerp(.07f, .18f, Mathf.Clamp01(intensity)) * musicVolume
                    : 0f;
        }

        public void Play(string id, float volume = 1f)
        {
            AudioClip clip;
            if (!enabled || !effectsEnabled || source == null || !clips.TryGetValue(id ?? string.Empty, out clip)) return;
            source.PlayOneShot(clip, Mathf.Clamp01(volume) * effectsVolume);
        }

        private void ApplyMix()
        {
            if (source != null)
            {
                source.mute = !enabled || !effectsEnabled;
                source.volume = .42f;
            }
            if (musicSource != null)
            {
                musicSource.mute = !enabled || !musicEnabled;
                if (!musicSource.mute) musicSource.volume = .13f * musicVolume;
            }
        }

        private static AudioClip CreateMusicLoop()
        {
            const int sampleRate = 44100;
            const float bpm = 118f;
            float stepDuration = 60f / bpm / 2f;
            const int steps = 64;
            float duration = stepDuration * steps;
            int count = Mathf.RoundToInt(duration * sampleRate);
            var data = new float[count];
            float[] bass = { 55f, 55f, 65.41f, 55f, 73.42f, 65.41f, 49f, 55f, 55f, 82.41f, 73.42f, 65.41f, 49f, 55f, 65.41f, 73.42f };
            float[] melody =
            {
                440f, 493.88f, 523.25f, 659.25f, 587.33f, 523.25f, 493.88f, 392f,
                440f, 523.25f, 659.25f, 783.99f, 739.99f, 659.25f, 587.33f, 523.25f,
                392f, 440f, 493.88f, 587.33f, 659.25f, 587.33f, 523.25f, 493.88f,
                440f, 493.88f, 523.25f, 659.25f, 880f, 783.99f, 659.25f, 587.33f,
            };
            float[] counter = { 220f, 246.94f, 261.63f, 329.63f, 293.66f, 261.63f, 246.94f, 196f };
            float[][] chords =
            {
                new[] { 110f, 164.81f, 220f },
                new[] { 98f, 146.83f, 196f },
                new[] { 130.81f, 196f, 261.63f },
                new[] { 82.41f, 123.47f, 164.81f },
            };
            for (int i = 0; i < count; i++)
            {
                float time = i / (float)sampleRate;
                int step = Mathf.FloorToInt(time / stepDuration);
                float local = (time - step * stepDuration) / stepDuration;
                float bassEnvelope = Mathf.Sin(Mathf.PI * Mathf.Clamp01(local)) * Mathf.Pow(1f - Mathf.Clamp01(local), .25f);
                float bassWave = Mathf.Sin(Mathf.PI * 2f * bass[step % bass.Length] * time) * bassEnvelope * .32f;
                float lead = 0f;
                if ((step & 1) == 0 || step % 4 == 3)
                {
                    int phrase = (step / 32) % 4;
                    float note = melody[(step + phrase * 5) % melody.Length] * (phrase == 3 && step % 32 > 20 ? 1.5f : 1f);
                    float envelope = Mathf.Sin(Mathf.PI * Mathf.Clamp01(local)) * (1f - Mathf.Clamp01(local));
                    lead = (Mathf.Sin(Mathf.PI * 2f * note * time) + Mathf.Sin(Mathf.PI * 2f * note * 2f * time) * .35f) * envelope * .18f;
                }
                float counterVoice = 0f;
                if (step % 8 == 6)
                {
                    float envelope = Mathf.Sin(Mathf.PI * Mathf.Clamp01(local)) * .9f;
                    counterVoice = Mathf.Sin(Mathf.PI * 2f * counter[(step / 2) % counter.Length] * time) * envelope * .08f;
                }
                float pad = 0f;
                if (step % 8 < 7)
                {
                    float[] chord = chords[(step / 8) % chords.Length];
                    for (int c = 0; c < chord.Length; c++)
                        pad += Mathf.Sin(Mathf.PI * 2f * chord[c] * time) * .026f;
                }
                float percussion = 0f;
                if (step % 8 == 0 || step % 8 == 4)
                {
                    float kick = Mathf.Sin(Mathf.PI * 2f * Mathf.Lerp(92f, 42f, Mathf.Clamp01(local)) * time);
                    percussion += kick * Mathf.Pow(1f - Mathf.Clamp01(local), 3.2f) * .22f;
                }
                if ((step & 1) == 1)
                {
                    float click = Mathf.Sin(Mathf.PI * 2f * 7800f * time);
                    percussion += click * Mathf.Pow(1f - Mathf.Clamp01(local), 5f) * .035f;
                }
                float edgeFade = Mathf.Min(1f, Mathf.Min(time, duration - time) / .07f);
                data[i] = Mathf.Clamp((bassWave + lead + counterVoice + pad + percussion) * edgeFade, -.82f, .82f);
            }
            var clip = AudioClip.Create("Prism Protocol Original Melody", count, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private static AudioClip CreateTone(string name, float frequency, float duration, float amplitude, float sweep)
        {
            const int sampleRate = 44100;
            int count = Mathf.Max(1, Mathf.RoundToInt(duration * sampleRate));
            var data = new float[count];
            float phase = 0f;
            for (int i = 0; i < count; i++)
            {
                float t = i / (float)count;
                phase += Mathf.PI * 2f * frequency * Mathf.Lerp(1f, sweep, t) / sampleRate;
                float envelope = Mathf.Sin(Mathf.PI * t) * Mathf.Pow(1f - t, .35f);
                data[i] = Mathf.Sin(phase) * envelope * amplitude;
            }
            var clip = AudioClip.Create(name, count, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private static AudioClip CreateChord(string name, float[] frequencies, float duration, float amplitude)
        {
            const int sampleRate = 44100;
            int count = Mathf.Max(1, Mathf.RoundToInt(duration * sampleRate));
            var data = new float[count];
            for (int i = 0; i < count; i++)
            {
                float time = i / (float)sampleRate;
                float t = i / (float)count;
                float signal = 0f;
                for (int f = 0; f < frequencies.Length; f++) signal += Mathf.Sin(Mathf.PI * 2f * frequencies[f] * time);
                float envelope = Mathf.Sin(Mathf.PI * t) * (1f - t);
                data[i] = signal / Mathf.Max(1, frequencies.Length) * envelope * amplitude;
            }
            var clip = AudioClip.Create(name, count, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
