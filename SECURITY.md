# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.8.x   | :white_check_mark: |
| 0.7.x   | :white_check_mark: |
| < 0.7   | :x:                |

## Reporting a Vulnerability

We take the security of OpenSpeed seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

📧 **security@openspeed.dev**

If you prefer, you can also use GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/yourusername/openspeed/security)
2. Click "Report a vulnerability"
3. Fill out the form with as much detail as possible

### What to Include

Please include the following information:

- **Type of issue** (e.g., SQL injection, XSS, authentication bypass)
- **Full paths** of source file(s) related to the manifestation of the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

### What to Expect

When you report a vulnerability, you can expect:

1. **Acknowledgment**: Within **24 hours** of your report
2. **Initial Assessment**: Within **48 hours**, including severity classification
3. **Regular Updates**: At least every **72 hours** until resolution
4. **Fix Timeline**:
   - **Critical**: 1-3 days
   - **High**: 3-7 days
   - **Medium**: 7-14 days
   - **Low**: 14-30 days

### Disclosure Policy

- **Coordinated Disclosure**: We follow responsible disclosure practices
- **Public Disclosure**: Only after a fix is available and deployed
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Bug Bounty

Currently, we do not offer a paid bug bounty program. However:

- All reporters will be publicly credited (if desired)
- Significant findings may receive OpenSpeed swag
- We deeply appreciate your help in keeping OpenSpeed secure

## Security Updates

Security updates will be released as:

1. **Patch version** (0.8.x → 0.8.y) for fixes that don't break backward compatibility
2. **Minor version** (0.8.x → 0.9.0) if fixes require breaking changes

### Staying Informed

Subscribe to security updates:

- Watch [GitHub Releases](https://github.com/yourusername/openspeed/releases)
- Follow [@OpenSpeedJS](https://twitter.com/openspeedjs) on Twitter
- Join our [Discord community](https://discord.gg/openspeed)

## Known Vulnerabilities

Current security advisories: [Security Advisories](https://github.com/yourusername/openspeed/security/advisories)

### Recently Fixed

- **0.8.1** (2024-XX-XX):
  - Fixed SQL injection vulnerability in auth plugin
  - Enhanced CSRF protection with origin validation
  - Added JSX raw HTML security warnings
  - Improved file upload validation

## Security Features

OpenSpeed includes built-in security features:

### 🔒 Authentication & Authorization
- Bcrypt password hashing (12+ rounds recommended)
- JWT token management
- Session management with secure cookies

### 🛡️ Input Validation
- Zod schema validation
- SQL injection prevention
- XSS protection
- CSRF tokens

### 🔐 Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options

### 📁 File Upload Security
- MIME type validation
- File size limits
- Malware scanning (ClamAV integration)
- Secure filename generation

### ⚡ Rate Limiting
- Configurable rate limits
- Brute force protection
- DDoS mitigation

### 🔍 Security Tools
- Automated vulnerability scanner
- Auto-fix for common issues
- Security test suite
- Dependency auditing

## Security Best Practices

For developers using OpenSpeed:

1. **Always validate user input** using schemas
2. **Use parameterized queries** for SQL
3. **Enable CSRF protection** for state-changing operations
4. **Set secure headers** in production
5. **Use HTTPS** in production
6. **Keep dependencies updated** (`npm audit`)
7. **Run security scans** regularly (`npm run security:scan`)
8. **Never commit secrets** to version control
9. **Use environment variables** for sensitive data
10. **Implement rate limiting** on authentication endpoints

Read the full [Security Guide](./docs/security/SECURITY_GUIDE.md) for detailed recommendations.

## Security Audit

We conduct regular security audits:

- **Internal**: Monthly automated scans
- **Dependency**: Weekly `npm audit` checks
- **External**: Annual third-party penetration testing

Latest audit report: [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)

## Security Tools

Run security checks on your codebase:

```bash
# Scan for vulnerabilities
npm run security:scan

# Export detailed JSON report
npm run security:scan:json

# Auto-fix common security issues
npm run security:fix

# Preview fixes without applying
npm run security:fix:dry

# Check dependency vulnerabilities
npm audit

# Auto-fix dependency issues
npm audit fix
```

## Compliance

OpenSpeed aims to help you meet common compliance requirements:

- **OWASP Top 10**: Built-in mitigations for all top 10 vulnerabilities
- **CWE Top 25**: Protection against most common weaknesses
- **GDPR**: Tools for data protection and privacy
- **PCI DSS**: Security features for payment processing
- **SOC 2**: Audit logging and access controls

## Hall of Fame

We thank the following security researchers for responsibly disclosing vulnerabilities:

<!-- Will be updated as researchers report issues -->

_No vulnerabilities reported yet._

## Contact

- **Security Team**: security@openspeed.dev
- **General Issues**: https://github.com/yourusername/openspeed/issues
- **Discord**: https://discord.gg/openspeed
- **Twitter**: [@OpenSpeedJS](https://twitter.com/openspeedjs)

---

**Thank you for helping keep OpenSpeed and its users safe!** 🙏
