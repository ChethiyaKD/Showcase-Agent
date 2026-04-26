const fs = require('fs');
const path = require('path');
const FlexSearch = require('flexsearch');

class KnowledgeBase {
  constructor() {
    this.projects = [];
    this.index = new FlexSearch.Document({
      document: {
        id: "id",
        index: ["title", "content", "summary", "tags", "stack", "problem", "solution", "skills", "queries"]
      },
      tokenize: "forward"
    });
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    const knowledgePath = path.join(__dirname, '../../knowledge');
    if (!fs.existsSync(knowledgePath)) {
      console.warn("Knowledge directory not found.");
      return;
    }
    const files = fs.readdirSync(knowledgePath);

    files.forEach((file, index) => {
      if (file.endsWith('.md')) {
        const fullPath = path.join(knowledgePath, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Helper to extract section content
        const extractSection = (regex) => {
          const match = content.match(regex);
          return match ? match[1].trim() : "";
        };

        const titleMatch = content.match(/^# (.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : file.replace('_project_summary.md', '');
        
        const projectData = {
          id: index,
          title: title,
          fileName: file,
          summary: extractSection(/## One Line Pitch\n([\s\S]*?)(?=\n##|$)/),
          tags: extractSection(/## Tags\n([\s\S]*?)(?=\n##|$)/),
          stack: extractSection(/## Tech Stack\n([\s\S]*?)(?=\n##|$)/),
          problem: extractSection(/## Problem\n([\s\S]*?)(?=\n##|$)/),
          solution: extractSection(/## Solution\n([\s\S]*?)(?=\n##|$)/),
          skills: extractSection(/## Skills Demonstrated\n([\s\S]*?)(?=\n##|$)/),
          queries: extractSection(/## Confidence Match Queries\n([\s\S]*?)$/),
          content: content // Keep full content for LLM
        };

        this.projects.push(projectData);
        this.index.add(projectData);
      }
    });

    this.isInitialized = true;
    console.log(`Knowledge Base initialized with ${this.projects.length} projects.`);
  }

  search(query) {
    if (!query) return [];
    
    // Search across multiple fields
    const results = this.index.search(query, 5); 
    const seen = new Set();
    const unique = [];
    
    results.forEach(result => {
      result.result.forEach(id => {
        if (!seen.has(id)) {
          seen.add(id);
          const project = this.projects.find(p => p.id === id);
          if (project) unique.push(project);
        }
      });
    });

    return unique.slice(0, 5); // Return top 5 for better context
  }

  getAllProjects() {
    return this.projects;
  }
}

module.exports = new KnowledgeBase();

