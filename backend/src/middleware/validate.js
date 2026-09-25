export function validate({ body, params, query }) {
  return async function validationMiddleware(req, _res, next) {
    try {
      if (body) req.body = await body.parseAsync(req.body);
      if (params) req.params = await params.parseAsync(req.params);
      if (query) req.query = await query.parseAsync(req.query);
      next();
    } catch (error) {
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
      next(error);
    }
  };
}
