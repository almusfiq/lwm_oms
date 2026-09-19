import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';
import { OfficeDocument } from '../types';

export const documentRoutes = Router();

documentRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, resourceType } = req.query;

  let list = [...db.documents];

  // Confidentiality filter: if confidential, only user in same department or CEO/Trustee can view
  const userDept = req.user?.departmentId;
  const isExec = req.user?.role === 'CEO' || req.user?.role === 'TRUSTEE';

  list = list.filter(doc => {
    if (!doc.isConfidential) return true;
    if (isExec) return true;
    return doc.departmentId === userDept || doc.uploadedBy === req.user?._id;
  });

  if (departmentId && typeof departmentId === 'string') {
    list = list.filter(d => d.departmentId === departmentId);
  }

  if (resourceType && typeof resourceType === 'string') {
    list = list.filter(d => d.resourceType === resourceType);
  }

  const populated = list.map(d => {
    const uploader = db.users.find(u => u._id === d.uploadedBy);
    const dept = d.departmentId ? db.departments.find(dept => dept._id === d.departmentId) : null;
    return {
      ...d,
      uploader: uploader ? sanitizeUser(uploader) : null,
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null
    };
  });

  res.json({ success: true, data: populated });
});

documentRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, type, size, url, resourceType = 'GENERAL', resourceId, departmentId, isConfidential } = req.body;
  if (!name || !url) {
    res.status(400).json({ success: false, message: 'Document name and url are required' });
    return;
  }

  const newDoc: OfficeDocument = {
    _id: db.generateId('doc'),
    name,
    type: type || 'application/pdf',
    size: size || 1024,
    url,
    resourceType,
    resourceId,
    departmentId: departmentId || req.user?.departmentId,
    uploadedBy: req.user!._id,
    isConfidential: Boolean(isConfidential),
    createdAt: new Date().toISOString()
  };

  db.documents.unshift(newDoc);
  db.save();
  res.status(201).json({ success: true, data: newDoc });
});
