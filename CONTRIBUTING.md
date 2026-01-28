# Contributing to ChainSmith

Thank you for your interest in contributing to ChainSmith! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
    - ChainSmith version
    - Node.js version
    - Operating system
    - Steps to reproduce
    - Expected vs actual behavior

### Suggesting Features

1. Check existing issues for similar suggestions
2. Use the feature request template
3. Describe the use case and expected behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3. Make your changes following our coding standards
4. Write or update tests as needed
5. Ensure all tests pass:
    ```bash
    pnpm lint
    pnpm format:check
    pnpm type-check
    pnpm build
    ```
6. Commit using conventional commits format:
    ```
    feat: add new feature
    fix: resolve bug
    docs: update documentation
    refactor: improve code structure
    test: add tests
    ```
7. Push and create a Pull Request

## Development Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/57blocks/ChainSmith.git
    cd ChainSmith
    ```

2. Install dependencies:

    ```bash
    pnpm install
    ```

3. Initialize test configuration:

    ```bash
    pnpm init:tests
    ```

4. Configure your test environment in `tests/config.json`

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

## Coding Standards

- Use TypeScript for all source code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Maintain test coverage for new features

## Project Structure

```
src/
├── core/           # Core blockchain management
├── blockchain/     # Chain-specific implementations
├── infrastructure/ # Node and Docker management
├── utils/          # Utility functions
└── index.ts        # Main entry point
```

## Questions?

Feel free to open an issue for any questions or discussions.
