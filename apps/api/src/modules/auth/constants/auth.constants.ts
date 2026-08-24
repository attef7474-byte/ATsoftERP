export const jwtConstants = {
  secret: (() => {
    const s = process.env.JWT_SECRET;
    if (!s) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (process.env.NODE_ENV === 'production' && s.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters in production. Current length: ' + s.length,
      );
    }
    return s;
  })(),
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
};
