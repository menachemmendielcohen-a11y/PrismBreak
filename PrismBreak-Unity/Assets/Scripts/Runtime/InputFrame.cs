using System;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Presentation-independent input consumed by <see cref="GameSession"/>.
    /// PointerWorld is expressed in the 1280 x 720 arena coordinate system.
    /// Button fields are rising-edge signals; Move is a continuous fallback for
    /// touch sticks, keyboard and accessibility controllers.
    /// </summary>
    [Serializable]
    public struct InputFrame
    {
        public Vector2 PointerWorld;
        public bool HasPointer;
        public Vector2 Move;
        public bool DashPressed;
        public bool NovaPressed;
        public bool SmashPressed;
        public bool LancePressed;
        public bool RefractPressed;
        public bool PausePressed;

        public static InputFrame Pointer(Vector2 arenaPosition)
        {
            return new InputFrame { PointerWorld = arenaPosition, HasPointer = true };
        }

        internal void MergeButtons(InputFrame newer)
        {
            PointerWorld = newer.PointerWorld;
            HasPointer = newer.HasPointer;
            Move = newer.Move;
            DashPressed |= newer.DashPressed;
            NovaPressed |= newer.NovaPressed;
            SmashPressed |= newer.SmashPressed;
            LancePressed |= newer.LancePressed;
            RefractPressed |= newer.RefractPressed;
            PausePressed |= newer.PausePressed;
        }

        internal void ConsumeButtons()
        {
            DashPressed = false;
            NovaPressed = false;
            SmashPressed = false;
            LancePressed = false;
            RefractPressed = false;
            PausePressed = false;
        }
    }

    public enum SessionPhase
    {
        Running,
        Paused,
        UpgradeChoice,
        NovaConfirm,
        Victory,
        Defeat
    }

    /// <summary>
    /// Save/progression code can translate its persistent profile into this
    /// lightweight object without making the deterministic simulation depend on
    /// PlayerPrefs, JSON, UI or a backend.
    /// </summary>
    [Serializable]
    public sealed class SessionLoadout
    {
        public int StartingHealthBonus;
        public int SelectedShip;
        public bool ReducedMotion;
        public UpgradeId[] StartingUpgrades = Array.Empty<UpgradeId>();
        public PersistentPowerId[] UnlockedPowers = Array.Empty<PersistentPowerId>();
        public WorldUpgradeId[] WorldUpgrades = Array.Empty<WorldUpgradeId>();
    }
}
