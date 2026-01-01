const CONSTS = {
    GAME_BORDER_COLOR: '#808080',
    WALL_COLOR: '#808080',
    BG_COLOR: '#080808',
  UNAVAILABLE_PLACEMENT_COLOR: '#333333',
    EXIT_FLASH_COLOR: '#f2ff00ff',
  EXIT_FLASH_DURATION: 300, // ms
  EXIT_ALARM_SOUND: "vector_assets/audio/greece-eas-alarm-451404.wav",
    EXIT_ALARM_VOLUME: 0.6,
    IMPACT_PARTICLE_MULTIPLIER: 10.0,
  TOWER_SALE_PCT: 0.5,
    TOWER_PLACEMENT_RANGE_DISC_TRANSPARENCY: 0.2,
  SHIPS_PER_GROUP: 10,
  SHIP_SPAWN_GAP_MS: 1000,
  GROUP_SPAWN_GAP_MS: 3000,
  START_MONEY: 100,
  START_LIVES: 10,
  DIFFICULTY_INCREASE_FACTOR: 1.2,
  VALUE_INCREASE_FACTOR: 1.1,
  INITIAL_MUSIC_STATE: "off",
  MUSIC_VOLUME: 0.5,
  SFX_VOLUME: 0.6,
  RANDOM_FIRST_SONG: true,
  SONGS: [
    "vector_assets/audio/ApocalypseDemoRun_2.mp3",
    "vector_assets/audio/GeometricLinesofDefense_1.mp3",
    "vector_assets/audio/MidnightVectorSiege_1.mp3",
    "vector_assets/audio/BossRoomBloodrush.mp3",
    "vector_assets/audio/MidnightSoftCurrents.mp3",
    "vector_assets/audio/TerminalLockdown.mp3",
    "vector_assets/audio/GeometricLinesofDefense_2.mp3",
    "vector_assets/audio/MidnightVectorSiege_2.mp3",
    "vector_assets/audio/NightfallGroove.mp3",
    "vector_assets/audio/VectorRamparts.mp3",
    "vector_assets/audio/VectorGridDefensive.mp3",
    "vector_assets/audio/VectorLinesLaserMines.mp3"
  ],
  SFX_VOL_DOWN_AMOUNT: 0.1,
  SFX_VOL_UP_AMOUNT: 0.1,
  MUSIC_VOL_DOWN_AMOUNT: 0.1,
  MUSIC_VOL_UP_AMOUNT: 0.1
};

const SHAPES = {
    // Defined as normalized points (x,y) assuming scale 1
    // Pointing RIGHT (East) as base rotation 0
    triangle: [
        {x: 10, y: 0},
        {x: -6, y: 7},
        {x: -6, y: -7}
    ],
    dart: [
        {x: 10, y: 0},
        {x: -10, y: 5},
        {x: -5, y: 0},
        {x: -10, y: -5}
    ],
    trapezoid: [
        {x: -8, y: 8},  // Top Back
        {x: 8, y: 4},   // Top Front
        {x: 8, y: -4},  // Bottom Front
        {x: -8, y: -8}  // Bottom Back
  ],
    loader_tower: [
      { x: -10, y: -10 },
      { x: -6, y: -10 },
      { x: -6, y: -3 },
      { x: -3, y: -3 },
      { x: -3, y: -10 },
      { x: 3, y: -10 },
      { x: 3, y: -3 },
      { x: 6, y: -3 },
      { x: 6, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: 6, y: 10 },
      { x: 6, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 10 },
      { x: -3, y: 10 },
      { x: -3, y: 3 },
      { x: -6, y: 3 },
      { x: -6, y: 10 },
      { x: -10, y: 10 },
      // { x: -10, y: -10 },

  ],
    square: [
      {x: 10, y: 10},
      {x: -10, y: 10},
      {x: -10, y: -10},
      {x: 10, y: -10}
  ],
    laser_tower: [
      { x: -10, y: -8 },
      { x: -8, y: -8 },
      { x: -8, y: -2 },
      { x: -6, y: -2},
      { x: -6, y: -8 },
      { x: -4, y: -8},
      { x: -4, y: -2},
      { x: 5, y: -2},
      { x: 5, y: 2},
      { x: -4, y: 2 },
      { x: -4, y: 8},
      { x: -6, y: 8 },
      { x: -6, y: 2 },
      { x: -8, y: 2 },
      { x: -8, y: 8 },
      { x: -10, y: 8 },

  ],
    pentagon: [
        {x: 10, y: 0},
        {x: 3.09, y: 9.51},
        {x: -8.09, y: 5.88},
        {x: -8.09, y: -5.88},
        {x: 3.09, y: -9.51}
  ],
    missile_tower: [
      { x: 5, y: 6 },
      { x: 5, y: 8 },
      { x: -5, y: 8 },
      { x: -5, y: -8 },
      { x: 5, y: -8 },
      { x: 5, y: -6 },
      { x: -3, y: -6 },
      { x: -3, y: 6 },
    ],
    hexagon: [
        {x: 10, y: 0},
        {x: 5, y: 8.66},
        {x: -5, y: 8.66},
        {x: -10, y: 0},
        {x: -5, y: -8.66},
        {x: 5, y: -8.66}
  ],
  railgun_tower: [
    { x: -7, y: -7 },
    { x: 0, y: -7 },
    { x: 2, y: -2 },
    { x: 8, y: -2 },
    { x: 8, y: 2 },
    { x: 2, y: 2 },
    { x: 0, y: 7 },
    { x: -7, y: 7 },
    { x: -7, y: -7 }
  ],
    artillery_tower: [
        {x: -10, y: -6},
        {x: -6, y: -6},
        {x: -6, y: -2},
        {x: 10, y: -2},
        {x: 10, y: 2},
        {x: -6, y: 2},
        {x: -6, y: 6},
        {x: -10, y: 6}
    ],
    emp_tower: [
        // 8-point starish shape
        {x: 10, y: 0}, {x: 3, y: 3},
        {x: 0, y: 10}, {x: -3, y: 3},
        {x: -10, y: 0}, {x: -3, y: -3},
        {x: 0, y: -10}, {x: 3, y: -3}
    ],
    nanite_tower: [
        {x: 6, y: 0}, // Nozzle
        {x: 2, y: 4},
        {x: -6, y: 4}, // Body Top
        {x: -8, y: 0}, // Back
        {x: -6, y: -4}, // Body Bottom
        {x: 2, y: -4}
    ]
};

const TARGETING_MODES = {
    nearest: 'nearest',
    weakest: 'weakest',
    strongest: 'strongest',
    fixed: 'fixed'
};

const TOWER_DAMAGE_TYPES = {
    LASER: 'laser',
    EXPLOSIVE: 'explosive',
    ELECTROMAGNETIC: 'electromagnetic',
    HIGH_ENERGY: 'high_energy',
    NANITE: 'nanite'
};

const TOWER_TYPES = {
    LASER: 'laser',
    MISSILE: 'missile',
    EMP: 'emp',
    ARTILLERY: 'artillery',
    RAILGUN: 'railgun',
    NANITE: 'nanite',
    LOADER: 'loader'
};

const TOWERS = {
    [TOWER_TYPES.RAILGUN]: {
        name: "Railgun",
        type: TOWER_TYPES.RAILGUN,
        damage_type: TOWER_DAMAGE_TYPES.HIGH_ENERGY,
        shape: "railgun_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/sci-fi-launch-3-351238.wav",
        fire_sound_volume: 0.7,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 100,
        range: 250, // Detection range
        cooldown: 3000,
        damage: 100,
        retarget_rotation_rate: 0.0, // Fixed direction
        firing_angle_threshold: 0.1,
    outlets: [{ x: 0, y: 0, delay: 0 }],
        effect_description: "High energy projectile that pierces all targets in its path.  Choose the firing direction before or after placing tower.",
        color: '#FFFF00'
    },
    [TOWER_TYPES.ARTILLERY]: { // was purple
        name: "Artillery Turret", // Typo fixed
        type: TOWER_TYPES.ARTILLERY,
        damage_type: TOWER_DAMAGE_TYPES.EXPLOSIVE,
        shape: "artillery_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/powerful-cannon-shot-352459.wav",
        fire_sound_volume: 0.7,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 40,
        range: 150,
        cooldown: 1500,
        damage: 150,
        retarget_rotation_rate: 5.0,
      firing_angle_threshold: 0.1, // Radians (~5.7 degrees)
        effect: { type: 'slow', factor: 0.5, duration: 250 },
        outlets: [{ x: 0, y: 0, delay: 0 }],
      projectile: { speed: 10, color: '#aa00ff' },
        effect_description: "Explosive shell that deals damage and creates a shockwave, briefly slowing the enemy.",
        color: '#aa00ff'
    },
    [TOWER_TYPES.LASER]: { // was green
        name: "Laser Turret",
        type: TOWER_TYPES.LASER,
        damage_type: TOWER_DAMAGE_TYPES.LASER,
        shape: "laser_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/steam-hissing-2-386162.wav",
        fire_sound_volume: 1.0,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 10,
        range: 100,
        cooldown: 0,
        damage: 80,
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
        outlets: [{x:0, y:0, delay:0}],
        shot_duration_ms: 1000,
      firing_pause_ms: 500,
        effect_description: "Directed energy beam that heats and damages the enemy.",
        color: '#00ff66'
    },
    [TOWER_TYPES.MISSILE]: { // was red
        name: "Missile Launcher",
        type: TOWER_TYPES.MISSILE,
        damage_type: TOWER_DAMAGE_TYPES.EXPLOSIVE,
        shape: "missile_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/missile-blast-2-95177.wav",
        fire_sound_volume: 0.8,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 20,
        range: 150,
        cooldown: 1500,
        damage: 50,
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
        outlets: [{x:-5, y:0, delay:0}, {x:5, y:0, delay:150}], // Staggered
        projectile: { speed: 6, color: '#ff3333' },
        color: '#ff3333'
    },
    [TOWER_TYPES.EMP]: { // was blue
        name: "Pulse Disruptor",
        type: TOWER_TYPES.EMP,
        damage_type: TOWER_DAMAGE_TYPES.ELECTROMAGNETIC,
        shape: "emp_tower",
        targeting_mode: TARGETING_MODES.fixed, // irrelevant for pulse
        fire_sound: "vector_assets/audio/electronic-pulse-8bit-293075.wav",
        fire_sound_volume: 0.5,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 30,
        range: 100,
        cooldown: 2000,
        damage: 10,
        effect: { type: 'slow', factor: 0.5, duration: 1000 },
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
      outlets: [{ x: 0, y: 0, delay: 0 }],
        effect_description: "Slows the enemy briefly.",
        color: '#33ccff'
    },
    [TOWER_TYPES.NANITE]: {
        name: "Nanite Sprayer",
        type: TOWER_TYPES.NANITE,
        damage_type: TOWER_DAMAGE_TYPES.NANITE,
        shape: "nanite_tower",
        targeting_mode: TARGETING_MODES.fixed,
        // fire_sound: "vector_assets/audio/air-release-47977.wav",
        fire_sound: "vector_assets/audio/breath-264957.wav",
        /*
          air-release-47977.wav
          breath-264957.wav
          compressed-air-429816.wav
          quick-bursts-of-air-429815.wav
          the-aerosol-spray-117048.wav
        */
        fire_sound_volume: 0.8,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 60,
        range: 80, // Short range
      cooldown: 2000, // Recharge time
        spray_duration: 500, // particles ejecting continuously for this duration in ms
        damage: 1, // Low impact damage per particle
        retarget_rotation_rate: 0.0,
        firing_angle_threshold: 0.5, // Wider angle allow
        nanite_settings: {
             spray_count: 30,
             particle_travel_distance: 100,
             arc_width_deg: 60,
             effect_duration_ms: 8000,
             effect_tick_rate_ms: 1000,
             dot_damage: 5,
             resistance_penalty: 0.2 // +0.3 to vulnerability
      },
        effect_description: "Nanites that attach to the enemy, reduce resistances, and deal damage over time.   Choose the firing direction before or after placing tower.",
        color: '#00ffcc'
    },
    [TOWER_TYPES.LOADER]: {
        name: "Ammo Loader",
        type: TOWER_TYPES.LOADER,
        shape: "loader_tower",
        price: 50,
        range: 0, // Passive
        cooldown: 0,
        damage: 0,
        cooldown_reduction_factor: 0.2, // 20% reduction
        effect_description: "Support tower. Reduces cooldown of adjacent projectile towers by 20%.",
        color: '#b0c4de' // Light Steel Blue
    }
};



const ENEMIES = [
    {
        id: "green",
        name: "Scout",
        hp: 110,
        speed: 100,
        value: 2,
        explode_sound: "vector_assets/audio/explosion-322491.wav",
        explode_sound_volume: 1.0,
        color: '#00ff66',
        shape: 'triangle',
        draw_scale: 0.8,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 1.0,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 1.0,
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    },
    {
        id: "orange",
        name: "Runner",
        hp: 60,
        speed: 200,
        value: 3,
        explode_sound: "vector_assets/audio/grenade-explosion-14-190266.wav",
        explode_sound_volume: 1.0,
        color: '#ffaa00',
        shape: 'dart',
        draw_scale: 0.8,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 1.0,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 0.8, // Slightly resistant to explosions?
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    },
    {
        id: "purple",
        name: "Tank",
        hp: 320,
        speed: 50,
      value: 3,
                explode_sound: "vector_assets/audio/musket-explosion-6383.wav",
        explode_sound_volume: 1.0,

        color: '#aa00ff',
      shape: 'trapezoid',
        draw_scale: 1.0,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 0.8,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 0.2, // Very resistant to explosions
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    }
];

// Compatibility Shim for old GameConfig if not fully refactored yet,
// though we will refactor game.js immediately.
const Enemies = {}; // Deprecated
