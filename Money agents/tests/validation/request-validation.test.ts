/**
 * Request Validation Tests
 * Tests for input validation, schema validation, and error handling
 */

// ============================================
// Validation Schemas
// ============================================
interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

class Validator {
  static required(value: unknown, field: string): ValidationError | null {
    if (value === undefined || value === null || value === '') {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  static minLength(value: string, min: number, field: string): ValidationError | null {
    if (value.length < min) {
      return { field, message: `${field} must be at least ${min} characters` };
    }
    return null;
  }

  static maxLength(value: string, max: number, field: string): ValidationError | null {
    if (value.length > max) {
      return { field, message: `${field} must not exceed ${max} characters` };
    }
    return null;
  }

  static pattern(value: string, regex: RegExp, field: string, message?: string): ValidationError | null {
    if (!regex.test(value)) {
      return { field, message: message || `${field} format is invalid` };
    }
    return null;
  }

  static min(value: number, min: number, field: string): ValidationError | null {
    if (value < min) {
      return { field, message: `${field} must be at least ${min}` };
    }
    return null;
  }

  static max(value: number, max: number, field: string): ValidationError | null {
    if (value > max) {
      return { field, message: `${field} must not exceed ${max}` };
    }
    return null;
  }

  static oneOf<T>(value: T, options: T[], field: string): ValidationError | null {
    if (!options.includes(value)) {
      return { field, message: `${field} must be one of: ${options.join(', ')}` };
    }
    return null;
  }

  static email(value: string, field: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { field, message: `${field} must be a valid email address` };
    }
    return null;
  }

  static url(value: string, field: string): ValidationError | null {
    try {
      new URL(value);
      return null;
    } catch {
      return { field, message: `${field} must be a valid URL` };
    }
  }

  static date(value: string, field: string): ValidationError | null {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { field, message: `${field} must be a valid date` };
    }
    return null;
  }

  static cuid(value: string, field: string): ValidationError | null {
    const cuidRegex = /^c[a-z0-9]{24}$/;
    if (!cuidRegex.test(value)) {
      return { field, message: `${field} must be a valid ID` };
    }
    return null;
  }
}

// ============================================
// Project Validation Tests
// ============================================
describe('Project Validation', () => {
  interface ProjectInput {
    name: string;
    description?: string;
    mode?: string;
  }

  function validateProject(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const data = input as ProjectInput;

    const nameError = Validator.required(data?.name, 'name');
    if (nameError) errors.push(nameError);

    if (data?.name) {
      const minLengthError = Validator.minLength(data.name, 1, 'name');
      if (minLengthError) errors.push(minLengthError);

      const maxLengthError = Validator.maxLength(data.name, 255, 'name');
      if (maxLengthError) errors.push(maxLengthError);
    }

    if (data?.mode) {
      const modeError = Validator.oneOf(data.mode, ['simulation', 'live'], 'mode');
      if (modeError) errors.push(modeError);
    }

    if (data?.description) {
      const descError = Validator.maxLength(data.description, 2000, 'description');
      if (descError) errors.push(descError);
    }

    return { valid: errors.length === 0, errors };
  }

  test('should validate required name', () => {
    const result = validateProject({});
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name', message: 'name is required' })
    );
  });

  test('should accept valid project data', () => {
    const result = validateProject({
      name: 'Test Project',
      description: 'A test project',
      mode: 'simulation',
    });
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject empty name', () => {
    const result = validateProject({ name: '' });
    
    expect(result.valid).toBe(false);
  });

  test('should reject name longer than 255 characters', () => {
    const result = validateProject({
      name: 'A'.repeat(256),
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name', message: expect.stringContaining('255') })
    );
  });

  test('should accept name with exactly 255 characters', () => {
    const result = validateProject({
      name: 'A'.repeat(255),
    });
    
    expect(result.valid).toBe(true);
  });

  test('should reject invalid mode', () => {
    const result = validateProject({
      name: 'Test',
      mode: 'invalid_mode',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'mode' })
    );
  });

  test('should accept valid modes', () => {
    const simulationResult = validateProject({ name: 'Test', mode: 'simulation' });
    const liveResult = validateProject({ name: 'Test', mode: 'live' });
    
    expect(simulationResult.valid).toBe(true);
    expect(liveResult.valid).toBe(true);
  });

  test('should reject description longer than 2000 characters', () => {
    const result = validateProject({
      name: 'Test',
      description: 'A'.repeat(2001),
    });
    
    expect(result.valid).toBe(false);
  });

  test('should accept undefined optional fields', () => {
    const result = validateProject({ name: 'Test' });
    
    expect(result.valid).toBe(true);
  });

  test('should handle null values', () => {
    const result = validateProject({ name: null });
    
    expect(result.valid).toBe(false);
  });
});

// ============================================
// Approval Validation Tests
// ============================================
describe('Approval Validation', () => {
  interface ApprovalInput {
    approvalId: string;
    approved: boolean;
    notes?: string;
  }

  function validateApproval(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const data = input as ApprovalInput;

    const idError = Validator.required(data?.approvalId, 'approvalId');
    if (idError) errors.push(idError);

    const approvedError = Validator.required(data?.approved, 'approved');
    if (approvedError) errors.push(approvedError);

    if (typeof data?.approved !== 'boolean') {
      errors.push({ field: 'approved', message: 'approved must be a boolean' });
    }

    if (data?.notes && typeof data.notes !== 'string') {
      errors.push({ field: 'notes', message: 'notes must be a string' });
    }

    return { valid: errors.length === 0, errors };
  }

  test('should require approvalId', () => {
    const result = validateApproval({ approved: true });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'approvalId' })
    );
  });

  test('should require approved boolean', () => {
    const result = validateApproval({ approvalId: 'test' });
    
    expect(result.valid).toBe(false);
  });

  test('should accept valid approval', () => {
    const result = validateApproval({
      approvalId: 'approval_123',
      approved: true,
      notes: 'Looks good',
    });
    
    expect(result.valid).toBe(true);
  });

  test('should reject non-boolean approved value', () => {
    const result = validateApproval({
      approvalId: 'test',
      approved: 'yes' as unknown as boolean,
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'approved', message: expect.stringContaining('boolean') })
    );
  });

  test('should accept without notes', () => {
    const result = validateApproval({
      approvalId: 'test',
      approved: false,
    });
    
    expect(result.valid).toBe(true);
  });
});

// ============================================
// Portfolio Validation Tests
// ============================================
describe('Portfolio Validation', () => {
  interface TradeInput {
    symbol: string;
    quantity: number;
    price: number;
    type: string;
  }

  function validateTrade(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const data = input as TradeInput;

    // Required fields
    ['symbol', 'quantity', 'price', 'type'].forEach(field => {
      const error = Validator.required((data as any)?.[field], field);
      if (error) errors.push(error);
    });

    // Symbol validation
    if (data?.symbol) {
      const symbolError = Validator.pattern(
        data.symbol,
        /^[A-Z]{1,5}$/,
        'symbol',
        'symbol must be 1-5 uppercase letters'
      );
      if (symbolError) errors.push(symbolError);
    }

    // Quantity validation
    if (typeof data?.quantity === 'number') {
      const qtyError = Validator.min(data.quantity, 1, 'quantity');
      if (qtyError) errors.push(qtyError);
    }

    // Price validation
    if (typeof data?.price === 'number') {
      const priceError = Validator.min(data.price, 0.01, 'price');
      if (priceError) errors.push(priceError);
    }

    // Type validation
    if (data?.type) {
      const typeError = Validator.oneOf(data.type, ['buy', 'sell'], 'type');
      if (typeError) errors.push(typeError);
    }

    return { valid: errors.length === 0, errors };
  }

  test('should validate valid buy order', () => {
    const result = validateTrade({
      symbol: 'AAPL',
      quantity: 100,
      price: 150.50,
      type: 'buy',
    });
    
    expect(result.valid).toBe(true);
  });

  test('should validate valid sell order', () => {
    const result = validateTrade({
      symbol: 'GOOGL',
      quantity: 50,
      price: 2800.00,
      type: 'sell',
    });
    
    expect(result.valid).toBe(true);
  });

  test('should reject invalid symbol format', () => {
    const result = validateTrade({
      symbol: 'aapl',
      quantity: 100,
      price: 150,
      type: 'buy',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'symbol' })
    );
  });

  test('should reject quantity less than 1', () => {
    const result = validateTrade({
      symbol: 'AAPL',
      quantity: 0,
      price: 150,
      type: 'buy',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'quantity' })
    );
  });

  test('should reject negative price', () => {
    const result = validateTrade({
      symbol: 'AAPL',
      quantity: 100,
      price: -10,
      type: 'buy',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'price' })
    );
  });

  test('should reject invalid trade type', () => {
    const result = validateTrade({
      symbol: 'AAPL',
      quantity: 100,
      price: 150,
      type: 'short',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'type' })
    );
  });

  test('should reject missing required fields', () => {
    const result = validateTrade({});
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});

// ============================================
// User Validation Tests
// ============================================
describe('User Validation', () => {
  interface UserInput {
    email: string;
    name?: string;
    role?: string;
  }

  function validateUser(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const data = input as UserInput;

    const emailError = Validator.required(data?.email, 'email');
    if (emailError) errors.push(emailError);

    if (data?.email) {
      const emailFormatError = Validator.email(data.email, 'email');
      if (emailFormatError) errors.push(emailFormatError);
    }

    if (data?.name) {
      const nameError = Validator.maxLength(data.name, 100, 'name');
      if (nameError) errors.push(nameError);
    }

    if (data?.role) {
      const roleError = Validator.oneOf(data.role, ['admin', 'analyst', 'viewer'], 'role');
      if (roleError) errors.push(roleError);
    }

    return { valid: errors.length === 0, errors };
  }

  test('should validate valid user', () => {
    const result = validateUser({
      email: 'test@example.com',
      name: 'Test User',
      role: 'analyst',
    });
    
    expect(result.valid).toBe(true);
  });

  test('should require email', () => {
    const result = validateUser({});
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    );
  });

  test('should reject invalid email format', () => {
    const result = validateUser({ email: 'not-an-email' });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email', message: expect.stringContaining('email') })
    );
  });

  test('should reject invalid role', () => {
    const result = validateUser({
      email: 'test@example.com',
      role: 'superuser',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'role' })
    );
  });

  test('should accept all valid roles', () => {
    const roles = ['admin', 'analyst', 'viewer'];
    
    roles.forEach(role => {
      const result = validateUser({
        email: 'test@example.com',
        role,
      });
      
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// ERV Policy Validation Tests
// ============================================
describe('ERV Policy Validation', () => {
  interface PolicyInput {
    name: string;
    category: string;
    pattern: string;
    action: string;
    priority?: number;
    enabled?: boolean;
  }

  function validatePolicy(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const data = input as PolicyInput;

    // Required fields
    ['name', 'category', 'pattern', 'action'].forEach(field => {
      const error = Validator.required((data as any)?.[field], field);
      if (error) errors.push(error);
    });

    // Category validation
    if (data?.category) {
      const catError = Validator.oneOf(
        data.category,
        ['financial', 'security', 'compliance', 'operational'],
        'category'
      );
      if (catError) errors.push(catError);
    }

    // Action validation
    if (data?.action) {
      const actionError = Validator.oneOf(
        data.action,
        ['execute', 'refuse', 'verify'],
        'action'
      );
      if (actionError) errors.push(actionError);
    }

    // Priority validation
    if (typeof data?.priority === 'number') {
      const priorityError = Validator.min(data.priority, 0, 'priority');
      if (priorityError) errors.push(priorityError);
      
      const maxError = Validator.max(data.priority, 100, 'priority');
      if (maxError) errors.push(maxError);
    }

    // Validate regex pattern
    if (data?.pattern) {
      try {
        new RegExp(data.pattern);
      } catch (e) {
        errors.push({ field: 'pattern', message: 'pattern must be a valid regex' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  test('should validate valid policy', () => {
    const result = validatePolicy({
      name: 'Test Policy',
      category: 'financial',
      pattern: 'execute_trade',
      action: 'verify',
      priority: 5,
    });
    
    expect(result.valid).toBe(true);
  });

  test('should reject invalid category', () => {
    const result = validatePolicy({
      name: 'Test',
      category: 'invalid',
      pattern: 'test',
      action: 'execute',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'category' })
    );
  });

  test('should reject invalid action', () => {
    const result = validatePolicy({
      name: 'Test',
      category: 'financial',
      pattern: 'test',
      action: 'invalid',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'action' })
    );
  });

  test('should reject negative priority', () => {
    const result = validatePolicy({
      name: 'Test',
      category: 'financial',
      pattern: 'test',
      action: 'execute',
      priority: -1,
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'priority' })
    );
  });

  test('should reject invalid regex pattern', () => {
    const result = validatePolicy({
      name: 'Test',
      category: 'financial',
      pattern: '[invalid(regex',
      action: 'execute',
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'pattern', message: expect.stringContaining('regex') })
    );
  });

  test('should accept valid regex patterns', () => {
    const patterns = ['execute_.*', '^trade$', '.*', '[a-z]+'];
    
    patterns.forEach(pattern => {
      const result = validatePolicy({
        name: 'Test',
        category: 'financial',
        pattern,
        action: 'execute',
      });
      
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// Date Validation Tests
// ============================================
describe('Date Validation', () => {
  test('should accept valid ISO date', () => {
    const result = Validator.date('2024-01-15T10:30:00Z', 'date');
    
    expect(result).toBeNull();
  });

  test('should accept valid date string', () => {
    const result = Validator.date('2024-01-15', 'date');
    
    expect(result).toBeNull();
  });

  test('should reject invalid date', () => {
    const result = Validator.date('not-a-date', 'date');
    
    expect(result).not.toBeNull();
    expect(result?.field).toBe('date');
  });

  test('should reject empty date', () => {
    const result = Validator.date('', 'date');
    
    expect(result).not.toBeNull();
  });
});

// ============================================
// URL Validation Tests
// ============================================
describe('URL Validation', () => {
  test('should accept valid HTTP URL', () => {
    const result = Validator.url('http://example.com', 'url');
    
    expect(result).toBeNull();
  });

  test('should accept valid HTTPS URL', () => {
    const result = Validator.url('https://example.com/path?query=1', 'url');
    
    expect(result).toBeNull();
  });

  test('should reject invalid URL', () => {
    const result = Validator.url('not-a-url', 'url');
    
    expect(result).not.toBeNull();
  });

  test('should reject empty URL', () => {
    const result = Validator.url('', 'url');
    
    expect(result).not.toBeNull();
  });
});

// ============================================
// Composite Validation Tests
// ============================================
describe('Composite Validation', () => {
  function validateAll(validators: (() => ValidationError | null)[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    validators.forEach(validator => {
      const error = validator();
      if (error) errors.push(error);
    });
    
    return { valid: errors.length === 0, errors };
  }

  test('should combine multiple validators', () => {
    const value = 'test@example.com';
    
    const result = validateAll([
      () => Validator.required(value, 'email'),
      () => Validator.email(value, 'email'),
    ]);
    
    expect(result.valid).toBe(true);
  });

  test('should collect all errors', () => {
    const value = '';
    
    const result = validateAll([
      () => Validator.required(value, 'field'),
      () => Validator.minLength(value, 5, 'field'),
    ]);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
