const AuthService = require("../services/auth.service");

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    const data = await AuthService.register({
      firstName,
      lastName,
      email,
      password,
      phone,
    });
    res.status(201).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const data = await AuthService.refresh(refreshToken);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await AuthService.logout(refreshToken);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await AuthService.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await AuthService.updateProfile(req.user.id, {
      firstName,
      lastName,
      phone,
    });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await AuthService.getAddresses(req.user.id);
    res.json({ success: true, addresses });
  } catch (err) {
    next(err);
  }
};

exports.addAddress = async (req, res, next) => {
  try {
    const address = await AuthService.addAddress(req.user.id, req.body);
    res.status(201).json({ success: true, address });
  } catch (err) {
    next(err);
  }
};

exports.updateAddress = async (req, res, next) => {
  try {
    const address = await AuthService.updateAddress(
      req.params.id,
      req.user.id,
      req.body,
    );
    res.json({ success: true, address });
  } catch (err) {
    next(err);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    await AuthService.deleteAddress(req.params.id, req.user.id);
    res.json({ success: true, message: "Address deleted" });
  } catch (err) {
    next(err);
  }
};
