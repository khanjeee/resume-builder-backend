const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
require('dotenv').config(); // Load environment variables
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function lightenHexColor(hex, percent) {
  let { r, g, b } = hexToRgb(hex);

  r = Math.min(255, r + r * percent / 100);
  g = Math.min(255, g + g * percent / 100);
  b = Math.min(255, b + b * percent / 100);

  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - increase limit for base64 photo
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
initializeDatabase();

// Auth routes
app.use('/api/auth', authRoutes);

// Serve PDF downloads (permissive headers to avoid 403 when frontend fetches as blob)
app.use('/downloads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Disposition', 'attachment'); // Force download
  next();
}, express.static(path.join(__dirname, 'downloads')));

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Auto-discover templates: any .ejs file in templates/ is a valid theme
function getValidThemes() {
  if (!fs.existsSync(templatesDir)) return [];
  return fs.readdirSync(templatesDir)
    .filter((f) => f.endsWith('.ejs'))
    .map((f) => f.replace(/\.ejs$/, ''));
}

// Display names and descriptions for each theme (add new templates here)
const THEME_META = {
  classic: { name: 'Classic', description: 'Professional blue headers' },
  modern: { name: 'Modern', description: 'Teal accent, clean layout' },
  minimal: { name: 'Minimal', description: 'Black & white, minimal' },
  elegant: { name: 'Elegant', description: 'JSON Resume — serif, warm sidebar' },
  flat: { name: 'Flat', description: 'JSON Resume — colored sidebar, flat design' },
  kendall: { name: 'Kendall', description: 'JSON Resume — bold section headers' },
  sidebar: { name: 'Sidebar', description: 'JSON Resume — dark sidebar strip' }
};

// GET /api/themes – list available templates (so frontend can show theme selector)
app.get('/api/themes', (req, res) => {
  const validIds = getValidThemes();
  const themes = validIds.map((id) => ({
    id,
    name: (THEME_META[id] && THEME_META[id].name) || id,
    description: (THEME_META[id] && THEME_META[id].description) || ''
  }));
  res.json({ themes });
});

// Generate Resume Endpoint (HTML template + Puppeteer → PDF)
app.post('/api/generate-resume', authMiddleware, async (req, res) => {
  let browser;
  try {
    const resumeData = req.body;
    const validThemes = getValidThemes();
    const themeKey = validThemes.includes(resumeData.theme) ? resumeData.theme : (validThemes[0] || 'classic');
    const templatePath = path.join(templatesDir, `${themeKey}.ejs`);
    if (!fs.existsSync(templatePath)) {
      return res.status(400).json({ success: false, message: `Theme "${themeKey}" template not found.` });
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    const photoDataUrl = resumeData.photoDataUrl || null;
    const themeColor = (resumeData.themeColor && /^#[0-9A-Fa-f]{6}$/.test(resumeData.themeColor)) ? resumeData.themeColor : '#0d9488';
    const themeColorLight = lightenHexColor(themeColor, 50); // Lighten by 50%
    const html = ejs.render(template, {
      name: resumeData.name || '',
      jobTitle: resumeData.jobTitle || '',
      phone: resumeData.phone || '',
      email: resumeData.email || '',
      location: resumeData.location || '',
      profile: resumeData.profile || '',
      skills: resumeData.skills || [],
      workExperience: resumeData.workExperience || [],
      education: resumeData.education || [],
      languages: resumeData.languages || [],
      photoDataUrl,
      themeColor,
      themeColorLight
    });

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();
    browser = null;

    const fileName = `resume_${Date.now()}.pdf`;
    const filePath = path.join(downloadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    res.json({
      success: true,
      message: 'Resume generated successfully',
      downloadUrl: `/downloads/${fileName}`
    });
  } catch (error) {
    if (browser) try { await browser.close(); } catch (_) {}
    console.error('Error generating resume:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating resume',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Resume Builder API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
