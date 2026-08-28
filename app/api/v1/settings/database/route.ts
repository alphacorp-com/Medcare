import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/permissions';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// This is a full pg_dump of the entire shared database — every tenant's data in one
// file, regardless of who triggers it, because this platform uses one shared Postgres
// database with tenantId row-scoping, not a physically separate database per tenant.
// It was previously gated by requireTenantAdmin, meaning any customer's tenant admin
// could trigger and download a dump containing every OTHER tenant's data too — a
// critical cross-tenant data exposure. This is a platform operations tool, not a
// tenant self-service feature, so it's now restricted to MedCare super_admin only.
const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const permCheck = requireSuperAdmin(session);
        if (!permCheck.ok) {
            return NextResponse.json(
                { error: permCheck.error },
                { status: permCheck.status }
            );
        }

        // Create backups directory if it doesn't exist
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Generate backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `medcare_full_backup_${timestamp}.sql`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // Get database connection info from environment
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            return NextResponse.json(
                { error: 'Database configuration not found' },
                { status: 500 }
            );
        }

        // Parse database URL to extract connection details
        const url = new URL(dbUrl);
        const host = url.hostname;
        const port = url.port;
        const database = url.pathname.slice(1);
        const username = url.username;
        const password = url.password;

        // Create pg_dump command for the entire database
        const pgDumpCommand = `pg_dump --host=${host} --port=${port} --username=${username} --file=${backupPath} --format=custom --compress=9 --no-password ${database}`;

        // Set password environment variable
        const env = { ...process.env, PGPASSWORD: password };

        // Execute backup
        await execAsync(pgDumpCommand, { env });

        // Verify backup file was created
        await fs.access(backupPath);

        // Get file size
        const stats = await fs.stat(backupPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        // Log backup creation (you might want to store this in audit logs)
        console.log(`Database backup created: ${backupFileName} (${fileSizeMB} MB)`);

        return NextResponse.json({
            success: true,
            message: 'Database backup created successfully',
            backupFile: backupFileName,
            size: `${fileSizeMB} MB`,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Database backup error:', error);
        return NextResponse.json(
            { error: 'Failed to create database backup' },
            { status: 500 }
        );
    }
}

// GET endpoint to list existing backups
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const permCheck = requireSuperAdmin(session);
        if (!permCheck.ok) {
            return NextResponse.json(
                { error: permCheck.error },
                { status: permCheck.status }
            );
        }

        try {
            const files = await fs.readdir(BACKUP_DIR);
            const backupFiles = files
                .filter(file => file.endsWith('.sql'))
                .map(async file => {
                    const filePath = path.join(BACKUP_DIR, file);
                    const stats = await fs.stat(filePath);
                    return {
                        filename: file,
                        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                        createdAt: stats.mtime.toISOString(),
                        path: filePath
                    };
                });

            // Wait for all file stats to be resolved
            const resolvedBackupFiles = (await Promise.all(backupFiles))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return NextResponse.json({
                backups: resolvedBackupFiles
            });

        } catch (error) {
            // If directory doesn't exist, return empty array
            return NextResponse.json({
                backups: []
            });
        }

    } catch (error) {
        console.error('Error listing backups:', error);
        return NextResponse.json(
            { error: 'Failed to list database backups' },
            { status: 500 }
        );
    }
}

// Download specific backup file
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const permCheck = requireSuperAdmin(session);
        if (!permCheck.ok) {
            return NextResponse.json(
                { error: permCheck.error },
                { status: permCheck.status }
            );
        }

        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        const filePath = path.join(BACKUP_DIR, filename);

        // Security check: ensure the file is within the backup directory
        const resolvedPath = path.resolve(filePath);
        const resolvedBackupDir = path.resolve(BACKUP_DIR);

        if (!resolvedPath.startsWith(resolvedBackupDir)) {
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 400 }
            );
        }

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            return NextResponse.json(
                { error: 'Backup file not found' },
                { status: 404 }
            );
        }

        // Read file content
        const fileContent = await fs.readFile(filePath);

        // Return file as download
        return new NextResponse(fileContent, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': fileContent.length.toString(),
            },
        });

    } catch (error) {
        console.error('Error downloading backup:', error);
        return NextResponse.json(
            { error: 'Failed to download backup file' },
            { status: 500 }
        );
    }
}