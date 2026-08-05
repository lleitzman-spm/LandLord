// Controlled operational evidence for model prompts. These helpers never
// forward source text. They recognize a bounded vocabulary and emit only a
// canonical token, so a subject may contain a person/door while the brain sees
// the decision-relevant symptom or violation type alone.

const MAINTENANCE = [
  ['no-cooling', /\b(?:no|not)\s+(?:cooling|cold air)\b|\bno-cooling\b/i],
  ['no-heating', /\b(?:no|not)\s+(?:heat|heating)\b|\bno-heating\b/i],
  ['refrigerant-leak', /\brefrigerant\s+leak\b/i],
  ['water-leak', /\b(?:active|roof|pipe|fixture|condensate)?\s*leak\b|\bpipe\s+burst\b/i],
  ['no-hot-water', /\bno\s+hot\s+water\b/i],
  ['drain-clog', /\b(?:clogged?|slow)\s+(?:drain|toilet)|\btoilet\s+overflow/i],
  ['thermostat-fault', /\bthermostat\b/i],
  ['refrigerator-failure', /\brefrigerator|fridge\b/i],
  ['dishwasher-failure', /\bdishwasher\b/i],
  ['disposal-failure', /\b(?:garbage\s+)?disposal\b/i],
  ['life-safety-detector', /\b(?:smoke|carbon monoxide|co)\s+(?:alarm|detector)\b/i],
  ['electrical-fault', /\b(?:outlet|breaker|circuit|sparking|power loss)\b/i],
  ['door-lock', /\b(?:door\s+lock|lockout|rekey|lock\s+seized)\b/i],
  ['window-damage', /\b(?:window|pane)\b/i],
  ['pest-infestation', /\b(?:pest|rodent|roach|bed[ -]?bug|infestation)\b/i],
  ['mold-moisture', /\b(?:mold|moisture|ceiling stain)\b/i],
  ['routine-service', /\b(?:routine|seasonal)\s+(?:hvac\s+)?service\b/i],
];

const VIOLATIONS = [
  ['exterior-upkeep', /\b(?:exterior[- ]upkeep|overgrown|yard|lawn|curb)\b/i],
  ['unauthorized-pet', /\bunauthorized[- ]pet\b/i],
  ['unauthorized-occupant', /\bunauthorized[- ]occupant\b|\blong[- ]term guest\b/i],
  ['nuisance', /\b(?:noise|nuisance)\b/i],
  ['housekeeping', /\b(?:housekeeping|property[- ]condition|interior[- ]condition)\b/i],
  ['hoa', /\bhoa\b/i],
  ['nonpayment', /\bnon[- ]?payment\b/i],
  ['curable-covenant-breach', /\bcurable lease covenant breach\b/i],
  ['material-breach', /\b(?:material|repeated|incurable)\b.*\bbreach\b/i],
];

const TURN_CONDITIONS = [
  [
    'major-rehabilitation',
    /\b(?:full|major|complete)\s+(?:renovation|rehab|remodel)\b|\b(?:gutted|uninhabitable|structural damage|fire damage)\b/i,
  ],
  [
    'heavy-damage',
    /\b(?:heavy|extensive|substantial)\s+(?:wear|damage|repairs?)\b|\b(?:pet|water|smoke)\s+damage\b|\b(?:replace|replacement)\s+(?:the\s+)?(?:flooring|carpet|cabinets?)\b/i,
  ],
  [
    'ordinary-turn-wear',
    /\b(?:ordinary|normal)\s+wear\b|\bstandard\s+turn\b|\bclean(?:ing)?\s*(?:and|\/)\s*paint\b/i,
  ],
  [
    'cosmetic-wear',
    /\b(?:light|minor|cosmetic)\s+(?:wear|scuffs?|touch[- ]?ups?|damage|repairs?)\b|\b(?:nail holes?|paint touch[- ]?ups?)\b/i,
  ],
];

const CATEGORIES = new Map([
  ['inspection-finding', 'inspection-finding'],
  ['maintenance-request', 'maintenance-request'],
  ['service-request', 'service-request'],
  ['resident-request', 'resident-request'],
  ['hoa-notice', 'hoa-notice'],
]);

function firstTag(value, patterns) {
  const text = String(value ?? '');
  for (const [tag, pattern] of patterns) {
    if (pattern.test(text)) return tag;
  }
  return null;
}

export function safeUrgency(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['emergency', 'urgent', 'routine', 'standard', 'scheduled'].includes(normalized)
    ? normalized
    : 'routine';
}

export function maintenanceSymptom(subject, params = {}) {
  return (
    firstTag(params.symptom, MAINTENANCE) ??
    firstTag(params.category, MAINTENANCE) ??
    firstTag(subject, MAINTENANCE) ??
    'unspecified'
  );
}

export function violationType(subject, params = {}) {
  return (
    firstTag(params.violationType, VIOLATIONS) ??
    firstTag(params.violation, VIOLATIONS) ??
    firstTag(subject, VIOLATIONS) ??
    'unspecified'
  );
}

export function residentEvidence(subject, params = {}) {
  const categoryValue = String(params.category ?? '').trim().toLowerCase();
  const category = CATEGORIES.get(categoryValue);
  const symptom = maintenanceSymptom(subject, params);
  const violation = violationType(subject, params);
  const evidence = [];
  if (category) evidence.push(`request-category=${category}`);
  if (params.urgency != null) evidence.push(`urgency=${safeUrgency(params.urgency)}`);
  if (symptom !== 'unspecified') evidence.push(`symptom=${symptom}`);
  if (violation !== 'unspecified') evidence.push(`violation-type=${violation}`);
  return evidence.length ? evidence : ['request-category=unspecified'];
}

/**
 * The turnover clerk needs condition, not the case label that carries a door
 * and a person. Read only a bounded condition vocabulary from event params or
 * the subject, then emit the canonical token alone.
 */
export function turnoverEvidence(subject, params = {}) {
  const sources = [
    params.turnCondition,
    params.turnLevel,
    params.condition,
    params.scope,
    params.damage,
    subject,
  ];
  const condition =
    sources.map((value) => firstTag(value, TURN_CONDITIONS)).find(Boolean) ??
    'unspecified';
  return [`turn-condition=${condition}`];
}
