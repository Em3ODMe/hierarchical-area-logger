# 🤝 Contributing to Hierarchical Area Logger

Thank you for your interest in contributing to this TypeScript logging library! This guide will help you get started and ensure your contributions align with the project standards.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## 🛠 Development Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **TypeScript** knowledge

### Installation

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/Em3ODMe/hierarchical-area-logger.git
   cd hierarchical-area-logger
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Verify setup**
   ```bash
   npm run lint:check
   npm test
   npm run build
   ```

## 🔄 Development Workflow

### Available Scripts

| Script             | Purpose                  | When to Use        |
| ------------------ | ------------------------ | ------------------ |
| `npm run dev`      | Watch mode development   | Active development |
| `npm run build`    | Build the library        | Before committing  |
| `npm test`         | Run unit tests           | After code changes |
| `npm run test:ui`  | Interactive test runner  | Debugging tests    |
| `npm run lint`     | Check code quality       | Before committing  |
| `npm run lint:fix` | Auto-fix lint issues     | During development |
| `npm run coverage` | Generate coverage report | Before PR          |

### Daily Development

1. **Start development server**

   ```bash
   npm run dev
   ```

2. **Make changes to source files** in `src/` directory

3. **Run tests frequently**

   ```bash
   npm test
   ```

4. **Check linting**

   ```bash
   npm run lint:check
   ```

5. **Build before commit**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
logger/
├── src/
│   ├── index.ts          # Main entry point and public exports
│   ├── Logger.ts         # Core Logger class implementation
│   ├── types.ts          # TypeScript type definitions
│   ├── utils.ts          # Utility functions
│   ├── guards.ts         # Type guards for log structures
│   └── constants.ts      # Internal constants
├── dist/                 # Built output (auto-generated)
├── test/
│   ├── logger.test.ts    # Logger class test suite
│   ├── utils.test.ts     # Utility functions test suite
│   └── guards.test.ts    # Type guards test suite
├── coverage/             # Coverage reports (auto-generated)
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── vitest.config.ts      # Test configuration
├── eslint.config.js      # Linting configuration
└── build.config.ts       # Build configuration (unbuild)
```

### Key Files & Responsibilities

- **`src/Logger.ts`**: Core `Logger` class with area-based logging and the `createLogger` factory
- **`src/types.ts`**: TypeScript interfaces and type definitions
- **`src/utils.ts`**: Helper functions for log creation, error handling and event ordering/grouping
- **`src/guards.ts`**: Runtime type guards (`isLogData`, `isOrderedLogEvents`, `hasRootPayload`)
- **`src/constants.ts`**: Internal constants (e.g. `DEFAULT_PREPARE_DUMP_OPTIONS`)
- **`src/index.ts`**: Public API exports — **everything public is re-exported here**

## 📝 Code Standards

### TypeScript Configuration

- **Target**: ES2020
- **Module**: ESNext
- **Strict mode**: Enabled
- **Output**: ESM only (`dist/index.mjs`); the library has zero runtime dependencies

### ESLint Rules

Key rules enforced:

- No unused variables (with `_` prefix exception)
- Warn on `any` types
- Prefer `const` over `let`
- No `var` declarations
- No empty functions (warn)

### Code Style Guidelines

1. **Use TypeScript for all new code**
2. **Follow existing naming conventions** (camelCase for variables, PascalCase for classes)
3. **Export only what's necessary** from index.ts
4. **Add JSDoc comments for public APIs**
5. **Use meaningful variable and function names**

### Import Organization

```typescript
// Internal modules
import { createRootLogEntry, prettyError } from './utils';
import { hasRootPayload, isLogData } from './guards';
import type { LogData, LoggerOptions, LogEntry } from './types';
```

## 🧪 Testing

### Test Framework

- **Vitest** for unit testing
- **Coverage** with v8 provider
- **100% coverage requirement** for new code

### Writing Tests

1. **Test file location**: `test/` directory
2. **Naming convention**: `*.test.ts`
3. **Structure your tests**:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { createLogger } from '../src/index';

   describe('Logger functionality', () => {
     it('should create logger with event ID', () => {
       const logger = createLogger({
         details: { instance: 'test' },
         eventId: 'event-test',
       });

       expect(logger.eventId).toBeDefined();
       expect(typeof logger.eventId).toBe('string');
     });
   });
   ```

### Test Categories

1. **Unit tests**: Individual function behavior
2. **Integration tests**: Component interaction
3. **Edge cases**: Error handling, invalid inputs
4. **Type safety**: TypeScript compilation checks

## 🔄 Pull Request Process

### Branch Naming

Use descriptive branch names:

- `feature/area-logging-enhancement`
- `fix/error-handling-bug`
- `docs/updated-readme`

### Commit Messages

Follow conventional commits:

```
type(scope): description

feat(logger): add batch logging capability
fix(types): resolve optional parameter issue
docs(readme): update installation instructions
```

### Before Submitting PR

1. **Create feature branch** from main
2. **Make your changes** with atomic commits
3. **Ensure all tests pass**:
   ```bash
   npm test
   npm run test
   ```
4. **Verify linting**:
   ```bash
   npm run lint:check
   ```
5. **Build successfully**:
   ```bash
   npm run build
   ```
6. **Update documentation** if needed

### PR Description Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] All tests pass
- [ ] 100% coverage maintained
- [ ] New tests added for new functionality

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if necessary
```

## 🚀 Release Process

### Version Management

- Follow **Semantic Versioning** (SemVer)
- Update version in `package.json`
- Create git tag for releases

### Pre-release Checks

1. **All tests pass**
2. **100% coverage maintained**
3. **Linting passes**
4. **Build succeeds**
5. **Documentation updated**

### Build Verification

```bash
# Clean build
rm -rf dist/
npm run build

# Verify outputs
ls -la dist/
# Should contain: index.mjs, index.d.ts, index.d.mts, source maps
```

### Publishing

1. **Update version** in package.json
2. **Create git tag**:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
3. **Publish to npm** (if you have access):
   ```bash
   npm publish
   ```

## 🆘 Getting Help

- **Check existing issues** for similar problems
- **Read the README.md** for usage examples
- **Look at test files** for implementation patterns
- **Review TypeScript types** in `src/types.ts`

## 📚 Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Configuration](https://eslint.org/docs/latest/)
- [Semantic Versioning](https://semver.org/)

---

Thank you for contributing to the Hierarchical Area Logger project! Your contributions help make this library better for everyone. 🎉
