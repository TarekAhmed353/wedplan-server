export function checkNotBlocked(req, res, next) {
  if (req.user?.isBlocked) {
    return res.status(403).json({
      message: "Your account is blocked. Please contact support",
      code: "ACCOUNT_BLOCKED",
    });
  }

  next();
}

export function verifyRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        message: "You do not have permission to do this",
        code: "FORBIDDEN_ROLE",
      });
    }

    next();
  };
}

export function requireRoleChosen(req, res, next) {
  if (req.user && !req.user.roleChosen) {
    return res.status(403).json({
      message: "Please choose your role first",
      code: "ROLE_NOT_CHOSEN",
    });
  }

  next();
}
