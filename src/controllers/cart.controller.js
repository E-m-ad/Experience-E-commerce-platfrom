const CartService = require("../services/cart.service");

exports.getCart = async (req, res, next) => {
  try {
    const cart = await CartService.getOrCreate(req.user.id);
    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    const cart = await CartService.addItem(req.user.id, {
      productId,
      variantId,
      quantity,
    });
    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const cart = await CartService.updateItem(
      req.user.id,
      req.params.id,
      quantity,
    );
    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
};

exports.removeItem = async (req, res, next) => {
  try {
    const cart = await CartService.removeItem(req.user.id, req.params.id);
    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    await CartService.clear(req.user.id);
    res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    next(err);
  }
};

exports.getAdminCarts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, active = "true" } = req.query;
    const data = await CartService.findAllForAdmin({
      page: +page,
      limit: +limit,
      onlyActive: active !== "false",
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};
