/**
 * Secure Folder Upload Service
 * Handles uploading and management of agents, MCPs, CLIs, and skills
 * 
 * SECURITY FIXES:
 * - Path traversal prevention
 * - File type validation
 * - Malicious code detection
 * - Size limits enforcement
 * - Content sanitization
 * - Quarantine for suspicious files
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============================================
// Types and Interfaces
// ============================================

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadResult {
  id: string;
  type: 'agent' | 'mcp' | 'cli' | 'skill';
  name: string;
  version: string;
  path: string;
  files: string[];
  manifest: ComponentManifest;
  validated: boolean;
  warnings: string[];
  createdAt: Date;
}

export interface ComponentManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  entry: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  config?: Record<string, unknown>;
  endpoints?: ComponentEndpoint[];
  tools?: ComponentTool[];
}

export interface ComponentEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
}

export interface ComponentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  returns: string;
}

export interface UploadedComponent {
  id: string;
  type: 'agent' | 'mcp' | 'cli' | 'skill';
  name: string;
  version: string;
  path: string;
  manifest: ComponentManifest;
  enabled: boolean;
  validated: boolean;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Security Constants
// ============================================

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.json', '.md', '.yaml', '.yml', '.txt',
  '.py', '.sh', '.env.example', '.config', '.schema',
  '.mjs', '.cjs', '.jsx', '.tsx',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bat', '.cmd',
  '.ps1', '.vbs', '.jar', '.war', '.ear',
  '.app', '.dmg', '.pkg', '.deb', '.rpm',
];

const DANGEROUS_PATTERNS = [
  // Code execution
  /\beval\s*\(/gi,
  /new\s+Function\s*\(/gi,
  /Function\s*\(/gi,
  
  // Process execution
  /require\s*\(\s*['"]child_process['"]\s*\)/gi,
  /import\s+.*['"]child_process['"]/gi,
  /exec\s*\(/gi,
  /spawn\s*\(/gi,
  /execSync\s*\(/gi,
  /spawnSync\s*\(/gi,
  
  // File system manipulation
  /require\s*\(\s*['"]fs['"]\s*\)/gi,
  /import\s+.*['"]fs['"]/gi,
  /\.writeFile\s*\(/gi,
  /\.writeFileSync\s*\(/gi,
  /\.unlink\s*\(/gi,
  /\.unlinkSync\s*\(/gi,
  /\.rm\s*\(/gi,
  /\.rmSync\s*\(/gi,
  /\.chmod\s*\(/gi,
  /\.chmodSync\s*\(/gi,
  
  // Shell injection
  /\$\(/g,
  /`[^`]*\$\{/g,
  /process\.env/g,
  
  // Network operations
  /require\s*\(\s*['"]net['"]\s*\)/gi,
  /require\s*\(\s*['"]http['"]\s*\)/gi,
  /require\s*\(\s*['"]https['"]\s*\)/gi,
  
  // Dangerous globals
  /global\s*\[/gi,
  /global\.\w+/gi,
  /process\.binding/gi,
  
  // Prototype pollution
  /__proto__/gi,
  /prototype\s*\[/gi,
  /constructor\s*\.\s*prototype/gi,
  
  // Secret exfiltration
  /fetch\s*\(\s*['"]https?:\/\/(?!api\.stripe\.com|api\.openai\.com)/gi,
  /axios\s*\(\s*\{[^}]*url\s*:\s*['"]https?:\/\/(?!api\.stripe\.com|api\.openai\.com)/gi,
];

const DANGEROUS_PERMISSIONS = [
  'file:read:all',
  'file:write:all',
  'network:unrestricted',
  'system:exec',
  'database:admin',
  'secrets:read',
  'secrets:write',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FOLDER_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_UPLOAD = 500;
const MAX_PATH_LENGTH = 4096;

// ============================================
// Secure Upload Service Class
// ============================================

export class SecureUploadService {
  private basePath: string;
  private quarantinePath: string;
  private allowedExtensions: Set<string>;
  private dangerousExtensions: Set<string>;
  private maxFileSize: number;
  private maxFolderSize: number;
  private maxFilesPerUpload: number;
  private uploadLog: Array<{ id: string; type: string; timestamp: Date; files: number; warnings: string[] }> = [];

  constructor() {
    this.basePath = '/home/z/my-project/uploads';
    this.quarantinePath = '/home/z/my-project/quarantine';
    this.allowedExtensions = ALLOWED_EXTENSIONS;
    this.dangerousExtensions = DANGEROUS_EXTENSIONS;
    this.maxFileSize = MAX_FILE_SIZE;
    this.maxFolderSize = MAX_FOLDER_SIZE;
    this.maxFilesPerUpload = MAX_FILES_PER_UPLOAD;
    
    this.initializeDirectories();
  }

  /**
   * Initialize storage directories
   */
  private async initializeDirectories(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(this.quarantinePath, { recursive: true });
  }

  /**
   * Process uploaded folder with security checks
   */
  async processFolderUpload(
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    files: UploadedFile[]
  ): Promise<UploadResult> {
    const componentId = uuidv4();
    const warnings: string[] = [];
    
    // Validate file count
    if (files.length === 0) {
      throw new Error('No files provided');
    }
    if (files.length > this.maxFilesPerUpload) {
      throw new Error(`Too many files. Maximum is ${this.maxFilesPerUpload}`);
    }

    let totalSize = 0;
    const processedFiles: Array<{ relativePath: string; buffer: Buffer; safe: boolean }> = [];
    let manifest: ComponentManifest | null = null;

    // First pass: Validate all files
    for (const file of files) {
      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File ${file.originalname} exceeds maximum size of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      totalSize += file.size;
      if (totalSize > this.maxFolderSize) {
        throw new Error(`Total folder size exceeds maximum of ${this.maxFolderSize / 1024 / 1024}MB`);
      }

      // Validate and sanitize filename
      const sanitizedPath = this.sanitizePath(file.originalname);
      if (!sanitizedPath) {
        throw new Error(`Invalid file path: ${file.originalname}`);
      }

      // Validate extension
      const ext = path.extname(sanitizedPath).toLowerCase();
      if (this.dangerousExtensions.has(ext)) {
        warnings.push(`File ${file.originalname} has a dangerous extension and was rejected`);
        continue;
      }
      if (!this.allowedExtensions.has(ext) && !sanitizedPath.startsWith('.')) {
        warnings.push(`File ${file.originalname} has an unusual extension: ${ext}`);
      }

      // Scan for malicious content
      const scanResult = this.scanContent(file.buffer.toString('utf-8'), file.originalname);
      if (scanResult.threats.length > 0) {
        warnings.push(`File ${file.originalname} contains potentially dangerous patterns: ${scanResult.threats.join(', ')}`);
        
        // Quarantine the file instead of rejecting entirely
        await this.quarantineFile(componentId, sanitizedPath, file.buffer, scanResult.threats);
        continue;
      }

      // Check for manifest
      if (sanitizedPath.endsWith('manifest.json') || sanitizedPath.endsWith('package.json')) {
        try {
          manifest = JSON.parse(file.buffer.toString('utf-8'));
        } catch {
          warnings.push(`Invalid JSON in ${sanitizedPath}`);
        }
      }

      processedFiles.push({
        relativePath: sanitizedPath,
        buffer: file.buffer,
        safe: scanResult.safe,
      });
    }

    // Create component directory
    const componentPath = path.join(this.basePath, `${type}s`, componentId);
    await fs.mkdir(componentPath, { recursive: true });

    const writtenFiles: string[] = [];

    try {
      // Write files
      for (const { relativePath, buffer } of processedFiles) {
        const fullPath = path.join(componentPath, relativePath);
        
        // Ensure we're not writing outside the component directory (path traversal check)
        const resolvedPath = path.resolve(fullPath);
        const resolvedComponentPath = path.resolve(componentPath);
        if (!resolvedPath.startsWith(resolvedComponentPath)) {
          throw new Error(`Path traversal attempt detected: ${relativePath}`);
        }

        // Create subdirectories if needed
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Write file
        await fs.writeFile(fullPath, buffer);
        writtenFiles.push(relativePath);
      }

      // Create default manifest if needed
      if (!manifest) {
        manifest = await this.createDefaultManifest(type, componentId, writtenFiles);
      }

      // Validate manifest permissions
      const permissionCheck = this.validatePermissions(manifest);
      if (!permissionCheck.valid) {
        warnings.push(...permissionCheck.issues);
      }

      // Validate component structure
      const structureValid = await this.validateComponent(type, componentPath, manifest);

      // Save to database record
      await this.saveComponentRecord(componentId, type, componentPath, manifest, structureValid, warnings);

      // Log upload
      this.logUpload(componentId, type, files.length, warnings);

      return {
        id: componentId,
        type,
        name: manifest.name,
        version: manifest.version,
        path: componentPath,
        files: writtenFiles,
        manifest,
        validated: structureValid && warnings.filter(w => w.includes('dangerous')).length === 0,
        warnings,
        createdAt: new Date(),
      };

    } catch (error) {
      // Cleanup on failure
      await fs.rm(componentPath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Sanitize file path to prevent path traversal
   */
  private sanitizePath(filename: string): string | null {
    // Remove null bytes
    let sanitized = filename.replace(/\x00/g, '');
    
    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');
    
    // Remove leading slashes and dots
    sanitized = sanitized.replace(/^[/\.]+/, '');
    
    // Check for path traversal attempts
    if (sanitized.includes('..')) {
      return null;
    }
    
    // Check for absolute paths
    if (path.isAbsolute(sanitized)) {
      return null;
    }
    
    // Check path length
    if (sanitized.length > MAX_PATH_LENGTH) {
      return null;
    }
    
    // Validate characters
    const validPathRegex = /^[a-zA-Z0-9_\-./]+$/;
    if (!validPathRegex.test(sanitized)) {
      // Allow more characters but log warning
      const cleaned = sanitized.replace(/[^\w\-./]/g, '_');
      return cleaned || null;
    }
    
    return sanitized;
  }

  /**
   * Scan content for malicious patterns
   */
  private scanContent(content: string, filename: string): { safe: boolean; threats: string[] } {
    const threats: string[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        threats.push(`Suspicious pattern found: ${match?.[0]?.substring(0, 50)}...`);
      }
    }

    // Check for base64 encoded suspicious content
    const base64Pattern = /atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/g;
    let base64Match;
    while ((base64Match = base64Pattern.exec(content)) !== null) {
      try {
        const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(decoded)) {
            threats.push('Base64 encoded suspicious content detected');
            break;
          }
        }
      } catch {
        // Invalid base64, ignore
      }
    }

    return {
      safe: threats.length === 0,
      threats,
    };
  }

  /**
   * Quarantine suspicious file
   */
  private async quarantineFile(
    componentId: string,
    filename: string,
    buffer: Buffer,
    threats: string[]
  ): Promise<void> {
    const quarantineDir = path.join(this.quarantinePath, componentId);
    await fs.mkdir(quarantineDir, { recursive: true });

    // Write file with .quarantine extension
    await fs.writeFile(
      path.join(quarantineDir, `${filename}.quarantine`),
      buffer
    );

    // Write threat report
    await fs.writeFile(
      path.join(quarantineDir, `${filename}.threats.json`),
      JSON.stringify({
        filename,
        threats,
        timestamp: new Date().toISOString(),
      }, null, 2)
    );

    console.log(`[SECURITY] Quarantined file: ${filename} for component ${componentId}. Threats: ${threats.join(', ')}`);
  }

  /**
   * Validate component permissions
   */
  private validatePermissions(manifest: ComponentManifest): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (manifest.permissions) {
      for (const permission of manifest.permissions) {
        if (DANGEROUS_PERMISSIONS.some(dp => permission.includes(dp))) {
          issues.push(`Dangerous permission requested: ${permission}`);
        }
      }
    }

    // Check for suspicious endpoints
    if (manifest.endpoints) {
      for (const endpoint of manifest.endpoints) {
        if (endpoint.path.includes('..') || endpoint.path.includes('$')) {
          issues.push(`Suspicious endpoint path: ${endpoint.path}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Create default manifest
   */
  private async createDefaultManifest(
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    id: string,
    files: string[]
  ): Promise<ComponentManifest> {
    const entryFile = files.find(f =>
      f === 'index.js' || f === 'index.ts' || f === 'main.js' || f === 'main.ts'
    ) || files.find(f => f.endsWith('.js') || f.endsWith('.ts')) || 'index.js';

    return {
      name: `${type}-${id.substring(0, 8)}`,
      version: '1.0.0',
      description: `Uploaded ${type}`,
      entry: entryFile,
      config: {},
    };
  }

  /**
   * Validate component structure
   */
  private async validateComponent(
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    componentPath: string,
    manifest: ComponentManifest
  ): Promise<boolean> {
    // Check entry file exists
    const entryPath = path.join(componentPath, manifest.entry);
    try {
      await fs.access(entryPath);
    } catch {
      return false;
    }

    // Type-specific validation
    switch (type) {
      case 'agent':
        return this.validateAgentComponent(manifest);
      case 'mcp':
        return this.validateMCPComponent(manifest);
      case 'cli':
        return this.validateCLIComponent(manifest);
      case 'skill':
        return this.validateSkillComponent(manifest);
      default:
        return false;
    }
  }

  private async validateAgentComponent(manifest: ComponentManifest): Promise<boolean> {
    return !!(
      (manifest.tools && manifest.tools.length > 0) ||
      (manifest.endpoints && manifest.endpoints.length > 0) ||
      (manifest.config && Object.keys(manifest.config).length > 0)
    );
  }

  private async validateMCPComponent(manifest: ComponentManifest): Promise<boolean> {
    return manifest.tools !== undefined && manifest.tools.length > 0;
  }

  private async validateCLIComponent(manifest: ComponentManifest): Promise<boolean> {
    return manifest.entry !== undefined;
  }

  private async validateSkillComponent(manifest: ComponentManifest): Promise<boolean> {
    return manifest.description !== undefined;
  }

  /**
   * Save component record
   */
  private async saveComponentRecord(
    id: string,
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    componentPath: string,
    manifest: ComponentManifest,
    validated: boolean,
    warnings: string[]
  ): Promise<void> {
    const recordPath = path.join(componentPath, '.component.json');
    await fs.writeFile(recordPath, JSON.stringify({
      id,
      type,
      path: componentPath,
      manifest,
      validated,
      warnings,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: this.generateChecksum(manifest),
    }, null, 2));
  }

  /**
   * Generate checksum for integrity
   */
  private generateChecksum(manifest: ComponentManifest): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(manifest))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * List uploaded components
   */
  async listComponents(type?: 'agent' | 'mcp' | 'cli' | 'skill'): Promise<UploadedComponent[]> {
    const components: UploadedComponent[] = [];
    const types = type ? [type] : ['agent', 'mcp', 'cli', 'skill'] as const;

    for (const t of types) {
      const typePath = path.join(this.basePath, `${t}s`);
      try {
        const dirs = await fs.readdir(typePath);
        for (const dir of dirs) {
          const componentPath = path.join(typePath, dir);
          const recordPath = path.join(componentPath, '.component.json');
          try {
            const record = JSON.parse(await fs.readFile(recordPath, 'utf-8'));
            components.push(record);
          } catch {
            // Skip invalid components
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return components;
  }

  /**
   * Get component by ID
   */
  async getComponent(id: string): Promise<UploadedComponent | null> {
    const components = await this.listComponents();
    return components.find(c => c.id === id) || null;
  }

  /**
   * Delete component
   */
  async deleteComponent(id: string): Promise<boolean> {
    const component = await this.getComponent(id);
    if (!component) return false;

    // Verify path is within base directory
    const resolvedPath = path.resolve(component.path);
    const resolvedBase = path.resolve(this.basePath);
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Invalid component path');
    }

    await fs.rm(component.path, { recursive: true, force: true });
    return true;
  }

  /**
   * Toggle component enabled status
   */
  async toggleComponent(id: string, enabled: boolean): Promise<UploadedComponent | null> {
    const component = await this.getComponent(id);
    if (!component) return null;

    component.enabled = enabled;
    component.updatedAt = new Date();

    const recordPath = path.join(component.path, '.component.json');
    await fs.writeFile(recordPath, JSON.stringify(component, null, 2));

    return component;
  }

  /**
   * Log upload
   */
  private logUpload(id: string, type: string, fileCount: number, warnings: string[]): void {
    this.uploadLog.push({
      id,
      type,
      timestamp: new Date(),
      files: fileCount,
      warnings,
    });

    // Keep only last 100 entries
    if (this.uploadLog.length > 100) {
      this.uploadLog.shift();
    }

    console.log(`[UPLOAD] ${type} ${id}: ${fileCount} files, ${warnings.length} warnings`);
  }

  /**
   * Get upload log
   */
  getUploadLog(limit: number = 50): Array<{ id: string; type: string; timestamp: Date; files: number; warnings: string[] }> {
    return this.uploadLog.slice(-limit);
  }
}

// ============================================
// Singleton Export
// ============================================

export const secureUploadService = new SecureUploadService();
