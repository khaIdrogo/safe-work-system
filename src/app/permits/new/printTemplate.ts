export function printPermitHtml(payload: any, permitNumber: number) {
  return `
      <html>
        <head>
          <title>Safe Work Permit #${permitNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1,h2 { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th { background: #dcdcdc; text-align: left; padding: 6px; border: 1px solid #aaa; }
            td { border: 1px solid #aaa; padding: 6px; vertical-align: top; }
            .section-title { background: #cfcfcf; padding: 6px; font-weight: bold; border: 1px solid #999; }
            .badge { display: inline-block; background: #eee; padding: 2px 6px; margin: 2px; border-radius: 4px; border:1px solid #ccc; }
          </style>
        </head>
        <body>
          <h1 style="text-align:center">Safe Work Permit Number: ${permitNumber}</h1>

          <table>
            <tr>
              <th>Date</th><td>${payload.date_issued ?? ''}</td>
              <th>Time Issued</th><td>${payload.time_issued ?? ''}</td>
            </tr>
            <tr>
              <th>Date Expired</th><td>${payload.date_expired ?? ''}</td>
              <th>Time Expired</th><td>${payload.time_expired ?? ''}</td>
            </tr>
            <tr>
              <th>Facility</th><td>${payload.facility}</td>
              <th>Location</th><td>${payload.location}</td>
            </tr>
            <tr>
              <th>Contractor</th><td colspan="3">${payload.contractor}</td>
            </tr>
          </table>

          <div class="section-title">Description of Work</div>
          <div style="border:1px solid #aaa; padding:8px; margin-bottom:8px;">${payload.description_of_work ?? ''}</div>

          <div class="section-title">PERMIT TYPE (check all that apply)</div>
          ${Object.keys(payload.permit_types).map((group: any) => `
            <h3>${String(group).replace('_',' ')}</h3>
            <div>${(payload.permit_types[group] || []).map((i:string)=>`<span class="badge">${i}</span>`).join(' ') || '<i>None selected</i>'}</div>
          `).join('')}

          <div class="section-title">Minimum PPE</div>
          <div style="border:1px solid #aaa; padding:8px;">${payload.ppe_requirements.minimum_line}</div>

          <div class="section-title">ADDITIONAL PPE / SPECIAL EQUIPMENT / SAFEGUARDS REQUIRED</div>
          ${['HAND_FACE_RESPIRATORY','HAND','OTHER_PPE','OTHER'].map((grp)=>`
            <h3>${String(grp).replace(/_/g,' ')}</h3>
            <div>${(payload.additional_ppe[grp]||[]).map((x:string)=>`<span class="badge">${x}</span>`).join(' ') || '<i>None</i>'}</div>
          `).join('')}

          <div class="section-title">HAZARD REDUCTION</div>
          <table>
            <tr><th>Item</th><th>Yes</th><th>No</th><th>N/A</th></tr>
            ${Object.entries(payload.hazard_reduction).map(([k,v]:[string,string])=>`
              <tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>
            `).join('')}
          </table>

          <div class="section-title">EQUIPMENT CONDITION</div>
          <table>
            <tr><th>Item</th><th>Yes</th><th>No</th><th>N/A</th></tr>
            ${Object.entries(payload.equipment_condition).map(([k,v]:[string,string])=>`
              <tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>
            `).join('')}
          </table>

          <div class="section-title">ENERGY CONTROL</div>
          <table>
            <tr><th>LOTO Verified</th><td>${payload.energy_control.lotoVerified}</td><th>Lock Box #</th><td>${payload.energy_control.lockBox ?? ''}</td></tr>
          </table>

          <div class="section-title">SPECIAL CONDITIONS REQUIRED</div>
          <table>
            <tr><th>Header Item</th><th>Yes</th><th>No</th><th>N/A</th></tr>
            ${Object.entries(payload.special_conditions.header).map(([k,v]:[string,string])=>`
              <tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>
            `).join('')}
          </table>

          <h3>Requirements</h3>
          <table>
            <tr><th>Requirement</th><th>Yes</th><th>No</th><th>N/A</th></tr>
            ${Object.entries(payload.special_conditions.left).map(([k,v]:[string,string])=>`
              <tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>
            `).join('')}
            ${Object.entries(payload.special_conditions.right).map(([k,v]:[string,string])=>`
              <tr><td>${k}</td><td>${v==='Yes'?'✓':''}</td><td>${v==='No'?'✓':''}</td><td>${v==='N/A'?'✓':''}</td></tr>
            `).join('')}
          </table>

          <div class="section-title">ADDITIONAL DOCUMENTS REQUIRED FOR REVIEW</div>
          <div>${(payload.additional_documents||[]).map((x:string)=>`<span class="badge">${x}</span>`).join(' ') || '<i>None</i>'}</div>

          <div class="section-title">AIR MONITORING — Continuous: ${payload.air_monitoring.continuous}</div>
          <table>
            <tr><th>Gas</th><th>Safe Range</th><th>Initial Check</th><th>Second Check</th><th>Time 1</th><th>Time 2</th></tr>
            ${payload.air_monitoring.readings.map((r:any)=>`
              <tr><td>${r.gas}</td><td>${r.safeRange}</td><td>${r.initial}</td><td>${r.second}</td><td>${r.time1}</td><td>${r.time2}</td></tr>
            `).join('')}
          </table>

          <div class="section-title">PERMIT ISSUER INSTRUMENT INFO</div>
          <table>
            <tr><th>Make</th><td>${payload.instrument_info.make}</td><th>Model</th><td>${payload.instrument_info.model}</td></tr>
            <tr><th>Serial</th><td>${payload.instrument_info.serial}</td><th>Last Calibration Date</th><td>${payload.instrument_info.lastCalibrationDate}</td></tr>
          </table>

          <div class="section-title">SIGNATURES</div>
          <table>
            <tr><th>Employee Number</th><td>${payload.signatures.employee_number}</td></tr>
          </table>
        </body>
      </html>`;
}
