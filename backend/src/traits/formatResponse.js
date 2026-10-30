function formatResponse(_req, res, next) {
  const normalizeSuccessData = (data) => {
    if (
      data === undefined ||
      data === null
    ) {
      return null;
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === "object") {
      return data;
    }

    return data;
  };

  res.success = (
    message,
    data = null,
    statusCode = 200
  ) => {
    return res.status(statusCode).json({
      status: "success",
      message,
      error_type: null,
      data: normalizeSuccessData(data),
    });
  };

  res.fail = (
    message,
    statusCode = 400,
    data = null,
    errorType = "error"
  ) => {
    return res.status(statusCode).json({
      status: "error",
      message,
      error_type: errorType,
      data: data || null,
    });
  };

  next();
}

module.exports = {
  formatResponse,
};