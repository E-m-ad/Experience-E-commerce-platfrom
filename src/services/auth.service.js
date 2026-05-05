const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────

const SALT_ROUNDS = 12;

// Fields we never return to the client
const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  createdAt: true,
  addresses: true,
};

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

const tokenPayload = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

// ── In-memory refresh token store ───────────────────────────
// For production, replace this with a Redis set or a
// RefreshToken table in Postgres.
const refreshTokenStore = new Set();

// ── Service methods ─────────────────────────────────────────

exports.register = async ({ firstName, lastName, email, password, phone }) => {
  // ── Validate ───────────────────────────────────────────
  if (!firstName || !lastName || !email || !password) {
    const err = new Error(
      "firstName, lastName, email and password are required",
    );
    err.statusCode = 400;
    throw err;
  }

  if (password.length < 8) {
    const err = new Error("Password must be at least 8 characters");
    err.statusCode = 400;
    throw err;
  }

  // ── Check duplicate ────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("An account with this email already exists");
    err.statusCode = 409;
    throw err;
  }

  // ── Hash & create ──────────────────────────────────────
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  const shouldBootstrapAdmin =
    adminCount === 0 && process.env.DISABLE_ADMIN_BOOTSTRAP !== "true";

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashed,
      phone: phone || null,
      role: shouldBootstrapAdmin ? "ADMIN" : "CUSTOMER",
    },
    select: safeUserSelect,
  });

  // ── Issue tokens ───────────────────────────────────────
  const accessToken = signAccess(tokenPayload(user));
  const refreshToken = signRefresh(tokenPayload(user));
  refreshTokenStore.add(refreshToken);

  return { user, accessToken, refreshToken };
};

exports.login = async (email, password) => {
  if (!email || !password) {
    const err = new Error("Email and password are required");
    err.statusCode = 400;
    throw err;
  }

  // fetch user WITH password for comparison
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  // strip password before returning
  const { password: _pw, ...safeUser } = user;

  const accessToken = signAccess(tokenPayload(safeUser));
  const refreshToken = signRefresh(tokenPayload(safeUser));
  refreshTokenStore.add(refreshToken);

  return { user: safeUser, accessToken, refreshToken };
};

exports.refresh = (refreshToken) => {
  if (!refreshToken) {
    const err = new Error("Refresh token is required");
    err.statusCode = 400;
    throw err;
  }

  if (!refreshTokenStore.has(refreshToken)) {
    const err = new Error("Refresh token is invalid or has been revoked");
    err.statusCode = 401;
    throw err;
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const accessToken = signAccess({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    return { accessToken };
  } catch {
    refreshTokenStore.delete(refreshToken);
    const err = new Error("Refresh token expired — please log in again");
    err.statusCode = 401;
    throw err;
  }
};

exports.logout = (refreshToken) => {
  if (refreshToken) refreshTokenStore.delete(refreshToken);
};

exports.findById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

exports.updateProfile = (id, { firstName, lastName, phone }) =>
  prisma.user.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
    },
    select: safeUserSelect,
  });

exports.changePassword = async (id, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    const err = new Error("Current password and new password are required");
    err.statusCode = 400;
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error("New password must be at least 8 characters");
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    const err = new Error("Current password is incorrect");
    err.statusCode = 401;
    throw err;
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
};

// ── Address management ───────────────────────────────────────

exports.getAddresses = (userId) =>
  prisma.address.findMany({
    where: { userId },
    orderBy: { isDefault: "desc" },
  });

exports.addAddress = async (userId, body) => {
  const { label, street, city, state, postalCode, country, isDefault } = body;

  // if this is marked default, unset any existing default first
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.address.create({
    data: {
      userId,
      label: label || "Home",
      street,
      city,
      state,
      postalCode,
      country: country || "EG",
      isDefault: isDefault || false,
    },
  });
};

exports.updateAddress = async (id, userId, body) => {
  // confirm ownership
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("Address not found");
    err.statusCode = 404;
    throw err;
  }

  // if promoting to default, demote others first
  if (body.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({ where: { id }, data: body });
};

exports.deleteAddress = async (id, userId) => {
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("Address not found");
    err.statusCode = 404;
    throw err;
  }
  return prisma.address.delete({ where: { id } });
};
