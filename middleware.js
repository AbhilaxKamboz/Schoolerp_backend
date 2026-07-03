const jwt = require("jsonwebtoken");
const { User } = require("./models");

const roleAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {

      const authHeader = req.headers.authorization;

      if (
        !authHeader ||
        !authHeader.startsWith("Bearer ")
      ) {
        return res.status(401).json({
          message: "No token provided",
        });
      }

      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      // Fetch complete user from DB
      const user = await User.findById(
        decoded.id
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      // Role check
      if (
        allowedRoles.length &&
        !allowedRoles.includes(user.role)
      ) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      req.user = user;

      next();

    } catch (error) {

      console.log(error);

      return res.status(401).json({
        message: "Invalid token",
      });

    }
  };
};

module.exports = { roleAuth };