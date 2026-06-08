import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please add it to your .env or .env.local file."
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Hash passwords using bcryptjs with 12 rounds
  const passwordHash = await bcrypt.hash("password123", 12);

  console.log("Cleaning database...");
  await prisma.courseEnrollment.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.userAuthenticator.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.classroom.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Creating users...");
  const faculty = await prisma.user.create({
    data: {
      email: "faculty@demo.edu",
      fullName: "Demo Faculty Member",
      passwordHash,
      role: "FACULTY",
    },
  });

  const student = await prisma.user.create({
    data: {
      email: "student@demo.edu",
      fullName: "Demo Student",
      passwordHash,
      role: "STUDENT",
      studentRegNumber: "STU001",
    },
  });

  console.log("Creating classroom...");
  const classroom = await prisma.classroom.create({
    data: {
      name: "Demo Hall L-202",
      building: "Main Block",
      latitude: 12.9716, // Default latitude
      longitude: 77.5946, // Default longitude
      radiusMeters: 20,
    },
  });

  console.log("Creating course...");
  const course = await prisma.course.create({
    data: {
      courseCode: "CS-101",
      courseName: "Intro to Computer Science",
      facultyId: faculty.id,
      semester: "Fall 2026",
    },
  });

  console.log("Enrolling student...");
  await prisma.courseEnrollment.create({
    data: {
      courseId: course.id,
      studentId: student.id,
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
