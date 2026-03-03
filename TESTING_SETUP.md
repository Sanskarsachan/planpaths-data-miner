# Testing Guide

This project includes comprehensive unit and component tests using Jest and React Testing Library.

## Running Tests

### Run all tests once
```bash
pnpm test
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
pnpm test:watch
```

### Run tests with coverage report
```bash
pnpm test:coverage
```

### Run specific test file
```bash
pnpm test ExtractForm.test.tsx
```

### Run tests matching a pattern
```bash
pnpm test --testNamePattern="ExtractForm"
```

## Test Structure

Tests are organized alongside source code in `__tests__` directories:

```
src/
├── components/
│   ├── ExtractForm.tsx
│   └── __tests__/
│       └── ExtractForm.test.tsx
├── lib/
│   ├── extraction/
│   │   ├── StateDetector.ts
│   │   └── __tests__/
│   │       └── StateDetector.test.ts
├── app/
│   └── api/
│       └── extract/
│           ├── route.ts
│           └── __tests__/
│               └── route.test.ts
└── utils/
    ├── hashCourse.ts
    └── __tests__/
        └── hashCourse.test.ts
```

## Test Files

### Component Tests

#### `ExtractForm.test.tsx`
Tests for the PDF extraction form component:
- ✅ Renders all required form fields
- ✅ Validates file type (PDF only)
- ✅ Validates file size (max 50MB)
- ✅ Enables/disables submit button correctly
- ✅ Submits form with correct data
- ✅ Displays error messages on failure

**Run:** `pnpm test ExtractForm.test.tsx`

### API Tests

#### `route.test.ts` (Extract endpoint)
Tests for POST /api/extract endpoint:
- ✅ Returns 400 when required fields missing
- ✅ Processes valid PDF uploads
- ✅ Returns upload_id and school_slug
- ✅ Handles server errors gracefully

**Run:** `pnpm test route.test.ts`

### Utility Tests

#### `hashCourse.test.ts`
Tests for SHA-256 course hashing utility:
- ✅ Generates consistent hashes
- ✅ Different inputs produce different hashes
- ✅ Returns 64-character hex string
- ✅ Handles special characters
- ✅ Whitespace sensitivity

**Run:** `pnpm test hashCourse.test.ts`

### Library Tests

#### `StateDetector.test.ts`
Tests for school state detection:
- ✅ Detects Florida (FL) from content/filename
- ✅ Detects Texas (TX)
- ✅ Detects California (CA)
- ✅ Falls back to filename detection
- ✅ Case-insensitive matching
- ✅ Handles edge cases (empty text, long text)

**Run:** `pnpm test StateDetector.test.ts`

## Writing New Tests

### Example: Component Test

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    render(<MyComponent />)
    const button = screen.getByRole('button', { name: /click me/i })
    
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(screen.getByText('Updated Text')).toBeInTheDocument()
    })
  })
})
```

### Example: API Route Test

```typescript
import { POST } from '@/app/api/example/route'
import type { NextRequest } from 'next/server'

describe('/api/example', () => {
  it('handles valid requests', async () => {
    const mockRequest = {
      json: async () => ({ data: 'test' }),
    } as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(200)
  })
})
```

### Example: Utility Test

```typescript
import { myFunction } from '@/utils/myFunction'

describe('myFunction', () => {
  it('returns expected output', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })
})
```

## Test Configuration

### jest.config.ts
Main Jest configuration file:
- Sets up jsdom environment for DOM testing
- Configures path aliases (@/ → src/)
- Enables coverage reporting
- Loads testing libraries

### jest.setup.ts
Test environment setup:
- Imports @testing-library/jest-dom for extended matchers
- Sets environment variables for tests
- Can add global mocks and configurations

## Coverage Goals

Current coverage by file:

| Category | Target | Status |
|----------|--------|--------|
| Components | 80% | ⏳ In Progress |
| API Routes | 70% | ⏳ In Progress |
| Utils | 100% | ⏳ In Progress |
| Libraries | 85% | ⏳ In Progress |

View coverage report:
```bash
pnpm test:coverage
```

## Mocking

### Mocking Supabase
```typescript
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [] })),
    })),
  })),
}))
```

### Mocking Fetch
```typescript
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' }),
  })
)
```

### Mocking File System
```typescript
import * as fs from 'fs'

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'file content'),
}))
```

## Debugging Tests

### Run single test with debugging
```bash
pnpm test --testNamePattern="specific test name" --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

## CI/CD Integration

Add to your CI pipeline:
```bash
# Lint and type check
pnpm lint
pnpm type-check

# Run tests
pnpm test

# Build
pnpm build
```

## Best Practices

1. **Test Behavior, Not Implementation** - Test what users see, not how code is structured
2. **Use Descriptive Names** - Test names should explain what they're testing
3. **Keep Tests Isolated** - Each test should be independent
4. **Mock External Dependencies** - Don't make real API calls in tests
5. **Use `waitFor` for Async** - Always wait for async operations
6. **Clean Up Mocks** - Call `jest.clearAllMocks()` in beforeEach

## Troubleshooting

### Tests fail with "Cannot find module" error
- Ensure path alias is configured in both `tsconfig.json` and `jest.config.ts`
- Run `pnpm install` to ensure dependencies are installed

### Tests timeout
- Increase timeout: `jest.setTimeout(10000)`
- Check for missing `await` on async operations
- Verify mocks are properly configured

### Coverage report not generating
- Ensure `--coverage` flag is used: `pnpm test:coverage`
- Check `jest.config.ts` `collectCoverageFrom` paths

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
