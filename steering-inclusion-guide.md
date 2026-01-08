---
inclusion: always
---

# Kiro Steering Rules Configuration Guide

This document defines the three inclusion patterns for Kiro steering rules to provide contextual guidance to AI assistants working in this React/TypeScript project.

## Always Included Rules

Use for project-wide standards that apply to all code:

```markdown
---
inclusion: always
---

# Global Development Standards
- Use TypeScript strict mode with explicit type annotations
- Follow ESLint and Prettier configurations
- Implement proper error handling patterns
- Use consistent naming conventions (camelCase for variables, PascalCase for components)
```

**When to use**: Core coding standards, architectural patterns, global configurations (like Yapi MCP setup)

## File Match Rules

Use for file-type specific guidance that activates when working with matching files:

```markdown
---
inclusion: fileMatch
fileMatchPattern: 'src/api/*.ts'
---

# API Development Standards
- Add comprehensive JSDoc comments for all API functions
- Use consistent error handling with proper status codes
- Sync interface definitions with Yapi documentation
- Follow RESTful naming conventions
```

```markdown
---
inclusion: fileMatch
fileMatchPattern: ['src/components/**/*.tsx', 'src/pages/**/*.tsx']
---

# React Component Standards
- Use functional components with hooks
- Define TypeScript interfaces for all props
- Implement React.memo for performance optimization
- Follow component file structure: index.tsx, types.ts, index.less
```

**Pattern examples**:
- `'src/api/*.ts'` - API layer files
- `'**/*.test.ts'` - Test files
- `['**/*.tsx', '**/*.jsx']` - React components
- `'src/utils/*.ts'` - Utility functions

## Manual Inclusion Rules

Use for specialized guidance that users explicitly reference:

```markdown
---
inclusion: manual
---

# Performance Optimization Guide
- React optimization: useMemo, useCallback, React.memo
- Bundle optimization: code splitting, lazy loading
- Image optimization: proper formats and compression
- API optimization: caching strategies, request batching
```

**Access via**: `#performance-guide` in chat

## Project Structure Recommendations

```
.kiro/steering/
├── general.md              # Always: Global standards
├── api-standards.md        # FileMatch: src/api/**/*.ts
├── react-guide.md          # FileMatch: src/components/**/*.tsx
├── utils-guide.md          # FileMatch: src/utils/**/*.ts
├── performance-guide.md    # Manual: #performance-guide
└── security-checklist.md   # Manual: #security-checklist
```

## Best Practices

1. **Always**: Keep concise, focus on universal project standards
2. **FileMatch**: Provide specific guidance for file types and patterns
3. **Manual**: Include detailed, specialized knowledge for on-demand use

This configuration ensures AI assistants receive relevant, contextual guidance without information overload.