import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MASTER_PERSONNEL } from '../server/personnelData';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lwm-oms';

async function syncAll() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected successfully!');

  const defaultPasswordHash = await bcrypt.hash('LWM@2026', 10);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  const usersCollection = db.collection('users');

  // Remove secondaryEmail from all existing user documents in MongoDB
  console.log('Removing secondaryEmail / alias emails from all database records...');
  await usersCollection.updateMany({}, { $unset: { secondaryEmail: 1 } });

  console.log(`Synchronizing ${MASTER_PERSONNEL.length} personnel records...`);

  for (const person of MASTER_PERSONNEL) {
    const updateDoc = {
      employeeId: person.employeeId,
      uniqueId: person.uniqueId,
      name: person.name,
      email: person.email,
      designation: person.designation,
      role: person.role,
      roleId: person.role,
      tier: person.tier || person.role,
      departmentId: person.departmentId,
      isActive: person.isActive !== undefined ? person.isActive : true,
      phone: person.phone || '+880 1700-000000',
      updatedAt: new Date().toISOString()
    };

    // Find by _id, uniqueId, employeeId, or email
    const existing = await usersCollection.findOne({
      $or: [
        { _id: person._id },
        { uniqueId: person.uniqueId },
        { employeeId: person.employeeId },
        { email: person.email }
      ]
    });

    if (existing) {
      await usersCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...updateDoc,
            password: existing.password || defaultPasswordHash,
            passwordHash: existing.passwordHash || defaultPasswordHash
          },
          $unset: {
            secondaryEmail: 1
          }
        }
      );
      console.log(`✓ Updated: [${person.employeeId}] ${person.name.en} (${person.name.bn}) -> ${person.email}`);
    } else {
      await usersCollection.insertOne({
        _id: person._id,
        ...updateDoc,
        password: defaultPasswordHash,
        passwordHash: defaultPasswordHash,
        createdAt: new Date().toISOString()
      });
      console.log(`+ Inserted: [${person.employeeId}] ${person.name.en} (${person.name.bn}) -> ${person.email}`);
    }
  }

  // Generate CREDENTIALS.md (Single Email, No Alias)
  console.log('Generating updated CREDENTIALS.md (Single Email, No Alias)...');
  let md = '# Liberation War Museum (LWM) OMS — User Credentials Directory\n\n';
  md += '> **Default Password for All Accounts**: `LWM@2026`\n';
  md += `> **Total Registered Personnel**: ${MASTER_PERSONNEL.length}\n`;
  md += '> **Authentication**: Each employee has exactly one official email address for login. They can also log in using their Employee ID or Unique ID with the password `LWM@2026`.\n\n';

  // Group by category
  const categories = Array.from(new Set(MASTER_PERSONNEL.map(p => p.category)));

  categories.forEach((cat, idx) => {
    const group = MASTER_PERSONNEL.filter(p => p.category === cat);
    md += `## ${idx + 1}. ${cat} (${group.length})\n\n`;
    md += '| # | English Name | Bengali Name (বাংলা নাম) | Designation | Role | Employee ID | Email (Login ID) | Default Password |\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
    group.forEach((u, i) => {
      md += `| ${i + 1} | **${u.name.en}** | ${u.name.bn} | ${u.designation.en} | \`${u.role}\` | \`${u.employeeId}\` | \`${u.email}\` | \`LWM@2026\` |\n`;
    });
    md += '\n';
  });

  fs.writeFileSync('CREDENTIALS.md', md, 'utf8');

  // Generate CREDENTIALS.txt (Single Email, No Alias)
  console.log('Generating updated CREDENTIALS.txt (Single Email, No Alias)...');
  let txt = '========================================================================================\n';
  txt += '   LIBERATION WAR MUSEUM (LWM) OMS — CREDENTIALS DIRECTORY\n';
  txt += '   DEFAULT SYSTEM PASSWORD FOR ALL ACCOUNTS: LWM@2026\n';
  txt += '========================================================================================\n\n';

  categories.forEach(cat => {
    const group = MASTER_PERSONNEL.filter(p => p.category === cat);
    txt += `----------------------------------------------------------------------------------------\n`;
    txt += `--- ${cat.toUpperCase()} (${group.length} Personnel) ---\n`;
    txt += `----------------------------------------------------------------------------------------\n`;
    group.forEach(u => {
      txt += `Name:         ${u.name.en} / ${u.name.bn}\n`;
      txt += `Designation:  ${u.designation.en} (${u.designation.bn})\n`;
      txt += `Role / Tier:  ${u.role} (${u.tier || u.role})\n`;
      txt += `Employee ID:  ${u.employeeId} | Unique ID: ${u.uniqueId}\n`;
      txt += `Email:        ${u.email}\n`;
      txt += `Password:     LWM@2026\n`;
      txt += `----------------------------------------------------------------------------------------\n`;
    });
    txt += '\n';
  });

  fs.writeFileSync('CREDENTIALS.txt', txt, 'utf8');

  await mongoose.disconnect();
  console.log('ALL SYNCS AND CREDENTIAL FILES GENERATED SUCCESSFULLY (NO ALIAS EMAILS)!');
}

syncAll().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
