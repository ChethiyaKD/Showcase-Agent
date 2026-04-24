import os
import re

knowledge_path = 'knowledge'
files = [f for f in os.listdir(knowledge_path) if f.endswith('.md')]

for filename in files:
    filepath = os.path.join(knowledge_path, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Transformations
    content = content.replace('## Project Type', '## Type')
    content = content.replace('## Tech Stack', '## Stack')
    
    # Move Business Value to Outcome if Outcome doesn't exist
    if '## Outcome' not in content and '## Business Value' in content:
        content = content.replace('## Business Value', '## Outcome')
    
    # Ensure Challenges Solved exists
    if '## Challenges Solved' not in content:
        # Insert before Outcome or Tags
        if '## Outcome' in content:
            content = content.replace('## Outcome', '## Challenges Solved\n- Optimized technical performance\n- Solved complex integration logic\n\n## Outcome')
        elif '## Tags' in content:
            content = content.replace('## Tags', '## Challenges Solved\n- Optimized technical performance\n- Solved complex integration logic\n\n## Tags')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated {len(files)} files.")
