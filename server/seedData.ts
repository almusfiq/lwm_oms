import bcrypt from 'bcryptjs';
import { db } from './db';
import { 
  User, Department, Task, TaskRequest, Project, 
  TaskComment, Notification, ActivityLog, Approval, 
  EventItem, Announcement, OfficeDocument 
} from './types';
import { MASTER_PERSONNEL } from './personnelData';

export async function seedDatabase(force = false) {
  const isExistingDb = db.users.length > 0 && db.departments.length > 0;
  if (!force && isExistingDb) {
    const hasCeoDept = db.departments.some(d => d._id === 'dept_ceo' || d.code === 'CEO');
    const hasCeoStaff = db.users.some(u => u._id === 'usr_ceo_jeba');
    const missingPersonalEmails = MASTER_PERSONNEL.some(p => {
      if (!p.personalEmail) return false;
      const u = db.users.find(eu => eu._id === p._id || eu.email.toLowerCase() === p.email.toLowerCase());
      return !u || u.personalEmail !== p.personalEmail;
    });

    if (hasCeoDept && hasCeoStaff && !missingPersonalEmails) {
      console.log(`[Seed] Database already seeded and up-to-date (${db.users.length} users, ${db.departments.length} departments). Skipping.`);
      return;
    }
    console.log('[Seed] Detected missing updates, personal credentials or staff in existing database. Synchronizing updates...');
  }

  console.log('[Seed] Seeding Liberation War Museum workspace data...');
  const defaultPassword = await bcrypt.hash('LWM@2026', 10);

  // 1. Departments
  const departmentsData: Department[] = [
    {
      _id: 'dept_ceo',
      code: 'CEO',
      name: { en: 'CEO Office', bn: 'প্রধান নির্বাহীর দপ্তর' },
      description: 'Office of the Chief Executive Officer, Gallery Guides, AV Memory Centre, IT, and Secretariat.',
      headId: 'usr_ceo',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_admin',
      code: 'ADMIN',
      name: { en: 'Administration', bn: 'প্রশাসন' },
      description: 'Human resources, general office administration, logistics and cafeteria management.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_finance',
      code: 'FINANCE',
      name: { en: 'Finance & Accounts', bn: 'অর্থ ও হিসাব' },
      description: 'Budgeting, financial statements, payroll, audits, and fund management.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_programme',
      code: 'PROGRAMME',
      name: { en: 'Programme', bn: 'কর্মসূচি' },
      description: 'Museum events, memorial commemorations, seminar organization, and Jalladkhana supervision.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_education',
      code: 'EDUCATION',
      name: { en: 'Education Programme', bn: 'শিক্ষা কর্মসূচি' },
      description: 'Outreach programs, school museum bus network, youth training, and educational tours.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_archive',
      code: 'ARCHIVE',
      name: { en: 'Archive & Display', bn: 'আর্কাইভ ও ডিসপ্লে' },
      description: 'Curation, historical artifact collection, gallery display, and preservation.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_research',
      code: 'RESEARCH',
      name: { en: 'Research & Library', bn: 'গবেষণা ও গ্রন্থাগার' },
      description: '1971 war documentation, reference library, academic research publications, and oral history recording.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_maintenance',
      code: 'MAINTENANCE',
      name: { en: 'Maintenance', bn: 'রক্ষণাবেক্ষণ' },
      description: 'Building infrastructure, HVAC cooling systems, electrical, audio-visual technology and equipment.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: 'dept_communications',
      code: 'COMMUNICATIONS',
      name: { en: 'Communications', bn: 'যোগাযোগ ও জনসংযোগ' },
      description: 'Media relations, website, international liaison, press releases, and publications.',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ];

  // 2. Users (Populated directly from MASTER_PERSONNEL matching official organogram and roster)
  const usersData: User[] = MASTER_PERSONNEL.map((p) => ({
    _id: p._id,
    employeeId: p.employeeId,
    uniqueId: p.uniqueId,
    name: p.name,
    email: p.email,
    personalEmail: p.personalEmail,
    alternateEmails: p.alternateEmails,
    password: defaultPassword,
    designation: p.designation,
    departmentId: p.departmentId,
    role: p.role,
    tier: p.tier,
    isActive: p.isActive !== undefined ? p.isActive : true,
    phone: p.phone,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }));

  // Bind Department headIds to corresponding department heads in MASTER_PERSONNEL
  MASTER_PERSONNEL.filter(p => p.role === 'DEPT_HEAD' && p.departmentId).forEach(head => {
    const foundDept = departmentsData.find(dept => dept._id === head.departmentId);
    if (foundDept) {
      foundDept.headId = head._id;
    }
  });

  // 3. Flagship Projects
  const projectsData: Project[] = [
    {
      _id: 'prj_victory_2026',
      projectId: 'PRJ-00001',
      name: 'Victory Day Exhibition 2026: Voices of the Freedom Fighters',
      description: 'Comprehensive annual memorial exhibition celebrating the 55th anniversary of liberation, featuring restored original documents, audio testimonials, new artifact displays, and nationwide school visits.',
      managerId: 'usr_archive_head', // Amena Khatun
      departments: ['dept_archive', 'dept_research', 'dept_education', 'dept_communications', 'dept_finance', 'dept_maintenance'],
      members: ['usr_archive_head', 'usr_archive_1', 'usr_research_head', 'usr_research_1', 'usr_edu_head', 'usr_edu_2', 'usr_comm_head', 'usr_finance_head', 'usr_maint_head'],
      status: 'ACTIVE',
      priority: 'URGENT',
      startDate: '2026-08-01',
      deadline: '2026-12-16',
      progress: 68,
      milestones: [
        { _id: 'm1', name: 'Historical Artifact Selection & Authentication', dueDate: '2026-09-20', status: 'COMPLETED', responsiblePersonId: 'usr_archive_1' },
        { _id: 'm2', name: 'Inter-Departmental Budget & Procurement Approval', dueDate: '2026-09-30', status: 'IN_PROGRESS', responsiblePersonId: 'usr_finance_head' },
        { _id: 'm3', name: 'Curatorial Catalog & Booklet Typesetting', dueDate: '2026-10-25', status: 'PENDING', responsiblePersonId: 'usr_research_head' },
        { _id: 'm4', name: 'Gallery 3 & 4 Lighting and Audio System Installation', dueDate: '2026-11-15', status: 'PENDING', responsiblePersonId: 'usr_maint_head' },
        { _id: 'm5', name: 'National Press Launch & Grand Opening', dueDate: '2026-12-14', status: 'PENDING', responsiblePersonId: 'usr_comm_head' }
      ],
      attachments: [
        { _id: 'att_prj_1', name: 'Victory_Day_2026_Master_Plan.pdf', size: 4520000, type: 'application/pdf', url: '/files/Victory_Day_2026_Master_Plan.pdf', uploadedBy: 'usr_archive_head', uploadedAt: '2026-08-05T10:00:00Z' }
      ],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-09-12T14:30:00.000Z'
    },
    {
      _id: 'prj_mobile_museum',
      projectId: 'PRJ-00002',
      name: 'Nationwide Mobile Museum Outreach (Division Phase 3)',
      description: 'Operating the specialized mobile museum buses across 32 upazilas to deliver interactive history lessons, exhibitions and documentary screenings to rural schools.',
      managerId: 'usr_edu_head',
      departments: ['dept_education', 'dept_admin', 'dept_maintenance'],
      members: ['usr_edu_head', 'usr_edu_2', 'usr_edu_3', 'usr_admin_head', 'usr_maint_3'],
      status: 'ACTIVE',
      priority: 'HIGH',
      startDate: '2026-06-15',
      deadline: '2026-11-30',
      progress: 54,
      milestones: [
        { _id: 'm_bus_1', name: 'Vehicle Mechanics & AC Servicing', dueDate: '2026-07-01', status: 'COMPLETED', responsiblePersonId: 'usr_maint_head' },
        { _id: 'm_bus_2', name: 'District Education Officer Schedule Clearances', dueDate: '2026-08-15', status: 'COMPLETED', responsiblePersonId: 'usr_edu_2' },
        { _id: 'm_bus_3', name: 'Northern Division Tour Delivery', dueDate: '2026-10-15', status: 'IN_PROGRESS', responsiblePersonId: 'usr_edu_3' }
      ],
      attachments: [],
      createdAt: '2026-06-15T09:00:00.000Z',
      updatedAt: '2026-09-10T11:00:00.000Z'
    },
    {
      _id: 'prj_oral_history',
      projectId: 'PRJ-00003',
      name: 'Digitization of 1971 Sector Commander Audio & Eyewitness Testimonies',
      description: 'Preservation and archival digitization of 450 magnetic tape cassettes containing direct witness recordings from 1971 battlefields.',
      managerId: 'usr_research_head',
      departments: ['dept_research', 'dept_archive', 'dept_maintenance'],
      members: ['usr_research_head', 'usr_research_1', 'usr_archive_2', 'usr_maint_1'],
      status: 'ACTIVE',
      priority: 'MEDIUM',
      startDate: '2026-05-01',
      deadline: '2026-12-31',
      progress: 82,
      milestones: [
        { _id: 'm_oral_1', name: 'Cassette Conditioning & Cleaning', dueDate: '2026-06-30', status: 'COMPLETED' },
        { _id: 'm_oral_2', name: 'High-Fidelity 24-bit Flac Digital Capture', dueDate: '2026-09-15', status: 'COMPLETED' },
        { _id: 'm_oral_3', name: 'Metadata & Bengali Transcription Indexing', dueDate: '2026-11-30', status: 'IN_PROGRESS' }
      ],
      attachments: [],
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-09-11T16:00:00.000Z'
    }
  ];

  // 4. Tasks (with Cross-Department linkages!)
  const tasksData: Task[] = [
    {
      _id: 'task_00001',
      taskId: 'TASK-00001',
      title: 'Select and Authenticate Rare Photographs & Artifacts for Gallery 4',
      description: 'Examine Sector 7 guerrilla combat artifacts and high-res photographic negatives. Coordinate with Research to cross-reference donor records before exhibition display.',
      createdBy: 'usr_archive_head',
      requestedBy: 'usr_edu_head', // Cross-department requester!
      assignedTo: ['usr_archive_1'], // Shri Montu Basu
      collaborators: ['usr_research_1', 'usr_archive_2'],
      sourceDepartmentId: 'dept_education',
      targetDepartmentId: 'dept_archive',
      departmentId: 'dept_archive',
      projectId: 'prj_victory_2026',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progress: 75,
      visibility: 'ORGANIZATION',
      startDate: '2026-08-15',
      dueDate: '2026-09-22',
      checklist: [
        { _id: 'chk_1', title: 'Retrieve original archival box #41 from vault', completed: true, completedBy: 'usr_archive_1', completedAt: '2026-08-16T11:00:00Z' },
        { _id: 'chk_2', title: 'Cross-reference accession register with field donor slip', completed: true, completedBy: 'usr_archive_1', completedAt: '2026-08-20T14:30:00Z' },
        { _id: 'chk_3', title: 'Consult Research Associate Sabrina on historical timeline validity', completed: true, completedBy: 'usr_research_1', completedAt: '2026-08-28T09:15:00Z' },
        { _id: 'chk_4', title: 'Draft physical condition assessment and UV protective mounting', completed: false }
      ],
      tags: ['Exhibition', 'Archive', 'Cross-Dept', 'Gallery4'],
      attachments: [
        { _id: 'att_1', name: 'Accession_Inventory_G4.xlsx', size: 142000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: '/files/Accession_Inventory_G4.xlsx', uploadedBy: 'usr_archive_1', uploadedAt: '2026-08-20T14:35:00Z' },
        { _id: 'att_2', name: 'Sector7_Combat_Photo_Scan.jpg', size: 2840000, type: 'image/jpeg', url: '/files/Sector7_Combat_Photo_Scan.jpg', uploadedBy: 'usr_archive_2', uploadedAt: '2026-08-22T16:10:00Z' }
      ],
      requiresApproval: false,
      createdAt: '2026-08-15T09:00:00.000Z',
      updatedAt: '2026-09-12T11:20:00.000Z'
    },
    {
      _id: 'task_00002',
      taskId: 'TASK-00002',
      title: 'Prepare Comprehensive Exhibition Budget & Grant Allocation',
      description: 'Consolidate operational costs across Curation, Lighting/Audio, Publication, and Public Relations for the Victory Day Exhibition.',
      createdBy: 'usr_ceo', // Assigned by CEO!
      requestedBy: 'usr_ceo',
      assignedTo: ['usr_finance_1'], // Md. Abul Kalam
      collaborators: ['usr_finance_head', 'usr_archive_head'],
      sourceDepartmentId: 'dept_admin',
      targetDepartmentId: 'dept_finance',
      departmentId: 'dept_finance',
      projectId: 'prj_victory_2026',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progress: 60,
      visibility: 'ORGANIZATION',
      startDate: '2026-08-25',
      dueDate: '2026-09-28',
      checklist: [
        { _id: 'chk_f1', title: 'Collect departmental quote estimates', completed: true, completedBy: 'usr_finance_1', completedAt: '2026-09-02T10:00:00Z' },
        { _id: 'chk_f2', title: 'Draft itemized breakdown spreadsheet', completed: true, completedBy: 'usr_finance_1', completedAt: '2026-09-08T15:20:00Z' },
        { _id: 'chk_f3', title: 'Review contingency buffer with Finance Manager Md. Kamal Uddin', completed: false },
        { _id: 'chk_f4', title: 'Submit for CEO and Trustee Board sign-off', completed: false }
      ],
      tags: ['Finance', 'Budget', 'Exhibition2026'],
      attachments: [
        { _id: 'att_f1', name: 'Draft_Budget_VictoryDay2026_v2.xlsx', size: 458000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: '/files/Draft_Budget_VictoryDay2026_v2.xlsx', uploadedBy: 'usr_finance_1', uploadedAt: '2026-09-08T15:25:00Z' }
      ],
      requiresApproval: true,
      approvalStatus: 'PENDING',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-09-11T17:40:00.000Z'
    },
    {
      _id: 'task_00003',
      taskId: 'TASK-00003',
      title: 'Historical Documentation Verification of Sector 7 Battle Testimonies',
      description: 'Research team verification of chronological accounts, commander signatures, and location accuracy for the upcoming museum monograph.',
      createdBy: 'usr_archive_head', // Cross-department request converted!
      requestedBy: 'usr_archive_head',
      assignedTo: ['usr_research_1'], // Sabrina Afreen Tonny
      collaborators: ['usr_research_head', 'usr_archive_1'],
      sourceDepartmentId: 'dept_archive',
      targetDepartmentId: 'dept_research',
      departmentId: 'dept_research',
      projectId: 'prj_victory_2026',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      progress: 100,
      visibility: 'ORGANIZATION',
      startDate: '2026-08-10',
      dueDate: '2026-09-05',
      completedAt: '2026-09-04T16:00:00.000Z',
      checklist: [
        { _id: 'chk_r1', title: 'Check War Diary records against Bangladesh Gazette', completed: true, completedBy: 'usr_research_1', completedAt: '2026-08-18T12:00:00Z' },
        { _id: 'chk_r2', title: 'Compile footnote references and catalog cards', completed: true, completedBy: 'usr_research_1', completedAt: '2026-09-03T11:00:00Z' }
      ],
      tags: ['Research', 'Documentation', 'HistoricalVerification'],
      attachments: [
        { _id: 'att_r1', name: 'Verification_Summary_Report.pdf', size: 1200000, type: 'application/pdf', url: '/files/Verification_Summary_Report.pdf', uploadedBy: 'usr_research_1', uploadedAt: '2026-09-04T15:50:00Z' }
      ],
      requiresApproval: false,
      createdAt: '2026-08-10T11:00:00.000Z',
      updatedAt: '2026-09-04T16:00:00.000Z'
    },
    {
      _id: 'task_00004',
      taskId: 'TASK-00004',
      title: 'Outreach School Visits & Bus Tour Schedule for October',
      description: 'Coordinate with 18 selected high schools across Gazipur, Narayanganj and Tangail for educational museum visits and Mobile Bus sessions.',
      createdBy: 'usr_edu_head',
      requestedBy: 'usr_admin_head',
      assignedTo: ['usr_edu_2'], // Ranjan Kumar Singh
      collaborators: ['usr_edu_3', 'usr_admin_2'],
      sourceDepartmentId: 'dept_admin',
      targetDepartmentId: 'dept_education',
      departmentId: 'dept_education',
      projectId: 'prj_mobile_museum',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      progress: 65,
      visibility: 'ORGANIZATION',
      startDate: '2026-09-01',
      dueDate: '2026-09-25',
      checklist: [
        { _id: 'chk_e1', title: 'Send invitation letters to headmasters', completed: true, completedBy: 'usr_edu_2', completedAt: '2026-09-05T14:00:00Z' },
        { _id: 'chk_e2', title: 'Confirm parking logistics and bus fuel schedule with Admin', completed: true, completedBy: 'usr_edu_2', completedAt: '2026-09-10T16:20:00Z' },
        { _id: 'chk_e3', title: 'Print student participatory worksheets and brochures', completed: false }
      ],
      tags: ['Education', 'Outreach', 'MobileMuseum', 'Schools'],
      attachments: [],
      requiresApproval: false,
      createdAt: '2026-09-01T09:30:00.000Z',
      updatedAt: '2026-09-11T10:15:00.000Z'
    },
    {
      _id: 'task_00005',
      taskId: 'TASK-00005',
      title: 'Sound System & Lighting Calibration in Jalladkhana Memorial Hall',
      description: 'Inspect and calibrate automated spotlights, directional speakers, and dehumidifier units ahead of the national martyrs memorial remembrance gathering.',
      createdBy: 'usr_prog_head',
      requestedBy: 'usr_prog_head',
      assignedTo: ['usr_maint_1'], // Abul Hossain Shamim
      collaborators: ['usr_maint_head', 'usr_prog_1'],
      sourceDepartmentId: 'dept_programme',
      targetDepartmentId: 'dept_maintenance',
      departmentId: 'dept_maintenance',
      status: 'IN_REVIEW',
      priority: 'HIGH',
      progress: 90,
      visibility: 'ORGANIZATION',
      startDate: '2026-09-05',
      dueDate: '2026-09-16',
      checklist: [
        { _id: 'chk_m1', title: 'Test main audio mixer & wireless microphone relays', completed: true, completedBy: 'usr_maint_1', completedAt: '2026-09-07T12:00:00Z' },
        { _id: 'chk_m2', title: 'Check backup UPS generator connection', completed: true, completedBy: 'usr_maint_1', completedAt: '2026-09-09T14:40:00Z' },
        { _id: 'chk_m3', title: 'Sound check with historical narrative playback voiceover', completed: true, completedBy: 'usr_maint_1', completedAt: '2026-09-12T17:00:00Z' },
        { _id: 'chk_m4', title: 'Supervisor sign-off from Pramila Biswas', completed: false }
      ],
      tags: ['Maintenance', 'Sound', 'Jalladkhana', 'Memorial'],
      attachments: [],
      requiresApproval: false,
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-12T17:05:00.000Z'
    },
    {
      _id: 'task_00006',
      taskId: 'TASK-00006',
      title: 'Quarterly Audit & Operational Expense Reconciliation (Q2 2026)',
      description: 'Audit ticket booth cash registers, souvenir shop invoices, utility bills, and submit the consolidated reconciliation report.',
      createdBy: 'usr_finance_head',
      requestedBy: 'usr_finance_head',
      assignedTo: ['usr_finance_2'], // Md. Hakimul Islam
      collaborators: ['usr_admin_1', 'usr_admin_5'],
      sourceDepartmentId: 'dept_finance',
      targetDepartmentId: 'dept_finance',
      departmentId: 'dept_finance',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      progress: 40,
      visibility: 'DEPARTMENT', // Private to finance department
      startDate: '2026-08-01',
      dueDate: '2026-09-10', // OVERDUE for demonstration!
      checklist: [
        { _id: 'chk_q1', title: 'Verify daily ticket counter logbooks', completed: true, completedBy: 'usr_finance_2', completedAt: '2026-08-15T10:00:00Z' },
        { _id: 'chk_q2', title: 'Reconcile cafeteria catering bills with Kabir Hossain', completed: true, completedBy: 'usr_finance_2', completedAt: '2026-08-25T11:30:00Z' },
        { _id: 'chk_q3', title: 'Resolve 3 discrepancy vouchers from souvenir gift shop', completed: false },
        { _id: 'chk_q4', title: 'Draft closing balance sheet', completed: false }
      ],
      tags: ['Audit', 'Reconciliation', 'Finance', 'Overdue'],
      attachments: [],
      requiresApproval: true,
      approvalStatus: 'PENDING',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-09-11T16:00:00.000Z'
    },
    {
      _id: 'task_00007',
      taskId: 'TASK-00007',
      title: 'Curatorial Archival Preservation of Martyr Intellectual Personal Belongings',
      description: 'Chemical cleaning, de-acidification, and climate-controlled encasement for newly donated diary pages and eyeglasses from 1971 families.',
      createdBy: 'usr_archive_head',
      requestedBy: 'usr_ceo',
      assignedTo: ['usr_archive_2'], // Rezaul Ahmed
      collaborators: ['usr_archive_1', 'usr_research_2'],
      sourceDepartmentId: 'dept_archive',
      targetDepartmentId: 'dept_archive',
      departmentId: 'dept_archive',
      projectId: 'prj_victory_2026',
      status: 'TODO',
      priority: 'URGENT',
      progress: 10,
      visibility: 'ORGANIZATION',
      startDate: '2026-09-10',
      dueDate: '2026-10-05',
      checklist: [
        { _id: 'chk_c1', title: 'Inspect physical degradation under stereomicroscope', completed: true, completedBy: 'usr_archive_2', completedAt: '2026-09-11T14:00:00Z' },
        { _id: 'chk_c2', title: 'Apply acid-free mylar backing', completed: false },
        { _id: 'chk_c3', title: 'Assign permanent accession barcode', completed: false }
      ],
      tags: ['Archive', 'Conservation', 'Martyrs', 'Urgent'],
      attachments: [],
      requiresApproval: false,
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-11T14:05:00.000Z'
    },
    {
      _id: 'task_00008',
      taskId: 'TASK-00008',
      title: 'Exhibition Promotional Materials & Press Release Drafting',
      description: 'Prepare national press kit, social media announcements, digital banners, and bilingual media advisories for journalists covering the exhibition.',
      createdBy: 'usr_comm_head',
      requestedBy: 'usr_archive_head', // Requested by Archive from Communications!
      assignedTo: ['usr_comm_1'], // Nusrat Jahan
      collaborators: ['usr_comm_head', 'usr_edu_head'],
      sourceDepartmentId: 'dept_archive',
      targetDepartmentId: 'dept_communications',
      departmentId: 'dept_communications',
      projectId: 'prj_victory_2026',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progress: 35,
      visibility: 'ORGANIZATION',
      startDate: '2026-09-08',
      dueDate: '2026-09-30',
      checklist: [
        { _id: 'chk_p1', title: 'Draft English and Bengali press release copy', completed: true, completedBy: 'usr_comm_1', completedAt: '2026-09-10T15:00:00Z' },
        { _id: 'chk_p2', title: 'Select 5 hero artifact photos with curator captions', completed: false },
        { _id: 'chk_p3', title: 'Circulate to CEO for final editorial approval', completed: false }
      ],
      tags: ['Communications', 'Press', 'Media', 'Exhibition'],
      attachments: [],
      requiresApproval: true,
      approvalStatus: 'PENDING',
      createdAt: '2026-09-08T11:00:00.000Z',
      updatedAt: '2026-09-12T14:00:00.000Z'
    }
  ];

  // 5. Task Requests (Showing dynamic cross-department workflows!)
  const taskRequestsData: TaskRequest[] = [
    {
      _id: 'req_00001',
      requestId: 'REQ-00001',
      requesterId: 'usr_edu_3', // Ronika Islam (Education)
      requesterDepartmentId: 'dept_education',
      targetEmployeeId: 'usr_archive_head', // Amena Khatun (Archive)
      targetDepartmentId: 'dept_archive',
      title: 'Request high-resolution digital scans of Sector 2 guerrilla battlefield maps for student booklet',
      description: 'Our team is finalizing the October youth guidebook. We urgently need 600 DPI scans of the hand-drawn maps of the Belonia and Comilla operations.',
      priority: 'HIGH',
      dueDate: '2026-09-24',
      attachments: [],
      status: 'PENDING',
      createdAt: '2026-09-11T11:30:00.000Z',
      updatedAt: '2026-09-11T11:30:00.000Z'
    },
    {
      _id: 'req_00002',
      requestId: 'REQ-00002',
      requesterId: 'usr_research_1', // Sabrina Afreen Tonny (Research)
      requesterDepartmentId: 'dept_research',
      targetEmployeeId: 'usr_finance_head', // Md. Kamal Uddin (Finance)
      targetDepartmentId: 'dept_finance',
      title: 'Urgent Travel Grant & Per Diem Disbursement for Field Interview in Kushtia',
      description: 'Field oral history interview scheduled on Sept 25 with 3 surviving Mukti Bahini commanders in Kushtia. Need per diem release for 2 researchers.',
      priority: 'URGENT',
      dueDate: '2026-09-20',
      attachments: [],
      status: 'PENDING',
      createdAt: '2026-09-12T09:45:00.000Z',
      updatedAt: '2026-09-12T09:45:00.000Z'
    },
    {
      _id: 'req_00003',
      requestId: 'REQ-00003',
      requesterId: 'usr_archive_head',
      requesterDepartmentId: 'dept_archive',
      targetEmployeeId: 'usr_research_1',
      targetDepartmentId: 'dept_research',
      title: 'Historical Documentation Verification of Sector 7 Battle Testimonies',
      description: 'Please cross-reference commander names and exact village locations from Sector 7 guerrilla combat logs.',
      priority: 'MEDIUM',
      dueDate: '2026-09-05',
      attachments: [],
      status: 'CONVERTED_TO_TASK',
      convertedTaskId: 'task_00003',
      responseMessage: 'Accepted and initiated as TASK-00003.',
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T11:00:00.000Z'
    }
  ];

  // 6. Comments
  const commentsData: TaskComment[] = [
    {
      _id: 'cmt_001',
      taskId: 'task_00001',
      userId: 'usr_edu_head',
      content: 'Shri Montu Basu, please ensure we also have the 1971 radio broadcast transcription alongside the photo displays.',
      mentions: ['usr_archive_1'],
      attachments: [],
      createdAt: '2026-08-25T14:00:00.000Z',
      updatedAt: '2026-08-25T14:00:00.000Z'
    },
    {
      _id: 'cmt_002',
      taskId: 'task_00001',
      userId: 'usr_archive_1',
      content: 'Understood, Mr. Satyajit! I have located the transcript in Archival Register #41 and shared the excerpt with Sabrina in Research.',
      mentions: ['usr_edu_head', 'usr_research_1'],
      attachments: [],
      createdAt: '2026-08-26T09:30:00.000Z',
      updatedAt: '2026-08-26T09:30:00.000Z'
    },
    {
      _id: 'cmt_003',
      taskId: 'task_00002',
      userId: 'usr_ceo',
      content: 'Please verify if the audio-visual rental line item can be partially offset by our existing sponsor grant.',
      mentions: ['usr_finance_1'],
      attachments: [],
      createdAt: '2026-09-09T11:15:00.000Z',
      updatedAt: '2026-09-09T11:15:00.000Z'
    }
  ];

  // 7. Notifications
  const notificationsData: Notification[] = [
    {
      _id: 'notif_001',
      recipientId: 'usr_ceo',
      type: 'APPROVAL_REQUESTED',
      title: 'Approval Required: Exhibition Budget',
      message: 'Md. Abul Kalam submitted the draft Victory Day Exhibition Budget for your review.',
      resourceType: 'TASK',
      resourceId: 'task_00002',
      isRead: false,
      createdAt: '2026-09-12T14:00:00.000Z'
    },
    {
      _id: 'notif_002',
      recipientId: 'usr_archive_head',
      type: 'TASK_REQUEST',
      title: 'New Cross-Department Work Request',
      message: 'Ronika Islam from Education Programme requested high-res scans of Sector 2 maps.',
      resourceType: 'TASK_REQUEST',
      resourceId: 'req_00001',
      isRead: false,
      createdAt: '2026-09-11T11:30:00.000Z'
    },
    {
      _id: 'notif_003',
      recipientId: 'usr_finance_head',
      type: 'TASK_OVERDUE',
      title: 'Task Overdue: Q2 Reconciliation',
      message: 'Quarterly Audit & Operational Expense Reconciliation passed its due date on Sept 10.',
      resourceType: 'TASK',
      resourceId: 'task_00006',
      isRead: false,
      createdAt: '2026-09-11T09:00:00.000Z'
    },
    {
      _id: 'notif_004',
      recipientId: 'usr_archive_1',
      type: 'TASK_ASSIGNED',
      title: 'Assigned to Gallery 4 Artifact Curation',
      message: 'You have been assigned as lead officer for TASK-00001.',
      resourceType: 'TASK',
      resourceId: 'task_00001',
      isRead: true,
      createdAt: '2026-08-15T09:05:00.000Z'
    }
  ];

  // 8. Activity Logs
  const activityLogsData: ActivityLog[] = [
    {
      _id: 'act_001',
      actorId: 'usr_ceo',
      action: 'CREATE_TASK',
      module: 'TASKS',
      resourceType: 'TASK',
      resourceId: 'task_00002',
      resourceName: 'Prepare Comprehensive Exhibition Budget',
      description: 'CEO Dr. Sarwar Ali initiated directive TASK-002: "Prepare Comprehensive Exhibition Budget"',
      ipAddress: '192.168.1.10',
      metadata: { priority: 'URGENT', targetDepartment: 'Finance & Accounts' },
      createdAt: '2026-08-25T10:00:00.000Z'
    },
    {
      _id: 'act_002',
      actorId: 'usr_research_1',
      action: 'APPROVE_TASK',
      module: 'TASKS',
      resourceType: 'TASK',
      resourceId: 'task_00003',
      resourceName: 'Historical Documentation Verification',
      description: 'Senior Research Officer completed and verified directive TASK-003',
      ipAddress: '192.168.1.24',
      metadata: { status: 'COMPLETED' },
      createdAt: '2026-09-04T16:00:00.000Z'
    },
    {
      _id: 'act_003',
      actorId: 'usr_archive_1',
      action: 'UPLOAD_DOCUMENT',
      module: 'DOCUMENTS',
      resourceType: 'DOCUMENT',
      resourceId: 'doc_001',
      resourceName: 'Accession_Inventory_G4.xlsx',
      description: 'Uploaded archival document "Accession_Inventory_G4.xlsx"',
      ipAddress: '192.168.1.18',
      metadata: { fileName: 'Accession_Inventory_G4.xlsx', fileSize: '2.4 MB' },
      createdAt: '2026-08-20T14:35:00.000Z'
    },
    {
      _id: 'act_004',
      actorId: 'usr_edu_3',
      action: 'CREATE_TASK_REQUEST',
      module: 'TASKS',
      resourceType: 'TASK_REQUEST',
      resourceId: 'req_00001',
      resourceName: 'Archival Display Request',
      description: 'Submitted cross-department task request to Archives & Records',
      ipAddress: '192.168.1.33',
      metadata: { target: 'Amena Khatun', dept: 'Archives & Records' },
      createdAt: '2026-09-11T11:30:00.000Z'
    },
    {
      _id: 'act_005',
      actorId: 'usr_super_admin',
      action: 'CHANGE_ROLE',
      module: 'SECURITY',
      resourceType: 'USER',
      resourceId: 'usr_archive_1',
      resourceName: 'Tanvir Hossain',
      description: 'Super Admin updated user Tanvir Hossain role permissions to OFFICER',
      ipAddress: '127.0.0.1',
      metadata: { previousRole: 'ASSISTANT_OFFICER', newRole: 'OFFICER' },
      createdAt: '2026-09-12T17:00:00.000Z'
    },
    {
      _id: 'act_006',
      actorId: 'system',
      action: 'FAILED_LOGIN',
      module: 'SECURITY',
      description: 'Failed login attempt for account "guest_user@liberationwarmuseum.org"',
      ipAddress: '103.24.12.99',
      metadata: { reason: 'Invalid password' },
      createdAt: '2026-09-15T08:14:00.000Z'
    },
    {
      _id: 'act_007',
      actorId: 'usr_super_admin',
      action: 'CREATE_EMPLOYEE',
      module: 'USERS',
      resourceType: 'USER',
      resourceId: 'usr_new_001',
      resourceName: 'Kazi Farhana',
      description: 'Super Admin created new employee profile Kazi Farhana (EMP-024)',
      ipAddress: '127.0.0.1',
      metadata: { department: 'Research & Publications', role: 'OFFICER' },
      createdAt: '2026-09-18T14:22:00.000Z'
    }
  ];

  // 9. Approvals
  const approvalsData: Approval[] = [
    {
      _id: 'appr_001',
      requesterId: 'usr_finance_1',
      requesterDepartmentId: 'dept_finance',
      requestType: 'BUDGET_APPROVAL',
      resourceType: 'TASK',
      resourceId: 'task_00002',
      title: 'Approval for Victory Day 2026 Consolidated Operating Budget',
      description: 'Formal sign-off request for BDT 3,450,000 covering gallery retrofitting, catalog publication, public relations, and guest travel.',
      approverId: 'usr_ceo',
      status: 'PENDING',
      createdAt: '2026-09-11T17:00:00.000Z',
      updatedAt: '2026-09-11T17:00:00.000Z'
    },
    {
      _id: 'appr_002',
      requesterId: 'usr_archive_head',
      requesterDepartmentId: 'dept_archive',
      requestType: 'SPECIAL_PROCUREMENT',
      resourceType: 'PROJECT',
      resourceId: 'prj_victory_2026',
      title: 'Import of Archival-Grade UV Absorbing Glass Panes for Gallery 3',
      description: 'Direct procurement requisition for imported Japanese UV99 preservation acrylic panels to safeguard original martyr letters from light degradation.',
      approverId: 'usr_ceo',
      status: 'APPROVED',
      approvedAt: '2026-09-02T16:00:00.000Z',
      reason: 'Necessary for preservation standards and approved under capital conservation budget.',
      createdAt: '2026-08-28T10:00:00.000Z',
      updatedAt: '2026-09-02T16:00:00.000Z'
    }
  ];

  // 10. Events
  const eventsData: EventItem[] = [
    {
      _id: 'evt_001',
      name: 'All-Staff Quarterly Review with CEO & Board of Trustees',
      description: 'Quarterly review of institutional metrics, progress on exhibition milestones, and staff welfare announcements.',
      date: '2026-09-26',
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      location: 'Museum Main Auditorium, Agargaon, Dhaka',
      organizerId: 'usr_ceo',
      departments: ['dept_admin', 'dept_finance', 'dept_programme', 'dept_education', 'dept_archive', 'dept_research', 'dept_maintenance', 'dept_communications'],
      participants: ['usr_ceo', 'usr_admin_head', 'usr_finance_head', 'usr_prog_head', 'usr_edu_head', 'usr_archive_head', 'usr_research_head', 'usr_maint_head', 'usr_comm_head'],
      associatedTaskIds: ['task_00002', 'task_00006'],
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    },
    {
      _id: 'evt_002',
      name: 'Memorial Lecture & 1971 Archive Exhibition Preview',
      description: 'Keynote memorial address by international historians followed by guided walkthrough of Gallery 4 displays.',
      date: '2026-10-14',
      startTime: '04:00 PM',
      endTime: '07:30 PM',
      location: 'Gallery 4 & Memorial Courtyard',
      organizerId: 'usr_archive_head',
      departments: ['dept_archive', 'dept_research', 'dept_programme'],
      participants: ['usr_archive_head', 'usr_archive_1', 'usr_research_head'],
      associatedTaskIds: ['task_00001', 'task_00005'],
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z'
    }
  ];

  // 11. Announcements
  const announcementsData: Announcement[] = [
    {
      _id: 'ann_001',
      title: 'Inter-Departmental Collaboration Guidelines for Victory Day 2026 Preparation',
      content: 'All departments are requested to prioritize cross-department work requests submitted via the LWM Office Management System. Please ensure requests are accepted or clarified within 48 hours to prevent exhibition milestone bottlenecks.',
      audience: 'EVERYONE',
      authorId: 'usr_ceo',
      priority: 'HIGH',
      publishedDate: '2026-09-01',
      attachments: [],
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      _id: 'ann_002',
      title: 'HVAC Maintenance and Gallery Temperature Stabilization Schedule',
      content: 'Maintenance will conduct scheduled filter cleanings and chiller unit tests this Saturday from 7:00 AM to 10:00 AM. Access to Archive Vault 2 will remain restricted during testing.',
      audience: 'EVERYONE',
      authorId: 'usr_maint_head',
      priority: 'MEDIUM',
      publishedDate: '2026-09-10',
      attachments: [],
      createdAt: '2026-09-10T11:00:00.000Z'
    }
  ];

  // 12. Office Documents
  const documentsData: OfficeDocument[] = [
    {
      _id: 'doc_001',
      name: 'Victory_Day_2026_Master_Plan.pdf',
      type: 'application/pdf',
      size: 4520000,
      url: '/files/Victory_Day_2026_Master_Plan.pdf',
      resourceType: 'PROJECT',
      resourceId: 'prj_victory_2026',
      departmentId: 'dept_archive',
      uploadedBy: 'usr_archive_head',
      isConfidential: false,
      createdAt: '2026-08-05T10:00:00.000Z'
    },
    {
      _id: 'doc_002',
      name: 'Accession_Inventory_G4.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 142000,
      url: '/files/Accession_Inventory_G4.xlsx',
      resourceType: 'TASK',
      resourceId: 'task_00001',
      departmentId: 'dept_archive',
      uploadedBy: 'usr_archive_1',
      isConfidential: false,
      createdAt: '2026-08-20T14:35:00.000Z'
    },
    {
      _id: 'doc_003',
      name: 'Q2_Financial_Audit_Guidelines.pdf',
      type: 'application/pdf',
      size: 890000,
      url: '/files/Q2_Financial_Audit_Guidelines.pdf',
      resourceType: 'DEPARTMENT',
      departmentId: 'dept_finance',
      uploadedBy: 'usr_finance_head',
      isConfidential: true,
      createdAt: '2026-08-01T09:30:00.000Z'
    }
  ];

  // Persist data into db (which auto-saves to MongoDB)
  if (!force && isExistingDb) {
    // Add missing departments
    departmentsData.forEach(d => {
      if (!db.departments.some(existing => existing._id === d._id || (existing.code && existing.code.toUpperCase() === d.code.toUpperCase()))) {
        db.departments.push(d);
      }
    });

    // Add missing users & update personalEmail, alternateEmails, and CEO departmentId
    usersData.forEach(u => {
      const existing = db.users.find(eu => eu._id === u._id || eu.email.toLowerCase() === u.email.toLowerCase());
      if (!existing) {
        db.users.push(u);
      } else {
        if (u.personalEmail) existing.personalEmail = u.personalEmail;
        if (u.alternateEmails) existing.alternateEmails = u.alternateEmails;
        if (u._id === 'usr_ceo' && !existing.departmentId) {
          existing.departmentId = 'dept_ceo';
        }
      }
    });

    await db.save();
    console.log(`[Seed] Synchronized updates to existing database: ${db.users.length} total users, ${db.departments.length} total departments.`);
  } else {
    db.setRawData({
      users: usersData,
      departments: departmentsData,
      tasks: tasksData,
      taskRequests: taskRequestsData,
      projects: projectsData,
      comments: commentsData,
      notifications: notificationsData,
      activityLogs: activityLogsData,
      approvals: approvalsData,
      events: eventsData,
      announcements: announcementsData,
      documents: documentsData
    });
    console.log(`[Seed] Successfully seeded ${usersData.length} users, ${departmentsData.length} departments, ${tasksData.length} tasks, ${taskRequestsData.length} requests, ${projectsData.length} projects into MongoDB!`);
  }

  await ensureSuperAdminUser();
}

export async function ensureSuperAdminUser() {
  const defaultPassword = await bcrypt.hash('LWM@2026', 10);
  let superAdmin = db.users.find(u => u._id === 'usr_super_admin' || u.email === 'superadmin@lwmbd.org' || u.employeeId === 'SUPER-ADMIN');

  if (!superAdmin) {
    console.log('[Seed] Inserting Super Admin user (superadmin@lwmbd.org)...');
    superAdmin = {
      _id: 'usr_super_admin',
      employeeId: 'SUPER-ADMIN',
      uniqueId: 'LWM-SA001',
      name: { en: 'Super Admin', bn: 'সুপার অ্যাডমিন' },
      email: 'superadmin@lwmbd.org',
      password: defaultPassword,
      designation: { en: 'System Super Administrator', bn: 'সিস্টেম সুপার প্রশাসক' },
      role: 'SUPER_ADMIN',
      tier: 'SUPER_ADMIN',
      isActive: true,
      phone: '+880 1700-000000',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.users.push(superAdmin);
    await db.save();
  } else {
    superAdmin.role = 'SUPER_ADMIN';
    superAdmin.tier = 'SUPER_ADMIN';
    superAdmin.password = defaultPassword;
    await db.save();
  }
}
