# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to the repository maintainers privately. You can find contact information in the repository or reach out via GitHub's private vulnerability reporting feature.

### What to Include

When reporting a vulnerability, please include:

1. **Description**: A clear description of the vulnerability
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Impact**: Your assessment of the potential impact
4. **Affected Components**: Which parts of the system are affected
5. **Suggested Fix**: If you have one (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Investigation**: We'll investigate and validate the issue
3. **Communication**: We'll keep you informed of our progress
4. **Credit**: With your permission, we'll credit you in the fix

## Security Considerations

### Docker Socket Access

**Important**: This application requires access to the Docker socket to function. This grants significant privileges:

- The container can list and inspect all containers on the host
- The container can read logs from any container
- The socket is mounted read-only (`:ro`) to limit write operations

**Mitigations**:
- Run in an isolated environment when possible
- Use network segmentation
- Monitor container activity
- Review the source code before deployment

### Authentication

The application uses challenge-response authentication:

- Passwords are **never transmitted** over the network
- Server generates a random challenge
- Client computes `SHA-256(challenge + password)`
- Only the hash is sent for verification
- Challenges expire after 60 seconds
- Timing-safe comparison prevents timing attacks

**Best Practices**:
- Use strong, unique passwords
- Set passwords via environment variables (not command line)
- Use HTTPS in production (docker-compose.https.yml)

### Data Storage

- **SQLite Database**: Stores task history, invoices, and logs locally
- **No Encryption at Rest**: The database is not encrypted; secure your host
- **Passwords in localStorage**: Stored for re-authentication; clear on logout

### Federation Privacy

When federation is enabled, data is anonymized before sharing:

**Never Shared**:
- Wallet addresses
- Private keys
- Task inputs/outputs
- Your IP address
- Exact metric values

**Anonymization Techniques**:
- SHA-256 hashing with unique per-node salt
- Metric bucketing (ranges instead of exact values)
- Timestamp rounding to 5-minute intervals
- Strict validation to block sensitive patterns

### Network Security

**CORS**: By default, CORS allows all origins. For production:
```bash
ALLOWED_ORIGINS=https://your-domain.com
```

**HTTPS**: Use `docker-compose.https.yml` for automatic TLS via Traefik and Let's Encrypt.

**Rate Limiting**: Authentication endpoints are rate-limited to prevent brute force attacks.

## Security Checklist for Deployment

- [ ] Use HTTPS in production
- [ ] Set strong `TASK_DATA_PASSWORD`
- [ ] Restrict `ALLOWED_ORIGINS` to your domain
- [ ] Run on an isolated network when possible
- [ ] Keep Docker and host OS updated
- [ ] Monitor container logs for suspicious activity
- [ ] Regularly backup your database
- [ ] Review federation settings if enabled

## Known Limitations

1. **Docker Socket**: Required for functionality but grants broad read access
2. **No MFA**: Single-factor password authentication only
3. **Local Storage**: Authentication state stored in browser localStorage
4. **No Audit Log**: Authentication attempts are not logged to a persistent audit trail

## Dependencies

We regularly update dependencies to address known vulnerabilities. Run `npm audit` to check for issues in your deployment.

## Acknowledgments

We thank the security researchers who have helped improve this project by responsibly disclosing vulnerabilities.
