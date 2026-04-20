/**
 * File upload handler utility
 * Extracted from index.ts to eliminate code duplication
 * Handles file path, URL, and base64 uploads with validation
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { validateFile, sanitizeFilename, validateFileSize, } from "../security/file-validator.js";
import { validateFilename, validateUrl } from "../security/input-validator.js";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_BASE64_SIZE = 50 * 1024 * 1024; // 50MB
const URL_DOWNLOAD_TIMEOUT = 30000; // 30 seconds
/**
 * Handles file upload from various sources (path, URL, base64)
 */
export async function handleFileUpload(filePath, fileUrl, fileBase64, providedFilename) {
    let fileBuffer;
    let finalFilename;
    // Option 1: Local file path
    if (filePath) {
        // Validate file path (prevents path traversal)
        const resolvedPath = path.resolve(path.normalize(filePath));
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File not found: ${resolvedPath}`);
        }
        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${resolvedPath}`);
        }
        // Validate file size before reading
        validateFileSize(stats.size, MAX_FILE_SIZE);
        fileBuffer = fs.readFileSync(resolvedPath);
        finalFilename = providedFilename || path.basename(resolvedPath);
        // Validate the file
        validateFile(resolvedPath, fileBuffer, {
            maxSizeBytes: MAX_FILE_SIZE,
        });
    }
    // Option 2: URL download
    else if (fileUrl) {
        validateUrl(fileUrl, "fileUrl");
        const response = await axios.get(fileUrl, {
            responseType: "arraybuffer",
            timeout: URL_DOWNLOAD_TIMEOUT,
            maxContentLength: MAX_FILE_SIZE,
        });
        fileBuffer = Buffer.from(response.data);
        validateFileSize(fileBuffer.length, MAX_FILE_SIZE);
        // Extract filename from URL or use provided
        finalFilename =
            providedFilename ||
                fileUrl.split("/").pop()?.split("?")[0] ||
                "audio.mp3";
    }
    // Option 3: Base64 encoded
    else if (fileBase64) {
        if (!providedFilename) {
            throw new Error("filename is required when using fileBase64");
        }
        // Handle data URL format: data:audio/mp3;base64,xxxx
        const base64Data = fileBase64.includes(",")
            ? fileBase64.split(",")[1]
            : fileBase64;
        // Validate base64 size (before decoding)
        const estimatedSize = (base64Data.length * 3) / 4;
        if (estimatedSize > MAX_BASE64_SIZE) {
            throw new Error(`Base64 data too large: estimated ${(estimatedSize / (1024 * 1024)).toFixed(2)}MB exceeds maximum of ${(MAX_BASE64_SIZE / (1024 * 1024)).toFixed(2)}MB`);
        }
        try {
            fileBuffer = Buffer.from(base64Data, "base64");
        }
        catch (error) {
            throw new Error(`Invalid base64 data: ${error instanceof Error ? error.message : "unknown error"}`);
        }
        validateFileSize(fileBuffer.length, MAX_FILE_SIZE);
        validateFilename(providedFilename);
        finalFilename = sanitizeFilename(providedFilename);
    }
    // No input provided
    else {
        throw new Error("You must provide one of: filePath, fileUrl, or fileBase64");
    }
    // Final validation
    validateFilename(finalFilename);
    return {
        fileBuffer,
        filename: finalFilename,
    };
}
