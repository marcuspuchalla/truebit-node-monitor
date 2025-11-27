/**
 * Privacy Violation Detector
 * Scans data for sensitive information that must never be transmitted in federation
 */

class PrivacyViolationDetector {
  static SENSITIVE_PATTERNS = {
    // Ethereum wallet address (0x followed by 40 hex characters)
    walletAddress: {
      pattern: /0x[a-fA-F0-9]{40}/g,
      description: 'Ethereum wallet address',
      severity: 'CRITICAL'
    },

    // UUID execution ID (standard UUID format)
    executionId: {
      pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
      description: 'Execution ID (UUID)',
      severity: 'HIGH'
    },

    // IPv4 address
    ipAddress: {
      pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      description: 'IP address',
      severity: 'HIGH'
    },

    // Private key patterns (various formats)
    privateKey: {
      pattern: /(?:private[_\s-]?key|priv[_\s-]?key|secret[_\s-]?key)[\s:=]+[a-fA-F0-9]{64}/gi,
      description: 'Private key',
      severity: 'CRITICAL'
    },

    // Exact timestamps (can be used for timing correlation)
    exactTimestamp: {
      pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
      description: 'Exact timestamp (should be rounded)',
      severity: 'MEDIUM'
    },

    // Sensitive field names in JSON
    sensitiveFields: {
      pattern: /"(input_data|output_data|error_data|execution_id|nodeAddress|walletAddress|privateKey)":/gi,
      description: 'Sensitive JSON field name',
      severity: 'HIGH'
    }
  };

  /**
   * Check data for privacy violations
   * @param {any} data - Data to check (object, string, or JSON)
   * @returns {Array} Array of violations found
   */
  static check(data) {
    const violations = [];
    let dataStr;

    // Convert data to string for pattern matching
    if (typeof data === 'string') {
      dataStr = data;
    } else if (typeof data === 'object') {
      try {
        dataStr = JSON.stringify(data);
      } catch (e) {
        return [{ error: 'Failed to serialize data for privacy check', severity: 'ERROR' }];
      }
    } else {
      dataStr = String(data);
    }

    // Check each pattern
    for (const [type, config] of Object.entries(this.SENSITIVE_PATTERNS)) {
      const matches = dataStr.match(config.pattern);

      if (matches && matches.length > 0) {
        violations.push({
          type,
          description: config.description,
          severity: config.severity,
          count: matches.length,
          examples: matches.slice(0, 3).map(m => this.maskSensitiveData(m, type)), // Show first 3, masked
          location: this.findLocation(data, matches[0])
        });
      }
    }

    return violations;
  }

  /**
   * Mask sensitive data for safe logging
   */
  static maskSensitiveData(data, type) {
    if (type === 'walletAddress') {
      return data.substring(0, 6) + '...' + data.substring(data.length - 4);
    } else if (type === 'privateKey' || type === 'executionId') {
      return '***REDACTED***';
    } else if (type === 'ipAddress') {
      const parts = data.split('.');
      return `${parts[0]}.${parts[1]}.***.***.`;
    }
    return '***';
  }

  /**
   * Find location of sensitive data in object
   */
  static findLocation(data, match) {
    if (typeof data !== 'object' || data === null) {
      return 'root';
    }

    const paths = [];

    function search(obj, path = []) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];

        if (typeof value === 'string' && value.includes(match)) {
          paths.push(currentPath.join('.'));
        } else if (typeof value === 'object' && value !== null) {
          search(value, currentPath);
        }
      }
    }

    search(data);
    return paths.length > 0 ? paths[0] : 'unknown';
  }

  /**
   * Assert that data is safe for federation transmission
   * Throws error if violations found
   */
  static assertSafe(data, context = 'data') {
    const violations = this.check(data);

    if (violations.length > 0) {
      const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
      const highViolations = violations.filter(v => v.severity === 'HIGH');

      if (criticalViolations.length > 0 || highViolations.length > 0) {
        const summary = violations.map(v =>
          `${v.severity}: ${v.description} (${v.count} found at ${v.location})`
        ).join('; ');

        throw new Error(`Privacy violation detected in ${context}: ${summary}`);
      }
    }

    return true;
  }

  /**
   * Get privacy score (0-100)
   * 100 = perfect privacy, 0 = critical violations
   */
  static getPrivacyScore(data) {
    const violations = this.check(data);

    if (violations.length === 0) {
      return 100;
    }

    let deductions = 0;

    for (const violation of violations) {
      switch (violation.severity) {
        case 'CRITICAL':
          deductions += 50;
          break;
        case 'HIGH':
          deductions += 20;
          break;
        case 'MEDIUM':
          deductions += 10;
          break;
        default:
          deductions += 5;
      }
    }

    return Math.max(0, 100 - deductions);
  }

  /**
   * Generate privacy report
   */
  static generateReport(data, context = 'data') {
    const violations = this.check(data);
    const score = this.getPrivacyScore(data);

    return {
      context,
      timestamp: new Date().toISOString(),
      privacyScore: score,
      status: score === 100 ? 'SAFE' : (score >= 80 ? 'WARNING' : 'UNSAFE'),
      violations: violations.length,
      details: violations,
      recommendation: score < 100 ? 'Remove or anonymize sensitive data before transmission' : 'Data is safe for federation'
    };
  }
}

export default PrivacyViolationDetector;
