# Contributing Guide

Guidelines for contributing to TS6 Stream Bot.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Submitting Changes](#submitting-changes)

---

## Getting Started

### 1. Fork the Repository

```bash
# In GitHub web interface, click "Fork"
# This creates your own copy
```

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/ts6-stream-bot.git
cd ts6-stream-bot
```

### 3. Add Upstream Remote

```bash
# Keep your fork synced with main repo
git remote add upstream https://github.com/ORIGINAL-OWNER/ts6-stream-bot.git
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Create Development Branch

```bash
git checkout -b feature/my-feature
# or: git checkout -b bugfix/issue-name
```

---

## Development Workflow

### 1. Make Changes

```bash
# Edit files as needed
# Keep changes focused on one feature
```

### 2. Run Tests

```bash
npm test

# Or with watch mode:
npm test -- --watch
```

### 3. Check TypeScript Compilation

```bash
npm run build

# Should compile without errors
```

### 4. Test Locally

```bash
# Development mode
npm run dev

# Should start without errors and connect to TS6/LiveKit
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add streaming quality selector"

# Follow commit guidelines (see below)
```

### 6. Push to Your Fork

```bash
git push origin feature/my-feature
```

### 7. Create Pull Request

- Go to GitHub
- Your fork should show "Compare & pull request" button
- Fill in PR description
- Reference any related issues

---

## Code Standards

### TypeScript

```typescript
// ✓ DO: Use explicit types
interface ComponentOptions {
  timeout: number;
  retries: number;
}

async function connect(options: ComponentOptions): Promise<void> {
  // ...
}

// ✗ DON'T: Use `any` type
async function connect(options: any): Promise<void> {
  // ...
}
```

### File Organization

```
src/
├── index.ts                      # Entry point only
├── core/
│   ├── Bot.ts                    # Main class
│   ├── EventBus.ts               # Event system
│   └── types.ts                  # All interfaces
├── components/                   # Each component is one file
│   └── MyComponent.ts
├── connectors/                   # Integration modules
│   ├── LiveKitConnector.ts
│   └── TS6Client/
│       ├── TSSignaling.ts
│       └── TSProtocol.ts
├── pipeline/                     # Stream processing
│   └── FramePipeline.ts
├── api/                          # External API clients
│   └── TS6RestClient.ts
└── config/                       # Configuration
    ├── config.ts
    └── logger.ts
```

### Naming Conventions

```typescript
// Classes: PascalCase
class StreamBridgeComponent { }
interface FrameData { }

// Functions/methods: camelCase
async function connectToServer() { }
private parseFrame() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Event names: snake_case
eventBus.emit('ts6:streamStarted', clientId);
eventBus.on('frame:processed', (frame) => {});
```

### Error Handling

```typescript
// ✓ DO: Handle errors meaningfully
try {
  await connect();
} catch (err) {
  logger.error(`Connection failed: ${err.message}`);
  throw new Error(`TS6 unavailable at ${url}`);
}

// ✗ DON'T: Ignore errors or use generic messages
try {
  await connect();
} catch (err) {
  console.log('error');  // Too vague
}

// ✓ DO: Log context
logger.error('Failed to parse H.264 frame', {
  frameSize: data.length,
  timestamp: frame.timestamp,
  errorCode: err.code
});
```

### Async/Await

```typescript
// ✓ DO: Use async/await for clarity
async function processStream(): Promise<void> {
  const data = await fetchData();
  const result = await transform(data);
  return result;
}

// ✗ DON'T: Mix promises and callbacks
function processStream() {
  fetchData().then(data => {
    transform(data).then(result => {
      // Callback hell
    });
  });
}
```

### Comments

```typescript
// ✓ DO: Use comments for non-obvious logic
// Wait for key frame before sending to LiveKit to ensure
// client can decode from frame boundary
if (frame.isKeyframe) {
  await livekit.publish(frame);
}

// ✓ DO: Document complex interfaces
/**
 * Represents an H.264 video frame ready for streaming.
 * Includes SPS/PPS for decoder initialization.
 */
interface H264Frame {
  data: Buffer;
  isKeyframe: boolean;
  timestamp: number;
  sps?: Buffer;
  pps?: Buffer;
}

// ✗ DON'T: State the obvious
// Increment counter
counter++;

// ✗ DON'T: Misleading comments
// This is a hack
// TODO: fix this someday
```

### Logging

```typescript
// Use context.logger from BotContext
// Provided to all components

async onInit(ctx: BotContext): Promise<void> {
  ctx.logger.debug('[MyComponent] Starting initialization');
  
  try {
    await this.setup();
    ctx.logger.info('[MyComponent] Successfully initialized');
  } catch (err) {
    ctx.logger.error('[MyComponent] Initialization failed:', err);
    throw err;
  }
}

// ✓ DO: Use consistent log level
// - debug: Detailed technical info (variables, values)
// - info: Important milestones (connected, started, ready)
// - warn: Unexpected but recoverable (retrying, fallback)
// - error: Failures requiring attention (connection lost, crash)
```

---

## Testing

### Writing Tests

Tests use [Vitest](https://vitest.dev/):

```typescript
// src/components/MyComponent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MyComponent } from './MyComponent.js';

describe('MyComponent', () => {
  let component: MyComponent;

  beforeEach(() => {
    component = new MyComponent();
  });

  afterEach(async () => {
    await component.onDestroy();
  });

  it('should initialize successfully', async () => {
    const mockContext = {
      logger: { info: () => {}, error: () => {} },
      // ... mock other properties
    };

    await component.onInit(mockContext as any);
    expect(component.isInitialized).toBe(true);
  });

  it('should emit events on state change', async () => {
    let emitted = false;
    mockContext.eventBus.on('test:event', () => {
      emitted = true;
    });

    await component.doSomething();
    expect(emitted).toBe(true);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- MyComponent.test.ts

# Watch mode (reruns on changes)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Test Checklist

Before submitting PR:
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run build`
- [ ] Code compiles: `npm run build`
- [ ] Manual testing completed
- [ ] No console.log() statements left (use logger instead)

---

## Commit Guidelines

### Commit Message Format

```
type(scope): subject

body

footer
```

### Type

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code reorganization without behavior change
- `test`: Test additions/changes
- `docs`: Documentation
- `ci`: CI/CD configuration
- `chore`: Build, dependencies, etc.

### Scope

The part of code affected:
- `core`: Core Bot class
- `components`: Components in general
- `stream-bridge`: StreamBridgeComponent specifically
- `config`: Configuration system
- `api`: TS6RestClient
- `pipeline`: Video pipeline

### Examples

```bash
git commit -m "feat(stream-bridge): add H.264 frame statistics"
git commit -m "fix(pipeline): handle incomplete frames gracefully"
git commit -m "refactor(core): simplify component lifecycle"
git commit -m "docs: add troubleshooting guide"
git commit -m "test(ts6-api): add client listing tests"
```

### Full Message Template

```
feat(stream-bridge): add video quality monitoring

- Collect frame timing metrics
- Log dropped frames per second
- Emit quality:degraded event when FPS drops below threshold

Fixes #123
```

### Best Practices

- Use imperative mood: "add feature" not "added feature"
- Don't capitalize first letter (after type/scope)
- Keep subject under 50 characters
- Explain what and why, not how
- Reference issues: "Fixes #123", "Related to #456"

---

## Submitting Changes

### Before Submitting

1. **Update from upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test everything:**
   ```bash
   npm test
   npm run build
   npm run dev  # Manual test
   ```

3. **Check code quality:**
   ```bash
   # No TypeScript errors
   npm run build

   # No console.log or debug code left
   grep -r "console\." src/
   grep -r "TODO" src/  # Review all TODOs
   ```

### Creating Pull Request

**Title Format:**
```
[Type] Brief description (50 chars max)
```

Examples:
- `[Feature] Add frame rate limiter`
- `[Bug] Fix memory leak in H264FrameAssembler`
- `[Doc] Add configuration guide`

**Description Template:**

```markdown
## Description
What does this PR do? Why is it needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How was this tested?

## Related Issues
Fixes #123
Related to #456

## Checklist
- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
```

### Review Process

1. Automated checks run (tests, lint)
2. Code review by maintainers
3. Changes requested (if needed)
4. Your responses to feedback
5. Approval and merge

---

## Adding a New Component

### Template

```typescript
// src/components/MyNewComponent.ts
import { BaseComponent } from './BaseComponent.js';
import type { BotContext } from '../core/types.js';
import { createLogger } from '../config/logger.js';

/**
 * MyNewComponent - Brief description
 * 
 * Does: ...
 * Events consumed: ...
 * Events emitted: ...
 */
export class MyNewComponent extends BaseComponent {
  readonly name = 'my-new-component';
  
  private ctx!: BotContext;

  async onInit(ctx: BotContext): Promise<void> {
    this.ctx = ctx;
    ctx.logger.info(`[${this.name}] Initializing`);

    // Setup event listeners
    ctx.eventBus.on('event:name', this.handleEvent.bind(this));

    // Initialize resources
    await this.setupAsync();

    ctx.logger.info(`[${this.name}] Ready`);
  }

  async onDestroy(): Promise<void> {
    this.ctx.logger.info(`[${this.name}] Destroying`);
    
    // Clean up resources
    await this.cleanup();
    
    // Remove listeners
    this.ctx.eventBus.off('event:name', this.handleEvent);
  }

  private async handleEvent(data: any): Promise<void> {
    // Handle event
  }

  private async setupAsync(): Promise<void> {
    // Setup logic
  }

  private async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
```

### Register Component

Update `src/index.ts`:

```typescript
import { MyNewComponent } from './components/MyNewComponent.js';

// ...

bot
  .register(new StreamBridgeComponent())
  .register(new MyNewComponent())     // Add here
  .register(new CommandComponent())
  // ...
```

### Add Tests

Create `src/components/MyNewComponent.test.ts` following the testing guide above.

---

## Version Numbering

Project uses [Semantic Versioning](https://semver.org/):

Format: `MAJOR.MINOR.PATCH`

- `MAJOR`: Breaking changes (0.1.0 → 1.0.0)
- `MINOR`: New features backward-compatible (1.0.0 → 1.1.0)
- `PATCH`: Bug fixes (1.0.0 → 1.0.1)

Example: `0.1.0` (current pre-release version)

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
- [Vitest Documentation](https://vitest.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Last Updated**: 2024-01-15
