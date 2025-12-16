# Contributing to TrueBit Node Monitor

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to be respectful and constructive in all interactions. We welcome contributors of all skill levels and backgrounds.

## How to Contribute

### Reporting Bugs

1. **Search existing issues** to avoid duplicates
2. **Use the bug report template** if available
3. Include:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Docker version, Node.js version)
   - Relevant logs or screenshots

### Suggesting Features

1. **Search existing issues** for similar suggestions
2. **Open a new issue** with the "feature request" label
3. Describe:
   - The problem you're trying to solve
   - Your proposed solution
   - Alternative approaches you've considered

### Submitting Pull Requests

1. **Fork the repository** and create a feature branch
2. **Follow the coding style** of the project
3. **Write tests** for new functionality
4. **Update documentation** if needed
5. **Ensure all tests pass** before submitting
6. **Create a descriptive PR** explaining your changes

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Docker 20.10 or higher (for testing)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/truebit-node-monitor.git
cd truebit-node-monitor

# Install dependencies
npm install

# Backend development
cd backend
npm run dev

# Frontend development (separate terminal)
cd frontend
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Run with coverage
npm run test:coverage
```

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build

# Build Docker image
docker build -t truebit-node-monitor .
```

## Project Structure

```
truebit-node-monitor/
├── backend/           # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── db/        # SQLite database layer
│   │   ├── docker/    # Docker client and log readers
│   │   ├── federation/# Federation client and anonymizer
│   │   ├── parsers/   # Log parsing utilities
│   │   ├── routes/    # API route handlers
│   │   ├── websocket/ # WebSocket server
│   │   └── index.ts   # Main entry point
│   └── package.json
├── frontend/          # Vue.js frontend
│   ├── src/
│   │   ├── components/# Vue components
│   │   ├── composables/# Vue composables (shared state)
│   │   ├── views/     # Page views
│   │   └── App.vue    # Root component
│   └── package.json
├── docker-compose.*.yml  # Docker deployment configs
└── Dockerfile           # Multi-stage Docker build
```

## Coding Guidelines

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define types for all function parameters and return values
- Avoid `any` type when possible

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- Add semicolons at end of statements
- Use meaningful variable and function names

### Git Commits

- Use descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 72 characters
- Reference issue numbers when applicable

Example:
```
Fix task status not updating in dashboard (#42)

- Update WebSocket handler to emit status changes
- Add error boundary for failed task rendering
```

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update tests for any changed functionality
- Ensure CI passes before requesting review
- Respond to review feedback promptly

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` for beginner-friendly tasks.

### Help Wanted

Issues labeled `help wanted` are more complex and benefit from community input.

### Current Priorities

- Improving test coverage
- Documentation improvements
- Performance optimizations
- Accessibility improvements

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, follow the process described in [SECURITY.md](SECURITY.md).

## Questions?

- Open a [discussion](https://github.com/marcuspuchalla/truebit-node-monitor/discussions)
- Check existing issues and documentation
- Ask in the issue if you're working on a specific problem

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
