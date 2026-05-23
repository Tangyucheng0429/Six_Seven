import multer from 'multer';

// Use memory storage for quick buffers, perfect for direct uploads to Supabase Storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type: Only images are allowed!'), false);
    }
  }
});
