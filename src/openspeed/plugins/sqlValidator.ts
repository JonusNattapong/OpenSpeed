/**
 * SQL Query Validator - Prevents SQL Injection
 * 
 * Validates SQL queries to prevent common SQL injection attacks
 */

export interface QueryValidationOptions {
  allowDynamicQueries?: boolean;
  maxQueryLength?: number;
  forbiddenPatterns?: RegExp[];
  logViolations?: boolean;
}

export class SQLQueryValidator {
  private options: Required<QueryValidationOptions>;
  private violations: Array<{
    timestamp: number;
    query: string;
    reason: string;
    clientIP?: string;
  }> = [];

  constructor(options: QueryValidationOptions = {}) {
    this.options = {
      allowDynamicQueries: false,
      maxQueryLength: 10000,
      forbiddenPatterns: [
        // SQL comments
        /--/,
        /#/,
        /\/\*/,
        
        // String concatenation in queries
        /\+\s*['"]/,
        
        // Template literals
        /\$\{/,
        
        // Multiple statements
        /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)/i,
        
        // UNION-based injection
        /UNION.*SELECT/i,
        
        // Blind SQL injection
        /WAITFOR\s+DELAY/i,
        /BENCHMARK\s*\(/i,
        /SLEEP\s*\(/i,
        
        // Information schema access
        /information_schema/i,
        /sysobjects/i,
        /syscolumns/i,
      ],
      logViolations: true,
      ...options,
    };
  }

  /**
   * Validate a SQL query
   */
  validate(query: string, context?: { clientIP?: string; userId?: string }): void {
    // Check query length
    if (query.length > this.options.maxQueryLength) {
      this.logViolation(query, 'Query exceeds maximum length', context?.clientIP);
      throw new Error(`SQL Query too long: ${query.length} characters (max: ${this.options.maxQueryLength})`);
    }

    // Check for string interpolation
    if (query.includes('${') || query.includes('` +')) {
      this.logViolation(query, 'String interpolation detected', context?.clientIP);
      throw new Error(
        'SQL Injection Risk: String interpolation detected in query. Use parameterized queries instead.\n' +
        'Example: query("SELECT * FROM users WHERE id = ?", [userId])'
      );
    }

    // Check forbidden patterns
    for (const pattern of this.options.forbiddenPatterns) {
      if (pattern.test(query)) {
        this.logViolation(query, `Forbidden pattern: ${pattern}`, context?.clientIP);
        throw new Error(
          `SQL Injection Risk: Forbidden pattern detected in query: ${pattern}\n` +
          'This query contains potentially dangerous SQL constructs.'
        );
      }
    }

    // Check for parameter placeholders
    if (!this.options.allowDynamicQueries) {
      const hasParams = query.includes('?') || query.includes('$1') || query.includes(':param');
      const hasValues = query.match(/=\s*['"][^'"]+['"]/);
      
      if (hasValues && !hasParams) {
        this.logViolation(query, 'Hardcoded values without parameters', context?.clientIP);
        console.warn(
          '[SQL VALIDATOR] Query contains hardcoded values. Consider using parameterized queries for better security.'
        );
      }
    }
  }

  /**
   * Validate and sanitize query parameters
   */
  validateParams(params: any[]): any[] {
    return params.map(param => {
      // Check for SQL injection attempts in parameters
      if (typeof param === 'string') {
        // Check for common SQL injection patterns
        const dangerous = [
          /'/g, // Single quotes
          /--/g, // SQL comments
          /;/g, // Statement terminators
          /UNION/gi,
          /SELECT/gi,
          /INSERT/gi,
          /UPDATE/gi,
          /DELETE/gi,
          /DROP/gi,
          /EXEC/gi,
        ];

        for (const pattern of dangerous) {
          if (pattern.test(param)) {
            console.warn(`[SQL VALIDATOR] Suspicious parameter detected: ${param}`);
          }
        }
      }

      return param;
    });
  }

  /**
   * Create a safe parameterized query
   */
  createSafeQuery(template: string, params: any[]): { query: string; params: any[] } {
    // Validate template
    this.validate(template);

    // Validate parameters
    const safeParams = this.validateParams(params);

    return {
      query: template,
      params: safeParams,
    };
  }

  /**
   * Log security violation
   */
  private logViolation(query: string, reason: string, clientIP?: string): void {
    if (this.options.logViolations) {
      const violation = {
        timestamp: Date.now(),
        query: query.substring(0, 200), // Truncate for logging
        reason,
        clientIP,
      };

      this.violations.push(violation);

      console.error('[SQL INJECTION ATTEMPT]', JSON.stringify(violation, null, 2));

      // Keep only last 100 violations
      if (this.violations.length > 100) {
        this.violations = this.violations.slice(-100);
      }
    }
  }

  /**
   * Get violation log
   */
  getViolations(): typeof this.violations {
    return [...this.violations];
  }

  /**
   * Clear violation log
   */
  clearViolations(): void {
    this.violations = [];
  }
}

// Global validator instance
let globalValidator: SQLQueryValidator | null = null;

/**
 * Get or create global SQL validator
 */
export function getSQLValidator(): SQLQueryValidator {
  if (!globalValidator) {
    globalValidator = new SQLQueryValidator({
      allowDynamicQueries: process.env.ALLOW_DYNAMIC_SQL === 'true',
      logViolations: process.env.NODE_ENV !== 'test',
    });
  }
  return globalValidator;
}

/**
 * Validate SQL query (convenience function)
 */
export function validateSQL(query: string, params?: any[]): void {
  const validator = getSQLValidator();
  validator.validate(query);
  
  if (params) {
    validator.validateParams(params);
  }
}

/**
 * Create safe SQL query (convenience function)
 */
export function sql(template: string, params: any[]): { query: string; params: any[] } {
  const validator = getSQLValidator();
  return validator.createSafeQuery(template, params);
}
