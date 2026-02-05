// src/app/permits/new/permitOptions.ts

export const PERMIT_TYPES = {
  HOT_WORK: [
    // Simplified to the items you actually use in the UI (the page maps/filters these anyway)
    'Burning/Brazing/Welding',
    'Grinding/Cutting',
    'Use of torch',
  ],

  VEHICLE_ENTRY: [
    'Overhead crane/engine entry (e.g. pump, generator, etc.)',
    'Vacuum trucks ops',
    'Forklift operation',
    'Cranes',
    'Excavation',
    'Rail operations',
    'Rail operations – engines',
    'Road work',
    'Commercial Trucks',
    'Pickup truck/passenger vehicle',
  ],

  // The page uses a custom GENERAL_WORK list, but keeping this for completeness
  GENERAL_WORK: [
    'Install equipment/materials',
    'Inspect/troubleshoot/test',
    'Run conduit/wire/pipe/tubing',
    'Use of hand tools',
    'Use of electric/power tools',
    'Working at elevations/overhead',
    'Hand paint/wire brush/scrape',
    'Hydro/pneumatic pressure test',
    'Crane/lifting equipment',
    'Use of heavy equipment',
  ],

  // Confined Space items – only the "Entry into..." that should trigger the PRCS/NPRCS rule
  CONFINED_SPACE: [
    'Entry into a tank',
    'Entry into a vessel',
    'Entry into a hopper/chute',
    'Entry into a pit',
    'Entry into an excavation greater than 4ft',
    'Entry into underground vault',
  ],

  // Placeholders preserved, not used by the page (PRCS/NPRCS are booleans in form state)
  PRCS: ['PRCS items per your form (if any separate)'],
  NPRCS: ['NPRCS items per your form (if any separate)'],
  DNCS: ['DNCS items per your form (if any separate)'],
};

export const ADDITIONAL_PPE = {
  HAND_FACE_RESPIRATORY: [
    // Normalized labels
    'Cutting Goggles (Torch)',
    'Welding hood',
    'Goggles (Dust/Chemical)',
    'Hearing Protection',
    'Double Hearing Protection',
    'Dust Mask',
    'Half Face Respirator*',
    // Added items used by the page
    'Face Shield',
    'Full Face Respirator*',
    'Powered Air Purifying Respirator (PAPR)',
    'Supplied Air or SCBA',
    '5-Min Escape Pack',
  ],

  HAND: [
    'Welding gloves/sleeves',
    'Impact Gloves',
    'Chemical Gloves', // (type captured via extra input in the page)
    'Leather/Cotton',
    'Cut resistant (Gloves/sleeves)',
  ],

  OTHER_PPE: [
    'Fall Protection Harness & Lanyards',
    'Arc flash PPE',
    'Rescue Lifeline',
    'Fire Retardant (FR) Clothing',
    'Chemical Suit',
    'Chemical Boots',
  ],

  OTHER: [
    // Mapped/renamed and added items
    'GFCI Protection',
    'Intrinsically Safe Equipment',
    'Forced Air Ventilation',
    'Ladder(s)',
    'Tripod/Hoist',
    'First Aid Kit',
    'Portable Lighting',
    'Escape/Rescue Air Cylinder',
    'Barricading Materials',
  ],
};

export const HAZARD_REDUCTION_ITEMS = [
  'Everyone understand they can exercise "Stop Work Authority"',
  'Environmental impacts identified/controlled/mitigated',
  'Muster Points/ Emergency Exits identified',
  'Employees understand what to do in an emergency',
  'Chemical hazard known/SDS review with employees',
  'Multi-Craft work discussed',
  'Area barricade required (overhead work, regulated areas, etc.)',
  'Grounding/bonding required',
  'Flagger/spotter required',
  'Radio communication',
  'Other',
];

// Not consumed by the page (the page uses a new EQUIPMENT_CONDITION list),
// but kept here to be consistent with the UI.
export const EQUIPMENT_CONDITION_ITEMS = [
  'Equipment In-Service',
  'Equipment depressurized/drained',
  'Equipment cleaned/gas free',
  'Equipment blinded/disconnected/air gapped',
  'Abatement completed (asbestos, lead, ect.)',
  'Fall Protection equipment inspected',
  'Fall Protection Rescue Plan reviewed with employees',
];

export const SPECIAL_CONDITIONS_HEADER = [
  'Transfer operations ceased',
  'Area Ops or KM Supervisor notified',
];

// Renamed/normalized and with removed entries omitted
export const SPECIAL_CONDITION_REQUIREMENTS_LEFT = [
  '100% spark containment required',
  'Fire resistant blankets or barriers are in place',
  'Combustible materials have been removed or protected (within 50’ of hot work area)',
  'Fire Watch required and assigned',
  'Fire extinguishers readily accessible',
  'Wall/floor openings covered or sealed',
  'Flammable liquids/vapors/dusts removed or controlled',
  'Firefighting equipment inspected/ inspection current',
  'Area atmosphere tested with gas monitor',
];

export const SPECIAL_CONDITION_REQUIREMENTS_RIGHT = [
  'No unusual odors/vapors present',
  'Protective warning barricades in place',
  'Adequate lighting conditions',
  'Non-sparking tools or materials required',
  'Area has been inspected for obvious hazards',
  'Additional fire/safety watch/spotter required',
  'Ventilation is adequate',
  'Confined Space Attendant assigned and onsite',
  'Multiple confined space attendants required',
  'Rescue team/equipment/plan on site and in place',
  'Communication with entrants has been determined',
];

export const ADDITIONAL_DOCUMENTS = [
  'Confined Space Entry Plan',
  'Rescue Plan',
  'Critical Lift Plan',
  'Site/Management Plan',
  'Insurance (Form: T-COMLIB-5S)',
  'Emergency/Prevent Reconstruction Inspection Report',
  'One Call Report + One Call Request #',
  'Confined Space Reclassification Form T-COMLIB-5Z',
];

// Kept in sync with the UI (safe ranges without HTML entities)
export const AIR_MONITORING_GASES = [
  { gas: 'LEL', safeRange: '<10%' },
  { gas: 'O₂', safeRange: '19.5-23.5%' },
  { gas: 'H₂S', safeRange: '<10ppm' },
  { gas: 'CO', safeRange: '<35ppm' },
  { gas: 'VOC', safeRange: '—' },
];
