# Development Environment Setup

## VS Code Setup

### Required Extensions

```json
{
    "core": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint", "ms-vscode.vscode-typescript-next"]
}
```

### Optional Extensions

```json
{
    "optional": [
        "GitHub.vscode-pull-request-github",
        "streetsidesoftware.code-spell-checker",
        "aaron-bond.better-comments",
        "PKief.material-icon-theme",
        "ms-vscode.vscode-json"
    ]
}
```

### Setup Steps

1. Install required extensions
2. Extensions will automatically use project's ESLint and Prettier configurations
3. Code will be automatically formatted on save

## Code Quality Checks

```bash
pnpm lint              # Check code quality
pnpm lint:fix          # Auto-fix issues
pnpm format            # Format code
pnpm type-check        # TypeScript validation
```

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: your feature description"

# 3. Pre-commit hooks will automatically run:
#    - ESLint checks
#    - Prettier formatting
#    - Commitlint validation

# 4. Push changes
git push origin feature/your-feature-name
```

## Testing

```bash
pnpm test:basic
pnpm test:rpc:evm
pnpm test:rpc:cometbft
pnpm test:fault-tolerance
pnpm test:performance
```

## Project Standards

### Code Style

- **Quotes**: Single quotes (`'`)
- **Semicolons**: Required
- **Line Width**: 100 characters
- **Indentation**: 2 spaces
- **Trailing Commas**: ES5 style

### Commit Message Format

```
type(scope): description

Examples:
feat: add cosmos client support
fix: resolve RPC connection timeout
docs: update development setup guide
refactor: improve error handling
test: add unit tests for EVM client
```

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Code refactoring
```

## Troubleshooting

1. **ESLint not working**: Run `pnpm install`
2. **Prettier not formatting**: Check VS Code prettier extension is enabled
3. **Git hooks failing**: Run `pnpm prepare` to reinstall hooks
4. **TypeScript errors**: Run `pnpm type-check` to see detailed errors
