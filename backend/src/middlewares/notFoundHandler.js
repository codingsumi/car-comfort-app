function notFoundHandler(_req, res) {
  return res.fail('Route not found', 404, undefined, 'not_found');
}

module.exports = { notFoundHandler };

