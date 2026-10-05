import type { RequestHandler } from 'express';
import { adminAuth } from '../services/firebaseAdmin';
export const authenticate: RequestHandler = async (request, response, next) => {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Entre na sua conta para continuar.' });
    return;
  }
  try {
    const token = await adminAuth.verifyIdToken(header.slice(7), true);
    if (token.firebase.sign_in_provider !== 'password') {
      response.status(403).json({ error: 'Use uma conta de e-mail e senha.' });
      return;
    }
    response.locals.uid = token.uid;
    next();
  } catch {
    response.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
  }
};
