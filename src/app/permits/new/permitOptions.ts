export const PERMIT_TYPES = {
  HOT_WORK: [
    'Burning/Welding/Cutting',
    'Grinding/Chopping (Grinding)',
    'Use of electric power tools',
    'Hot tar activities',
    'In-situ care maintenance activities (Mow-Edge Weed eat)',
    'Electrical work that could result in arc/spark',
    'Use of torch',
    'Use of low volt tools/equip'
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
    'Pickup truck/passenger vehicle'
  ],
  GENERAL_WORK: [
    'Non-construction/repairing/blanking',
    'Hand power tools/bench/torque',
    'Inspect/housekeeping/bolt test',
    'Small equipment materials',
    'Use of Terminal vehicles',
    'General works in proximity to rail/equipment',
    'Heavy lifting operations (crane use)',
    'Hydro/pressure test',
    'H2S Monitor',
    'Walking at elevations/overhead'
  ],
  CONFINED_SPACE: [
    'Entry into a tank',
    'Entry into a vessel',
    'Entry into a hopper/chute',
    'Entry into a pit',
    'Entry into an excavation greater than 4ft',
    'Entry into underground vault',
    'Entry after cooling off',
    'Switching building entries',
    'Breaking lines connections blow-up work'
  ],
  PRCS: ['PRCS items per your form (if any separate)'],
  NPRCS: ['NPRCS items per your form (if any separate)'],
  DNCS: ['DNCS items per your form (if any separate)']
};

export const ADDITIONAL_PPE = {
  HAND_FACE_RESPIRATORY: [
    'Clamping goggles (Torch)',
    'Full Face*',
    'Welding hood',
    'Goggles (Dust/Chemical)',
    'Hearing Prot.',
    'Double hearing Protect',
    'Dust Mask',
    'Half Face*',
    'Other'
  ],
  HAND: [
    'Welding gloves/sleeves',
    'Impact gloves',
    'Chemical Gloves Type',
    'Leather/Cotton',
    'Cut resistant (Gloves/sleeves)',
    'Other'
  ],
  OTHER_PPE: [
    'Full Body Harness',
    'Arc flash PPE',
    'Smoldering PPEs',
    'Fire retardant clothing',
    'KMIT Two watch vest',
    'Material guards',
    'Chemical Boots',
    'H2S Monitor',
    'Other PPE – Level A',
    'Other PPE – Level B',
    'Other PPE – Level C'
  ],
  OTHER: [
    'GFCI',
    'Descent Device',
    'Intentionally Split equip / 12 volt lighting',
    'X Ray barricades',
    'Air Mover, In/Out',
    'Rail Switch Locks',
    'Blue Flag / Derailer',
    'Other',
    'Other Special PPE'
  ]
};

export const HAZARD_REDUCTION_ITEMS = [
  'Employee understands they can exercise “You Can Stop”',
  'Environmental impacts identified/controlled/mitigated',
  'Matrix/Assemblies products identified (Hussey/Schemistry)',
  'Employees understand what to do in an emergency',
  'Chemical hazard known/SDS review with employees',
  'Multi-unit work discussed',
  'Area barricaded required (overhead work, regulated areas, etc.)',
  'Grounding bonding required',
  'Flagger/spotter required',
  'Radio communication (Radio #)',
  'Other'
];

export const EQUIPMENT_CONDITION_ITEMS = [
  'Equipment in good condition / proper maint',
  'Equipment properly serviced/adjusted',
  'All guards present/in place',
  'Machine operations completed review',
  'Damages/abnormal operations present',
  'Firefighting equipment inspected inspection current',
  'Storage drum/valve equipment items verified',
  'Stop all work and report unsafe conditions',
  'Other'
];

export const SPECIAL_CONDITIONS_HEADER = [
  'Transfer operations ceased',
  'Area Ops or KM Supervisor notified'
];

export const SPECIAL_CONDITION_REQUIREMENTS_LEFT = [
  'Operational activity considered',
  '100% spark containment required',
  'Fire resistant/blanket or barriers are in place',
  'Vehicle engines turned off (TV Protection)',
  'Flammable/Combustible materials have been removed or protected (within 50’ of hot work area)',
  'Fire Watch required (assigned as course)',
  'Fire extinguishers required',
  'Pre-plan inspection/guards required',
  'Damage controls/operations required',
  'Firefighting equipment inspected inspection current',
  'Storage drum/valve equipment items verified',
  'Stop all work and report unsafe conditions',
  'Other'
];

export const SPECIAL_CONDITION_REQUIREMENTS_RIGHT = [
  'No unusual odors/vapors present',
  'Protective warning barricades in place',
  'Adequate lighting conditions',
  'Non-sparking tools or materials required',
  'Area has been inspected for obvious hazards',
  'Audit for safety watch/spotter required',
  'Ventilation as required',
  'Confined Space Attendant assigned and onsite',
  'Multiple personnel plan or attendant required',
  'Resource team required on site as a place',
  'Ensure communication with committee has been documented',
  'Use of special lifeline required',
  'Other'
];

export const ADDITIONAL_DOCUMENTS = [
  'Confined Space Entry Plan',
  'Rescue Plan',
  'Critical Lift Plan',
  'Site/Management Plan',
  'Insurance (Form: T-COMLIB-5S)',
  'Emergency/Prevent Reconstruction Inspection Report',
  'One Call Report + One Call Request #',
  'Confined Space Reclassification Form T-COMLIB-5Z'
];

export const AIR_MONITORING_GASES = [
  { gas: 'LEL', safeRange: '10% - 25% LEL' },
  { gas: 'O₂', safeRange: '19.5% - 23.5%' },
  { gas: 'H₂S', safeRange: '< 10 ppm' },
  { gas: 'CO', safeRange: '< 35 ppm' },
  { gas: 'VOC', safeRange: '—' }
];
