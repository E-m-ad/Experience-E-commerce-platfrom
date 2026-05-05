const ProductService = require("../services/product.service");

exports.getAll = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      sort,
      q,
    } = req.query;

    const data = await ProductService.findAll({
      page: +page,
      limit: +limit,
      category,
      brand,
      minPrice,
      maxPrice,
      sort,
      q,
    });

    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.getFeatured = async (req, res, next) => {
  try {
    const products = await ProductService.findFeatured();
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { q, limit = 8 } = req.query;
    if (!q) return res.json({ success: true, products: [] });

    const products = await ProductService.search(q, +limit);
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
};

exports.getBrands = async (req, res, next) => {
  try {
    const brands = await ProductService.getDistinctBrands();
    res.json({ success: true, brands });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const product = await ProductService.findBySlug(req.params.slug);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.getAdminAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, status, q } = req.query;
    const data = await ProductService.findAllForAdmin({
      page: +page,
      limit: +limit,
      status,
      q,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.getAdminOne = async (req, res, next) => {
  try {
    const product = await ProductService.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const product = await ProductService.create(req.body, req.files);
    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const product = await ProductService.update(
      req.params.id,
      req.body,
      req.files,
    );
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.toggleActive = async (req, res, next) => {
  try {
    const product = await ProductService.toggleActive(req.params.id);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await ProductService.remove(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    next(err);
  }
};
