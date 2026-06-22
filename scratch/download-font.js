const http = require('https');
const fs = require('fs');
const path = require('path');

const fontUrl = 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Regular.ttf';
const outputPath = path.join(__dirname, '..', 'client', 'src', 'assets', 'font.js');

console.log('Downloading Roboto-Regular.ttf...');
http.get(fontUrl, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to download font: ' + res.statusCode);
    return;
  }
  const data = [];
  res.on('data', (chunk) => data.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(data);
    const base64 = buffer.toString('base64');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const code = `// Roboto-Regular.ttf base64 encoded
export const ROBOTO_FONT_BASE64 = '${base64}';
`;
    fs.writeFileSync(outputPath, code);
    console.log('Font successfully saved to: ' + outputPath);
  });
}).on('error', (err) => {
  console.error('Error downloading font:', err);
});
