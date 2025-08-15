# Contributing to DocuGen

First off, thank you for considering contributing to DocuGen! It's people like you that make DocuGen such a great tool for the community.

## Code of Conduct

This project and everyone participating in it is governed by the [DocuGen Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem
- **Describe the exact steps which reproduce the problem** in as many details as possible
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs** if possible
- **Include your environment details** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior** and **explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful** to most DocuGen users

### Creating Templates

One of the easiest ways to contribute is by creating new document templates:

1. Create a new JSON file in the appropriate category folder
2. Follow the template structure defined in the documentation
3. Test your template thoroughly
4. Submit a pull request with your template

Template structure example:
```json
{
  "id": "unique-template-id",
  "name": "Template Display Name",
  "description": "What this template is for",
  "category": "category-name",
  "version": "1.0",
  "sections": [
    // Template sections here
  ]
}
```

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** if applicable
4. **Ensure the test suite passes** (when available)
5. **Run the build** to make sure everything compiles
6. **Update documentation** if you've changed APIs
7. **Write a good commit message** following conventional commits

#### Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable
2. Update the CLAUDE.md file if you've made architectural changes
3. The PR will be merged once you have the sign-off of at least one maintainer

## Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn
- TypeScript knowledge
- Familiarity with Google APIs (helpful but not required)

### Local Development

1. Clone your fork:
```bash
git clone https://github.com/your-username/docugen.git
cd docugen
```

2. Install dependencies:
```bash
npm install
```

3. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

4. Make your changes and test:
```bash
npm run build
npm start
```

5. Run in development mode (watch for changes):
```bash
npm run dev
```

### Project Structure

```
docugen/
├── src/               # Source TypeScript files
│   └── server.ts      # Main MCP server
├── templates/         # Document templates
│   └── standard/      # Built-in templates
├── build/            # Compiled JavaScript (git-ignored)
├── docs/             # Documentation
└── tests/            # Test files (coming soon)
```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Follow existing code style and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Use async/await over callbacks

### Template Guidelines

- Templates should be generic and reusable
- Use clear, descriptive placeholder names
- Include all necessary sections for the document type
- Test with various data inputs
- Document any special requirements

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add sprint planning template
fix: resolve OAuth token refresh issue
docs: update template creation guide
```

## Testing

Currently, testing is manual. Automated tests are planned for future releases. When testing:

1. Test with different Google accounts
2. Verify template placeholders work correctly
3. Check error handling for API failures
4. Test with various document sizes
5. Verify formatting is preserved

## Documentation

- Update README.md for user-facing changes
- Update CLAUDE.md for architectural changes
- Add JSDoc comments for new functions
- Create examples for new features
- Update template documentation

## Release Process

Releases are managed by maintainers. The process includes:

1. Version bump in package.json
2. Update CHANGELOG.md
3. Create GitHub release with notes
4. Publish to npm (if applicable)

## Questions?

Feel free to open an issue with your question or reach out to the maintainers. We're here to help!

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Special thanks section

Thank you for contributing to DocuGen! 🎉