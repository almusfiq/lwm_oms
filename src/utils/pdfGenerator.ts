/**
 * LWM OMS — PDF Generator
 * Uses a hidden iframe + window.print() with styled HTML for clean PDF output.
 * No external library needed.
 */

function printHtml(html: string, filename: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

const STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 12px; }
  .header { display: flex; align-items: center; border-bottom: 3px solid #7f1d1d; padding-bottom: 12px; margin-bottom: 20px; }
  .logo-box { width: 48px; height: 48px; background: #7f1d1d; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; border-radius: 8px; margin-right: 14px; }
  .org-name { font-size: 15px; font-weight: 700; color: #7f1d1d; }
  .org-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  h2 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-pending { background: #fef3c7; color: #92400e; }
  .badge-approved { background: #d1fae5; color: #065f46; }
  .badge-rejected { background: #fee2e2; color: #991b1b; }
  .badge-referred { background: #ede9fe; color: #5b21b6; }
  .section { margin: 16px 0; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field { margin-bottom: 8px; }
  .field-label { font-size: 10px; color: #94a3b8; margin-bottom: 2px; text-transform: uppercase; }
  .field-value { font-weight: 600; color: #0f172a; font-size: 12px; }
  .description-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; line-height: 1.6; white-space: pre-wrap; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .signature-box { border-top: 1.5px solid #334155; padding-top: 8px; }
  .signature-name { font-weight: 700; font-size: 12px; }
  .signature-role { font-size: 10px; color: #64748b; margin-top: 2px; }
  .signature-date { font-size: 10px; color: #94a3b8; margin-top: 12px; }
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { padding: 4px 0; display: flex; align-items: center; gap: 8px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
  .checklist li .cb { width: 14px; height: 14px; border: 1.5px solid #334155; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .checklist li .cb.done { background: #065f46; border-color: #065f46; color: white; }
  .attach-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .attach-chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px 10px; font-size: 10px; font-weight: 600; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
`;

/** Generate and print a Task Assignment PDF */
export function downloadTaskPdf(task: any, assigner: any, assignees: any[]) {
  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const assigneeNames = assignees.map((a: any) => a?.name?.en || 'Unknown').join(', ');
  const checklistHtml = task.checklist?.length
    ? `<ul class="checklist">${task.checklist.map((c: any) => `
        <li>
          <span class="cb ${c.completed ? 'done' : ''}">${c.completed ? '✓' : ''}</span>
          <span ${c.completed ? 'style="text-decoration:line-through;color:#94a3b8"' : ''}>${c.title}</span>
        </li>`).join('')}</ul>`
    : '<p style="color:#94a3b8;font-size:11px">No checklist items.</p>';

  const attachHtml = task.attachments?.length
    ? `<div class="attach-list">${task.attachments.map((a: any) => `<span class="attach-chip">📎 ${a.name}</span>`).join('')}</div>`
    : '<span style="color:#94a3b8;font-size:11px">No attachments.</span>';

  const statusBadge = task.status?.toLowerCase().replace('_', ' ') || 'pending';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Task: ${task.taskId}</title>
<style>${STYLES}</style></head>
<body>
  <div class="header">
    <div class="logo-box">LWM</div>
    <div>
      <div class="org-name">Liberation War Museum</div>
      <div class="org-sub">Official Task Assignment Record</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
    <div>
      <h2>${task.title}</h2>
      <div style="margin-top:4px;display:flex;gap:8px;align-items:center">
        <span class="badge badge-${task.status?.toLowerCase() === 'completed' ? 'approved' : task.status?.toLowerCase().includes('reject') || task.status?.toLowerCase().includes('cancel') ? 'rejected' : 'pending'}">${statusBadge}</span>
        <span style="font-size:11px;color:#64748b">Priority: <strong>${task.priority || 'MEDIUM'}</strong></span>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:#64748b">
      <div style="font-weight:700;font-size:13px;color:#7f1d1d">${task.taskId}</div>
      <div>Generated: ${now}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Task Details</div>
    <div class="grid-2">
      <div>
        <div class="field"><div class="field-label">Assigned By</div><div class="field-value">${assigner?.name?.en || 'Unknown'}</div></div>
        <div class="field"><div class="field-label">Department</div><div class="field-value">${task.department?.name?.en || task.departmentId || '—'}</div></div>
        <div class="field"><div class="field-label">Start Date</div><div class="field-value">${task.startDate || '—'}</div></div>
      </div>
      <div>
        <div class="field"><div class="field-label">Assigned To</div><div class="field-value">${assigneeNames}</div></div>
        <div class="field"><div class="field-label">Progress</div><div class="field-value">${task.progress ?? 0}%</div></div>
        <div class="field"><div class="field-label">Deadline</div><div class="field-value" style="color:#b91c1c">${task.dueDate || '—'}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Description & Scope</div>
    <div class="description-box">${task.description || 'No description provided.'}</div>
  </div>

  <div class="section">
    <div class="section-title">Checklist (${task.checklist?.filter((c: any) => c.completed).length || 0}/${task.checklist?.length || 0} complete)</div>
    ${checklistHtml}
  </div>

  <div class="section">
    <div class="section-title">Attachments</div>
    ${attachHtml}
  </div>

  <div class="signature-row">
    <div class="signature-box">
      <div class="signature-name">${assigner?.name?.en || 'Task Assigner'}</div>
      <div class="signature-role">${assigner?.designation?.en || assigner?.role || ''}</div>
      <div class="signature-date">Date: _______________</div>
    </div>
    <div class="signature-box">
      <div class="signature-name">${assigneeNames}</div>
      <div class="signature-role">Assigned Employee(s)</div>
      <div class="signature-date">Date: _______________</div>
    </div>
  </div>

  <div class="footer">
    <span>Liberation War Museum OMS — Confidential Internal Document</span>
    <span>${task.taskId} | Printed: ${now}</span>
  </div>
</body></html>`;

  printHtml(html, `task-${task.taskId}.pdf`);
}

/** Generate and print an Approval PDF */
export function downloadApprovalPdf(approval: any) {
  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const statusClass = approval.status === 'APPROVED' ? 'approved' : approval.status === 'REJECTED' ? 'rejected' : approval.status === 'REFERRED' ? 'referred' : 'pending';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Approval: ${approval._id}</title>
<style>${STYLES}</style></head>
<body>
  <div class="header">
    <div class="logo-box">LWM</div>
    <div>
      <div class="org-name">Liberation War Museum</div>
      <div class="org-sub">Official Approval Record</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
    <div>
      <h2>${approval.title}</h2>
      <div style="margin-top:4px;display:flex;gap:8px;align-items:center">
        <span class="badge badge-${statusClass}">${approval.status}</span>
        <span style="font-size:11px;color:#64748b">Level: <strong>${approval.level || '—'}</strong></span>
        <span style="font-size:11px;color:#64748b">Type: <strong>${(approval.requestType || '').replace(/_/g, ' ')}</strong></span>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:#64748b">
      <div style="font-weight:700;font-size:12px;color:#7f1d1d">APPROVAL REF: ${approval._id?.slice(-8).toUpperCase()}</div>
      <div>Generated: ${now}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Request Details</div>
    <div class="grid-2">
      <div>
        <div class="field"><div class="field-label">Submitted By</div><div class="field-value">${approval.requester?.name?.en || '—'}</div></div>
        <div class="field"><div class="field-label">Department</div><div class="field-value">${approval.requesterDepartment?.name?.en || approval.requesterDepartment?.code || '—'}</div></div>
        <div class="field"><div class="field-label">Submitted On</div><div class="field-value">${approval.createdAt ? new Date(approval.createdAt).toLocaleDateString('en-BD') : '—'}</div></div>
      </div>
      <div>
        <div class="field"><div class="field-label">Reviewed By</div><div class="field-value">${approval.approver?.name?.en || '—'}</div></div>
        <div class="field"><div class="field-label">Authority</div><div class="field-value">${approval.approver?.designation?.en || approval.approver?.role || '—'}</div></div>
        <div class="field"><div class="field-label">Decision Date</div><div class="field-value">${approval.approvedAt || approval.rejectedAt ? new Date(approval.approvedAt || approval.rejectedAt).toLocaleDateString('en-BD') : '—'}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Justification & Description</div>
    <div class="description-box">${approval.description || 'No description provided.'}</div>
  </div>

  ${approval.reason ? `
  <div class="section">
    <div class="section-title">Decision Note</div>
    <div class="description-box" style="border-color:${approval.status === 'APPROVED' ? '#86efac' : '#fca5a5'};background:${approval.status === 'APPROVED' ? '#f0fdf4' : '#fff1f2'}">${approval.reason}</div>
  </div>` : ''}

  ${approval.referralNote ? `
  <div class="section">
    <div class="section-title">Referral Note</div>
    <div class="description-box" style="border-color:#c4b5fd;background:#faf5ff">${approval.referralNote}</div>
  </div>` : ''}

  <div class="signature-row">
    <div class="signature-box">
      <div class="signature-name">${approval.requester?.name?.en || 'Requester'}</div>
      <div class="signature-role">${approval.requester?.designation?.en || approval.requester?.role || ''} — ${approval.requesterDepartment?.name?.en || ''}</div>
      <div class="signature-date">Date: _______________</div>
    </div>
    <div class="signature-box">
      <div class="signature-name">${approval.approver?.name?.en || 'Approving Authority'}</div>
      <div class="signature-role">${approval.approver?.designation?.en || approval.approver?.role || ''}</div>
      <div class="signature-date">Date: _______________</div>
    </div>
  </div>

  <div style="margin-top:24px;padding:12px;border:2px dashed #e2e8f0;border-radius:8px;text-align:center;color:#94a3b8;font-size:10px">
    [OFFICIAL STAMP / SEAL]
  </div>

  <div class="footer">
    <span>Liberation War Museum OMS — Confidential Governance Document</span>
    <span>Ref: ${approval._id?.slice(-8).toUpperCase()} | Printed: ${now}</span>
  </div>
</body></html>`;

  printHtml(html, `approval-${approval._id}.pdf`);
}

/** Generate and print Tasks PDF Report (Supports Ongoing, Completed, and All Tasks) */
export function downloadTasksPdfReport({
  reportTitle,
  scopeName,
  departmentName,
  filterTypeName = 'Ongoing Tasks',
  tasks,
  generatedBy,
}: {
  reportTitle: string;
  scopeName: string;
  departmentName?: string;
  filterTypeName?: string;
  tasks: any[];
  generatedBy: any;
}) {
  const now = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  const tasksHtml = tasks.length > 0 ? tasks.map((t: any, index: number) => {
    const assignees = (t.assignees || []).map((a: any) => a?.name?.en || a?.name || 'Unassigned').join(', ') || 'Unassigned';
    const requesterName = t.requester?.name?.en || t.creator?.name?.en || 'System / Direct';
    const sourceDept = t.sourceDepartment?.name?.en || t.sourceDepartment?.code || '—';
    const targetDept = t.targetDepartment?.name?.en || t.department?.name?.en || t.department?.code || '—';
    const checklistDone = t.checklist?.filter((c: any) => c.completed).length || 0;
    const checklistTotal = t.checklist?.length || 0;

    const priorityColor = t.priority === 'URGENT' ? '#dc2626' : t.priority === 'HIGH' ? '#ea580c' : t.priority === 'MEDIUM' ? '#2563eb' : '#16a34a';

    return `
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span style="font-family: monospace; font-weight: 700; color: #7f1d1d; font-size: 11px;">#${index + 1} • ${t.taskId || 'TSK-000'}</span>
            <h3 style="margin: 4px 0 2px; font-size: 14px; color: #0f172a; font-weight: 700;">${t.title}</h3>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; color: white; background: ${priorityColor}; text-transform: uppercase;">${t.priority || 'MEDIUM'}</span>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Status: <strong style="color:${t.status === 'COMPLETED' ? '#059669' : '#0f172a'}">${(t.status || 'IN_PROGRESS').replace(/_/g, ' ')}</strong></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 11px; margin-bottom: 10px;">
          <div>
            <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; display: block;">Source Dept & Requester</span>
            <strong style="color: #334155;">${sourceDept}</strong> (${requesterName})
          </div>
          <div>
            <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; display: block;">Target Dept & Assigned Staff</span>
            <strong style="color: #0f172a;">${targetDept}</strong> (${assignees})
          </div>
          <div>
            <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; display: block;">Due Date & Progress</span>
            <strong style="color: #b91c1c;">${t.dueDate || '—'}</strong> | Progress: <strong>${t.progress ?? 0}%</strong>
          </div>
        </div>

        ${t.description ? `<div style="font-size: 11px; color: #334155; line-height: 1.5; margin-bottom: 8px;"><strong>Description & Scope:</strong> ${t.description}</div>` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 6px;">
          <span>Checklist Progress: <strong>${checklistDone}/${checklistTotal} items completed</strong></span>
          <span>Attachments: <strong>${t.attachments?.length || 0} file(s)</strong></span>
        </div>
      </div>
    `;
  }).join('') : '<div style="padding: 30px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 8px;">No tasks found matching this criteria.</div>';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="header">
    <div class="logo-box">LWM</div>
    <div>
      <div class="org-name">Liberation War Museum (মুক্তিযুদ্ধ জাদুঘর)</div>
      <div class="org-sub">Plot 1/1, Sher-e-Bangla Nagar, Agargaon, Dhaka-1207 • Official Task PDF Report</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
    <div>
      <h2 style="font-size: 18px; color: #7f1d1d;">${reportTitle}</h2>
      <div style="font-size: 11px; color: #475569; margin-top: 4px;">
        Report Scope: <strong>${scopeName}</strong> ${departmentName ? `• Department: <strong>${departmentName}</strong>` : ''} • Category: <strong>${filterTypeName}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Generated By: <strong>${generatedBy?.name?.en || generatedBy?.name || 'Authorized User'}</strong></div>
      <div>Designation/Role: <strong>${generatedBy?.designation?.en || generatedBy?.role || 'Authority'}</strong></div>
      <div>Generated On: <strong>${now}</strong></div>
      <div style="margin-top: 4px; font-weight: 700; color: #065f46;">Total Included Tasks: ${tasks.length}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${filterTypeName.toUpperCase()} PARTICULARS & DETAILS (${tasks.length})</div>
    ${tasksHtml}
  </div>

  <div class="signature-row" style="margin-top: 40px;">
    <div class="signature-box">
      <div class="signature-name">${generatedBy?.name?.en || 'Report Generator'}</div>
      <div class="signature-role">${generatedBy?.designation?.en || generatedBy?.role || 'Supervisory Authority'}</div>
      <div class="signature-date">Date: ${now.split(',')[0]}</div>
    </div>
    <div class="signature-box">
      <div class="signature-name">Executive Verification</div>
      <div class="signature-role">Liberation War Museum Directorate</div>
      <div class="signature-date">Official Seal / Signature</div>
    </div>
  </div>

  <div class="footer">
    <span>Liberation War Museum OMS — Confidential Institutional Task Report</span>
    <span>Generated: ${now}</span>
  </div>
</body>
</html>`;

  printHtml(html, `Tasks_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

export const downloadOngoingTasksPdfReport = downloadTasksPdfReport;
