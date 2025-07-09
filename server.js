const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
const upload = multer();

app.post('/live-translate', upload.single('audio'), async (req, res) => {
  try {
    // هنا يمكنك إرسال الصوت إلى AssemblyAI أو أي خدمة ترجمة
    // مؤقتاً أرجع نص تجريبي
    res.json({ translatedText: "This is a test translation." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server running on port', PORT));
