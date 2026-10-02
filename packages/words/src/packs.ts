export type WordPack = {
  id: string;
  name: string;
  description: string;
  words: readonly string[];
};

/** The classic 400-word deck. */
const CLASSIC = [
  'AFRICA', 'AGENT', 'AIR', 'ALIEN', 'ALPS', 'AMAZON', 'AMBULANCE', 'AMERICA',
  'ANGEL', 'ANTARCTICA', 'APPLE', 'ARM', 'ATLANTIS', 'AUSTRALIA', 'AZTEC', 'BACK',
  'BALL', 'BAND', 'BANK', 'BAR', 'BARK', 'BAT', 'BATTERY', 'BEACH',
  'BEAR', 'BEAT', 'BED', 'BEIJING', 'BELL', 'BELT', 'BERLIN', 'BERMUDA',
  'BERRY', 'BILL', 'BLOCK', 'BOARD', 'BOLT', 'BOMB', 'BOND', 'BOOM',
  'BOOT', 'BOTTLE', 'BOW', 'BOX', 'BRIDGE', 'BRUSH', 'BUCK', 'BUFFALO',
  'BUG', 'BUGLE', 'BUTTON', 'CALF', 'CANADA', 'CAP', 'CAPITAL', 'CAR',
  'CARD', 'CARROT', 'CASINO', 'CAST', 'CAT', 'CELL', 'CENTAUR', 'CENTER',
  'CHAIR', 'CHANGE', 'CHARGE', 'CHECK', 'CHEST', 'CHICK', 'CHINA', 'CHOCOLATE',
  'CHURCH', 'CIRCLE', 'CLIFF', 'CLOAK', 'CLUB', 'CODE', 'COLD', 'COMIC',
  'COMPOUND', 'CONCERT', 'CONDUCTOR', 'CONTRACT', 'COOK', 'COPPER', 'COTTON', 'COURT',
  'COVER', 'CRANE', 'CRASH', 'CRICKET', 'CROSS', 'CROWN', 'CYCLE', 'CZECH',
  'DANCE', 'DATE', 'DAY', 'DEATH', 'DECK', 'DEGREE', 'DIAMOND', 'DICE',
  'DINOSAUR', 'DISEASE', 'DOCTOR', 'DOG', 'DRAFT', 'DRAGON', 'DRESS', 'DRILL',
  'DROP', 'DUCK', 'DWARF', 'EAGLE', 'EGYPT', 'EMBASSY', 'ENGINE', 'ENGLAND',
  'EUROPE', 'EYE', 'FACE', 'FAIR', 'FALL', 'FAN', 'FENCE', 'FIELD',
  'FIGHTER', 'FIGURE', 'FILE', 'FILM', 'FIRE', 'FISH', 'FLUTE', 'FLY',
  'FOOT', 'FORCE', 'FOREST', 'FORK', 'FRANCE', 'GAME', 'GAS', 'GENIUS',
  'GERMANY', 'GHOST', 'GIANT', 'GLASS', 'GLOVE', 'GOLD', 'GRACE', 'GRASS',
  'GREECE', 'GREEN', 'GROUND', 'HAM', 'HAND', 'HAWK', 'HEAD', 'HEART',
  'HELICOPTER', 'HIMALAYAS', 'HOLE', 'HOLLYWOOD', 'HONEY', 'HOOD', 'HOOK', 'HORN',
  'HORSE', 'HORSESHOE', 'HOSPITAL', 'HOTEL', 'ICE', 'ICE CREAM', 'INDIA', 'IRON',
  'IVORY', 'JACK', 'JAM', 'JET', 'JUPITER', 'KANGAROO', 'KETCHUP', 'KEY',
  'KID', 'KING', 'KIWI', 'KNIFE', 'KNIGHT', 'LAB', 'LAP', 'LASER',
  'LAWYER', 'LEAD', 'LEMON', 'LEPRECHAUN', 'LIFE', 'LIGHT', 'LIMOUSINE', 'LINE',
  'LINK', 'LION', 'LITTER', 'LOCH NESS', 'LOCK', 'LOG', 'LONDON', 'LUCK',
  'MAIL', 'MAMMOTH', 'MAPLE', 'MARBLE', 'MARCH', 'MASS', 'MATCH', 'MERCURY',
  'MEXICO', 'MICROSCOPE', 'MILLIONAIRE', 'MINE', 'MINT', 'MISSILE', 'MODEL', 'MOLE',
  'MOON', 'MOSCOW', 'MOUNT', 'MOUSE', 'MOUTH', 'MUG', 'NAIL', 'NEEDLE',
  'NET', 'NEW YORK', 'NIGHT', 'NINJA', 'NOTE', 'NOVEL', 'NURSE', 'NUT',
  'OCTOPUS', 'OIL', 'OLIVE', 'OLYMPUS', 'OPERA', 'ORANGE', 'ORGAN', 'PALM',
  'PAN', 'PANTS', 'PAPER', 'PARACHUTE', 'PARK', 'PART', 'PASS', 'PASTE',
  'PENGUIN', 'PHOENIX', 'PIANO', 'PIE', 'PILOT', 'PIN', 'PIPE', 'PIRATE',
  'PISTOL', 'PIT', 'PITCH', 'PLANE', 'PLASTIC', 'PLATE', 'PLATYPUS', 'PLAY',
  'PLOT', 'POINT', 'POISON', 'POLE', 'POLICE', 'POOL', 'PORT', 'POST',
  'POUND', 'PRESS', 'PRINCESS', 'PUMPKIN', 'PUPIL', 'PYRAMID', 'QUEEN', 'RABBIT',
  'RACKET', 'RAY', 'REVOLUTION', 'RING', 'ROBIN', 'ROBOT', 'ROCK', 'ROME',
  'ROOT', 'ROSE', 'ROULETTE', 'ROUND', 'ROW', 'RULER', 'SATELLITE', 'SATURN',
  'SCALE', 'SCHOOL', 'SCIENTIST', 'SCORPION', 'SCREEN', 'SCUBA DIVER', 'SEAL', 'SERVER',
  'SHADOW', 'SHAKESPEARE', 'SHARK', 'SHIP', 'SHOE', 'SHOP', 'SHOT', 'SINK',
  'SKYSCRAPER', 'SLIP', 'SLUG', 'SMUGGLER', 'SNOW', 'SNOWMAN', 'SOCK', 'SOLDIER',
  'SOUL', 'SOUND', 'SPACE', 'SPELL', 'SPIDER', 'SPIKE', 'SPINE', 'SPOT',
  'SPRING', 'SPY', 'SQUARE', 'STADIUM', 'STAFF', 'STAR', 'STATE', 'STICK',
  'STOCK', 'STRAW', 'STREAM', 'STRIKE', 'STRING', 'SUB', 'SUIT', 'SUPERHERO',
  'SWING', 'SWITCH', 'TABLE', 'TABLET', 'TAG', 'TAIL', 'TAP', 'TEACHER',
  'TELESCOPE', 'TEMPLE', 'THEATER', 'THIEF', 'THUMB', 'TICK', 'TIE', 'TIME',
  'TOKYO', 'TOOTH', 'TORCH', 'TOWER', 'TRACK', 'TRAIN', 'TRIANGLE', 'TRIP',
  'TRUNK', 'TUBE', 'TURKEY', 'UNDERTAKER', 'UNICORN', 'VACUUM', 'VAN', 'VET',
  'WAKE', 'WALL', 'WAR', 'WASHER', 'WASHINGTON', 'WATCH', 'WATER', 'WAVE',
  'WEB', 'WELL', 'WHALE', 'WHIP', 'WIND', 'WITCH', 'WORM', 'YARD',
] as const;

/** Harder, more abstract words — good once a group has played a lot. */
const ABSTRACT = [
  'ABSENCE', 'ACCIDENT', 'ADVANTAGE', 'ANGER', 'ANSWER', 'BALANCE', 'BEAUTY', 'BELIEF',
  'BLAME', 'BOREDOM', 'CHANCE', 'CHAOS', 'CHARM', 'COMFORT', 'COURAGE', 'CRISIS',
  'CULTURE', 'CURIOSITY', 'DANGER', 'DEBT', 'DEFEAT', 'DELAY', 'DEPTH', 'DESIRE',
  'DESTINY', 'DOUBT', 'DREAM', 'DUTY', 'ECHO', 'EFFORT', 'ENERGY', 'ENVY',
  'ERROR', 'ESCAPE', 'FAITH', 'FAME', 'FEAR', 'FREEDOM', 'FUTURE', 'GLORY',
  'GRAVITY', 'GREED', 'GRIEF', 'GUILT', 'HABIT', 'HARMONY', 'HOPE', 'HUNGER',
  'IDEA', 'IMPACT', 'INSTINCT', 'JUSTICE', 'KARMA', 'KNOWLEDGE', 'LEGEND', 'LIBERTY',
  'LIMIT', 'LOGIC', 'LOSS', 'LOYALTY', 'LUXURY', 'MAGIC', 'MEMORY', 'MERCY',
  'METHOD', 'MIRACLE', 'MOMENT', 'MOTION', 'MYSTERY', 'MYTH', 'NATURE', 'NONSENSE',
  'ORDER', 'ORIGIN', 'PANIC', 'PATIENCE', 'PEACE', 'PERIL', 'PITY', 'POWER',
  'PRIDE', 'PRIVACY', 'PROGRESS', 'PROMISE', 'PROOF', 'PURPOSE', 'QUALITY', 'REASON',
  'REGRET', 'RHYTHM', 'RISK', 'RUMOR', 'SECRET', 'SHAME', 'SILENCE', 'SKILL',
  'SORROW', 'STRESS', 'TALENT', 'THEORY', 'THREAT', 'TRADITION', 'TRUST', 'TRUTH',
  'VICTORY', 'VIRTUE', 'WISDOM', 'WONDER',
] as const;

/** Words that are fun to clue but rarely appear in the base deck. */
const MODERN = [
  'ALGORITHM', 'AVATAR', 'BANDWIDTH', 'BLOCKCHAIN', 'BLOG', 'BOOKMARK', 'BOT', 'BROWSER',
  'BUFFER', 'CACHE', 'CHARGER', 'CLOUD', 'CLICKBAIT', 'COOKIE', 'CRYPTO', 'CURSOR',
  'DASHBOARD', 'DATA', 'DEBUG', 'DESKTOP', 'DOWNLOAD', 'DRIVE', 'EMOJI', 'FEED',
  'FILTER', 'FIREWALL', 'FOLDER', 'FOLLOWER', 'FORUM', 'GADGET', 'GLITCH', 'HASHTAG',
  'HEADSET', 'INBOX', 'INFLUENCER', 'KERNEL', 'KEYBOARD', 'LAPTOP', 'LATENCY', 'MEME',
  'MOUSE PAD', 'NETWORK', 'NOTIFICATION', 'PASSWORD', 'PATCH', 'PHISHING', 'PIXEL', 'PLAYLIST',
  'PODCAST', 'PROFILE', 'QUEUE', 'RANSOM', 'REBOOT', 'ROUTER', 'SCROLL', 'SELFIE',
  'SENSOR', 'SIGNAL', 'SPAM', 'STREAM', 'STREAK', 'TABLET', 'THREAD', 'TIMELINE',
  'TOKEN', 'TRENDING', 'UPLOAD', 'USERNAME', 'VIRUS', 'WIDGET', 'WIFI', 'WIRE',
] as const;

export const WORD_PACKS: readonly WordPack[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original 400-word deck.',
    words: CLASSIC,
  },
  {
    id: 'abstract',
    name: 'Abstract',
    description: 'Concepts and feelings. Harder to clue, much harder to guess.',
    words: ABSTRACT,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Internet and technology words.',
    words: MODERN,
  },
];

const PACKS_BY_ID = new Map(WORD_PACKS.map((p) => [p.id, p]));

export function getPack(id: string): WordPack | undefined {
  return PACKS_BY_ID.get(id);
}

/**
 * Collect the unique words across the given packs plus any custom words.
 * Unknown pack ids are ignored so a stale ruleset can never break game start.
 */
export function collectWords(packIds: readonly string[], customWords: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const word = raw.trim().toUpperCase();
    if (word.length === 0 || seen.has(word)) return;
    seen.add(word);
    out.push(word);
  };
  for (const id of packIds) {
    const pack = PACKS_BY_ID.get(id);
    if (pack) pack.words.forEach(push);
  }
  customWords.forEach(push);
  return out;
}
