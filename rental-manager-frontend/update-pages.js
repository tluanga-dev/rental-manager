#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pages that should remain public (no auth required)
const publicPages = [
  'login/page.tsx',
  'register/page.tsx',
  'forgot-password/page.tsx',
  'reset-password/page.tsx'
];

// Get all page.tsx files
function getAllPageFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllPageFiles(fullPath));
    } else if (item === 'page.tsx') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function updatePageFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has AuthConnectionGuard
    if (content.includes('AuthConnectionGuard')) {
      console.log(`Skipping ${filePath} - already updated`);
      return;
    }
    
    const isPublicPage = publicPages.some(publicPage => filePath.includes(publicPage));
    const requireAuth = !isPublicPage;
    
    // Add import if not present
    let updatedContent = content;
    if (!content.includes("import { AuthConnectionGuard }")) {
      // Find the first import statement and add our import after it
      const importRegex = /^import.*from.*['"];$/m;
      const match = content.match(importRegex);
      if (match) {
        const firstImportIndex = content.indexOf(match[0]);
        const afterFirstImport = firstImportIndex + match[0].length;
        updatedContent = 
          content.substring(0, afterFirstImport) + 
          "\nimport { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';" +
          content.substring(afterFirstImport);
      } else {
        // No imports found, add at the top after 'use client' if present
        if (content.includes("'use client';")) {
          updatedContent = content.replace(
            "'use client';",
            "'use client';\n\nimport { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';"
          );
        } else {
          updatedContent = 
            "import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';\n" + 
            content;
        }
      }
    }
    
    // Find the main return statement and wrap it
    const returnRegex = /return\s*\(\s*(<[^>]*>[\s\S]*<\/[^>]*>|\S+)/;
    const returnMatch = updatedContent.match(returnRegex);
    
    if (returnMatch) {
      const returnContent = returnMatch[1];
      
      // Check if it's already wrapped with a guard component
      if (returnContent.includes('<ProtectedRoute') || returnContent.includes('<AuthConnectionGuard')) {
        console.log(`Skipping ${filePath} - already has guard component`);
        return;
      }
      
      // Extract the JSX content between return ( and );
      const returnStart = updatedContent.indexOf('return (') + 8;
      const jsxContent = extractJSXContent(updatedContent.substring(returnStart));
      
      if (jsxContent) {
        const wrappedContent = `
    <AuthConnectionGuard requireAuth={${requireAuth}} showOfflineAlert={true}>
      ${jsxContent.trim()}
    </AuthConnectionGuard>`;
        
        updatedContent = updatedContent.replace(
          `return (\n${jsxContent}`,
          `return (${wrappedContent}`
        );
      }
    }
    
    fs.writeFileSync(filePath, updatedContent);
    console.log(`Updated ${filePath}`);
    
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

function extractJSXContent(content) {
  let depth = 0;
  let start = -1;
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    
    if (char === '<') {
      if (start === -1) start = i;
      depth++;
    } else if (char === '>') {
      // Continue
    } else if (char === '<' && content[i + 1] === '/') {
      depth--;
      if (depth === 0) {
        // Find the end of this closing tag
        let j = i;
        while (j < content.length && content[j] !== '>') {
          j++;
        }
        return content.substring(start, j + 1);
      }
    }
    
    i++;
  }
  
  return null;
}

// Main execution
const appDir = '/Users/tluanga/current_work/rental-manager/rental-manager-frontend/src/app';
const pageFiles = getAllPageFiles(appDir);

console.log(`Found ${pageFiles.length} page files to update:`);

pageFiles.forEach(file => {
  console.log(`Processing: ${file.replace(appDir, '')}`);
  updatePageFile(file);
});

console.log('Update complete!');
