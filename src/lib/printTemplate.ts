// src/app/permits/printTemplate.ts

type JsonMap = Record<string, any>;

export function printPermitHtml(payload: any, permitNumber: number) {
  // ---- helpers -------------------------------------------------------------
  const safe = (v: any) => (v ?? '') as string;

  const yesNoNA = (entry?: { yes?: boolean; na?: boolean }) => {
    if (!entry) return { yes: '', na: '' };
    return {
      yes: entry.yes ? '✓' : '',
      na: entry.na ? '✓' : '',
    };
  };

  const boolYesNo = (b: any) => (b === true ? 'Yes' : b === false ? 'No' : '');

  // Gather selected permit types (booleans), exclude meta fields
  const PERMIT_META_KEYS = new Set([
    'PRCS',
    'NPRCS',
    'hotwork_exact_area',
    'hotwork_other',
    'confined_other',
  ]);
  const selectedPermitTypes = Object.entries(payload.permit_types || {})
    .filter(([k, v]) => typeof v === 'boolean' && v === true && !PERMIT_META_KEYS.has(k))
    .map(([k]) => k);

  const prcsSelected = !!(payload.permit_types?.PRCS);

  // Hazard Reduction & Equipment Condition rows
  const hazardRows = Object.keys(payload.hazard_reduction || {});
  const equipRows = Object.keys(payload.equipment_condition || {});

  // Special Conditions
  const scKeys = Object.keys(payload.special_conditions || {}).filter(
    (k) => !['comm_type', 'fire_watch_after', 'fire_watch_length', 'other_text'].includes(k)
  );

  // Air monitoring columns (Initial + t1..tN)
  const initialsMap: JsonMap = payload.air_monitoring_initials || {};
  const timeCols = Object.keys(initialsMap)
    .filter((k) => k !== 'initial')
    .sort((a, b) => {
      const ai = parseInt(a.slice(1), 10);
      const bi = parseInt(b.slice(1), 10);
      return ai - bi;
    });

  const gasRows = Object.keys(payload.air_monitoring || {});
  const SAFE_RANGE: Record<string, string> = {
    LEL: '<10%',
    'O₂': '19.5-23.5%',
    'H₂S': '<10ppm',
    CO: '<35ppm',
    VOC: '—',
  };

  // Confined Space Hazard Assessment
  const csHazards = Object.entries(payload.confined_hazard_assessment || {})
    .filter(([k]) => k !== 'other_text')
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const csOtherHaz = safe(payload.confined_hazard_assessment?.other_text);

  // Entrants table
  const entrantsTimePairs = Math.max(0, payload.confined_entrants?.time_pairs ?? 0);
  const entrantsRows: any[] = payload.confined_entrants?.rows ?? [];

  // Attendants & Rescue Team
  const attRows: any[] = payload.confined_attendants?.rows ?? [];
  const teamRows: any[] = payload.confined_rescue_team?.rows ?? [];

  const html = `
<html>
  <head>
    <title>Safe Work Permit #${permitNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; }
      h1,h2,h3 { margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; }
      th { background: #dcdcdc; text-align: left; padding: 6px; border: 1px solid #aaa; }
      td { border: 1px solid #aaa; padding: 6px; vertical-align: top; }
      .section-title { background: #cfcfcf; padding: 8px; font-weight: bold; border: 1px solid #999; margin-top: 10px; }
      .pill { display: inline-block; background: #f3f4f6; padding: 2px 6px; margin: 2px 4px 0 0; border-radius: 4px; border:1px solid #d1d5db; }
      .muted { color: #555; font-style: italic; }
      .nowrap { white-space: nowrap; }
      .center { text-align: center; }
      .small { font-size: 12px; color: #444; }
      .no-break { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1 class="center">Safe Work Permit Number: ${permitNumber}</h1>

    <table>
      <tr>
        <th>Date Issued</th><td>${safe(payload.date_issued)}</td>
        <th>Time Issued</th><td>${safe(payload.time_issued)}</td>
      </tr>
      <tr>
        <th>Date Expires</th><td>${safe(payload.date_expires)}</td>
        <th>Time Expires</th><td>${safe(payload.time_expires)}</td>
      </tr>
      <tr>
        <th>Facility</th><td>${safe(payload.facility)}</td>
        <th>Location</th><td>${safe(payload.location)}</td>
      </tr>
      <tr>
        <th>Contractor</th><td colspan="3">${safe(payload.contractor)}</td>
      </tr>
    </table>

    <div class="section-title">Description of Work</div>
    <div style="border:1px solid #aaa; padding:8px; margin-bottom:8px;">${safe(payload.description_of_work)}</div>

    <div class="section-title">Permit Types (check all that apply)</div>
    <div class="no-break">
      ${selectedPermitTypes.length
        ? selectedPermitTypes.map((x: string) => `<span class="pill">${x}</span>`).join(' ')
        : '<span class="muted">None selected</span>'}
      ${payload.permit_types?.hotwork_exact_area ? `<div class="small"><b>Exact area of Hot Work:</b> ${safe(payload.permit_types.hotwork_exact_area)}</div>` : ''}
      ${payload.permit_types?.hotwork_other ? `<div class="small"><b>Other (Hot Work):</b> ${safe(payload.permit_types.hotwork_other)}</div>` : ''}
      ${payload.permit_types?.confined_other ? `<div class="small"><b>Other (Confined Space):</b> ${safe(payload.permit_types.confined_other)}</div>` : ''}
      <div class="small"><b>PRCS:</b> ${payload.permit_types?.PRCS ? 'Yes' : 'No'} &nbsp;&nbsp; <b>NPRCS:</b> ${payload.permit_types?.NPRCS ? 'Yes' : 'No'}</div>
    </div>

    <div class="section-title">Additional PPE / Special Equipment / Safeguards Required</div>
    ${['HAND_FACE_RESPIRATORY','HAND','OTHER_PPE','OTHER'].map((grp) => {
      const group = (payload.additional_ppe || {})[grp] || {};
      const items = Object.keys(group).filter((k) => typeof group[k] === 'boolean' && group[k] === true);
      const extras: string[] = [];
      if (grp === 'HAND_FACE_RESPIRATORY' && group.resp_cartridge_type) {
        extras.push(`<div class="small"><b>*Cartridge Type Required:</b> ${safe(group.resp_cartridge_type)}</div>`);
      }
      if (grp === 'HAND' && group.chem_gloves_type) {
        extras.push(`<div class="small"><b>Type (Chemical Gloves):</b> ${safe(group.chem_gloves_type)}</div>`);
      }
      return `
        <h3>${String(grp).replace(/_/g, ' ')}</h3>
        <div>
          ${items.length ? items.map((x) => `<span class="pill">${x}</span>`).join(' ') : '<span class="muted">None</span>'}
        </div>
        ${extras.join('')}
      `;
    }).join('')}

    <div class="section-title">Hazard Reduction</div>
    <table class="no-break">
      <tr><th>Item</th><th class="center">Yes</th><th class="center">N/A</th></tr>
      ${hazardRows.map((k) => {
        if (k === 'other_text' || k === 'radio_channel') return '';
        const v = yesNoNA((payload.hazard_reduction || {})[k]);
        return `<tr><td>${k}</td><td class="center">${v.yes}</td><td class="center">${v.na}</td></tr>`;
      }).join('')}
    </table>
    ${payload.hazard_reduction?.radio_channel ? `<div class="small"><b>Radio Channel #:</b> ${safe(payload.hazard_reduction.radio_channel)}</div>` : ''}
    ${payload.hazard_reduction?.other_text ? `<div class="small"><b>Other:</b> ${safe(payload.hazard_reduction.other_text)}</div>` : ''}

    <div class="section-title">Equipment Condition</div>
    <table class="no-break">
      <tr><th>Item</th><th class="center">Yes</th><th class="center">N/A</th></tr>
      ${equipRows.map((k) => {
        if (k === 'other_text') return '';
        const v = yesNoNA((payload.equipment_condition || {})[k]);
        return `<tr><td>${k}</td><td class="center">${v.yes}</td><td class="center">${v.na}</td></tr>`;
      }).join('')}
    </table>
    ${payload.equipment_condition?.other_text ? `<div class="small"><b>Other:</b> ${safe(payload.equipment_condition.other_text)}</div>` : ''}

    <div class="section-title">Energy Control</div>
    <table>
      <tr>
        <th>Verified Zero-Energy State</th><td>${boolYesNo(payload.energy_control?.zero_energy)}</td>
        <th>Personal Locks Hung</th><td>${boolYesNo(payload.energy_control?.personal_locks)}</td>
      </tr>
      <tr>
        <th>Lock Box Number</th><td colspan="3">${safe(payload.energy_control?.lock_box_number)}</td>
      </tr>
    </table>

    <div class="section-title">Special Conditions</div>
    <table class="no-break">
      <tr><th>Item</th><th class="center">Yes</th><th class="center">N/A</th></tr>
      ${scKeys.map((k) => {
        const v = yesNoNA((payload.special_conditions || {})[k]);
        return `<tr><td>${k}</td><td class="center">${v.yes}</td><td class="center">${v.na}</td></tr>`;
      }).join('')}
    </table>
    ${payload.special_conditions?.comm_type ? `<div class="small"><b>Comm. Type:</b> ${safe(payload.special_conditions.comm_type)}</div>` : ''}
    ${payload.special_conditions?.fire_watch_after ? `<div class="small"><b>Fire watch after completion:</b> ${safe(payload.special_conditions.fire_watch_after)} ${payload.special_conditions?.fire_watch_after === '>30' && payload.special_conditions?.fire_watch_length ? `(${safe(payload.special_conditions.fire_watch_length)} min)` : ''}</div>` : ''}
    ${payload.special_conditions?.other_text ? `<div class="small"><b>Other special conditions:</b> ${safe(payload.special_conditions.other_text)}</div>` : ''}

    <div class="section-title">Air Monitoring</div>
    <table class="no-break">
      <tr>
        <th colspan="2">Initials of tester</th>
        <th class="center">${safe(initialsMap.initial)}</th>
        ${timeCols.map((tKey) => `<th class="center">${safe(initialsMap[tKey])}</th>`).join('')}
      </tr>
      <tr>
        <th>Gas</th>
        <th>Safe Range</th>
        <th>Initial Reading</th>
        ${timeCols.map(() => `<th class="nowrap">Time</th>`).join('')}
      </tr>
      ${gasRows.map((gas) => {
        const row = payload.air_monitoring?.[gas] || {};
        return `
          <tr>
            <td>${gas}</td>
            <td>${SAFE_RANGE[gas] ?? '—'}</td>
            <td>${safe(row['Initial Reading'])}</td>
            ${timeCols.map((tKey) => `<td>${safe(row[tKey])}</td>`).join('')}
          </tr>
        `;
      }).join('')}
    </table>

    <div class="section-title">Instrument Info</div>
    <table>
      <tr>
        <th>Make</th><td>${safe(payload.instrument_info?.make)}</td>
        <th>Model</th><td>${safe(payload.instrument_info?.model)}</td>
      </tr>
      <tr>
        <th>Serial</th><td>${safe(payload.instrument_info?.serial)}</td>
        <th>Bump Tested Before Use</th><td>${boolYesNo(payload.instrument_info?.bump_tested)}</td>
      </tr>
      <tr>
        <th>Calibration Current</th><td>${boolYesNo(payload.instrument_info?.calibration_current)}</td>
        <td></td><td></td>
      </tr>
    </table>

    ${prcsSelected ? `
      <div class="section-title">Confined Space Hazard Assessment (PRCS)</div>
      <div class="no-break">
        ${csHazards.length
          ? csHazards.map((x) => `<span class="pill">${x}</span>`).join(' ')
          : '<span class="muted">No hazards selected</span>'}
        ${csOtherHaz ? `<div class="small"><b>Other:</b> ${csOtherHaz}</div>` : ''}
      </div>

      <div class="section-title">Confined Space Rescue Plan (PRCS)</div>
      <table class="no-break">
        <tr>
          <th>Non-Entry Rescue Plan</th><td>${boolYesNo(payload.confined_rescue_plan?.non_entry)}</td>
          <th>Entry Rescue Plan</th><td>${boolYesNo(payload.confined_rescue_plan?.entry)}</td>
        </tr>
      </table>
      ${payload.confined_rescue_plan?.notes ? `<div class="small"><b>Rescue Plan Details:</b> ${safe(payload.confined_rescue_plan?.notes)}</div>` : ''}
      <div class="small"><b>Entry Supervisor reviewed plan:</b> ${boolYesNo(payload.confined_rescue_plan?.reviewed)}</div>
      ${payload.confined_rescue_plan?.supervisor_initials ? `<div class="small"><b>Entry Supervisor Initials:</b> ${safe(payload.confined_rescue_plan?.supervisor_initials)}</div>` : ''}

      <div class="section-title">Confined Space Authorized Entrant(s) Log (PRCS)</div>
      <table class="no-break">
        <tr>
          <th class="nowrap">Name</th>
          ${Array.from({ length: entrantsTimePairs }).map((_, i) => `
            <th class="nowrap">Time In ${i+1}</th>
            <th class="nowrap">Time Out ${i+1}</th>
          `).join('')}
        </tr>
        ${(entrantsRows).map((r) => `
          <tr>
            <td>${safe(r.name)}</td>
            ${Array.from({ length: entrantsTimePairs }).map((_, i) => {
              const t = r.times?.[i] || {};
              return `
                <td>${safe(t.in)}</td>
                <td>${safe(t.out)}</td>
              `;
            }).join('')}
          </tr>
        `).join('')}
      </table>

      <div class="section-title">Confined Space Authorized Attendant(s) (PRCS)</div>
      <table class="no-break">
        <tr>
          <th>Name</th><th>Start Time</th><th>Stop Time</th><th>Start Time</th><th>Stop Time</th>
        </tr>
        ${attRows.map((r) => `
          <tr>
            <td>${safe(r.name)}</td>
            ${(r.times || []).map((t: any) => `
              <td>${safe(t.start)}</td>
              <td>${safe(t.stop)}</td>
            `).join('')}
          </tr>
        `).join('')}
      </table>

      <div class="section-title">Confined Space Rescue Team (PRCS)</div>
      <table class="no-break">
        <tr>
          <th>Name</th><th>Start Time</th><th>Stop Time</th><th>Start Time</th><th>Stop Time</th>
        </tr>
        ${teamRows.map((r) => `
          <tr>
            <td>${safe(r.name)}</td>
            ${(r.times || []).map((t: any) => `
              <td>${safe(t.start)}</td>
              <td>${safe(t.stop)}</td>
            `).join('')}
          </tr>
        `).join('')}
      </table>
    ` : ''}

    <div class="section-title">Signatures</div>
    <table>
      <tr><th>Permit Issuer</th><td>${safe(payload.signatures?.issuer)}</td></tr>
      <tr><th>Permit Receiver</th><td>${safe(payload.signatures?.receiver)}</td></tr>
      ${prcsSelected ? `<tr><th>Confined Space Authorized Entry Supervisor</th><td>${safe(payload.signatures?.entry_supervisor)}</td></tr>` : ''}
    </table>
  </body>
</html>
  `.trim();

  return html;
}

