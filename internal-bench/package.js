const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const defectsFile = path.join(__dirname, 'defects.yaml');
const tasksDir = path.join(__dirname, 'tasks');

if (!fs.existsSync(tasksDir)) {
  fs.mkdirSync(tasksDir, { recursive: true });
}

// Simple YAML parser for defects list
const content = fs.readFileSync(defectsFile, 'utf8');
const blocks = content.split(/\n\s*-\s+id:\s+/).slice(1);

console.log(`Found ${blocks.length} defect blocks.`);

blocks.forEach((block) => {
  const lines = block.split('\n');
  const idMatch = lines[0].match(/^"([^"]+)"/);
  if (!idMatch) return;
  const id = idMatch[1];

  const getField = (field) => {
    const regex = new RegExp(`^\\s*${field}:\\s*"([^"]+)"`, 'm');
    const m = block.match(regex);
    return m ? m[1] : '';
  };

  const category = getField('category');
  const title = getField('title');
  const file = getField('file');
  const description = getField('description');
  const impact = getField('impact');
  const f2p_test = getField('f2p_test');
  const p2p_test = getField('p2p_test');

  const taskDir = path.join(tasksDir, id);
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }

  const instructions = `# Task Specification: ${id} — ${title}

## Category
**${category}**

## Target Source File
\`${file}\`

## Problem Statement & Description
${description}

## Failure Impact
${impact}

## Verification Protocol
1. Verify reproduction with defect test:
   \`npx jest ${f2p_test}\`
2. Verify preservation of non-regressing behaviors:
   \`npx jest ${p2p_test}\`
3. Verify full system build and test suite pass:
   \`npm run lint && npm run build && npm test\`
`;

  fs.writeFileSync(path.join(taskDir, 'instructions.md'), instructions, 'utf8');

  const metadata = {
    id,
    category,
    title,
    file,
    description,
    impact,
    f2p_test,
    p2p_test,
  };

  fs.writeFileSync(path.join(taskDir, 'task.json'), JSON.stringify(metadata, null, 2), 'utf8');
});

console.log(`Successfully generated Sand-style tasks in ${tasksDir}`);
