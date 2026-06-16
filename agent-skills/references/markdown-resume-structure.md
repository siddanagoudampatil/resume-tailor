# Markdown resume structure

1. Name + contact line
2. Education
3. Skills
4. Experience
5. Projects

Use horizontal rules (`---`) with empty lines around them to separate main sections.

Main headings must use level 2 (`## Education`, `## Skills`, `## Experience`, `## Projects`).

Education block template:
```markdown
**Degree** — _Dates_
School, Location | Info
```

Skills block template (re-order categories based on target role relevance):
```markdown
- **Languages:** Item 1, Item 2
- **Frameworks & Runtimes:** Item 1, Item 2
- **Databases:** Item 1, Item 2
- **Cloud & DevOps:** Item 1, Item 2
- **AI & Agentic Tools:** Item 1, Item 2
- **Core Concepts:** Item 1, Item 2
```


Experience block template:
```markdown
**Title** — _Dates_
Company, Location

- Bullet points
```

Projects block template:
```markdown
**Project Title** | _Technologies/Tags_

- Bullet points
```

Use HTML comments `<!-- anchor:company-role -->` only when needed for stable diffs.

