const OrderService = require("../services/order.service");

exports.create = async (req, res, next) => {
  try {
    const order = await OrderService.create(req.user.id, req.body);
    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const data = await OrderService.findByUser(req.user.id, +page, +limit);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.getMyOrder = async (req, res, next) => {
  try {
    const order = await OrderService.findByIdForUser(
      req.params.id,
      req.user.id,
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const order = await OrderService.cancel(req.params.id, req.user.id);
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ── Admin ───────────────────────────────────────────────────

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const data = await OrderService.findAll({
      page: +page,
      limit: +limit,
      status,
      paymentStatus,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const order = await OrderService.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await OrderService.updateStatus(req.params.id, status);
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

exports.updatePayment = async (req, res, next) => {
  try {
    const { paymentStatus, paymentMethod } = req.body;
    const order = await OrderService.updatePayment(
      req.params.id,
      paymentStatus,
      paymentMethod,
    );
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};
