/**
 * File validation utilities for security
 * Prevents path traversal, validates file sizes, MIME types, and extensions
 */

import path from "path";
import fs from "fs";

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  allowedDirs?: string[];
}

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".webm"];
const DEFAULT_ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/vorbis",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/webm",
];

/**
 * Validates and normalizes a file path, preventing path traversal attacks
 */
export function validateFilePath(
  filePath: string,
  allowedDirs?: string[]
): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path: path must be a non-empty string");
  }

  // Normalize the path to resolve .. and . segments
  const normalizedPath = path.normalize(filePath);
  const resolvedPath = path.resolve(normalizedPath);

  // Check for path traversal attempts
  if (normalizedPath.includes("..")) {
    throw new Error("Invalid file path: path traversal detected");
  }

  // If allowed directories are specified, verify the path is within them
  if (allowedDirs && allowedDirs.length > 0) {
    const isAllowed = allowedDirs.some((allowedDir) => {
      const resolvedAllowed = path.resolve(allowedDir);
      return resolvedPath.startsWith(resolvedAllowed);
    });

    if (!isAllowed) {
      throw new Error(
        `Invalid file path: path must be within allowed directories`
      );
    }
  }

  // Verify file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  // Verify it's a file, not a directory
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${resolvedPath}`);
  }

  return resolvedPath;
}

/**
 * Validates file size against maximum allowed size
 */
export function validateFileSize(size: number, maxSize: number = DEFAULT_MAX_SIZE): void {
  if (typeof size !== "number" || size < 0) {
    throw new Error("Invalid file size: must be a non-negative number");
  }

  if (size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File too large: ${actualSizeMB}MB exceeds maximum of ${maxSizeMB}MB`
    );
  }
}

/**
 * Validates file extension against allowed list
 */
export function validateFileExtension(
  filename: string,
  allowedExtensions: string[] = DEFAULT_ALLOWED_EXTENSIONS
): void {
  if (!filename || typeof filename !== "string") {
    throw new Error("Invalid filename: must be a non-empty string");
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ext) {
    throw new Error("Invalid filename: no file extension found");
  }

  if (!allowedExtensions.includes(ext)) {
    throw new Error(
      `Invalid file extension: ${ext}. Allowed extensions: ${allowedExtensions.join(", ")}`
    );
  }
}

/**
 * Validates MIME type by checking file buffer signature (magic numbers)
 * Falls back to extension-based validation if magic number detection fails
 */
export function validateMimeType(
  buffer: Buffer,
  filename: string,
  allowedTypes: string[] = DEFAULT_ALLOWED_MIME_TYPES
): void {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid buffer: must be a non-empty Buffer");
  }

  // Check magic numbers for common audio formats
  const magicNumbers: Record<string, number[][]> = {
    "audio/mpeg": [[0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]], // MP3
    "audio/wav": [[0x52, 0x49, 0x46, 0x46]], // WAV (RIFF)
    "audio/mp4": [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // MP4/M4A
    "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]], // OGG
    "audio/flac": [[0x66, 0x4c, 0x61, 0x43]], // FLAC
  };

  let detectedType: string | null = null;

  // Try to detect MIME type from magic numbers
  for (const [mimeType, signatures] of Object.entries(magicNumbers)) {
    for (const signature of signatures) {
      if (buffer.length >= signature.length) {
        const matches = signature.every(
          (byte, index) => buffer[index] === byte
        );
        if (matches) {
          detectedType = mimeType;
          break;
        }
      }
    }
    if (detectedType) break;
  }

  // Fallback to extension-based validation
  if (!detectedType && filename) {
    const ext = path.extname(filename).toLowerCase();
    const extensionMap: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".aac": "audio/aac",
      ".webm": "audio/webm",
    };
    detectedType = extensionMap[ext] || null;
  }

  // Validate against allowed types
  if (!detectedType || !allowedTypes.includes(detectedType)) {
    throw new Error(
      `Invalid file type: ${detectedType || "unknown"}. Allowed types: ${allowedTypes.join(", ")}`
    );
  }
}

/**
 * Sanitizes a filename by removing dangerous characters and path components
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "unnamed_file";
  }

  // Remove path components
  let sanitized = path.basename(filename);

  // Remove or replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, "_");

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");

  // Ensure it's not empty
  if (!sanitized) {
    sanitized = "unnamed_file";
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Comprehensive file validation combining all checks
 */
export function validateFile(
  filePath: string,
  fileBuffer: Buffer,
  options: FileValidationOptions = {}
): {
  resolvedPath: string;
  sanitizedFilename: string;
  size: number;
  mimeType: string;
} {
  const {
    maxSizeBytes = DEFAULT_MAX_SIZE,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES,
    allowedDirs,
  } = options;

  // Validate and resolve file path
  const resolvedPath = validateFilePath(filePath, allowedDirs);

  // Get filename
  const filename = path.basename(resolvedPath);
  const sanitizedFilename = sanitizeFilename(filename);

  // Validate file size
  validateFileSize(fileBuffer.length, maxSizeBytes);

  // Validate extension
  validateFileExtension(sanitizedFilename, allowedExtensions);

  // Validate MIME type
  validateMimeType(fileBuffer, sanitizedFilename, allowedMimeTypes);

  return {
    resolvedPath,
    sanitizedFilename,
    size: fileBuffer.length,
    mimeType: "audio", // Simplified, actual detection done in validateMimeType
  };
}
