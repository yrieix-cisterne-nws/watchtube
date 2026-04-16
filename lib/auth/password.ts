import bcrypt from "bcryptjs";

const DEFAULT_COST = 12;

function getCost(): number {
  const raw = process.env.BCRYPT_COST;
  if (!raw) return DEFAULT_COST;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 8 || parsed > 15) {
    throw new Error("BCRYPT_COST must be an integer between 8 and 15");
  }

  return parsed;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const salt = await bcrypt.genSalt(getCost());
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(input: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return await bcrypt.compare(input.password, input.hash);
}
