---
name: Bug report
about: Create a report to help us improve the Autonomous Web Framework
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔄 Steps to Reproduce
Steps to reproduce the behavior:
1. Initialize framework with '...'
2. Create app with requirements '...'
3. Run command '...'
4. See error

## ✅ Expected Behavior
A clear and concise description of what you expected to happen.

## ❌ Actual Behavior
A clear and concise description of what actually happened.

## 💻 Environment
- OS: [e.g. macOS 13.0, Windows 11, Ubuntu 22.04]
- Node.js version: [e.g. 18.17.0]
- Framework version: [e.g. 1.0.0]
- AI Provider: [e.g. OpenAI, Anthropic]

## 📝 Configuration
```javascript
// Your framework configuration (remove sensitive data like API keys)
const config = {
  aiProvider: 'openai',
  database: { type: 'postgresql' },
  // ... other relevant config
};
```

## 📋 Code Sample
```javascript
// Minimal code to reproduce the issue
const framework = new AutonomousWebFramework(config);
await framework.createApp('your requirements here');
```

## 📊 Error Messages
```
Paste full error messages and stack traces here
```

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 📝 Logs
```
Paste relevant log output here (remove sensitive information)
```

## 🔍 Additional Context
Add any other context about the problem here.

## 🚀 Possible Solution
If you have ideas on how to fix the issue, please describe them here.

## ☑️ Checklist
- [ ] I have searched existing issues to make sure this is not a duplicate
- [ ] I have included all relevant information
- [ ] I have removed sensitive information (API keys, passwords, etc.)
- [ ] I have tested with the latest version of the framework