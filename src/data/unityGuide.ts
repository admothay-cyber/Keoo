export interface GuideStep {
  id: string;
  stepNumber: number;
  title: string;
  summary: string;
  icon: string;
  details: {
    heading: string;
    description: string;
    codeSnippet?: string;
    bulletPoints?: string[];
    table?: {
      headers: string[];
      rows: string[][];
    };
  }[];
}

export const UNITY_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'step-tags-layers',
    stepNumber: 1,
    title: 'Layers, Tags & 2D Physics Collision Matrix',
    summary: 'Configure Unity Tags, Layers, and the 2D Collision Matrix so attacks and collisions behave cleanly without friendly fire.',
    icon: 'Layers',
    details: [
      {
        heading: '1. Create Tags & Layers',
        description: 'Open Unity and go to Edit > Project Settings > Tags and Layers. Add the following:',
        bulletPoints: [
          'Tags to add: Player, Enemy, Obstacle, Interactable, Pickup',
          'User Layers to add: Layer 6: Player, Layer 7: Enemy, Layer 8: PlayerAttack, Layer 9: EnemyAttack, Layer 10: Pickup, Layer 11: Interactable',
        ],
      },
      {
        heading: '2. Physics 2D Collision Matrix Configuration',
        description: 'Navigate to Edit > Project Settings > Physics 2D. Scroll down to the Layer Collision Matrix. Uncheck unwanted collisions so projectiles only collide with appropriate targets:',
        table: {
          headers: ['Layer Name', 'Collides With', 'Ignored By (Unchecked)'],
          rows: [
            ['Player', 'Enemy, Obstacle, Pickup, Interactable', 'PlayerAttack'],
            ['Enemy', 'Player, PlayerAttack, Obstacle', 'EnemyAttack, Pickup'],
            ['PlayerAttack', 'Enemy, Obstacle', 'Player, PlayerAttack, Pickup'],
            ['EnemyAttack', 'Player, Obstacle', 'Enemy, EnemyAttack, Pickup'],
            ['Pickup', 'Player', 'Enemy, PlayerAttack, EnemyAttack, Pickup'],
          ],
        },
      },
    ],
  },

  {
    id: 'step-player-prefab',
    stepNumber: 2,
    title: 'Building the Player Prefab with Primitives',
    summary: 'Construct the Player GameObject, Rigidbody2D, CircleCollider2D, and nested Floating Weapon Pivot.',
    icon: 'User',
    details: [
      {
        heading: '1. Create the Player Base GameObject',
        description: 'In your Hierarchy, right-click and choose 2D Object > Sprites > Circle. Rename it to "Player".',
        bulletPoints: [
          'Set Tag to "Player" and Layer to "Player".',
          'Sprite Renderer: Sprite = Circle, Color = White (will be tinted by ScriptableObject).',
          'Add Component > Rigidbody 2D: Body Type = Dynamic, Gravity Scale = 0, Collision Detection = Continuous, Constraints = Freeze Rotation Z.',
          'Add Component > Circle Collider 2D: Radius = 0.45, Is Trigger = False.',
          'Add Component > PlayerController.cs and SkillSystem.cs.',
        ],
      },
      {
        heading: '2. Add the Floating Weapon Pivot (Nested Child)',
        description: 'Right-click on the Player GameObject in Hierarchy > Create Empty. Rename it to "WeaponPivot".',
        bulletPoints: [
          'Ensure WeaponPivot Transform Position is (0, 0, 0).',
          'Add Component > WeaponPivot.cs on this object.',
          'Right-click WeaponPivot > 2D Object > Sprites > Square. Rename it to "WeaponVisual".',
          'Set WeaponVisual Transform: Position = (0.6, 0, 0), Scale = (0.7, 0.18, 1).',
          'Drag WeaponVisual into the "Weapon Visual Transform" slot on the WeaponPivot script.',
        ],
      },
      {
        heading: '3. Save as Prefab',
        description: 'Drag the Player object from the Hierarchy into Assets/Prefabs/ to create the Player.prefab.',
      },
    ],
  },

  {
    id: 'step-combat-prefabs',
    stepNumber: 3,
    title: 'Constructing Attack & Projectile Prefabs',
    summary: 'Assemble Melee Slash Hitbox, Bow Arrow / Marksman Bullet, and Mage Fireball prefabs using default circles and squares.',
    icon: 'Crosshair',
    details: [
      {
        heading: '1. Melee Slash Prefab (For Fighter & Tank)',
        description: 'Create a 2D Object > Sprites > Square named "MeleeSlashPrefab":',
        bulletPoints: [
          'Layer: PlayerAttack.',
          'Transform Scale: (1.2, 0.5, 1). Sprite Color: Semi-transparent White/Red (#FF6666AA).',
          'Add Component > Box Collider 2D: Is Trigger = TRUE, Size = (1.2, 0.5).',
          'Add Component > DamageHitbox.cs: Lifetime = 0.15s.',
          'Drag into Assets/Prefabs/ to save as prefab, then delete from scene.',
        ],
      },
      {
        heading: '2. Marksman Arrow / Bullet Prefab',
        description: 'Create a 2D Object > Sprites > Circle named "ArrowPrefab":',
        bulletPoints: [
          'Layer: PlayerAttack.',
          'Transform Scale: (0.4, 0.15, 1). Sprite Color: Bright Emerald (#10B981).',
          'Add Component > Circle Collider 2D: Is Trigger = TRUE, Radius = 0.2.',
          'Add Component > Projectile.cs: Max Lifetime = 2.5s.',
          'Save into Assets/Prefabs/.',
        ],
      },
      {
        heading: '3. Mage Pyroclasm Fireball Prefab',
        description: 'Create a 2D Object > Sprites > Circle named "FireballPrefab":',
        bulletPoints: [
          'Layer: PlayerAttack.',
          'Transform Scale: (0.7, 0.7, 1). Sprite Color: Fiery Orange (#F97316).',
          'Add Component > Circle Collider 2D: Is Trigger = TRUE, Radius = 0.35.',
          'Add Component > Projectile.cs: Check Is Area Of Effect = TRUE, AOE Radius = 2.2.',
          'Save into Assets/Prefabs/.',
        ],
      },
    ],
  },

  {
    id: 'step-enemy-spawner',
    stepNumber: 4,
    title: 'Enemy Prefab & Dungeon Wave Spawner',
    summary: 'Build the Enemy Circle prefab with knockback, hurt flash, and the automated Wave Spawner.',
    icon: 'Skull',
    details: [
      {
        heading: '1. Enemy Prefab Assembly',
        description: 'Create a 2D Object > Sprites > Circle named "EnemyPrefab":',
        bulletPoints: [
          'Tag = "Enemy", Layer = "Enemy".',
          'Transform Scale = (0.9, 0.9, 1). Sprite Color = Crimson Red (#EF4444).',
          'Add Component > Rigidbody 2D: Body Type = Dynamic, Gravity Scale = 0, Collision Detection = Continuous, Freeze Rotation Z = TRUE.',
          'Add Component > Circle Collider 2D: Radius = 0.45, Is Trigger = FALSE.',
          'Add Component > EnemyAI.cs: Max Health = 50, Move Speed = 3.2, Contact Damage = 10, Gold Drop Amount = 15.',
          'Assign the GoldGemPrefab (built in Step 5) into the "Gold Gem Prefab" field.',
          'Save as Enemy.prefab in Assets/Prefabs/.',
        ],
      },
      {
        heading: '2. Dungeon Wave Spawner Setup',
        description: 'In your Scene, create an Empty GameObject named "DungeonWaveSpawner":',
        bulletPoints: [
          'Add Component > WaveSpawner.cs.',
          'In the Inspector, expand "Enemy Prefabs" array (Size = 1 or more) and drag in your Enemy.prefab.',
          'Set Spawn Radius = 12, Time Between Waves = 4s.',
        ],
      },
    ],
  },

  {
    id: 'step-town-economy',
    stepNumber: 5,
    title: 'Gold Gem, Quest NPC & Town Shop',
    summary: 'Assemble the magnet Gold Gem, Quest Board ("Kill 10 Monsters"), and Shop NPC (+Damage, Potions).',
    icon: 'Coins',
    details: [
      {
        heading: '1. Gold Gem Pickup Prefab',
        description: 'Create a 2D Object > Sprites > Square named "GoldGemPrefab":',
        bulletPoints: [
          'Transform: Scale = (0.25, 0.25, 1), Rotation Z = 45° (forms a crisp diamond shape!).',
          'Sprite Renderer: Color = Bright Gold (#FBBF24).',
          'Tag = "Pickup", Layer = "Pickup".',
          'Add Component > Circle Collider 2D: Is Trigger = TRUE, Radius = 0.3.',
          'Add Component > GoldGemPickup.cs: Gold Value = 15, Magnet Radius = 3.5, Fly Speed = 9.',
          'Save to Assets/Prefabs/.',
        ],
      },
      {
        heading: '2. Quest NPC / Board ("Kill 10 Monsters")',
        description: 'Create an Empty GameObject or Sprite (Square colored Blue) named "QuestNPC":',
        bulletPoints: [
          'Add Circle Collider 2D: Is Trigger = TRUE, Radius = 1.8 (interaction trigger zone).',
          'Add Component > QuestNPC.cs.',
          'Create a single global manager in the scene with QuestManager.cs attached.',
        ],
      },
      {
        heading: '3. Shop NPC (Blacksmith & Potion Alchemist)',
        description: 'Create a 2D Object > Sprites > Square (colored Amber) named "ShopNPC":',
        bulletPoints: [
          'Add Circle Collider 2D: Is Trigger = TRUE, Radius = 1.8.',
          'Add Component > ShopNPC.cs: Weapon Upgrade Cost = 50, Damage Increase = 6, Potion Cost = 25.',
          'Hook up UI Canvas buttons for Buy Weapon Upgrade and Buy Potion to call ShopNPC.BuyWeaponUpgrade() and BuyHealthPotion().',
        ],
      },
    ],
  },

  {
    id: 'step-scriptable-objects',
    stepNumber: 6,
    title: 'Creating the 5 Class Presets (ScriptableObjects)',
    summary: 'Generate the 5 ScriptableObject assets with their recommended production balance values.',
    icon: 'Sparkles',
    details: [
      {
        heading: 'How to Create ScriptableObjects in Unity',
        description: 'Right-click inside your Project window in Assets/Data/ > Create > ARPG > Class Preset. Create 5 assets with the following exact values:',
        table: {
          headers: ['Class', 'Max HP', 'Speed', 'Base ATK', 'Crit % / Multi', 'Attack Type', 'Skill 1 & 2'],
          rows: [
            ['Fighter', '180', '6.0', '32', '15% / 2.0x', 'MeleeSlash', 'Whirlwind (CD: 4s) | Battle Cry (CD: 9s)'],
            ['Tank', '280', '5.0', '24', '5% / 1.75x', 'MeleeHeavyStab', 'Holy Aegis (CD: 7s) | Taunting Quake (CD: 6s)'],
            ['Assassin', '110', '7.8', '26', '40% / 2.75x', 'MeleeSlash', 'Shadow Dash (CD: 3.2s) | Blade Spiral (CD: 6.5s)'],
            ['Marksman', '125', '6.5', '28', '25% / 2.2x', 'RangedProjectile', 'Arrow Fan (CD: 3.5s) | Rain of Arrows (CD: 7s)'],
            ['Mage', '115', '6.2', '38', '20% / 2.1x', 'MagicAoe', 'Pyroclasm Fireball (CD: 4.5s) | Frost Nova (CD: 6.5s)'],
          ],
        },
      },
      {
        heading: 'Assigning to Player',
        description: 'On your Player prefab in the inspector, drag your chosen Class Preset (e.g. Fighter.asset) into the "Current Class Data" slot on the PlayerController component.',
      },
    ],
  },

  {
    id: 'step-mobile-controls',
    stepNumber: 7,
    title: 'Mobile Controls: Virtual Joystick, Action Pad & Landscape Fullscreen',
    summary: 'Configure Unity for Landscape Fullscreen, hide OS bars, set up the Virtual Joystick at bottom-left, and the Touch Action Cluster at bottom-right.',
    icon: 'Smartphone',
    details: [
      {
        heading: '1. Landscape Fullscreen & OS Bar Setup (Project Settings)',
        description: 'Configure Player Settings so the mobile game runs strictly in horizontal orientation and hides system bars:',
        bulletPoints: [
          'Go to Edit > Project Settings > Player > Resolution and Presentation.',
          'Orientation: Set Default Orientation = Landscape Left.',
          'Allowed Orientations: Check Landscape Left = True, Landscape Right = True, Portrait = False.',
          'Android: Check "Start in fullscreen mode" (Immersive Mode), "Hide Navigation Bar", and "Disable depth and stencil".',
          'Attach MobileScreenConfig.cs to your Bootstrapper / GameManager GameObject to ensure Screen.orientation and Screen.fullScreen are enforced at runtime.',
        ],
      },
      {
        heading: '2. Canvas Scaler for Responsive Mobile Resolution',
        description: 'Ensure your UI Canvas scales uniformly across all mobile phone aspect ratios (16:9, 19.5:9, 20:9):',
        bulletPoints: [
          'Select Canvas in Hierarchy.',
          'Canvas Scaler Component: Set UI Scale Mode = "Scale With Screen Size".',
          'Reference Resolution = 1920 x 1080.',
          'Screen Match Mode = Match Width Or Height, with Value = 0.5 (balanced).',
        ],
      },
      {
        heading: '3. Virtual Joystick Setup (Bottom-Left Corner)',
        description: 'Create the 8-directional virtual thumbstick on your Canvas:',
        bulletPoints: [
          'Right-click Canvas > Create Empty. Rename to "VirtualJoystickZone". Set Anchor: Bottom-Left (X:0, Y:0), Pivot: (0,0), Pos: (80, 80).',
          'Add Child Image "JoystickBackground": Sprite = Circle, Color = Semi-transparent Grey/Black (#00000066), Width/Height = 180 x 180.',
          'Add Child Image "JoystickHandle": Sprite = Circle, Color = White (#FFFFFFCC), Width/Height = 75 x 75.',
          'Attach VirtualJoystick.cs to JoystickBackground. Drag JoystickBackground into "Joystick Background" slot, and JoystickHandle into "Joystick Handle" slot. Handle Range = 75.',
        ],
      },
      {
        heading: '4. Touch Action Cluster Setup (Bottom-Right Corner)',
        description: 'Assemble the attack and skill buttons cluster on your Canvas:',
        bulletPoints: [
          'Create Empty GameObject under Canvas named "ActionCluster". Set Anchor: Bottom-Right (X:1, Y:0), Pivot: (1,0), Pos: (-80, 80).',
          'Main Attack Button: Circle Sprite, Width/Height = 110 x 110. Attach TouchActionButton.cs (Button Type = BasicAttack).',
          'Skill 1 Button: Circle Sprite, Width/Height = 75 x 75, positioned at (-110, 85) relative to main button. Attach TouchActionButton.cs (Button Type = Skill1). Add child Image for Cooldown Radial Mask (Image Type = Filled, Radial 360).',
          'Skill 2 Button: Circle Sprite, Width/Height = 75 x 75, positioned at (-45, 140) relative to main button. Attach TouchActionButton.cs (Button Type = Skill2). Add child Image for Cooldown Radial Mask.',
          'Potion Button: Circle Sprite, Width/Height = 60 x 60, positioned at (-140, 15). Attach TouchActionButton.cs (Button Type = HealthPotion).',
        ],
      },
    ],
  },
];
