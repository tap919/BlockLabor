/**
 * Folder Upload Service
 * Handles uploading and management of agents, MCPs, CLIs, and skills
 * Supports full folder structure uploads with validation
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
  config?: Record<string, any>;
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
  parameters: Record<string, any>;
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
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Upload Service Class
// ============================================

export class UploadService {
  private basePath: string;
  private allowedExtensions: Set<string>;
  private maxFileSize: number;
  private maxFolderSize: number;

  constructor() {
    this.basePath = '/home/z/my-project/uploads';
    this.allowedExtensions = new Set([
      '.js', '.ts', '.json', '.md', '.yaml', '.yml', '.txt',
      '.py', '.sh', '.env.example', '.config', '.schema',
    ]);
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFolderSize = 100 * 1024 * 1024; // 100MB
  }

  /**
   * Process uploaded folder
   */
  async processFolderUpload(
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    files: UploadedFile[]
  ): Promise<UploadResult> {
    const componentId = uuidv4();
    const componentPath = path.join(this.basePath, `${type}s`, componentId);

    // Create directory
    await fs.mkdir(componentPath, { recursive: true });

    const writtenFiles: string[] = [];
    let manifest: ComponentManifest | null = null;
    let totalSize = 0;

    try {
      // Process each file
      for (const file of files) {
        // Validate file
        const validation = this.validateFile(file);
        if (!validation.valid) {
          throw new Error(`Invalid file ${file.originalname}: ${validation.error}`);
        }

        totalSize += file.size;
        if (totalSize > this.maxFolderSize) {
          throw new Error('Total folder size exceeds limit');
        }

        // Extract relative path from fieldname or originalname
        const relativePath = this.extractRelativePath(file.originalname, type);
        const fullPath = path.join(componentPath, relativePath);

        // Create subdirectories if needed
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Write file
        await fs.writeFile(fullPath, file.buffer);
        writtenFiles.push(relativePath);

        // Check for manifest
        if (file.originalname.endsWith('manifest.json') || file.originalname.endsWith('package.json')) {
          manifest = JSON.parse(file.buffer.toString());
        }
      }

      // Validate manifest
      if (!manifest) {
        manifest = await this.createDefaultManifest(type, componentId, writtenFiles);
      }

      // Validate component structure
      const validated = await this.validateComponent(type, componentPath, manifest);

      // Save to database
      await this.saveComponentToDatabase(componentId, type, componentPath, manifest, validated);

      return {
        id: componentId,
        type,
        name: manifest.name,
        version: manifest.version,
        path: componentPath,
        files: writtenFiles,
        manifest,
        validated,
        createdAt: new Date(),
      };

    } catch (error) {
      // Cleanup on failure
      await fs.rm(componentPath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: UploadedFile): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.maxFileSize) {
      return { valid: false, error: 'File size exceeds limit' };
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.has(ext) && !file.originalname.startsWith('.')) {
      return { valid: false, error: `File extension ${ext} is not allowed` };
    }

    // Check for dangerous patterns
    const content = file.buffer.toString();
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /require\s*\(\s*['"]child_process['"]\s*\)/gi,
      /exec\s*\(/gi,
      /spawn\s*\(/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { valid: false, error: 'File contains potentially dangerous code' };
      }
    }

    return { valid: true };
  }

  /**
   * Extract relative path from filename
   */
  private extractRelativePath(filename: string, type: string): string {
    // Remove type prefix if present
    const cleanName = filename.replace(new RegExp(`^${type}[-_/]?`, 'i'), '');
    return cleanName;
  }

  /**
   * Create default manifest for components without one
   */
  private async createDefaultManifest(
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    id: string,
    files: string[]
  ): Promise<ComponentManifest> {
    const entryFile = files.find(f => 
      f === 'index.js' || f === 'index.ts' || f === 'main.js' || f === 'main.ts'
    ) || files[0] || 'index.js';

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
      // Entry file doesn't exist
      return false;
    }

    // Type-specific validation
    switch (type) {
      case 'agent':
        return this.validateAgentComponent(componentPath, manifest);
      case 'mcp':
        return this.validateMCPComponent(componentPath, manifest);
      case 'cli':
        return this.validateCLIComponent(componentPath, manifest);
      case 'skill':
        return this.validateSkillComponent(componentPath, manifest);
      default:
        return false;
    }
  }

  /**
   * Validate agent component
   */
  private async validateAgentComponent(path: string, manifest: ComponentManifest): Promise<boolean> {
    // Agents should have tools or endpoints defined
    return !!((manifest.tools && manifest.tools.length > 0) ||
           (manifest.endpoints && manifest.endpoints.length > 0) ||
           (manifest.config && Object.keys(manifest.config).length > 0));
  }

  /**
   * Validate MCP component
   */
  private async validateMCPComponent(path: string, manifest: ComponentManifest): Promise<boolean> {
    // MCPs should define tools
    return manifest.tools !== undefined && manifest.tools.length > 0;
  }

  /**
   * Validate CLI component
   */
  private async validateCLIComponent(path: string, manifest: ComponentManifest): Promise<boolean> {
    // CLIs should have an entry point
    return manifest.entry !== undefined;
  }

  /**
   * Validate skill component
   */
  private async validateSkillComponent(path: string, manifest: ComponentManifest): Promise<boolean> {
    // Skills should have description and config schema
    return manifest.description !== undefined;
  }

  /**
   * Save component to database
   */
  private async saveComponentToDatabase(
    id: string,
    type: 'agent' | 'mcp' | 'cli' | 'skill',
    componentPath: string,
    manifest: ComponentManifest,
    validated: boolean
  ): Promise<void> {
    // This would save to a UploadedComponent table
    // For now, we'll create a JSON record
    const recordPath = path.join(componentPath, '.component.json');
    await fs.writeFile(recordPath, JSON.stringify({
      id,
      type,
      path: componentPath,
      manifest,
      validated,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, null, 2));
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
   * Validate component permissions
   */
  validatePermissions(manifest: ComponentManifest): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const dangerousPermissions = [
      'file:read:all',
      'file:write:all',
      'network:unrestricted',
      'system:exec',
      'database:admin',
    ];

    if (manifest.permissions) {
      for (const permission of manifest.permissions) {
        if (dangerousPermissions.some(dp => permission.includes(dp))) {
          issues.push(`Dangerous permission: ${permission}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const uploadService = new UploadService();
