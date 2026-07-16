export const jwtConstants = {
  secret: (() => {
    const s = process.env.JWT_SECRET;
    if (!s) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return s;
  })(),
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
};
