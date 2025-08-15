#!/usr/bin/env node

/**
 * Validation script for DocuGen MCP Server
 * Checks that everything is properly configured before publishing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}

function warning(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

console.log('🔍 Validating DocuGen MCP Server...\n');

// Check package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));

if (packageJson.bin && packageJson.bin['docugen-mcp']) {
  success('package.json has bin field configured');
} else {
  error('package.json missing bin field for npx execution');
}

if (packageJson.type === 'module') {
  success('package.json configured as ES module');
} else {
  error('package.json should have "type": "module"');
}

// Check build output
if (fs.existsSync(path.join(PROJECT_ROOT, 'build', 'server.js'))) {
  success('Build output exists');
  
  // Check shebang
  const serverFile = fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'server.js'), 'utf-8');
  if (serverFile.startsWith('#!/usr/bin/env node')) {
    success('Server file has shebang');
  } else {
    warning('Server file missing shebang (might not execute directly)');
  }
} else {
  error('Build output missing - run npm run build');
}

// Check templates
const templatesDir = path.join(PROJECT_ROOT, 'templates', 'standard');
if (fs.existsSync(templatesDir)) {
  const templates = [];
  
  function findTemplates(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        findTemplates(fullPath);
      } else if (file.endsWith('.json')) {
        templates.push(file);
      }
    }
  }
  
  findTemplates(templatesDir);
  
  if (templates.length > 0) {
    success(`Found ${templates.length} templates: ${templates.join(', ')}`);
  } else {
    warning('No templates found');
  }
} else {
  error('Templates directory missing');
}

// Check documentation
const requiredDocs = ['README.md', 'docs/SETUP_OAUTH.md'];
for (const doc of requiredDocs) {
  if (fs.existsSync(path.join(PROJECT_ROOT, doc))) {
    success(`Documentation exists: ${doc}`);
  } else {
    error(`Missing documentation: ${doc}`);
  }
}

// Check .gitignore
if (fs.existsSync(path.join(PROJECT_ROOT, '.gitignore'))) {
  const gitignore = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf-8');
  const shouldIgnore = ['node_modules', 'build', 'credentials.json', 'token.json'];
  
  for (const item of shouldIgnore) {
    if (gitignore.includes(item)) {
      success(`.gitignore includes ${item}`);
    } else {
      warning(`.gitignore should include ${item}`);
    }
  }
}

// Summary
console.log('\n📊 Validation Summary:');
if (errors === 0 && warnings === 0) {
  console.log('✨ Everything looks good! Ready to publish.');
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(s) found - fix before publishing`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) found - consider fixing`);
  }
}

process.exit(errors > 0 ? 1 : 0);