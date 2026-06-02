const sharp = require('sharp');
const fs = require('fs');
const feather = require('feather-icons');

const SIZE = 160;
const color = '#4A90D9';
const baseSVG = feather.icons.home.toSvg({ width: 24, height: 24 });

const styles = [
  [
    'A-细线',
    baseSVG
      .replace(/stroke-width="[^"]*"/, 'stroke-width="1.2"')
      .replace(/stroke="[^"]*"/, 'stroke="' + color + '"')
      .replace(/fill="[^"]*"/, 'fill="none"')
  ],
  [
    'B-粗线',
    baseSVG
      .replace(/stroke-width="[^"]*"/, 'stroke-width="2.5"')
      .replace(/stroke="[^"]*"/, 'stroke="' + color + '"')
      .replace(/fill="[^"]*"/, 'fill="none"')
  ],
  [
    'C-加粗',
    baseSVG
      .replace(/stroke-width="[^"]*"/, 'stroke-width="3.5"')
      .replace(/stroke="[^"]*"/, 'stroke="' + color + '"')
      .replace(/fill="[^"]*"/, 'fill="none"')
  ],
  [
    'D-实心',
    baseSVG
      .replace(/stroke-width="[^"]*"/g, '')
      .replace(/stroke="[^"]*"/, 'stroke="none"')
      .replace(/fill="[^"]*"/, 'fill="' + color + '"')
  ]
];

async function go() {
  for (const [label, svg] of styles) {
    const wrapped =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      SIZE +
      '" height="' +
      SIZE +
      '" viewBox="0 0 24 24">' +
      svg.replace(/<svg[^>]*>/g, '').replace(/<\/svg>/g, '') +
      '</svg>';
    const buf = await sharp(Buffer.from(wrapped)).png().toBuffer();
    fs.writeFileSync('images/preview/home-' + label + '.png', buf);
    console.log('OK', label, buf.length + 'b');
  }
}
go().catch((e) => console.error(e));
