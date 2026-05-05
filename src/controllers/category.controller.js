const CategoryService = require("../services/category.service");

exports.getAll = async (req, res, next) => {
  try {
    const categories = await CategoryService.findAll();
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

exports.getTree = async (req, res, next) => {
  try {
    const tree = await CategoryService.findTree();
    res.json({ success: true, tree });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const category = await CategoryService.findBySlug(req.params.slug);
    if (!category)
      return res.status(404).json({ message: "Category not found" });
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const category = await CategoryService.create(req.body, req.file);
    res.status(201).json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const category = await CategoryService.update(
      req.params.id,
      req.body,
      req.file,
    );
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await CategoryService.remove(req.params.id);
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    next(err);
  }
};
