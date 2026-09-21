import { Router, Response, Request, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthenticatedRequest } from '../auth';
import { db } from '../db';

export const uploadRoutes = Router();

// === Allowed file types ===
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv'
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// === Storage config ===
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error(`File type "${ext}" is not allowed.`));
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error(`MIME type "${file.mimetype}" is not permitted.`));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

// === Multer error handler ===
function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, message: `File too large. Maximum size is 25MB.` });
      return;
    }
    res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    return;
  }
  if (err) {
    res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    return;
  }
  next();
}

// === POST /api/upload (single or multiple files) ===
uploadRoutes.post(
  '/',
  requireAuth,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    upload.array('files', 10)(req as Request, res, (err) => {
      handleMulterError(err, req as Request, res, next);
    });
  },
  (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'No files were uploaded.' });
      return;
    }

    const results = files.map(f => {
      const ext = path.extname(f.originalname).toLowerCase();
      let fileType = 'file';
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) fileType = 'img';
      else if (ext === '.pdf') fileType = 'pdf';
      else if (['.xls', '.xlsx', '.csv'].includes(ext)) fileType = 'xls';
      else if (['.doc', '.docx'].includes(ext)) fileType = 'doc';
      else if (['.ppt', '.pptx'].includes(ext)) fileType = 'ppt';

      return {
        _id: db.generateId('att'),
        name: f.originalname,
        size: f.size,
        type: fileType,
        mimeType: f.mimetype,
        url: `/api/upload/file/${f.filename}`,
        storedFilename: f.filename,
        uploadedBy: req.user!._id,
        uploadedAt: new Date().toISOString()
      };
    });

    res.json({ success: true, data: results });
  }
);

// === GET /uploads/:filename (serve file securely - requires auth) ===
uploadRoutes.get('/file/:filename', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const filename = req.params.filename;

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    res.status(400).json({ success: false, message: 'Invalid filename.' });
    return;
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: 'File not found.' });
    return;
  }

  res.sendFile(filePath);
});
