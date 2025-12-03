require('dotenv').config();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// ---------- S3 + UPLOAD SETUP ----------
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-2';

const s3 = new S3Client({ region: AWS_REGION });

// store uploaded files in memory, then push to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

async function uploadToS3(file) {
  if (!file) return null;

  // if no bucket configured (e.g. local dev), skip S3
  if (!S3_BUCKET) {
    console.log('No S3_BUCKET set; skipping S3 upload.');
    return null;
  }

  const safeName = file.originalname.replace(/\s+/g, '_');
  const key = `users/${Date.now()}_${safeName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });

  await s3.send(command);

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { upload, uploadToS3 };
