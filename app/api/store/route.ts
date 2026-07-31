import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STORE_FILE = path.join(process.cwd(), "temp", "shared_store.json");

export async function GET() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
  } catch (e) {
    console.error("Failed to read store file", e);
  }
  return NextResponse.json(null);
}

export async function POST(request: Request) {
  try {
    const storeData = await request.json();
    // Ensure directory exists
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(storeData, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to write store file", e);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
