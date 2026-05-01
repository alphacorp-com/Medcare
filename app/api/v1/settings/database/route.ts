import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== 'tenant_admin') {
            return NextResponse.json(
                { error: 'Unauthorized - Tenant admin access required' },
                { status: 403 }
            );
        }

        if (!session.user.tenantId) {
            return NextResponse.json(
                { error: 'Tenant ID not found in session' },
                { status: 400 }
            );
        }

        // Get tenant info
        const tenant = await prisma.tenant.findUnique({
            where: { id: session.user.tenantId },
            select: { name: true }
        });

        if (!tenant) {
            return NextResponse.json(
                { error: 'Tenant not found' },
                { status: 404 }
            );
        }

        // Create backups directory if it doesn't exist
        const backupDir = path.join(process.cwd(), 'backups');
        await fs.mkdir(backupDir, { recursive: true });

        // Generate backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${tenant.name.replace(/\s+/g, '_')}_backup_${timestamp}.sql`;
        const backupPath = path.join(backupDir, backupFileName);

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

        if (!session || session.user.role !== 'tenant_admin') {
            return NextResponse.json(
                { error: 'Unauthorized - Tenant admin access required' },
                { status: 403 }
            );
        }

        const backupDir = path.join(process.cwd(), 'backups');

        try {
            const files = await fs.readdir(backupDir);
            const backupFiles = files
                .filter(file => file.endsWith('.sql'))
                .map(async file => {
                    const filePath = path.join(backupDir, file);
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

        if (!session || session.user.role !== 'tenant_admin') {
            return NextResponse.json(
                { error: 'Unauthorized - Tenant admin access required' },
                { status: 403 }
            );
        }

        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        const backupDir = path.join('/home/pliya/Desktop', 'Medcare_Backups');
        const filePath = path.join(backupDir, filename);

        // Security check: ensure the file is within the backup directory
        const resolvedPath = path.resolve(filePath);
        const resolvedBackupDir = path.resolve(backupDir);

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