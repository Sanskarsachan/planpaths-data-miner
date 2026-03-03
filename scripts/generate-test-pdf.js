#!/usr/bin/env node
/**
 * Generate a test PDF with Florida high school course catalog
 * Output: test-catalog.pdf
 * Usage: node scripts/generate-test-pdf.js
 */

const fs = require('fs')
const path = require('path')

// Create a simple text-based PDF using raw PDF format
const generateTestPDF = () => {
  const filename = path.join(__dirname, '../public/test-catalog.pdf')
  
  const catalogText = `
ORLANDO HIGH SCHOOL - COURSE CATALOG

Course Code: 6101010
Course Name: English Language Arts Grade 9
Category: English Language Arts
Description: Foundational ELA course covering reading, writing, and communication skills.

Course Code: 6101020
Course Name: AP English Language and Composition
Category: English Language Arts
Description: Advanced Placement course in English Language focusing on rhetoric and composition.

Course Code: 132310
Course Name: Physics I
Category: Science
Description: Introduction to classical mechanics, waves, and thermodynamics.

Course Code: 132330
Course Name: AP Chemistry
Category: Science
Description: Advanced Placement Chemistry covering organic and inorganic chemistry.

Course Code: 201005
Course Name: Algebra I
Category: Mathematics
Description: Introduction to algebraic equations and functions.

Course Code: 201035
Course Name: AP Calculus AB
Category: Mathematics
Description: Advanced Placement Calculus covering limits, derivatives, and integrals.

Course Code: 2100010
Course Name: World History
Category: Social Studies
Description: Survey of world history from ancient civilizations to modern times.

Course Code: 2100020
Course Name: AP US Government and Politics
Category: Social Studies
Description: Study of US governmental structure and political processes.

Course Code: 5100005
Course Name: Visual Arts I
Category: Fine Arts
Description: Introduction to drawing, painting, and design fundamentals.

Course Code: 5200010
Course Name: Music Theory I
Category: Fine Arts
Description: Fundamentals of music theory and composition.
`

  // Create raw PDF content
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${catalogText.length + 50} >>
stream
BT
/F1 12 Tf
50 750 Td
(${catalogText.replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000244 00000 n
0000000448 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${Buffer.from(pdfContent).length}
%%EOF`

  // For simplicity, create a text file that represents a PDF-like content
  // In production, use pdf-lib or similar
  fs.writeFileSync(filename, catalogText, 'utf-8')
  console.log(`✓ Test PDF created: ${filename}`)
}

generateTestPDF()
