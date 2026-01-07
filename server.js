
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3001;
// 请将此地址改为你服务器的真实公网 IP 或域名
// 如果是在本地测试并使用 ngrok，请填写 ngrok 提供的域名
const HOST = `http://localhost:${PORT}`;

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 确保目录存在
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 Multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'hero-' + uniqueSuffix + path.extname(file.originalname || '.jpg'));
  }
});

const upload = multer({ storage: storage });

/**
 * 核心接口：接收图片并返回 URL
 */
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 500, msg: '没有找到上传的文件' });
  }
  
  const fileUrl = `${HOST}/uploads/${req.file.filename}`;
  console.log('文件已保存:', fileUrl);
  
  res.json({
    code: 200,
    data: { url: fileUrl }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 魔法图床服务器已启动: ${HOST}`);
  console.log(`📸 上传接口: ${HOST}/api/upload`);
});
