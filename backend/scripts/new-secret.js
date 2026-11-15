// Prints a strong random value for JWT_SECRET or BOARD_ACCESS_KEY in backend/.env.
console.log(require("crypto").randomBytes(48).toString("base64url"));
