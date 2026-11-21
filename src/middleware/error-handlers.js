export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }

  const status = error.status || error.statusCode || 500;

  if (status >= 500) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Something went wrong on the server" });
  }

  res.status(status).json({ message: error.message });
}
