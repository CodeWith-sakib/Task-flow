#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BENCH_DIR="$ROOT_DIR/internal-bench"
TASKS_DIR="$BENCH_DIR/tasks"

mkdir -p "$TASKS_DIR"

echo "=== Packaging Sand-Style Benchmark Tasks for TaskFlow Engine ==="

# We read defect definitions and create task packaging structure
python3 - << 'PY_EOF'
import yaml
import os
import shutil

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__) if '__file__' in locals() else '.', '..'))
defects_file = os.path.join(root_dir, 'internal-bench', 'defects.yaml')
tasks_dir = os.path.join(root_dir, 'internal-bench', 'tasks')

with open(defects_file, 'r') as f:
    data = yaml.safe_load(f)

defects = data.get('defects', [])
print(f"Loaded {len(defects)} defect definitions.")

for defect in defects:
    did = defect['id']
    task_dir = os.path.join(tasks_dir, did)
    os.makedirs(task_dir, exist_ok=True)
    
    # 1. instructions.md
    instructions_path = os.path.join(task_dir, 'instructions.md')
    with open(instructions_path, 'w') as inf:
        inf.write(f"""# Task Specification: {did} — {defect['title']}

## Category
**{defect['category']}**

## Targeted Target File
`{defect['file']}`

## Problem Description
{defect['description']}

## Severity & Impact
{defect['impact']}

## Verification Requirements
1. Run target failing test to verify reproduction:
   `npx jest {defect['f2p_test']}`
2. Ensure regression suite continues to pass:
   `npx jest {defect['p2p_test']}`
3. Full verification:
   `npm run lint && npm run build && npm test`
""")

    # 2. task.json metadata
    task_json_path = os.path.join(task_dir, 'task.json')
    with open(task_json_path, 'w') as tjf:
        import json
        json.dump(defect, tjf, indent=2)

print(f"Successfully packaged {len(defects)} tasks in {tasks_dir}.")
PY_EOF

echo "=== Task Packaging Complete ==="
