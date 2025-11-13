# Contributing to Design Tokens Crawler

Thank you for your interest in contributing to the Design Tokens Crawler! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 16 or higher
- PostgreSQL 12 or higher with pgvector extension
- OpenAI API key (for AI features)
- Git

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/Designtokens.git
   cd Designtokens
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize Database**
   ```bash
   # Create PostgreSQL database
   createdb designtokens
   
   # Run schema
   npm run init-db
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

6. **Start Development Server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- Feature: `feature/description`
- Bug Fix: `fix/description`
- Documentation: `docs/description`
- Refactor: `refactor/description`

### Commit Messages

Follow conventional commits format:

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `test: add or update tests`
- `refactor: code refactoring`
- `chore: maintenance tasks`

### Pull Request Process

1. Create a new branch from `main`
2. Make your changes
3. Write/update tests
4. Ensure all tests pass: `npm test`
5. Update documentation if needed
6. Submit pull request with clear description

## Code Standards

### JavaScript Style

- Use ES6+ features
- Use `const` and `let`, avoid `var`
- Use async/await for asynchronous code
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code style

### Testing

- Write unit tests for new features
- Maintain or improve code coverage
- Test edge cases
- Mock external services (OpenAI, databases)

### Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for architectural changes
- Add JSDoc comments for public APIs
- Include examples for new features

## Project Structure

```
Designtokens/
├── __tests__/           # Test files
├── scripts/            # Utility scripts
├── server.js           # Main API server
├── crawler.js          # Web crawler
├── llm.js             # OpenAI integration
├── store.js           # Database operations
├── pdf-generator.js   # PDF generation
├── config.js          # Configuration
├── schema.sql         # Database schema
├── package.json       # Dependencies
└── README.md          # Documentation
```

## Areas for Contribution

### High Priority

1. **Enhanced Crawling**
   - Multi-page crawling support
   - Better JavaScript site handling
   - Mobile viewport support

2. **AI Improvements**
   - Better token normalization
   - More accurate brand voice analysis
   - Support for more design systems

3. **Testing**
   - Increase test coverage
   - Integration tests
   - E2E tests

### Medium Priority

1. **Performance**
   - Database query optimization
   - Better caching strategies
   - Concurrent crawling improvements

2. **Features**
   - Webhook support
   - Batch processing
   - Export to design tools

3. **Documentation**
   - More examples
   - Video tutorials
   - API documentation

### Low Priority

1. **UI/UX**
   - Web dashboard
   - Visual reports
   - Interactive previews

2. **Integrations**
   - Figma plugin
   - Slack notifications
   - CI/CD integration

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/crawler.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm run test:watch
```

### Writing Tests

Example test structure:

```javascript
describe('Feature Name', () => {
  describe('specific function', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Coverage Goals

- Aim for >80% coverage on new code
- All public APIs should be tested
- Critical paths require >90% coverage

## Code Review Process

### For Contributors

- Keep PRs focused and small
- Respond to feedback promptly
- Update PR based on review comments
- Ensure CI passes

### For Reviewers

- Review within 48 hours
- Be constructive and respectful
- Check code quality, tests, and docs
- Verify functionality locally

## Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, Node version, etc.
6. **Logs**: Relevant error messages

Use this template:

```markdown
**Bug Description**
[Clear description]

**Steps to Reproduce**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**
[What should happen]

**Actual Behavior**
[What actually happens]

**Environment**
- OS: [e.g., macOS 13.0]
- Node: [e.g., 18.0.0]
- Version: [e.g., 1.0.0]

**Logs**
```
[error logs]
```
```

## Feature Requests

When requesting features, include:

1. **Use Case**: Why is this needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other approaches considered
4. **Additional Context**: Any other info

## Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email security concerns to [security contact]
2. Provide detailed description
3. Include steps to reproduce
4. Suggest a fix if possible

## Questions and Support

- **Documentation**: Check README and ARCHITECTURE
- **Examples**: See examples.js
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in related documentation

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome diverse perspectives
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing private information
- Other unprofessional conduct

### Enforcement

Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report issues to project maintainers.

## Additional Resources

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Playwright Documentation](https://playwright.dev)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Thank You!

Your contributions help make this project better for everyone. We appreciate your time and effort!
