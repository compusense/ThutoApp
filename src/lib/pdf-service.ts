import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function getIndefiniteArticle(noun: string): string {
  // Simple check for vowel start (a, e, i, o, u)
  return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

export interface LetterData {
  recipientName: string;
  subject: string;
  content: string;
  date?: string;
  type?: 'general' | 'confirmation';
  // Confirmation specific fields
  employeeName?: string;
  idNumber?: string;
  position?: string;
  startDate?: string;
  employmentType?: string;
  expiryDate?: string;
  salaryScale?: string;
  postalAddress?: string;
  physicalAddress?: string;
  houseNumber?: string;
  schoolName?: string;
  schoolHeadName?: string;
  destinationAddress?: string;
}

/**
 * Generates a merged PDF by overlaying text onto a letterhead background.
 * @param backgroundPdfUrl The URL of the letterhead PDF stored in Firebase Storage.
 * @param letterData The data for the letter (recipient, subject, content).
 * @returns A Blob containing the generated PDF.
 */
export async function generateMergedPDF(
  backgroundPdfUrl: string,
  letterData: LetterData
): Promise<Blob> {
  // Fetch the background PDF
  const response = await fetch(backgroundPdfUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch letterhead PDF');
  }
  const existingPdfBytes = await response.arrayBuffer();

  // Load the document
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  if (letterData.type === 'confirmation') {
    return generateConfirmationLayout(pdfDoc, letterData);
  }

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Embed the font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = firstPage.getSize();
  const marginX = 50;
  let currentY = 650; // Starting Y coordinate as requested

  // Draw Date
  const dateStr = letterData.date || new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  firstPage.drawText(dateStr, {
    x: width - 150,
    y: 650,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Draw Destination Address
  firstPage.drawText(letterData.destinationAddress || 'To whom it may concern', {
    x: marginX,
    y: 620,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });

  firstPage.drawText('Dear Sir/ Madam', {
    x: marginX,
    y: 600,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Draw Subject
  const subjectText = letterData.subject.toUpperCase();
  const subjectWidth = boldFont.widthOfTextAtSize(subjectText, 12);
  firstPage.drawText(subjectText, {
    x: (width - subjectWidth) / 2,
    y: 560,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  firstPage.drawLine({
    start: { x: (width - subjectWidth) / 2, y: 558 },
    end: { x: (width - subjectWidth) / 2 + subjectWidth, y: 558 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  currentY = 530;

  // Draw Content (simplified line wrapping)
  const fontSize = 11;
  const maxWidth = width - marginX * 2;
  const lines = wrapText(letterData.content, maxWidth, font, fontSize);

  for (const line of lines) {
    if (currentY < 150) break;
    firstPage.drawText(line, {
      x: marginX,
      y: currentY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
    currentY -= 15;
  }

  // Draw Signature
  currentY -= 40;
  firstPage.drawLine({
    start: { x: marginX, y: currentY },
    end: { x: marginX + 150, y: currentY },
    thickness: 0.5,
  });
  currentY -= 15;
  firstPage.drawText(letterData.schoolHeadName || 'School Head', {
    x: marginX,
    y: currentY,
    size: 11,
    font: boldFont,
  });
  currentY -= 15;
  firstPage.drawText('School Head', {
    x: marginX,
    y: currentY,
    size: 11,
    font: font,
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

async function generateConfirmationLayout(pdfDoc: PDFDocument, data: LetterData): Promise<Blob> {
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width } = firstPage.getSize();
  const marginX = 50;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Date (Top Right)
  const dateStr = data.date || new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  firstPage.drawText(dateStr, {
    x: width - 150,
    y: 650,
    size: 11,
    font: font,
  });

  // 2. Destination (Top Left)
  firstPage.drawText(data.destinationAddress || 'To whom it may concern', {
    x: marginX,
    y: 620,
    size: 11,
    font: font,
  });
  firstPage.drawText('Dear Sir/ Madam', {
    x: marginX,
    y: 600,
    size: 11,
    font: font,
  });

  // 3. Subject (Centered, Bold, Underlined)
  const subjectText = `CONFIRMATION OF EMPLOYMENT – ${data.employeeName?.toUpperCase()}`;
  const subjectWidth = boldFont.widthOfTextAtSize(subjectText, 11);
  const subjectX = (width - subjectWidth) / 2;
  firstPage.drawText(subjectText, {
    x: subjectX,
    y: 560,
    size: 11,
    font: boldFont,
  });
  firstPage.drawLine({
    start: { x: subjectX, y: 558 },
    end: { x: subjectX + subjectWidth, y: 558 },
    thickness: 1,
  });

  // 4. Main Paragraph
  const article = getIndefiniteArticle(data.position || '');
  const mainParagraph = `This letter serves to confirm that ${data.employeeName} (ID Number: ${data.idNumber}) is currently employed as ${article} ${data.position} at ${data.schoolName || 'the Ministry of Child Welfare and Basic Education'} since ${data.startDate}.`;
  const lines = wrapText(mainParagraph, width - marginX * 2, font, 11);
  let currentY = 530;
  for (const line of lines) {
    firstPage.drawText(line, { x: marginX, y: currentY, size: 11, font: font });
    currentY -= 15;
  }

  // 5. Employment Details Header
  currentY -= 10;
  firstPage.drawText('We wish to confirm the following employment Details:', {
    x: marginX,
    y: currentY,
    size: 11,
    font: font,
  });
  currentY -= 25;

  // 6. Bullet Points
  const natureOfEmployment = data.employmentType === 'Contract' && data.expiryDate
    ? `Contract (Expiry: ${data.expiryDate})`
    : data.employmentType;

  const bulletPoints = [
    { label: 'Present Position', value: data.position?.toUpperCase() },
    { label: 'Nature of Employment', value: natureOfEmployment },
    { label: 'Identity Number', value: data.idNumber },
    { label: 'Postal Address', value: data.postalAddress },
    { label: 'Physical Address', value: data.physicalAddress },
    { label: 'House Number', value: data.houseNumber },
    { label: 'Salary Scale', value: data.salaryScale },
  ];

  for (const bp of bulletPoints) {
    if (!bp.value) continue;
    // Draw bullet
    firstPage.drawCircle({ x: marginX + 10, y: currentY + 3, size: 2, color: rgb(0, 0, 0) });
    // Draw Label: Value
    firstPage.drawText(`${bp.label}: ${bp.value}`, {
      x: marginX + 25,
      y: currentY,
      size: 11,
      font: font,
    });
    currentY -= 20;
  }

  // 7. Closing
  currentY -= 10;
  const closingText = 'Should you require any further verification, please do not hesitate to contact us.';
  firstPage.drawText(closingText, { x: marginX, y: currentY, size: 11, font: font });
  currentY -= 20;
  firstPage.drawText('Yours Sincerely', { x: marginX, y: currentY, size: 11, font: font });

  // 8. Signature Block (Left Aligned)
  currentY -= 40;
  firstPage.drawLine({
    start: { x: marginX, y: currentY },
    end: { x: marginX + 150, y: currentY },
    thickness: 0.5,
  });
  currentY -= 15;
  firstPage.drawText(data.schoolHeadName || 'School Head', {
    x: marginX,
    y: currentY,
    size: 11,
    font: boldFont,
  });
  currentY -= 15;
  firstPage.drawText('School Head', {
    x: marginX,
    y: currentY,
    size: 11,
    font: font,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Simple text wrapping function.
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}
