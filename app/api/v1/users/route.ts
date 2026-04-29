import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const users = await prisma.tenantUser.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        modules: true,
        status: true, // We don't have status in DB, we have isActive. Wait, let's map it.
        isActive: true,
        lastLoginAt: true,
        departmentId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const mappedUsers = users.map(user => ({
      ...user,
      status: user.isActive ? 'active' : 'inactive',
      lastActive: user.lastLoginAt?.toISOString(),
    }));

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, fullName, role, modules, status } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingUser = await prisma.tenantUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Hash a default password for newly created users from the dashboard
    const defaultPassword = "password123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const newUser = await prisma.tenantUser.create({
      data: {
        email,
        fullName,
        role,
        modules: modules || [],
        passwordHash,
        isActive: status === 'active',
      },
    });

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      modules: newUser.modules,
      status: newUser.isActive ? 'active' : 'inactive',
      lastActive: newUser.lastLoginAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
